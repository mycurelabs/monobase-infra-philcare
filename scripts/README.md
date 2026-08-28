# Scripts Directory

This directory contains operational scripts for managing the mono-infra project.

## Structure

```
scripts/
├── *.ts                    # TypeScript scripts (Bun runtime)
├── *.sh                    # Shell helpers (e.g. upgrade-gateway-api-crds.sh)
├── lib/                    # Shared utilities for ALL scripts
│   ├── k8s.ts             # Kubernetes client
│   ├── prompts.ts         # CLI prompts (@clack/prompts)
│   ├── yaml.ts            # YAML parsing/writing
│   └── utils.ts           # General utilities
└── {feature}/             # Feature-specific modules
    ├── types.ts           # Feature types
    ├── parser.ts          # Feature parsers
    ├── providers/         # Provider implementations
    └── generators/        # Resource generators
```

## TypeScript Scripts (Bun)

### Prerequisites

```bash
# Install tools via mise
mise install

# Install dependencies
bun install
```

### Secrets Management

**Status:** ✅ Complete (Phase 3: Infrastructure Bootstrapping)

Provider-agnostic secrets management with centralized `secrets.yaml` configuration and full infrastructure bootstrapping.

**Files:**

- `scripts/secrets.ts` - Main CLI ✅
- `scripts/secrets/` - Secrets-specific modules
  - `types.ts` - Provider-agnostic schema ✅
  - `parser.ts` - Parse secrets.yaml ✅
  - `providers/base.ts` - Provider interface ✅
  - `providers/gcp.ts` - GCP implementation ✅
  - `generators/clustersecretstore.ts` - Generate ClusterSecretStore ✅
  - `generators/externalsecret.ts` - Generate ExternalSecret ✅
  - `gcp-setup.ts` - GCP service account, IAM, API setup ✅
  - `k8s-setup.ts` - Kubernetes namespace, gcpsm-secret setup ✅
  - `tls-setup.ts` - TLS ClusterIssuer generation ✅
  - `validate-cluster.ts` - Cluster state validation ✅

**Configuration:**

- `values/clusters/<cluster>/argocd/secrets.yaml` - Cluster-wide infra secrets registry ✅
- `values/deployments/mycure-staging.yaml` - Staging deployment (secrets via ESO remoteRefs) ✅
- `values/deployments/mycure-production.yaml` - Production deployment (secrets via ESO remoteRefs) ✅

**Auto-Detection Features:**

- **GCP Project**: Detects from existing `gcp-secretstore.yaml` → `gcloud config` → prompts
- **Provider**: Detects from existing `*-secretstore.yaml` files → defaults to `gcp`
- **Kubeconfig**: Discovers all files in `~/.kube/` → shows interactive selection menu
- **Context Display**: Shows current `kubectl context` when kubeconfig is configured

**Priority Order:**

```
Project ID:   CLI flag > env var > gcp-secretstore.yaml > gcloud config > prompt
Provider:     CLI flag > existing *-secretstore.yaml > default (gcp)
Kubeconfig:   CLI flag > env var > ~/.kube/ discovery + selection > prompt
```

**Usage:**

```bash
# Auto-detect everything (idempotent, no flags needed!)
bun scripts/secrets.ts generate
bun scripts/secrets.ts validate-cluster

# Quick setup (secrets only, auto-detects project)
bun scripts/secrets.ts setup

# Full infrastructure setup (auto-detects project + kubeconfig)
bun scripts/secrets.ts setup --full

# Explicit values (overrides auto-detection)
bun scripts/secrets.ts setup --project my-project
bun scripts/secrets.ts setup --full --project my-project --kubeconfig ~/.kube/cluster-main

# Validate secrets.yaml files
bun scripts/secrets.ts validate

# Validate cluster state (auto-discovers kubeconfig, shows context)
bun scripts/secrets.ts validate-cluster

# Dry-run mode
bun scripts/secrets.ts generate --dry-run

# Using environment variables
export GCP_PROJECT_ID=my-project-prod
export KUBECONFIG=/path/to/kubeconfig
bun scripts/secrets.ts setup

# Via mise tasks
mise run secrets setup --project my-project-prod
mise run secrets:generate
mise run secrets:validate
```

**Full Setup (`--full` flag) includes:**

1. **GCP Infrastructure:**
   - Enable Secret Manager API
   - Create `external-secrets` service account
   - Grant `roles/secretmanager.secretAccessor` IAM role
   - Generate service account key to `~/.gcp/external-secrets-{PROJECT}.json`

