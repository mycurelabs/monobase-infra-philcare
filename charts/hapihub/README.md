# HapiHub Helm Chart

Helm chart for deploying the HapiHub healthcare infrastructure service (compliance and
interoperability API). This is a pure application chart — PostgreSQL, Valkey, and MinIO are
deployed as separate ArgoCD Applications (see `charts/argocd-applications/`), not as sub-charts.

## Overview

The chart deploys:

- **HapiHub API** — Bun-based healthcare backend (port 7500)
- **HTTPRoute** — Gateway API route for external access
- **ExternalSecret** — optional secret sync via External Secrets Operator
- **CronJobs** — optional session prune and HIPAA-retention audit prune
- **ServiceMonitor / PDB / NetworkPolicy / HPA** — optional production hardening

It connects to an external (separately deployed) PostgreSQL and, optionally, a shared
in-cluster Valkey for response caching.

## Quick Start

```yaml
# values/deployments/myclient-production.yaml
image:
  repository: ghcr.io/mycurelabs/hapihub
  tag: "10.0.13"        # pin a semver; see values.schema.json for the tag rule

replicaCount: 3

global:
  domain: example.com
  namespace: myclient-production
  environment: production
  gateway:
    name: shared-gateway
    namespace: gateway-system

postgresql:
  enabled: true
  external: true          # use a separately deployed / managed PostgreSQL
```

Deploy via ArgoCD (GitOps) or Helm:

```bash
# GitOps (recommended) — changes under values/ trigger auto-sync
git add values/deployments/myclient-production.yaml && git commit && git push

# Manual Helm install
helm install myclient-hapihub ./charts/hapihub -f values/deployments/myclient-production.yaml
```

## Key Parameters

### image.repository / image.tag / image.pullPolicy

- **repository** — default `ghcr.io/mycurelabs/hapihub`
- **tag** — MUST be semver (or `latest`), optionally with a digest; see the schema
  description in `values.schema.json`. Pin a version in production.
- **pullPolicy** — `Always`, `IfNotPresent` (default), or `Never`

### replicaCount

- **Type:** integer — **Default:** `2` — **Production:** `3` for HA

### resources

- Requests default to `500m` CPU / `1Gi` memory; limits `2` CPU / `4Gi` memory.
  Tune per environment.

### gateway

- **enabled** — emit an HTTPRoute (default `true`)
- **hostname** — custom hostname; empty defaults to `hapihub.{global.domain}`
- **snippetsPolicy** — optional NGINX Gateway SnippetsPolicy for `proxy_read_timeout`
  and `client_max_body_size` tuning
- **storageRoute** — optional extra HTTPRoute attaching specific path prefixes on
  another hostname to this release's service

### autoscaling

- **enabled** — Horizontal Pod Autoscaler (default `false`); `minReplicas`,
  `maxReplicas`, `targetCPUUtilizationPercentage`

### podDisruptionBudget / networkPolicy

- Enabled by default; recommended for production HA and security.

### externalSecrets

- **enabled** — sync secrets from a KMS via External Secrets Operator (default `false`)
- **secretStore**, **refreshInterval**, and a **secrets** list of `secretKey` /
  `remoteKey` pairs

### cache

- **enabled** — turn on the Valkey response cache (default `false`). When enabled and the
  shared Valkey app is deployed, the pod receives `REDIS_URL` and `CACHE_ENABLED=true`.
  Which endpoints are cached is declared in HapiHub's OpenAPI specs via `x-cache`.

### postgresql

- **enabled** — wire PostgreSQL connection env (default `false`)
- **external** — use an external/managed PostgreSQL via `DATABASE_URI` from ExternalSecrets
- **serviceName**, **auth.database**, **auth.username**, **auth.existingSecret**

### pruneExpiredSessions / pruneAuditEvents

- Optional CronJobs (default `false`). `pruneExpiredSessions` deletes expired Better Auth
  sessions daily; `pruneAuditEvents` performs a retention prune of the append-only
  `audit_events` trail. Opt in per environment.

## Configuration Examples

### Minimal (staging)

```yaml
replicaCount: 1
image:
  tag: "latest"
resources:
  requests:
    cpu: 250m
    memory: 512Mi
cache:
  enabled: false
```

### Production (HA)

```yaml
replicaCount: 3
image:
  tag: "10.0.13"   # pin version
autoscaling:
  enabled: true
  minReplicas: 3
  maxReplicas: 10
resources:
  requests:
    cpu: 1
    memory: 2Gi
  limits:
    cpu: 2
    memory: 4Gi
podDisruptionBudget:
  enabled: true
networkPolicy:
  enabled: true
```

## Related Documentation

- **[values.schema.json](values.schema.json)** — JSON schema for validation
- **[values.yaml](values.yaml)** — default values
- **[../README.md](../README.md)** — charts overview and global parameters
