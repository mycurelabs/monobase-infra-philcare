# Chart Inventory

The repo's charts live under `charts/`. Everything deployable is a chart. The
groups below reflect the current `charts/` tree — run `ls -d charts/*/` to get the
authoritative list.

## Applications

### hapihub

- **Purpose**: HapiHub — healthcare infrastructure service (compliance, interoperability)
- **Runtime**: Bun
- **Database**: PostgreSQL
- **Key values**: `image.tag`, `replicaCount`, `gateway.hostname`, `gateway.sectionName`, `externalSecrets`, `autoscaling`, `betterAuth`
- **Templates**: deployment, service, httproute, externalsecret, hpa, pdb, servicemonitor, networkpolicy
- **Dependencies**: PostgreSQL (bitnami subchart), optional Valkey, optional MinIO, optional Mailpit
- **Reference implementation** — most complete chart with all patterns

### app

- **Purpose**: Generic frontend/service chart, consolidating the per-app clone charts
- **Templates**: deployment, service, httproute, networkpolicy, hpa, pdb, configmap, externalsecret, pvc
- **Usage**: instantiate per frontend/service via a deployment values entry rather than cloning a chart

### medley

- **Purpose**: Medley — Medical AI Gateway service (Hono/Bun backend)

### medgemma-worker

- **Purpose**: MedGemma Worker — medical vision AI inference worker (Hono/Bun backend)

### openmed

- **Purpose**: OpenMed — medical AI model serving service (Hono/Bun backend)

### nocodb

- **Purpose**: Self-hosted NocoDB (no-code DB UI) for browsing Postgres data

## Data-plane / Sync

### cadence

- **Purpose**: cadence data-plane hub (iroh 1.0 P2P sync engine); anchors a Postgres store, serves the observability + bootstrap API, reachable for direct QUIC via the shared gateway's UDPRoute

### cadence-relay

- **Purpose**: Self-hosted iroh relay for cadence, giving hard-NAT boxes a controlled relay data-path (stock n0 `iroh-relay` image)

## Infrastructure Charts

### argocd-bootstrap

- **Purpose**: ArgoCD bootstrap — infrastructure root Application + client auto-discovery ApplicationSet

### argocd-applications

- **Purpose**: ArgoCD Applications factory for the stack (infrastructure + applications)

### argocd-infrastructure

- **Purpose**: Cluster-wide infrastructure components (cert-manager, gateways, storage, security)

### namespace

- **Purpose**: Namespace creation with security and resource quota configuration
- **Key values**: `podSecurityStandards.enabled`, `podSecurityStandards.level`, `resourceQuotas`
- **Templates**: namespace, resourcequota

### nginx-gateway

- **Purpose**: NGINX Gateway Fabric shared Gateway resources (public + internal)
- **Key values**: `gateway.listeners`, `extraGateways`, `snippetsPolicies`, `tls.certificates`
- **Templates**: gateway, gatewayclass, namespace, certificate, nginxproxy, snippetspolicy, njs-security-headers-cm

### cert-manager-issuers

- **Purpose**: Multi-provider ClusterIssuer management
- **Templates**: clusterissuer (HTTP-01 and DNS-01 challenge types)

### coredns-custom

- **Purpose**: Managed-CoreDNS override hook (`kube-system/coredns-custom` ConfigMap) for in-cluster DNS rewrites/hairpins; rewrites are per-cluster data in `values/clusters/<cluster>/argocd/infrastructure.yaml`

### external-dns

- **Purpose**: Multi-instance External DNS for automatic DNS record management from Kubernetes resources
- **Templates**: deployment, rbac, serviceaccount

### database-secrets

- **Purpose**: External Secrets for database credentials (PostgreSQL, MinIO)
- **Templates**: externalsecret

### external-secrets-stores

- **Purpose**: ClusterSecretStore + cluster-scoped ExternalSecrets (GCP Secret Manager wiring)

### tailscale-operator

- **Purpose**: Tailscale Kubernetes operator — private-network exposure for cluster services (deny-first gateway)

### ollama-egress

- **Purpose**: Tailscale egress from the cluster to the medical-AI host's Ollama

### minio-httproute

- **Purpose**: HTTPRoute for MinIO object storage

### minio-artifacts-httproute

- **Purpose**: HTTPRoute exposing the public-read artifacts MinIO bucket

## Storage / Backup

### velero-resources

- **Purpose**: Velero backup storage locations, volume snapshot locations, and schedules

## Observability

### grafana

- **Purpose**: Grafana with Gateway API integration
- **Dependencies**: bitnami Grafana subchart
- **Templates**: httproute (wraps subchart)

### signoz

- **Purpose**: SigNoz observability platform with Gateway API integration

### monitoring-resources

- **Purpose**: PrometheusRules, ServiceMonitors, Grafana dashboards, Alertmanager config ExternalSecret

## Security

### security-baseline

- **Purpose**: NetworkPolicies and RBAC for zero-trust networking
- **Templates**: networkpolicy (default-deny, allow-gateway, allow-db, allow-storage)

### kyverno-resources

- **Purpose**: Kyverno ClusterPolicies (pod-security, require-labels, restrict-registries)

### falco-resources

- **Purpose**: Custom Falco runtime security detection rules

### tenzir

- **Purpose**: Self-hosted security detection pipeline — a single Tenzir Node ingesting hapihub audit events, normalizing to OCSF, and routing findings to Alertmanager

## Dev / Testing

### mailpit

- **Purpose**: Email testing tool (dev/staging environments)
- **Templates**: deployment, service, httproute (web UI + SMTP service)
