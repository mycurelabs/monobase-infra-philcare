# ArgoCD Application Definitions

This directory contains ArgoCD Application resources for GitOps-managed infrastructure and applications.

## Architecture Overview

**Two-Layer GitOps Architecture:**

1. **Cluster-Wide Infrastructure** (bootstrap/infrastructure-root.yaml)
   - Deployed ONCE per cluster
   - Manages: cert-manager, gateways, storage, security, backups
   - Auto-syncs from Git (drift correction enabled)

2. **Per-Client Applications** (bootstrap/applicationset-auto-discover.yaml)
   - Deployed ONCE per cluster
   - Auto-discovers client/env configs in `values/deployments/`
   - Creates per-client Applications automatically

## Directory Structure

```
argocd/
├── bootstrap/
│   ├── infrastructure-root.yaml           # Cluster-wide infrastructure
│   └── applicationset-auto-discover.yaml  # Per-client auto-discovery
├── infrastructure/                        # Helm chart for cluster infrastructure
│   ├── Chart.yaml
│   ├── values.yaml
│   └── templates/
│       ├── cert-manager.yaml             # TLS certificates (Wave 0)
│       ├── nginx-gateway.yaml            # Gateway API (Wave 0)
│       ├── external-secrets.yaml          # Secret management (Wave 0)
│       ├── velero.yaml                   # Backups (Wave 0)
│       ├── longhorn.yaml                 # Storage (Wave 0, optional)
│       ├── kyverno.yaml                  # Policy engine (Wave 0, optional)
│       ├── kyverno-policies.yaml         # Policies (Wave 1, optional)
│       ├── falco.yaml                    # Runtime security (Wave 0, optional)
│       ├── falco-rules.yaml              # Custom rules (Wave 1, optional)
│       └── monitoring.yaml               # Observability (Wave 0, optional)
└── applications/                          # Helm chart for per-client apps
    ├── Chart.yaml
    ├── values.yaml
    └── templates/
        ├── namespace.yaml                # Namespace + PSS (Wave -1)
        ├── security-baseline.yaml        # NetworkPolicies + RBAC (Wave 0)
        ├── database-secrets.yaml         # DB secret wiring (Wave 1)
        ├── postgresql.yaml               # Database (Wave 2)
        ├── valkey.yaml                   # Cache (Wave 2)
        ├── minio.yaml                    # Object storage (Wave 2, optional)
        ├── minio-artifacts.yaml          # Artifacts store (Wave 2, optional)
        ├── mailpit.yaml                  # Email testing (Wave 2, dev only)
        ├── hapihub.yaml                  # Backend API (Wave 3)
        ├── hapihub-worker.yaml           # API worker (Wave 3, optional)
        └── generic-app.yaml              # Frontends/services via charts/app (Wave 3)
```

## Bootstrap Workflow

```bash
# Step 1: Install ArgoCD (manual, once)
mise run bootstrap

# This installs:
# 1. ArgoCD itself
# 2. Infrastructure Root Application (cluster infrastructure via GitOps)
# 3. ApplicationSet (per-client auto-discovery)

# Step 2: Add client/env configurations
cp values/deployments/mycure-production.yaml values/deployments/myclient-production.yaml
vim values/deployments/myclient-production.yaml  # Edit domain, namespace, etc.
git add values/deployments/myclient-production.yaml
git commit -m "Add myclient-production"
git push

# Step 3: ArgoCD auto-discovers and deploys!
# - Infrastructure already deployed (cluster-wide)
# - ApplicationSet creates myclient-prod Applications
# - All synced from Git automatically
```

## Deployment Layers

### Layer 1: Cluster Infrastructure (Wave 0-1)

**Managed by:** `charts/argocd-bootstrap/templates/infrastructure-root.yaml`

**Deploys:** Cluster-wide components (ONE instance per cluster)

| Component | Wave | Enabled By Default | Purpose |
|-----------|------|-------------------|---------|
| cert-manager | 0 | ✅ Yes | TLS certificate automation |
| nginx-gateway | 0 | ✅ Yes | Gateway API implementation |
| external-secrets | 0 | ✅ Yes | Secret management |
| velero | 0 | ✅ Yes | Backup and disaster recovery |
| longhorn | 0 | ❌ No | Distributed block storage |
| kyverno | 0 | ❌ No | Policy engine |
| kyverno-policies | 1 | ❌ No | Policy definitions |
| falco | 0 | ❌ No | Runtime security monitoring |
| falco-rules | 1 | ❌ No | Custom security rules |
| monitoring | 0 | ❌ No | Prometheus + Grafana |

**Configuration:** Edit `charts/argocd-infrastructure/values.yaml` to enable/disable components.

**GitOps Benefits:**

- ✅ Drift detection and auto-correction
- ✅ Updates via git push
- ✅ Full visibility in ArgoCD UI
- ✅ Declarative infrastructure as code

### Layer 2: Per-Client Applications (Wave -1 through 3)

**Managed by:** `charts/argocd-bootstrap/templates/applicationset-auto-discover.yaml`

**Deploys:** Per-client/environment resources (ONE set per client/env)

| Component | Wave | Scope | Purpose |
|-----------|------|-------|---------|
| namespace | -1 | Per-client | Namespace with Pod Security Standards |
| security-baseline | 0 | Per-client | NetworkPolicies + RBAC |
| postgresql | 2 | Per-client | Database instance |
| valkey | 2 | Per-client | Redis cache instance |
| minio | 2 | Per-client | Object storage (optional) |
| mailpit | 2 | Per-client | Email testing (dev/staging) |
| hapihub | 3 | Per-client | Backend API application |
| generic-app | 3 | Per-client | Frontends/services (via `charts/app`) |

