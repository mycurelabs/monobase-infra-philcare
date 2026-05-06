# PhilCare Seed Script Upgrade — Design

**Date:** 2026-05-06
**Status:** Approved (brainstorming)
**Target file:** `scripts/seed.ts`
**Source of truth being ported from:** `mycure-infra/scripts/seed.ts` (~6800 lines)

## Problem

`philcare-infra/scripts/seed.ts` is a 323-line stub that creates 7 users, 1 organization, and member rows. Anyone logging into philcare-staging sees an empty clinic — no patients, no services, no partners, no clinical fixtures. The mycure seed exists with 6800 lines of demo content (patients, encounters, services, HMOs, products, lab tests, etc.) and is the reference for what a "complete" demo clinic looks like in this stack.

## Goal

Port the mycure seed feature-set to philcare-staging, rebranded for PhilCare. Same flags, same idempotency model, same CLI ergonomics. After running, philcare-staging should look and behave like a working clinic for demos and verification work.

## Non-goals

- Refactoring the seed into modules or a shared library. (Considered as Approach 2/3 in brainstorming, deferred.)
- Seeding philcare-production. The script gates production behind `--confirm`, but that path is not exercised here.
- Automated tests. Verification is manual against the live API (parity with mycure).

## Scope

### In scope (full port from mycure)

