# Values Directory

This directory contains all actual configuration values used to deploy infrastructure and applications. Everything outside this directory should be treated as templates or examples.

## Directory Structure

```
values/
├── clusters/                       # Per-cluster configuration
│   └── <cluster>/                  # e.g. aws-main
│       ├── argocd/                 # Cluster-wide infra config (ArgoCD-synced)
│       │   ├── infrastructure.yaml # Main infra config (cert-manager, gateway, etc.)
│       │   ├── external-dns.yaml   # External DNS configuration
│       │   ├── argocd.yaml         # ArgoCD Helm values
│       │   └── secrets.yaml        # Secrets registry (ESO remoteRefs, never raw secrets)
│       └── terraform/              # OpenTofu root for the cluster
│           ├── main.tf
│           ├── variables.tf
│           ├── outputs.tf
│           └── terraform.tfvars
└── deployments/                    # Application deployment configurations (flat)
    ├── base.yaml                  # Shared neutral parent (disabled: "true", never deploys)
    ├── mycure-staging.yaml        # Staging environment (extends: base)
    └── mycure-production.yaml     # Production environment (extends: base)
```

## Inheritance (load-bearing)

Every deployment is a flat top-level file `values/deployments/*.yaml` — no
subdirectories, no filename magic. Two explicit keys govern behaviour:

- `extends: <name>` — names the single parent values file (e.g. `extends: base`
  → `values/deployments/base.yaml`). The parent is merged FIRST and this file
  wins per key; maps deep-merge, ARRAYS REPLACE WHOLESALE (keep any array that
  differs per env entirely in this file). Omit `extends` for no parent.
- `disabled: "true"` — makes a file parent-only: it never deploys (its own
  Application is filtered out by the ApplicationSet selector). Absent = deployed.
  The quoted string is intentional.

`base.yaml` is the shared, neutral parent — always `disabled: "true"` — that the
shipped `mycure-staging.yaml` and `mycure-production.yaml` both `extends: base`.

## Usage

### Infrastructure Configuration

Infrastructure values are referenced by ArgoCD applications in `charts/argocd-infrastructure/`:

```yaml
# charts/argocd-bootstrap/infrastructure-root.yaml
helm:
  valueFiles:
    - ../../values/clusters/<cluster>/argocd/infrastructure.yaml
```

### Deployment Configuration

Deployment values are automatically discovered by the ApplicationSet in `charts/argocd-bootstrap/applicationset-auto-discover.yaml`.

The ApplicationSet uses a **Git Files Generator** to scan `values/deployments/*.yaml` files:

```yaml
generators:
  - git:
      files:
        - path: "values/deployments/*.yaml"
```

Each YAML file discovered creates a corresponding ArgoCD Application.

## Adding New Deployments

To add a new client deployment:

1. Create a new values file: `values/deployments/{client}-{env}.yaml`
2. Copy from existing deployment or example
3. Customize for your client
4. Commit and push - ArgoCD will auto-discover

Example:

```bash
cp values/deployments/mycure-staging.yaml values/deployments/newclient-staging.yaml
# Edit values/deployments/newclient-staging.yaml
git add values/deployments/newclient-staging.yaml
git commit -m "feat: add newclient staging deployment"
git push
```

## Configuration Guidelines

### Naming Convention

- **Infrastructure**: `clusters/<cluster>/argocd/{component}.yaml` (e.g., `infrastructure.yaml`, `argocd.yaml`)
- **Deployments**: `{client}-{environment}.yaml` (e.g., `mycure-staging.yaml`)

### Secrets

**Never commit secrets to this directory.** Use External Secrets Operator (ESO) to sync secrets from:

- GCP Secret Manager
- AWS Secrets Manager
- Azure Key Vault

Secret registries live at `values/clusters/<cluster>/argocd/secrets.yaml` (ESO
remoteRefs only — never raw secret values).

### Structure

Keep values files flat and well-commented:

```yaml
# Good
global:
  domain: example.com
  namespace: app-staging

postgresql:
  enabled: true
  auth:
    database: myapp

# Avoid deep nesting
```
