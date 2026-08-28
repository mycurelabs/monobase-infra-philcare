# ApplicationSet Auto-Discovery Guide

Source: `charts/argocd-bootstrap/templates/applicationset-auto-discover.yaml`

## How It Works

The `monobase-auto-discover` ApplicationSet uses ArgoCD's **Git Files Generator**:

```yaml
generators:
  - git:
      repoURL: https://github.com/mycurelabs/monobase-infra-template.git
      revision: HEAD
      files:
        - path: "values/deployments/*.yaml"     # Include all YAML files
        - path: "values/deployments/example-*.yaml"
          exclude: true                          # Exclude examples
```

Every deployment is a flat file under `values/deployments/`. Inheritance is
governed by two explicit keys in the file itself, not by path or filename:

- `extends: <name>` — names the single parent file (e.g. `extends: base` →
  `values/deployments/base.yaml`), merged FIRST; this file wins per key.
- `disabled: "true"` — makes a file parent-only. Its Application is filtered out
  by the ApplicationSet selector, so parents like `base.yaml` never deploy.

### Discovery Process

1. ArgoCD periodically polls the Git repository
2. Git Files Generator scans `values/deployments/*.yaml`
3. For each matching file, ArgoCD reads the file content as YAML
4. Template variables are populated from file path metadata

### Template Variables

| Variable | Example | Description |
|----------|---------|-------------|
| `{{.path.path}}` | `values/deployments` | Directory path |
| `{{.path.filename}}` | `<client>-production.yaml` | Filename |
| `{{.path.filename \| trimSuffix ".yaml"}}` | `<client>-production` | Name without extension |

### Application Name Mapping

```
values/deployments/<client>-production.yaml  →  <client>-production-root
values/deployments/<client>-staging.yaml     →  <client>-staging-root
values/deployments/newclient-prod.yaml     →  newclient-prod-root
```

### Namespace Mapping

Filename (without `.yaml`) becomes the target namespace:

```
<client>-production.yaml  →  namespace: <client>-production
<client>-staging.yaml     →  namespace: <client>-staging
```

## Go Template Syntax

The ApplicationSet uses Go templates with `goTemplate: true`:

```yaml
goTemplate: true
goTemplateOptions: ["missingkey=error"]  # Fail on missing keys
```

Key expressions:

```yaml
name: '{{.path.filename | trimSuffix ".yaml"}}-root'
namespace: '{{.path.filename | trimSuffix ".yaml"}}'
valueFiles:
  - '../../{{.path.path}}/{{.path.filename}}'
```

## Sync Policies

### ApplicationSet Level

```yaml
syncPolicy:
  preserveResourcesOnDeletion: true    # Don't cascade-delete namespace resources
```

### Per-Application Level (in template)

```yaml
syncPolicy:
  automated:
    prune: true        # Remove resources deleted from Git
    selfHeal: true     # Revert manual kubectl changes
    allowEmpty: false   # Prevent accidental empty deploys
  syncOptions:
    - CreateNamespace=true              # Auto-create namespace
    - PrunePropagationPolicy=foreground # Delete in correct order
    - PruneLast=true                    # Prune after new resources healthy
  retry:
    limit: 5
    backoff:
      duration: 5s
      factor: 2
      maxDuration: 3m
```

## Infrastructure Root Application

Separate from the ApplicationSet, `charts/argocd-bootstrap/templates/infrastructure-root.yaml` manages cluster-wide infrastructure:

```yaml
source:
  path: charts/argocd-infrastructure
  helm:
    valueFiles:
      - ../../values/clusters/<cluster>/argocd/infrastructure.yaml
```

This deploys:

- cert-manager + issuers, NGINX Gateway Fabric + shared gateways
- External Secrets Operator + secret stores
- Monitoring (Prometheus + Grafana), Velero + resources
- Kyverno + policies, Falco + rules
- Gateway resources, External DNS, Longhorn (optional)
- Storage resources

## Bootstrap Sequence

```
1. Install ArgoCD (manual helm install)
2. Apply the argocd-bootstrap chart's infrastructure-root Application
   → ArgoCD deploys all infrastructure components (charts/argocd-infrastructure)
3. Apply the argocd-bootstrap chart's auto-discover ApplicationSet
   → ArgoCD discovers values/deployments/*.yaml files
   → Creates per-deployment root Applications
   → Each root Application deploys tenant stack
```

After bootstrap, everything is Git-driven:

- Edit `values/clusters/<cluster>/argocd/infrastructure.yaml` → infrastructure changes
- Edit `values/deployments/*.yaml` → tenant deployment changes
- Add/remove files in `values/deployments/` → add/remove tenants

## Ignored Differences

The ApplicationSet template ignores expected Helm-managed annotations:

```yaml
ignoreDifferences:
  - group: "*"
    kind: "*"
    jsonPointers:
      - /metadata/annotations/meta.helm.sh~1release-name
      - /metadata/annotations/meta.helm.sh~1release-namespace
```
