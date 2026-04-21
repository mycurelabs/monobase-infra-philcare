# PhilCare Infrastructure (monobase-infra-philcare)

Healthcare SaaS infrastructure on Azure AKS.
GitOps-driven with ArgoCD, Helm charts, and Terraform/OpenTofu.

## Repository Structure

```
charts/           # 26 Helm charts (healthcare apps, core services, infrastructure)
  argocd-*/       # ArgoCD bootstrap, applications, infrastructure
values/           # Configuration values
  deployments/    # Per-environment configs (philcare-staging.yaml, philcare-production.yaml)
  infrastructure/ # Cluster-wide infra config (main.yaml)
terraform/        # IaC modules for 6 providers
  modules/        # aws-eks, azure-aks, gcp-gke, do-doks, on-prem-k3s, local-k3d
scripts/          # Operational scripts (bootstrap, provision, secrets, admin)
docs/             # Architecture, operations, security documentation
```

## Tool Management

This project uses **mise exclusively** for tool versions and task running.
- Install tools: `mise install`
- Run tasks: `mise run <task>` (e.g., `mise run lint`, `mise run validate`)
- See all tasks: `mise tasks`

## Naming Conventions

- **Namespaces**: `philcare-{environment}` (e.g., `philcare-production`, `philcare-staging`)
- **Deployment files**: `values/deployments/philcare-{environment}.yaml`
- **Chart names**: lowercase, hyphenated (e.g., `hapihub`, `database-secrets`)
- **Infrastructure namespaces**: `gateway-system`, `envoy-gateway-system`, `argocd`, `monitoring`, `cert-manager`, `external-secrets-system`

## Key Patterns

- **Gateway API** (not Ingress) via Envoy Gateway — shared-gateway in `gateway-system` namespace
- **External Secrets Operator** syncs from GCP Secret Manager — never commit secrets
- **ArgoCD auto-sync** — changes to `values/` trigger automatic deployment
- **PostgreSQL-only** database strategy (no MongoDB/FerretDB)
- **Single TLS certificate** with multiple subdomains per gateway (not per-app certs)
- **Global values** pattern: `global.domain`, `global.namespace`, `global.gateway`, `global.storage`

## Git Conventions

- Conventional commits: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`
- Never commit secrets, credentials, or `.env` files

## Safety Rules

- **No destructive kubectl operations** without explicit user confirmation
- Changes to `values/deployments/*.yaml` trigger ArgoCD auto-sync to production
- Direct `kubectl` changes are reverted by ArgoCD self-heal
- Always use `helm template --dry-run` before applying chart changes

## Cluster

- **Provider**: Azure AKS (cluster: AKS-MC-01)
- **Kubeconfig**: `.kube/config` (gitignored)
- **Domain**: `mycure.stitchtechsolutions.com`
- **Static IP**: Azure Public IP `philcare-production-gateway-ip` in `mycurerg`