**Configuration:** Each deployment is a single flat file `values/deployments/{client}-{env}.yaml` that inherits the shared `values/deployments/base.yaml` via `extends: base` (parent merged first, the env file wins per key)

**GitOps Workflow:**

```bash
# Add new client
cp values/deployments/mycure-production.yaml values/deployments/newclient-production.yaml
vim values/deployments/newclient-production.yaml
git add values/deployments/newclient-production.yaml && git commit -m "Add newclient-production" && git push
# ✓ ArgoCD auto-creates all Applications for newclient-production

# Update existing client
vim values/deployments/existingclient-production.yaml
git commit -am "Update existingclient: enable minio" && git push
# ✓ ArgoCD auto-syncs only existingclient-production
```

## Sync Waves Explained

Sync waves control deployment order. ArgoCD waits for each wave to be healthy before proceeding.

**Infrastructure (Cluster-Wide):**

- Wave 0: Core infrastructure (cert-manager, gateways, storage, secrets, backups)
- Wave 1: Dependent components (policies, custom rules)

**Applications (Per-Client):**

- Wave -1: Namespace creation (Pod Security Standards labels)
- Wave 0: Security baseline (NetworkPolicies, RBAC)
- Wave 2: Data services (PostgreSQL, Valkey, MinIO, Mailpit)
- Wave 3: Applications (API, Account frontend)

**Example Flow for New Client:**

```
1. Wave -1: Create namespace "myclient-production" with PSS labels
2. Wave 0: Deploy NetworkPolicies and RBAC to "myclient-production"
3. Wave 2: Deploy PostgreSQL, Valkey to "myclient-production"
4. Wave 3: Deploy HapiHub API and frontends to "myclient-production"
   (HapiHub waits for PostgreSQL to be healthy)
```

## Managing Infrastructure

### Enable/Disable Components

Edit `charts/argocd-infrastructure/values.yaml`:

```yaml
# Enable Longhorn storage
longhorn:
  enabled: true
  version: 1.6.0

# Enable Kyverno policies
kyverno:
  enabled: true
  version: 3.2.0
  policies:
    enabled: true
```

Git commit and push - ArgoCD auto-syncs!

### Update Component Versions

Edit `charts/argocd-infrastructure/values.yaml`:

```yaml
certManager:
  enabled: true
  version: v1.15.0  # Updated from v1.14.2
```

Git commit and push - ArgoCD upgrades cert-manager!

### View Infrastructure Status

```bash
# View infrastructure Application
kubectl get application infrastructure -n argocd

# View all infrastructure components
kubectl get applications -n argocd -l app.kubernetes.io/component=cluster-infrastructure

# Check sync status
argocd app get infrastructure
```

## Managing Per-Client Applications

### Add New Client/Environment

```bash
cp values/deployments/mycure-staging.yaml values/deployments/newclient-staging.yaml

# Edit values
vim values/deployments/newclient-staging.yaml

# Commit and push
git add values/deployments/newclient-staging.yaml
git commit -m "Add newclient-staging environment"
git push

# ArgoCD auto-discovers within ~30 seconds
kubectl get applications -n argocd | grep newclient-staging
```

### Update Existing Client

```bash
# Edit configuration
vim values/deployments/myclient-production.yaml

# Commit and push
git commit -am "myclient-production: increase API replicas to 3"
git push

# ArgoCD auto-syncs within seconds
argocd app sync myclient-production-hapihub
```

### Remove Client/Environment

```bash
git rm values/deployments/oldclient-production.yaml
git commit -m "Remove oldclient-production"
git push

# ApplicationSet auto-removes Applications
# (preserveResourcesOnDeletion=true prevents data loss)
```

## Troubleshooting

### Infrastructure Not Deploying

```bash
# Check infrastructure Application status
kubectl get application infrastructure -n argocd -o yaml

# Check ArgoCD logs
kubectl logs -n argocd -l app.kubernetes.io/name=argocd-application-controller

# Manually sync
argocd app sync infrastructure
```

### ApplicationSet Not Discovering Configs

```bash
# Check ApplicationSet status
kubectl get applicationset monobase-auto-discover -n argocd -o yaml

# Verify deployment files exist
ls -la values/deployments/

# Check ApplicationSet logs
kubectl logs -n argocd -l app.kubernetes.io/name=argocd-applicationset-controller
```

### Application Stuck in Progressing

```bash
# Check specific application
kubectl get application myclient-production-hapihub -n argocd -o yaml

# View sync status
argocd app get myclient-production-hapihub

# Check application logs
kubectl logs -n myclient-production -l app=hapihub
```

## Architecture Benefits

✅ **Full GitOps:** All infrastructure and applications managed via Git  
✅ **Drift Correction:** Auto-healing enabled for all components  
✅ **Scalability:** Add clients via git push, no manual kubectl  
✅ **Visibility:** Single ArgoCD UI for all infrastructure + apps  
✅ **Safety:** Sync waves prevent deployment race conditions  
✅ **Flexibility:** Enable/disable components per cluster or per client  

## References

- Bootstrap script: `mise run bootstrap`
- Infrastructure values: `charts/argocd-infrastructure/values.yaml`
- Application templates: `charts/argocd-applications/templates/`
- Deployment configs: `values/deployments/*.yaml`
