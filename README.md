# Monobase Infrastructure (mono-infra)

Multi-tenant Kubernetes infrastructure for healthcare SaaS.
GitOps-driven with ArgoCD, Helm charts, and Terraform/OpenTofu. Each cluster is
OpenTofu-managed from `values/clusters/<cluster>/terraform`.

## Repository Structure

```
charts/               # Everything deployable is a chart
  argocd-bootstrap/       # Infrastructure root + auto-discover ApplicationSet
  argocd-applications/    # Per-deployment Application factory + dedicated templates
  argocd-infrastructure/  # Cluster-wide infrastructure apps
  app/                    # Generic frontend/service chart (consolidates clones)
  <bespoke charts>        # hapihub, cadence, nginx-gateway, security-baseline, ...
terraform/            # IaC modules for 6 providers
  modules/                # aws-eks, azure-aks, gcp-gke, do-doks, on-prem-k3s, local-k3d
values/               # ALL real configuration
  clusters/               # per-cluster: <name>/terraform (OpenTofu root) +
                          #   <name>/argocd (infrastructure.yaml, secrets, external-dns, argocd)
  deployments/            # flat <name>-<env>.yaml files + shared base.yaml parent
scripts/              # Operational scripts (bootstrap, provision, secrets, admin)
docs/                 # Architecture, operations, security documentation
```

## Tooling

Tool versions and tasks are managed with [mise](https://mise.jdx.dev/):

```bash
mise install          # install pinned tool versions
mise tasks            # list all tasks
mise run lint         # yamllint + helm lint + tflint
mise run validate     # template-render all charts against real values
```

Key tasks: `lint`, `validate`, `check`, `fmt`, `bootstrap`, `provision`, `secrets`, `admin`, `cluster-plan`, `cluster-apply`.

## How Deployment Works

Everything is GitOps — push to `main` and ArgoCD syncs:

1. **Deployments**: edit `values/deployments/<name>-<env>.yaml` (a flat file that
   inherits the shared `values/deployments/base.yaml` via `extends: base`),
   commit, push. The auto-discover ApplicationSet picks it up and syncs the
   namespace `{client}-{environment}`. A file with `disabled: "true"` is
   parent-only and never deploys.
2. **Cluster-wide infrastructure**: edit `values/clusters/<cluster>/argocd/infrastructure.yaml`
   (gateway listeners, cert issuers, snippets policies, ...).
3. **Cluster itself** (node pools, k8s version): `values/clusters/<cluster>/terraform` +
   `mise run cluster-plan <cluster>` / `mise run cluster-apply <cluster>` (OpenTofu).
4. **Bootstrap** (new/empty cluster): `mise run bootstrap` — installs ArgoCD
   and the root apps; everything else flows from Git.

Direct `kubectl` changes are reverted by ArgoCD self-heal.

## Stack

| Concern | Technology |
|---------|-----------|
| Ingress | Gateway API via NGINX Gateway Fabric — public `nginx-shared-gateway` (prod-only) + tailnet-only `nginx-internal-gateway` (cluster default) in `nginx-gateway-system` |
| GitOps | ArgoCD App-of-Apps + ApplicationSet auto-discovery |
| Secrets | External Secrets Operator ← GCP Secret Manager (never commit secrets) |
| TLS | cert-manager (HTTP-01 via gateway, DNS-01 via Cloudflare) |
| DNS | external-dns |
| Backups | Velero |
| Private access | Tailscale operator |
| Data stores | PostgreSQL, Valkey, MinIO (Bitnami legacy images) |
| Box sync | cadence (hub + relay), QUIC over the shared gateway |

Domains: configured per deployment (multi-domain supported, e.g. `*.example.com`, `*.example.org`).

## Forking this template

This repo is a template — a tenant forks it and **changes only `values/`**. The
engine (`charts/`, `terraform/modules/`, the ArgoCD bootstrap logic) is shared
and is never edited per-tenant.

- Track the template as `upstream` and pull fixes with `git merge upstream/main`
  (`main` is append-only, so it always merges cleanly).
- Per-tenant deployments: `values/deployments/<client>-<env>.yaml` (`extends: base`).
- Per-cluster config: `values/clusters/<cluster>/argocd/*` + `terraform/`, including
  `bootstrap.yaml` (`repoURL` / `clusterName` / `deploymentPaths`) — **not**
  `charts/argocd-bootstrap/values.yaml`.

Full fork checklist: [docs/TEMPLATE-GUIDE.md](docs/TEMPLATE-GUIDE.md).

## Documentation

Index: [docs/README.md](docs/README.md)

- [System Architecture](docs/architecture/ARCHITECTURE.md)
- [GitOps with ArgoCD](docs/architecture/GITOPS-ARGOCD.md)
- [Gateway API](docs/architecture/GATEWAY-API.md) — NGINX Gateway Fabric, HTTPRoutes
- [Multi-Domain Gateway](docs/architecture/MULTI-DOMAIN-GATEWAY.md)
- [Cluster Provisioning](docs/getting-started/CLUSTER-PROVISIONING.md)
- [Client Onboarding](docs/getting-started/CLIENT-ONBOARDING.md)
- [Backup & DR](docs/operations/BACKUP_DR.md) · [DR Runbooks](docs/operations/DISASTER_RECOVERY_RUNBOOKS.md)
- [Scaling Guide](docs/operations/SCALING-GUIDE.md) · [Troubleshooting](docs/operations/TROUBLESHOOTING.md)
- [Security Hardening](docs/security/SECURITY-HARDENING.md) · [Compliance](docs/security/SECURITY_COMPLIANCE.md) (HIPAA, SOC2, GDPR)

## Security & Compliance

- NetworkPolicies — default-deny, allow-specific (see `charts/security-baseline`)
- Pod Security Standards — restricted profile enforced per namespace
- TLS everywhere via cert-manager; secrets only via External Secrets + GCP SM
- Internal-by-default ingress — routes land on the tailnet gateway unless a
  deployment explicitly opts into the public gateway

## Conventions

- Namespaces: `{client}-{environment}` (e.g. `<client>-production`)
- Deployment files: `values/deployments/{client}-{environment}.yaml`
- Node pools (example `aws-main` EKS cluster): `prod-db`, `prod-apps`, `infra`,
  `nonprod` — tainted `node-pool=<name>:NoSchedule` except `nonprod` (see [Scaling Guide](docs/operations/SCALING-GUIDE.md))
- Conventional commits: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`
- See [CONTRIBUTING.md](CONTRIBUTING.md)
