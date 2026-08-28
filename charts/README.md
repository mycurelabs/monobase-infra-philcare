# Helm Charts

Reusable Helm charts for deploying Monobase applications.

## Overview

This directory contains **Helm charts** for all Monobase components:

- **app** - Generic frontend/service chart (consolidates frontend clones)
- **hapihub**, **cadence**, and other bespoke product/service charts
- **namespace** - Namespace creation with Pod Security Standards
- **argocd-bootstrap / argocd-applications / argocd-infrastructure** - GitOps factories

**What's here:** Application Helm charts (internal implementation)  
**What you deploy:** Deployment configs in `../values/deployments/`  
**Complements:** Cluster-wide infra and OpenTofu roots in `../values/clusters/<cluster>/`

## Quick Start

**Note:** You typically work with deployment configs in `../values/deployments/`, not these charts directly.

```bash
# Deployment configs are single YAML files:
values/deployments/
├── base.yaml               # Shared neutral parent (disabled: "true", never deploys)
├── mycure-production.yaml   # Production deployment (extends: base)
└── mycure-staging.yaml      # Staging deployment (extends: base)

# Deploy via ArgoCD (GitOps):
git add values/deployments/myclient-production.yaml
git commit -m "feat: add myclient production config"
git push
# ArgoCD auto-discovers and deploys

# Or render the app-of-apps tree the way ArgoCD deploys it (base + env overlay):
helm template x charts/argocd-applications -f values/deployments/base.yaml -f values/deployments/mycure-production.yaml
```

## Charts

| Chart | Description | Dependencies |
|-------|-------------|--------------|
| **app** | Generic frontend/service chart (frontends, dashboards, workers) | None (calls the API) |
| **hapihub** | HapiHub API backend | PostgreSQL, Valkey, optional MinIO |
| **namespace** | Namespace + Pod Security | None |

## Global Parameters

Global parameters are shared across all charts and must be configured in your deployment values file.

### global.domain

- **Type:** string
- **Required:** Yes
- **Example:** `myclient.com`
- **Description:** Base domain for all services
- **Pattern:** Valid domain name

### global.namespace

- **Type:** string
- **Required:** Yes
- **Example:** `myclient-prod`
- **Description:** Kubernetes namespace for deployment
- **Pattern:** `{client}-{env}` (lowercase alphanumeric with hyphens)

### global.environment

- **Type:** string
- **Required:** Yes
- **Options:** `development`, `staging`, `production`
- **Description:** Environment identifier

### global.gateway.name

- **Type:** string
- **Default:** `shared-gateway`
- **Description:** Name of shared Gateway resource

### global.gateway.namespace

- **Type:** string
- **Default:** `gateway-system`
- **Description:** Namespace where shared Gateway is deployed

### global.storage.provider

- **Type:** string
- **Options:** `cloud-default`, `longhorn`, `local-path`
- **Default:** `cloud-default`
- **Description:** Storage provider (see `../docs/operations/STORAGE.md`)

### global.storage.className

- **Type:** string
- **Default:** `""` (auto-detect)
- **Description:** StorageClass name (empty = use provider default)

## Chart-Specific Documentation

Each chart has detailed parameter documentation:

- **[app/README.md](app/README.md)** - Generic frontend/service chart configuration
- **[hapihub/README.md](hapihub/README.md)** - HapiHub API configuration, resources, dependencies
- **[namespace/README.md](namespace/README.md)** - Namespace and resource quota configuration

## Deployment Configuration

For complete deployment configuration guides, see:

- **[../values/README.md](../values/README.md)** - How to configure deployments
- **[../docs/getting-started/CLIENT-ONBOARDING.md](../docs/getting-started/CLIENT-ONBOARDING.md)** - New client setup

## Example Global Configuration

### Minimal (Staging)

```yaml
global:
  domain: myclient.com
  namespace: myclient-staging
  environment: staging
  storage:
    provider: cloud-default
    className: ""
```

### Production (HA)

```yaml
global:
  domain: myclient.com
  namespace: myclient-prod
  environment: production
  gateway:
    name: shared-gateway
    namespace: gateway-system
  storage:
    provider: longhorn  # Or cloud-default for EKS/AKS/GKE
    className: longhorn
```

## Development

### Chart Structure

Each chart follows standard Helm conventions:

```
charts/{chart-name}/
├── Chart.yaml           # Chart metadata
├── values.yaml          # Default values
├── values.schema.json   # JSON schema (validation)
├── README.md            # Chart documentation
└── templates/           # Kubernetes manifests
    ├── deployment.yaml
    ├── service.yaml
    ├── httproute.yaml
    └── ...
```

### Testing Charts Locally

```bash
# Lint chart
helm lint ./charts/hapihub

# Render the app-of-apps tree the way ArgoCD deploys it (base + env overlay merge)
helm template x charts/argocd-applications -f values/deployments/base.yaml -f values/deployments/mycure-production.yaml

# Or render a single chart standalone with its OWN values (deployment overlays
# nest under the chart key, so pass --set for a bare chart render)
helm template x ./charts/hapihub --set enabled=true --set global.namespace=test
```

### Chart Dependencies

Dependencies are managed in `Chart.yaml`:

```yaml
# Example: charts/hapihub/Chart.yaml
dependencies:
  - name: postgresql
    version: "12.x.x"
    repository: "https://charts.bitnami.com/bitnami"
    condition: postgresql.enabled
```

Update dependencies:

```bash
cd charts/hapihub
helm dependency update
```

## Next Steps

1. **Read:** Chart-specific READMEs for detailed parameter documentation
2. **Configure:** Create deployment values in `../values/deployments/`
3. **Deploy:** Use ArgoCD GitOps or manual Helm install
4. **Monitor:** See `../docs/operations/MONITORING.md`
