# App Helm Chart

Generic Helm chart for deploying a frontend or lightweight service application.

## Overview

`app` is the consolidated chart for per-app frontend/service deployments. Instead of
maintaining a near-identical clone chart per application (dashboard, pxp, myaccount,
mycurelocal, and similar), each app is a **release of this one chart** with its own
values overlay. It renders the standard workload resources:

- Deployment + Service
- Gateway API HTTPRoute for routing
- NetworkPolicy (ingress/egress)
- HorizontalPodAutoscaler (optional)
- PodDisruptionBudget
- ServiceAccount, ConfigMap
- ExternalSecret (optional)
- PersistentVolumeClaim (optional)
- ServiceMonitor (optional)

The default image (`ghcr.io/mycurelabs/mycureapp`) serves a static frontend behind a
read-only root filesystem as a non-root user. Point `image.repository` at any app image
to deploy a different application from the same chart.

## Quick Start

Each app is one release with its own values overlay:

```yaml
# values/deployments/myclient-prod/dashboard.yaml
enabled: true
replicaCount: 2
image:
  repository: ghcr.io/mycurelabs/dashboard
  tag: "1.0.0"
gateway:
  hostname: dashboard.myclient.com   # optional; defaults to {release-name}.{global.domain}
```

Deploy via ArgoCD (GitOps) or Helm:

```bash
# GitOps (recommended) — ArgoCD auto-syncs on commit
git add values/deployments/myclient-prod/dashboard.yaml && git commit && git push

# Manual Helm install
helm install myclient-dashboard ./charts/app -f values/deployments/myclient-prod/dashboard.yaml
```

## Key Parameters

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| `enabled` | boolean | `true` | Enable or disable the deployment |
| `replicaCount` | integer | `2` | Number of pod replicas |
| `image.repository` | string | `ghcr.io/mycurelabs/mycureapp` | Container image repository |
| `image.tag` | string | `latest` | Container image tag (pin a specific version in production) |
| `image.pullPolicy` | string | `IfNotPresent` | `Always`, `IfNotPresent`, or `Never` |
| `service.port` | integer | `80` | Service port |
| `service.targetPort` | integer | `8080` | Container port the app listens on |

### Resources

Defaults are sized for a lightweight static frontend. Override per app/environment.

| Key | Default |
| --- | --- |
| `resources.requests.cpu` | `200m` |
| `resources.requests.memory` | `512Mi` |
| `resources.limits.cpu` | `1` |
| `resources.limits.memory` | `1Gi` |

### Gateway

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| `gateway.enabled` | boolean | `true` | Render the HTTPRoute |
| `gateway.hostname` | string | `""` | Custom hostname. Empty defaults to `{release-name}.{global.domain}` |
| `gateway.hostnames` | list | — | Multiple hostnames (overrides `gateway.hostname`) |

The route attaches to the shared Gateway defined by `global.gateway.name` /
`global.gateway.namespace`.

### High Availability

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| `autoscaling.enabled` | boolean | `false` | Enable the HPA |
| `autoscaling.minReplicas` | integer | `2` | Minimum replicas |
| `autoscaling.maxReplicas` | integer | `5` | Maximum replicas |
| `autoscaling.targetCPUUtilizationPercentage` | integer | `70` | HPA CPU target |
| `podDisruptionBudget.enabled` | boolean | `true` | Enable the PDB |
| `podDisruptionBudget.minAvailable` | integer | `1` | Minimum available pods during disruption |

### Scheduling

`nodePool` (or inherited `global.nodePool`) sets a `node-pool` nodeSelector plus a
matching toleration, so the release schedules onto a dedicated/tainted node pool. Leave
unset to schedule anywhere. `nodeSelector`, `tolerations`, and `affinity` are also
exposed directly.

### Optional Features

| Key | Default | Description |
| --- | --- | --- |
| `config` | `{}` | Extra environment variables (rendered into a ConfigMap) |
| `externalSecrets.enabled` | `false` | Sync secrets via External Secrets Operator |
| `persistence.enabled` | `false` | Attach a PersistentVolumeClaim |
| `serviceMonitor.enabled` | `false` | Emit a Prometheus ServiceMonitor |
| `networkPolicy.enabled` | `true` | Restrict ingress/egress |

See [`values.yaml`](values.yaml) for the full set and [`values.schema.json`](values.schema.json)
for validation.

## Configuration Examples

### Minimal (non-production)

```yaml
enabled: true
replicaCount: 1
image:
  tag: "latest"
resources:
  requests:
    cpu: 100m
    memory: 256Mi
```

### Production (HA, pinned)

```yaml
enabled: true
replicaCount: 2
image:
  tag: "1.0.0"   # pin a version
resources:
  requests:
    cpu: 200m
    memory: 512Mi
  limits:
    cpu: 500m
    memory: 1Gi
podDisruptionBudget:
  enabled: true
  minAvailable: 1
```

## Related Documentation

- [`values.yaml`](values.yaml) — default values
- [`values.schema.json`](values.schema.json) — values schema
- [`../../README.md`](../../README.md) — repository overview and global parameters
