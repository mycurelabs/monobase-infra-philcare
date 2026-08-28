# Deployment Guide

How deployments happen in Monobase Infrastructure.

Everything is GitOps. ArgoCD watches this repo and reconciles the cluster to
match it. You deploy by editing a file under `values/`, committing, and pushing
— ArgoCD auto-syncs. There is no manual `helm install` or `kubectl apply` step
for application or infrastructure workloads.

## Table of Contents

1. [Mental Model](#mental-model)
2. [Where Everything Lives](#where-everything-lives)
3. [One-Time Bootstrap](#one-time-bootstrap)
4. [Deploying a Change](#deploying-a-change)
5. [Verification](#verification)
6. [DNS Configuration](#dns-configuration)
7. [Rollback](#rollback)
8. [Related Docs](#related-docs)

---

## Mental Model

- **Everything deployable is a Helm chart** under `charts/`.
- **All configuration lives in `values/`.**
- **ArgoCD is the only deployer.** A root App-of-Apps plus an auto-discover
  ApplicationSet turn files in `values/` into running workloads. See
  [../architecture/GITOPS-ARGOCD.md](../architecture/GITOPS-ARGOCD.md).
- **The cluster itself is OpenTofu-managed** from
  `values/clusters/<cluster>/terraform/`
  (`mise run cluster-plan <cluster>` / `cluster-apply <cluster>`). See
  [CLUSTER-PROVISIONING.md](CLUSTER-PROVISIONING.md).

The only imperative step in the entire lifecycle is the one-time bootstrap that
installs ArgoCD and points it at the repo. After that, Git is the interface.

---

## Where Everything Lives

### Charts (`charts/`)

| Chart | Purpose |
|-------|---------|
| `charts/app` | Generic frontend/service chart — every clinic app, dashboard, myaccount, etc. is an instance of this |
| `charts/hapihub` | HapiHub API (PostgreSQL-backed) |
| `charts/cadence` | Cadence sync service |
| `charts/nginx-gateway` | NGINX Gateway Fabric install |
| `charts/security-baseline` | Namespace-level PSA, NetworkPolicies, RBAC |
| `charts/velero-resources` | Backup schedules and storage locations |
| `charts/monitoring-resources` | Prometheus rules, dashboards, alert routes |
| `charts/argocd-bootstrap` | Root App-of-Apps + auto-discover ApplicationSet |
| `charts/argocd-applications` | Per-deployment Application factory + dedicated templates |
| `charts/argocd-infrastructure` | Cluster-wide infrastructure Applications (gateway, cert-manager, ESO, monitoring, velero, …) |

### Configuration (`values/`)

| Path | Purpose |
|------|---------|
| `values/deployments/<client>-<env>.yaml` | Per-deployment flat file (e.g. `values/deployments/<client>-production.yaml`, `values/deployments/<client>-staging.yaml`), each with `extends: base` |
| `values/deployments/base.yaml` | Shared neutral parent (`disabled: "true"`, never deploys) that every deployment `extends` |
| `values/clusters/<cluster>/argocd/infrastructure.yaml` | Cluster-wide infrastructure config (gateway, cert-manager, ESO, monitoring, velero) + secrets registry |
| `values/clusters/<cluster>/argocd/` | Other cluster-scoped ArgoCD config (`argocd.yaml`, `external-dns.yaml`, `secrets.yaml`) |
| `values/clusters/<cluster>/terraform/` | OpenTofu root for the cluster |

An overlay is a thin file: it sets image tags, replica counts, domains,
resource requests, and which components are enabled. The base carries
everything common. To add a whole new deployment, see
[CLIENT-ONBOARDING.md](CLIENT-ONBOARDING.md).

---

## One-Time Bootstrap

Run once against a freshly-provisioned cluster. This is the single imperative
step — it installs ArgoCD, the root App-of-Apps, and the auto-discover
ApplicationSet. From then on ArgoCD deploys everything else (gateway,
cert-manager, External Secrets Operator, monitoring, velero, and all app
workloads) straight from the repo.

```bash
mise run bootstrap
```

Prerequisites:

- Cluster provisioned and `kubectl` context pointed at it
  (`mise run cluster-apply <cluster>`).
  See [CLUSTER-PROVISIONING.md](CLUSTER-PROVISIONING.md) and
  [INFRASTRUCTURE-REQUIREMENTS.md](INFRASTRUCTURE-REQUIREMENTS.md).
- Secrets present in GCP Secret Manager (External Secrets Operator syncs them
  in; never commit secrets).

Operational scripts are TypeScript run via bun through mise tasks — there are no
`*.sh` scripts to invoke by hand.

After bootstrap, retrieve the ArgoCD admin password:

```bash
kubectl -n argocd get secret argocd-initial-admin-secret \
  -o jsonpath="{.data.password}" | base64 -d
```

---

## Deploying a Change

The entire day-to-day workflow:

```bash
# 1. Edit the relevant file under values/
$EDITOR values/deployments/<client>-production.yaml   # e.g. bump an image tag

# 2. Validate locally
mise run lint
mise run validate

# 3. Commit and push
git add values/deployments/<client>-production.yaml
git commit -m "chore(prod): bump app image to X.Y.Z"
git push
```

ArgoCD detects the commit and auto-syncs. Watch it land:

```bash
# In the UI, or via CLI:
argocd app list
argocd app get <app-name> --refresh
```

Notes:

- Changes under `values/deployments/*.yaml` sync to the corresponding
  environment automatically — production included. Push deliberately.
- Direct `kubectl edit`/`apply` changes are reverted by ArgoCD self-heal. Edit
  the repo, not the cluster.
- Cluster-wide infrastructure changes go in
  `values/clusters/<cluster>/argocd/infrastructure.yaml` and sync the same way.

---

## Verification

### Workloads

```bash
# Pods in a deployment namespace (namespace = <client>-<environment>)
kubectl get pods -n <client>-production

# Services
kubectl get svc -n <client>-production
```

### Ingress / Gateway

Ingress is NGINX Gateway Fabric (Gateway API, not Ingress). Two gateways live in
`nginx-gateway-system`:

- `nginx-shared-gateway` — public LoadBalancer
- `nginx-internal-gateway` — tailnet-internal (cluster default)

```bash
# Control plane + data plane pods
kubectl get pods -n nginx-gateway-system

# Gateways and their LoadBalancer IPs
kubectl get gateway -n nginx-gateway-system
kubectl get svc -n nginx-gateway-system

# Routes for a deployment
kubectl get httproute -n <client>-production
```

### Secrets

External Secrets Operator syncs from GCP Secret Manager:

```bash
kubectl get externalsecrets -n <client>-production
kubectl describe externalsecret <name> -n <client>-production
```

### Endpoints

```bash
curl https://api.example.com/health      # HapiHub API health
curl -I https://app.example.com          # frontend
```

---

## DNS Configuration

Point client domains at the public gateway's LoadBalancer IP.

```bash
# Public gateway LoadBalancer IP
kubectl get gateway nginx-shared-gateway -n nginx-gateway-system \
  -o jsonpath='{.status.addresses[0].value}'
```

Create A records (wildcards preferred) for the served domains — e.g.
`*.example.com`. See
[../architecture/MULTI-DOMAIN-GATEWAY.md](../architecture/MULTI-DOMAIN-GATEWAY.md).

```bash
nslookup app.example.com
curl -v https://app.example.com 2>&1 | grep subject   # TLS cert (cert-manager)
```

---

## Rollback

Roll back by reverting the commit that caused the change — that is the source of
truth ArgoCD reconciles to.

```bash
git revert <commit>
git push
```

For an out-of-band emergency, ArgoCD can roll an app to a prior synced revision:

```bash
argocd app history <app-name>
argocd app rollback <app-name> <revision>
```

This is temporary — the next sync reconciles back to Git, so follow up with a
`git revert`. For data-level recovery, restore from a Velero backup (verify the
backup first).

---

## Related Docs

- [CLUSTER-PROVISIONING.md](CLUSTER-PROVISIONING.md) — provisioning a cluster
- [CLIENT-ONBOARDING.md](CLIENT-ONBOARDING.md) — adding a new deployment
- [INFRASTRUCTURE-REQUIREMENTS.md](INFRASTRUCTURE-REQUIREMENTS.md) — cluster sizing and prerequisites
- [../architecture/GITOPS-ARGOCD.md](../architecture/GITOPS-ARGOCD.md) — App-of-Apps and auto-discovery
- [../architecture/GATEWAY-API.md](../architecture/GATEWAY-API.md) — Gateway API / NGINX Gateway Fabric
- [../architecture/MULTI-DOMAIN-GATEWAY.md](../architecture/MULTI-DOMAIN-GATEWAY.md) — multi-domain listeners
- [TROUBLESHOOTING.md](../operations/TROUBLESHOOTING.md) — common issues
