# Template Fork Guide

This repo is a generic infrastructure template. A new tenant forks it and changes
**only files under `values/`** — the charts, terraform modules, and ArgoCD bootstrap
logic are shared and should not be edited per-tenant.

The template ships concrete reference config:

- `values/deployments/base.yaml` — shared parent, `disabled: "true"` (parent-only,
  never deploys) — plus `values/deployments/mycure-{staging,production}.yaml`
  (`extends: base`): real reference deployments (namespace = filename).
- `values/clusters/aws-main/` — ArgoCD infra config + terraform tfvars.

You copy the `mycure-<env>.yaml` overlays to your own `<client>-<env>.yaml` names
and swap identity; the auto-discover ApplicationSet then picks them up.

## 1. Fork

```bash
git clone git@github.com:mycurelabs/monobase-infra-template.git infra-<client>
cd infra-<client>
git remote rename origin upstream          # template stays as `upstream`
git remote add origin <your repo>          # your tenant repo
```

Pull template improvements later with `git fetch upstream && git merge upstream/main`.
Your changes live only in `values/`, so merges don't conflict with the engine.

## 2. Deployments — copy the reference overlays and swap identity

There is no per-client base — every tenant shares the single `base.yaml`
(`disabled: "true"`, parent-only). Copy each `mycure-<env>.yaml` →
`<client>-<env>.yaml`, keep the `extends: base` line at the top of each, then
replace the placeholders:

| Placeholder | Replace with |
|---|---|
| `<client>` (namespaces, `secretPrefix`, `remoteKey` prefixes) | your tenant slug, e.g. `philcare` |
| `ghcr.io/mycurelabs/*` (image repos) | keep for the shared product images; override only if you build your own |
| `example.com` (all gateway hostnames) | your domain(s) |
| `service@example.com`, `no-reply@example.com` | your service / alert addresses |
| `<load-balancer-ip>`, `<tailnet-ip>` (`cadence.publicAddr` etc.) | your LB / tailnet address |

> **White-labeling MyCure on your own cluster?** You can keep the `mycure-*`
> filenames/namespaces (reusing the product's secret prefixes) instead of
> renaming — but then add a `.gitattributes` so your overlays win on merge and
> upstream example updates never conflict:
> ```
> values/deployments/mycure-production.yaml merge=ours
> values/deployments/mycure-staging.yaml    merge=ours
> ```
> (+ `git config merge.ours.driver true` in each clone).

## 3. Cluster — copy `aws-main/` and swap infra identity

Copy `values/clusters/aws-main/` → `values/clusters/<cluster-name>/` and replace:

| Placeholder | Replace with |
|---|---|
| `aws-main` (dir name) | your cluster name |
| `<velero-bucket>` | your Velero object-storage bucket |
| `<load-balancer-id>` | your cloud LB id |
| `<tailnet-ip>` | the internal gateway's tailnet IP |
| DNS zones / listener hostnames (`*.example.com`) | your domains |
| `letsencrypt-production` cert issuer, `cloudflare-api-token` | keep, or rename consistently |
| `infra:` (ops-plane node pool) | keep if your cluster has a dedicated infra pool; **omit** it otherwise -- the operators then schedule anywhere |

The **per-tenant bootstrap selection lives entirely in `values/`** — edit
`values/clusters/<cluster-name>/argocd/bootstrap.yaml` (`argocd.repoURL` → your
fork's repo, `argocd.clusterName` → your cluster, `argocd.deploymentPaths` →
your `<client>-<env>.yaml` set). `scripts/bootstrap.ts` auto-loads that file, so
you **never edit `charts/argocd-bootstrap/values.yaml`** — that shared chart
stays untouched and merges cleanly from upstream.

## 4. External resources to provision (outside this repo)

- **GCP Secret Manager** (or your ESO backend): create `<client>-<env>-*` secrets for every
  `remoteKey` in your deployment files (OAuth, encryption keys, DB creds, Stripe, Postmark,
  MinIO root, cadence SA key), plus the shared `infrastructure-*` secrets
  (`infrastructure-cloudflare-api-token`, `infrastructure-tailscale-operator-oauth`,
  `infrastructure-postmark-api-key`).
- **DNS**: your zones on Cloudflare (or swap the external-dns / cert-manager provider).
- **Tailscale**: your tailnet + operator OAuth client.
- **Cluster**: provision via `values/clusters/<cluster-name>/terraform` (`mise run cluster-plan|apply`),
  then capture the LB id / tailnet IP back into `infrastructure.yaml`.
- **Image registry**: build/host the product images, or arrange pull access.

## What NOT to edit

`charts/**`, `terraform/modules/**`, `scripts/**`, and the ArgoCD bootstrap logic are the
shared **engine**. A fork changes only `values/`. Per-tenant knobs already live in `values/`
— including the bootstrap selection (`values/clusters/<cluster>/argocd/bootstrap.yaml`:
`repoURL` / `clusterName` / `deploymentPaths`), auto-loaded by `scripts/bootstrap.ts` — so
you should **not** edit `charts/argocd-bootstrap/values.yaml` or anything else in the engine.

If you genuinely need an engine change, do **one** of:

1. **Upstream it first (preferred)** — open an issue/PR on the template, then pull it back
   with `git merge upstream/main`. Every tenant benefits and nothing diverges.
2. **Isolate + generalize it** — if you must carry it locally, put it in its **own commit**,
   written **generically** (no tenant specifics — drive it from `values/`) so it can be PR'd
   upstream as-is. Never bury a tenant-specific change in the engine: it rots your merge base
   (`git merge upstream/main` starts conflicting) and can't be shared back.

`main` on the template is **append-only** — it is never force-pushed/rewritten, so
`git merge upstream/main` always fast-forwards cleanly.