- 7 role-based users (`@philcare.test` domain) with role bundles: admin, doctor, pediatrician, family doctor, nurse, cashier, lab tech, imaging tech.
- 3-org facility hierarchy: parent **PhilCare Clinics** + branches **Vital Kinetics Makati** and **Astracare Makati**.
- 25 random Filipino patients per facility (default; `--patients N` to override) with full demographics + insurance.
- 1 fixed demo patient (Pedro Demo Lopez) with 2 encounters, 9 medical records, vitals, ICD-10 assessments (T2DM, HTN), Metformin + Losartan med orders.
- Better-auth self-care patient accounts (default 5; `--patient-accounts N`).
- Services catalog (~30 entries across 7 service types).
- Inventory: suppliers, stock rooms, product types, adjustment reasons, ~200 products per facility.
- Billing: payment methods, tax types, service providers (with reader's-fee commissions), withholding taxes.
- Partners: HMOs, companies, government, diagnostic centers (real PH brands; PhilCare HMO included since the *clinic* accepts that *insurance product* — different entity from the tenant).
- Registration: extra queues (Procedure Room + per-doctor consults), patient tags, privacy notices.
- EMR: medicines (~40 PH formulary), favorite medicines, dental statuses (19 entries), form templates from sibling repo.
- PME: report templates from sibling repo.
- LIS: sections, ~18 tests, ~70 measures, packages, analyzers, report templates.
- RIS: sections, ~12 tests, packages, report templates.
- System fixtures (installation-wide): 15 countries, 37 PH address components, 50 ICD-10 codes, 12 PRC professions, 20 medical specialties.

### Out of scope

- Tenant divergences from mycure's clinical content. The seed is intentionally a 1:1 port; any PhilCare-specific clinical content (different services menu, different HMO mix, different localized fixtures) is a follow-up.

## Architecture

**Single-file monolith**, mirroring `mycure-infra/scripts/seed.ts`. Same section delimiters, same helper functions, same loop structures. Reasons:

1. Existing convention in both repos — both seed scripts are single files today.
2. Preserves a clean diff against mycure so future upstream improvements can be cherry-picked.
3. No new module structure to maintain.

Modular extraction (Approach 2) and shared library (Approach 3) were considered and deferred — see "Alternatives considered."

### Branding indirection

All tenant-specific strings live in a single `BRANDING` constants block near the top of the file. Nothing else in the file should reference the literal string "PhilCare" or facility names directly — every reference goes through `BRANDING`.

```ts
const BRANDING = {
  password: "PhilCare2026!",
  emailDomain: "philcare.test",
  facilityEmailDomain: "philcare-demo.example.ph",
  fromAddr: "noreply@stg.mycure.stitchtechsolutions.com",
  cmsUrl: "https://cms.stg.mycure.stitchtechsolutions.com",
  facilities: {
    parent:   { name: "PhilCare Clinics",       emailLocal: "main",          slug: "philcare-clinics" },
    branches: [
      { name: "Vital Kinetics Makati", emailLocal: "vitalkinetics", slug: "vital-kinetics-makati" },
      { name: "Astracare Makati",      emailLocal: "astracare",     slug: "astracare-makati" },
    ],
  },
  clinicReferenceName: "PhilCare Clinics",
} as const;
```

### Tenant-neutral data (kept verbatim)

- HMO partner list (Maxicare, Intellicare, Medicard, PhilCare HMO, Cocolife, Pacific Cross, Insular, etc.).
- Filipino patient names, ICD-10 codes, services catalog, medicines, lab/imaging tests.
- System fixtures (countries, professions, specialties).
- `externalId` prefixes (`SEED-PATIENT-`, `SEED-SVC-`, `SEED-FIXTURE-`) — preserves idempotency semantics.

## CLI surface

| Flag                     | Behaviour                                                                                                                                |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `--env <name>`           | `staging` → `https://api.stg.mycure.stitchtechsolutions.com`. `production` → philcare prod URL, gated by `--confirm`. Default: `staging`. |
| `--api-url <url>`        | Override the env lookup. Preserves the existing philcare seed's flag.                                                                    |
| `--confirm`              | Required when `--env production`. Prevents accidental prod seeding.                                                                       |
| `--reset`                | Wipe seed users + memberships + seed orgs + `SEED-*` entities, then seed fresh. Requires `BRANDING.password` to match what was originally used. |
| `--patients <N>`         | Random Filipino patients per facility. Default 25. `0` to skip.                                                                          |
| `--patient-accounts <N>` | Better-auth self-care accounts. Default 5. `0` to skip.                                                                                  |
| `--help`                 | Print usage.                                                                                                                              |

`mise run seed -- <flags>` is the canonical invocation (matches mycure).

## Sibling-repo template resolution

EMR / PME / LIS / RIS templates are imported from the sibling `mycure` frontend repo at `apps/mycure/src/pages/{emr,pme,lis,ris}/{formTemplatePresets,reportTemplatePresets}.ts`.

**Path candidates**, tried in order:

```ts
const candidates = [
  `${import.meta.dir}/../../mycure/apps/...`,            // sibling to philcare-infra (e.g., infra-ai/mycure/)
  `${import.meta.dir}/../../../mycure/apps/...`,         // up one more (e.g., work/mycure/)
  process.env.MYCURE_REPO
    ? `${process.env.MYCURE_REPO}/apps/...`              // explicit override
    : null,
].filter(Boolean);
```

If none hit → log a yellow warning per template kind, set `MYCURE_REPO` hint, **continue with the rest of the seed**. No hard failure.

Today (philcare-infra at `infra-ai/philcare-infra/`, mycure repo at `work/mycure/`), candidate 2 hits — no extra config needed.

## Idempotency model

Carried over from mycure verbatim:

- Every seeded entity has a deterministic `externalId`. Re-runs query by `externalId`, skip if present.
- Users dedup'd by email. Collision → sign in instead of sign up (existing philcare behaviour, preserved).
- Partners dedup'd by `(facility, name)` against `/insurance-contracts`.
- Auto-created hapihub queues (8 defaults per `types=clinic` org) are not re-created — only Procedure Room + per-doctor consults are added on top.
- Re-running without `--reset` should produce a no-op log dominated by `~ already exists` lines.

## Reset flow

`--reset`:
1. Sign in as `superadmin@<emailDomain>`.
2. List + delete:
   - Seed users (filter by `BRANDING.emailDomain`).
   - Their memberships.
   - Orgs whose name matches any of `BRANDING.facilities.parent.name` or `BRANDING.facilities.branches[*].name`.
   - All entities with a `SEED-*` externalId scoped to those facilities.
3. Continue to fresh seed.

**Constraint:** `BRANDING.password` must still match the password used at the time of the original seed (better-auth uses bcrypt; can't sign in if rotated). If rotated, log red instructions to manually delete the seed user and re-run.

## First-run conflict (existing data)

philcare-staging already has a "PhilCare Demo Clinic" org from the previous 323-line seed. The new seed creates "PhilCare Clinics" — a different name, so they'd coexist if not cleaned.

**Recommended first run:** `mise run seed -- --reset`. The existing reset logic catches the old org by `@philcare.test` email lookup → membership → org cascade. Documented in the script's help text and in the operations runbook.

## Error handling

- HTTP errors → message includes status code and response body.
- 429 → exponential backoff, retry. Existing philcare seed already does this for signups; extended to all endpoints.
- "Duplicate"/"UNIQUE" → info-level skip, not a failure.
- Unrecoverable error in one section → log red, set non-zero exit code at the end, **continue executing other sections** (sections are loosely coupled — patient seeding doesn't depend on lab seeding).

## Verification protocol

No automated tests. Manual verification after each run:

1. **Local sanity:**
   - `bun scripts/seed.ts --help` — usage prints, no syntax errors.
   - Bad URL → fast bail, no hang.
2. **Reset run on staging:**
   - `mise run seed -- --reset` against `--env staging`.
   - Watch for red `✗`. Yellow `⚠` on missing template files acceptable.
3. **Idempotency run:**
   - Re-run without `--reset`. Every entity logs `~ already exists`. No new rows.
4. **Live API verification** (curl + jq):
   - 3 orgs (1 parent, 2 branches with `parent` set).
   - ≥ 25 patients on parent, ~ on each branch.
   - ~30 services per facility.
   - HMO partners present.
5. **End-to-end smoke** (browser):
   - Log in to `https://cms.stg.mycure.stitchtechsolutions.com` as `superadmin@philcare.test` / `PhilCare2026!`.
   - Navigate to PhilCare Clinics → patients, services, HMOs visible.
   - Switch to Vital Kinetics Makati → services, queues, inventory visible.

**Pass criteria:** all five steps clean.

## Alternatives considered

| Approach                | Why deferred                                                                                                          |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **Modular split**       | Diverges from mycure's structure → harder to backport upstream changes. Re-evaluate after first port lands.            |
| **Shared seed library** | Cross-repo package machinery doesn't exist today. Out of scope for "upgrade philcare's seed."                          |

## Open questions

None at design time. Implementation phase may surface:
- Are role IDs (`clinic_manager`, `nurse_head`, `lab_tech`, `lab_qc`, `imaging_qc`, etc.) recognized by hapihub 11.3.9 or do they need to be created? — verified during implementation, fallback is to drop unknown roles from the bundle.
- Whether the existing "PhilCare Demo Clinic" org can be deleted by `--reset` cleanly — verified during the first reset run.
