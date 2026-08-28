# Deployment Workflow Guide

## Deployment File Structure

Each file in `values/deployments/` defines a complete tenant deployment.
Filename determines namespace: `<client>-production.yaml` → namespace `<client>-production`.

### Required Fields

```yaml
global:
  domain: example.com        # Base domain for all apps
  namespace: <client>-production         # Must match filename
  environment: production              # production | staging | development
  nodePool: "production"               # Node affinity target
  gateway:
    name: nginx-shared-gateway         # Gateway resource (or nginx-internal-gateway)
    namespace: nginx-gateway-system    # Gateway namespace
  storage:
    provider: ""                       # Storage provider (optional)
    className: ""                      # StorageClass override (optional)
```

### Application Sections

Each application has its own section with `.enabled` toggle:

```yaml
hapihub:
  enabled: true                        # Deploy this app
  image:
    repository: ghcr.io/mycurelabs/hapihub
    tag: "10.11.15"                    # Version to deploy
    pullPolicy: IfNotPresent
  replicaCount: 1
  resources:
    requests: { cpu: 1000m, memory: 768Mi }
    limits: { cpu: "2", memory: 2Gi }
  gateway:
    hostname: ""                       # Auto-derived from global.domain
    sectionName: https-public             # Listener name for domain routing
    timeouts:
      request: "60s"
  autoscaling:
    enabled: true
    maxReplicas: 3
  externalSecrets:
    enabled: true
    secretStore: gcp-secretstore
    secretStoreKind: ClusterSecretStore
    refreshInterval: 1h
    secrets: [...]                     # Secret key mappings
  postgresql:
    enabled: true
    architecture: replication          # standalone | replication
    auth:
      existingSecret: postgresql       # Pre-created via database-secrets chart
```

### Database Sections (Bitnami Subcharts)

```yaml
postgresql:
  enabled: true
  fullnameOverride: "postgresql"
  architecture: replication
  image:
    repository: bitnamilegacy/postgresql
    tag: 16.4.0-debian-12-r13
  auth:
    existingSecret: postgresql         # Pre-created via database-secrets chart
  persistence:
    enabled: true
    size: 100Gi
  resources: { ... }
```

### Optional Sections

```yaml
valkey:                                # Redis-compatible cache
  enabled: false
  architecture: standalone

minio:                                 # S3-compatible object storage
  enabled: false
  mode: standalone

mailpit:                               # Email testing (staging only)
  enabled: false

backup:                                # Velero backup for this namespace
  enabled: false

podSecurityStandards:
  enabled: true
  level: restricted

resourceQuotas:
  enabled: false
```

## Values Flow

```
values/deployments/<client>-production.yaml
  ↓ (referenced by ApplicationSet)
ArgoCD Application (<client>-production-root)
  ↓ (Helm rendering with these values)
charts/argocd-applications/ templates
  ↓ (creates per-chart ArgoCD Applications)
Individual chart deployments (hapihub, app instances, cadence, etc.)
  ↓ (each chart reads global + its section from values)
Kubernetes resources (Deployments, Services, HTTPRoutes, etc.)
```

## Environment-Specific Patterns

### Production

- `global.environment: production`
- `global.nodePool: "production"`
- HPA enabled for hapihub
- ExternalSecrets enabled (full secret set)
- Higher resource limits
- `gateway.sectionName: https-public`

### Staging

- `global.environment: staging`
- `global.nodePool: "staging"`
- HPA disabled (save resources)
- ExternalSecrets may be partial
- Lower resource limits
- `gateway.sectionName: https-staging`
- Mailpit enabled for email testing
- MinIO enabled for local object storage

## Common Operations

### Bump Image Version

```yaml
# Edit the specific app's image.tag
hapihub:
  image:
    tag: "10.12.0"  # was "10.11.15"
```

### Enable/Disable Component

```yaml
# Toggle the .enabled flag
mailpit:
  enabled: true  # was false
```

### Add External Secret

```yaml
externalSecrets:
  secrets:
    - secretKey: NEW_SECRET_KEY
      remoteKey: <client>-production-new-secret
```

### Change Resources

```yaml
hapihub:
  resources:
    requests:
      cpu: 2000m      # was 1000m
      memory: 1Gi     # was 768Mi
    limits:
      cpu: "4"        # was "2"
      memory: 4Gi     # was 2Gi
```