2. **Kubernetes Infrastructure:**
   - Create `external-secrets-system` namespace
   - Create `gcpsm-secret` with service account credentials

3. **TLS Setup:**
   - Generate Let's Encrypt ClusterIssuer manifests (staging + production)
   - HTTP-01 challenge configuration

4. **Secrets Setup:**
   - Create/update GCP Secret Manager secrets
   - Generate ExternalSecret manifests

**Schema Example:**

```yaml
secrets:
  - name: postgresql              # K8s secret name
    remoteRef: example-staging-postgresql-password # Provider reference (abstract)
    targetNamespace: example-staging  # Optional, inferred from location
    keys:
      - key: postgres-password    # K8s secret key
        remoteKey: staging-postgresql-password  # Provider key
        generate: true            # Auto-generate value
```

**Implementation Complete:**

**Phase 1 & 2:**

- ✅ package.json, tsconfig.json setup
- ✅ mise.toml updated (bun added)
- ✅ Provider-agnostic secrets.yaml files created
- ✅ Shared library (scripts/lib/) implemented
- ✅ Types and parser implemented
- ✅ GCP provider implementation
- ✅ Manifest generators
- ✅ CLI implementation (setup, generate, validate commands)
- ✅ Bash scripts removed

**Phase 3 (Infrastructure Bootstrapping):**

- ✅ GCP service account creation with idempotency
- ✅ IAM permission granting with retry logic
- ✅ Service account key generation
- ✅ Secret Manager API enablement
- ✅ Kubernetes namespace creation
- ✅ K8s gcpsm-secret creation
- ✅ TLS ClusterIssuer generation (Let's Encrypt + Cloudflare)
- ✅ Environment variable support (GCP_PROJECT_ID, KUBECONFIG)
- ✅ Cluster state validation (validate-cluster command)
- ✅ Full infrastructure setup mode (--full flag)

**Phase 4 (Auto-Detection & Idempotency):**

- ✅ GCP project auto-detection from existing gcp-secretstore.yaml
- ✅ GCP project fallback to gcloud config
- ✅ Provider auto-detection from existing *-secretstore.yaml files
- ✅ Kubeconfig auto-discovery from ~/.kube/ directory
- ✅ Interactive kubeconfig selection menu
- ✅ Current kubectl context display
- ✅ Priority-based configuration resolution
- ✅ Fully idempotent re-runs (no manual re-entry needed)

## Other TypeScript Scripts

All operational scripts are TypeScript (Bun), wired as `mise run <task>`:

- `scripts/bootstrap.ts` - Bootstrap cluster with ArgoCD (`mise run bootstrap`)
- `scripts/provision.ts` - Provision cluster with OpenTofu (`mise run provision`)
- `scripts/admin.ts` - Port-forward to admin UIs (`mise run admin`)
- `scripts/validate.ts` - Validate infrastructure templates (`mise run validate-template`)
- `scripts/resize.ts` - Resize StatefulSet PVCs (`mise run resize-storage`)
- `scripts/seed.ts` - Seed cluster data (`mise run seed`)
- `scripts/upgrade-gateway-api-crds.sh` - Upgrade Gateway API CRDs

## Development

### Running TypeScript Scripts

```bash
# Direct execution
bun scripts/secrets.ts

# Via mise tasks
mise run secrets

# With arguments
bun scripts/secrets.ts setup --provider gcp
```

### Adding New Scripts

1. Create `scripts/{name}.ts` for CLI entry point
2. Create `scripts/{name}/` for feature-specific modules
3. Use `scripts/lib/` for shared utilities
4. Update `mise.toml` if adding tasks
5. Update this README

### Import Aliases

```typescript
import { loadKubeConfig } from "@/lib/k8s";
import { parseSecretsFile } from "@/secrets/parser";
```

Configured in `tsconfig.json`:

```json
{
  "paths": {
    "@/lib/*": ["scripts/lib/*"],
    "@/secrets/*": ["scripts/secrets/*"]
  }
}
```

## Scripts

Operational scripts are TypeScript (Bun); `upgrade-gateway-api-crds.sh` is a small shell helper.

| Script | Status | Notes |
|--------|--------|-------|
| secrets.ts | ✅ Complete | TypeScript |
| bootstrap.ts | ✅ Complete | TypeScript |
| provision.ts | ✅ Complete | TypeScript |
| admin.ts | ✅ Complete | TypeScript |
| validate.ts | ✅ Complete | TypeScript |
| resize.ts | ✅ Complete | TypeScript |
| seed.ts | ✅ Complete | TypeScript |
