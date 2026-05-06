# PhilCare Seed Script Upgrade — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `philcare-infra/scripts/seed.ts` (323-line stub) with a 1:1 port of `mycure-infra/scripts/seed.ts` (~6800 lines), rebranded for PhilCare.

**Architecture:** Single-file monolith. Copy mycure's seed.ts verbatim, hoist all tenant-specific strings into a `BRANDING` constants block at the top, surgically replace mycure references with `BRANDING.*` references. Preserves clean diff against mycure for future cherry-picks.

**Tech Stack:** Bun runtime, TypeScript, `chalk` + `ora` (already in `package.json`), Better-Auth + hapihub HTTP API.

**Reference design:** `docs/superpowers/specs/2026-05-06-philcare-seed-upgrade-design.md`

---

## File Structure

| File | Action | Purpose |
| --- | --- | --- |
| `scripts/seed.ts` | **Replace** (was 323 lines, becomes ~6800) | The seed script itself. |
| `mise.toml` | **Modify** (add `[tasks.seed]`) | Wire `mise run seed` to the script. |
| `package.json` | No change | `chalk`, `ora` already present. |
| `bun.lock` | No change | No new deps. |

---

## Task 1: Copy mycure seed verbatim and add mise task

**Files:**
- Replace: `scripts/seed.ts`
- Modify: `mise.toml` — append `[tasks.seed]` block after `[tasks.unbootstrap]` (last entry).

- [ ] **Step 1: Replace seed.ts with mycure's version**

```bash
cd /Users/centipede/Documents/workspace/work/infra-ai/philcare-infra
cp ../mycure-infra/scripts/seed.ts scripts/seed.ts
```

- [ ] **Step 2: Add `[tasks.seed]` to mise.toml**

Append at end of `mise.toml`:

```toml
[tasks.seed]
description = "Seed demo data (users, org, patients, services, partners, ...) into an environment"
run = 'bun scripts/seed.ts "$@"'
```

- [ ] **Step 3: Verify the script compiles & --help runs**

```bash
mise run seed -- --help 2>&1 | head -5
```

Expected: prints `MyCure Seed Script` (still mycure-branded — that's fine for this checkpoint) followed by usage. No syntax errors.

- [ ] **Step 4: Commit**

```bash
git add scripts/seed.ts mise.toml
git commit -m "chore(seed): copy mycure seed verbatim as starting point for philcare port"
```

---

## Task 2: Introduce BRANDING constants block

**Files:**
- Modify: `scripts/seed.ts` — insert constants block above the `ENVS` map (around line 19).

- [ ] **Step 1: Add BRANDING block**

After the file's docstring/imports (before `const ENVS = ...`), insert:

```ts
// ---------------------------------------------------------------------------
// Tenant branding — every tenant-specific string is sourced from here.
// Nothing else in this file should reference "PhilCare" or facility names directly.
// ---------------------------------------------------------------------------
const BRANDING = {
  /** Default password for ALL seeded users (staff + patient accounts). */
  password: "PhilCare2026!",
  /** Domain for staff user accounts (e.g. doctor@<emailDomain>). */
  emailDomain: "philcare.test",
  /** Domain for facility contact emails (e.g. main@<facilityEmailDomain>). */
  facilityEmailDomain: "philcare-demo.example.ph",
  /** From-address for outbound email (Mailpit-routed in staging). */
  fromAddr: "noreply@stg.mycure.stitchtechsolutions.com",
  /** CMS login URL — used in summary output. */
  cmsUrl: "https://cms.stg.mycure.stitchtechsolutions.com",
  /** Display name used in clinician bios and a few descriptions. */
  clinicReferenceName: "PhilCare Clinics",
  /** Facility hierarchy: 1 parent + N branches. */
  facilities: {
    parent: { name: "PhilCare Clinics", emailLocal: "main", slug: "philcare-clinics" },
    branches: [
      { name: "Vital Kinetics Makati", emailLocal: "vitalkinetics", slug: "vital-kinetics-makati" },
      { name: "Astracare Makati", emailLocal: "astracare", slug: "astracare-makati" },
    ],
  },
  /** Legacy seed org names to delete during --reset (from prior seed runs). */
  legacyOrgNames: ["PhilCare Demo Clinic", "MyCure Demo Branch"],
} as const;
```

- [ ] **Step 2: Verify still compiles**

```bash
bun --bun scripts/seed.ts --help 2>&1 | head -3
```

Expected: prints usage. No "Cannot find name 'BRANDING'" — the new const is unused but valid.

- [ ] **Step 3: Commit**

```bash
git add scripts/seed.ts
git commit -m "feat(seed): add BRANDING constants block (philcare values)"
```

---

## Task 3: Rebrand top-of-file (header, ENVS, password, help text)

**Files:**
- Modify: `scripts/seed.ts` lines 1-260 region.

- [ ] **Step 1: Rewrite the file docstring header**

Replace the `/** Seed script for MyCure environments ... */` block (top of file) with:

```ts
#!/usr/bin/env bun
/**
 * Seed script for PhilCare environments
 * Creates a demo facility hierarchy with role-based users, patients,
 * services, partners, lab/imaging fixtures, and clinical content.
 *
 * Usage:
 *   bun scripts/seed.ts --env staging
 *   bun scripts/seed.ts --env production --confirm
 *   bun scripts/seed.ts --api-url https://custom-url.example.com
 */
```

- [ ] **Step 2: Replace ENVS map**

Find:

```ts
const ENVS: Record<string, { api: string; cms: string }> = {
  preprod: {
    api: "https://hapihub.preprod.localfirsthealth.com",
    cms: "https://mycure.preprod.localfirsthealth.com",
  },
  production: {
    api: "https://hapihub.localfirsthealth.com",
    cms: "https://mycure.localfirsthealth.com",
  },
};
```

Replace with:

```ts
const ENVS: Record<string, { api: string; cms: string }> = {
  staging: {
    api: "https://api.stg.mycure.stitchtechsolutions.com",
    cms: BRANDING.cmsUrl,
  },
  production: {
    api: "https://api.mycure.stitchtechsolutions.com",
    cms: "https://cms.mycure.stitchtechsolutions.com",
  },
};
```

- [ ] **Step 3: Update PASSWORD constant**

Find: `const PASSWORD = "Mycure123!";`
Replace with: `const PASSWORD = BRANDING.password;`

- [ ] **Step 4: Update printUsage() text**

Find: `${chalk.bold("MyCure Seed Script")}` → `${chalk.bold("PhilCare Seed Script")}`

Find:
> when superadmin@mycure.test was created. If the password

Replace with:
> when superadmin@philcare.test was created. If the password

Find: `Passwords are the same Mycure123!` → `Passwords are the same PhilCare2026!`

Update example commands at the bottom of the help text:

Find:
```
  bun scripts/seed.ts --env preprod
  bun scripts/seed.ts --env production --confirm
  bun scripts/seed.ts --api-url http://localhost:7500 --reset
  bun scripts/seed.ts --api-url http://localhost:7500 --patients 25
  mise run seed -- --env preprod
```

Replace with:
```
  bun scripts/seed.ts --env staging
  bun scripts/seed.ts --env production --confirm
  bun scripts/seed.ts --api-url https://api.stg.mycure.stitchtechsolutions.com --reset
  bun scripts/seed.ts --api-url https://api.stg.mycure.stitchtechsolutions.com --patients 25
  mise run seed -- --env staging
```

- [ ] **Step 5: Verify --help renders**

```bash
mise run seed -- --help 2>&1 | head -10
```

Expected: prints `PhilCare Seed Script` and `Target environment: staging, production`.

- [ ] **Step 6: Commit**

```bash
git add scripts/seed.ts
git commit -m "feat(seed): rebrand header, ENVS, PASSWORD, help text"
```

---

## Task 4: Rebrand USERS array email domain

**Files:**
- Modify: `scripts/seed.ts` USERS array (around line 348).

- [ ] **Step 1: Domain-swap all USERS emails**

Use `sed`-style targeted Edit on the 9 lines starting `superadmin@mycure.test` through `imaging@mycure.test`. Each `@mycure.test` → `@${BRANDING.emailDomain}` is unsafe (string interpolation in object literal), so use template strings.

Find each line in USERS array and replace email field. Examples:

```ts
// before
{ email: "superadmin@mycure.test", name: "Carlos Tan",      ... },
// after
{ email: `superadmin@${BRANDING.emailDomain}`, name: "Carlos Tan",  ... },
```

Apply to all 9 entries: superadmin, admin, doctor, pedia, familymd, nurse, cashier, laboratory, imaging.

- [ ] **Step 2: Update USER_PROFILES keys**

The `USER_PROFILES` object (around line 405) is keyed by email string. Same rewrite — change keys from `"superadmin@mycure.test"` etc. to `\`superadmin@${BRANDING.emailDomain}\``. Note that JS object keys can be computed expressions only inside `{ [key]: value }` syntax, so:

Replace the entire `const USER_PROFILES: Record<string, ...> = { ... };` declaration to use computed keys:

```ts
const USER_PROFILES: Record<string, ClinicProfile> = {
  [`superadmin@${BRANDING.emailDomain}`]: { /* ... existing body ... */ },
  [`admin@${BRANDING.emailDomain}`]:      { /* ... */ },
  [`doctor@${BRANDING.emailDomain}`]:     { /* ... */ },
  [`pedia@${BRANDING.emailDomain}`]:      { /* ... */ },
  [`familymd@${BRANDING.emailDomain}`]:   { /* ... */ },
  [`nurse@${BRANDING.emailDomain}`]:      { /* ... */ },
  [`cashier@${BRANDING.emailDomain}`]:    { /* ... */ },
  [`laboratory@${BRANDING.emailDomain}`]: { /* ... */ },
  [`imaging@${BRANDING.emailDomain}`]:    { /* ... */ },
};
```

(Body content of each profile is unchanged in this step — bios are touched in Task 6.)

- [ ] **Step 3: Update FIXED_PATIENT_DOCTOR_EMAIL constant**

Find: `const FIXED_PATIENT_DOCTOR_EMAIL = "doctor@mycure.test";`
Replace with: `const FIXED_PATIENT_DOCTOR_EMAIL = \`doctor@${BRANDING.emailDomain}\`;`

- [ ] **Step 4: Update SERVICE_PROVIDER_BINDINGS array**

Find all `userEmail: "doctor@mycure.test"` (and pedia, familymd, nurse, imaging variants) in the SERVICE_PROVIDER_BINDINGS array (around line 2668) and rewrite as template strings:

```ts
{ userEmail: `doctor@${BRANDING.emailDomain}`,   serviceName: "...", ... },
```

Apply to all entries (doctor, pedia, familymd, nurse, imaging).

- [ ] **Step 5: Update WITHHOLDING_TAX bindings**

Find around line 2804:

```ts
{ userEmail: "doctor@mycure.test", withholdingTax: 10 },
{ userEmail: "nurse@mycure.test",  withholdingTax: 5 },
```

Replace with template strings using `BRANDING.emailDomain`.

- [ ] **Step 6: Update extra-queue writers (around line 3384)**

Find:
```ts
{ email: "doctor@mycure.test", ... },
{ email: "pedia@mycure.test", ... },
{ email: "familymd@mycure.test", ... },
```

Replace email values with template strings using `BRANDING.emailDomain`.

- [ ] **Step 7: Update reset & main signIn calls**

Find both occurrences of:
```ts
await signIn("superadmin@mycure.test", PASSWORD);
```
(around lines 5952 and 6492). Replace with:
```ts
await signIn(`superadmin@${BRANDING.emailDomain}`, PASSWORD);
```

Also update the reset error-message strings (lines 5968-5977) — replace literal `superadmin@mycure.test` and `%@mycure.test` with template-string equivalents using `BRANDING.emailDomain`.

- [ ] **Step 8: Update legacy-org name lookup**

Find: `const LEGACY_SEED_ORG_NAMES = ["MyCure Demo Branch"];`
Replace with: `const LEGACY_SEED_ORG_NAMES = BRANDING.legacyOrgNames;`

- [ ] **Step 9: Update random-patient email generator**

Find around line 1022: `const email = \`${emailLocal}@mycure.test\`;`
Replace with: `const email = \`${emailLocal}@${BRANDING.emailDomain}\`;`

- [ ] **Step 10: Update fixed-demo-patient email**

Find: `email: "pedro.demo.lopez@mycure.test",`
Replace with: `email: \`pedro.demo.lopez@${BRANDING.emailDomain}\`,`

- [ ] **Step 11: Verify zero remaining mycure.test references**

```bash
grep -n "mycure\.test" scripts/seed.ts
```

Expected: **no output** (all replaced).

- [ ] **Step 12: Verify --help still works (full compile check)**

```bash
mise run seed -- --help 2>&1 | tail -5
```

Expected: usage prints, no errors.

- [ ] **Step 13: Commit**

```bash
git add scripts/seed.ts
git commit -m "feat(seed): rebrand all email references to BRANDING.emailDomain"
```

---

## Task 5: Rebrand FACILITIES array

**Files:**
- Modify: `scripts/seed.ts` — FACILITIES array (around lines 700-810) and supporting helpers.

- [ ] **Step 1: Rewrite the FACILITIES array**

Find the entire `const FACILITIES = [...]` array (3 entries: parent + QC branch + Cebu branch). Replace with:

```ts
/** "PhilCare Clinics" is the parent; the rest are child branches. */
const FACILITIES = [
  {
    name: BRANDING.facilities.parent.name,
    parentName: null,
    description:
      `Flagship outpatient clinic of the ${BRANDING.facilities.parent.name} demo network. Multi-specialty ` +
      "facility — primary care, family medicine, paediatrics, dental, and PME.",
    types: ["clinic"],
    email: `${BRANDING.facilities.parent.emailLocal}@${BRANDING.facilityEmailDomain}`,
    phone: "+63 2 8123 4567",
    website: `https://${BRANDING.facilities.parent.slug}.example.ph`,
    address: {
      line1: "Ground Floor, Demo Medical Plaza",
      line2: "123 Ayala Avenue",
      city: "Makati",
      state: "Metro Manila",
      country: "PH",
      postalCode: "1226",
    },
    socials: {
      facebook: `https://facebook.com/${BRANDING.facilities.parent.slug}`,
      instagram: `https://instagram.com/${BRANDING.facilities.parent.slug}`,
      twitter: `https://twitter.com/${BRANDING.facilities.parent.slug.replace(/-/g, "_")}`,
    },
  },
  {
    name: BRANDING.facilities.branches[0].name,
    parentName: BRANDING.facilities.parent.name,
    description:
      `${BRANDING.facilities.branches[0].name} — Makati branch focused on outpatient consultations, diagnostics, and PME packages.`,
    types: ["clinic"],
    email: `${BRANDING.facilities.branches[0].emailLocal}@${BRANDING.facilityEmailDomain}`,
    phone: "+63 2 8234 5678",
    website: `https://${BRANDING.facilities.branches[0].slug}.example.ph`,
    address: {
      line1: "2/F Vital Tower",
      line2: "Salcedo Village",
      city: "Makati",
      state: "Metro Manila",
      country: "PH",
      postalCode: "1227",
    },
    socials: {
      facebook: `https://facebook.com/${BRANDING.facilities.branches[0].slug}`,
      instagram: `https://instagram.com/${BRANDING.facilities.branches[0].slug}`,
      twitter: `https://twitter.com/${BRANDING.facilities.branches[0].slug.replace(/-/g, "_")}`,
    },
  },
  {
    name: BRANDING.facilities.branches[1].name,
    parentName: BRANDING.facilities.parent.name,
    description:
      `${BRANDING.facilities.branches[1].name} — Makati branch covering general practice, immunizations, and walk-in dental services.`,
    types: ["clinic"],
    email: `${BRANDING.facilities.branches[1].emailLocal}@${BRANDING.facilityEmailDomain}`,
    phone: "+63 2 8345 6789",
    website: `https://${BRANDING.facilities.branches[1].slug}.example.ph`,
    address: {
      line1: "G/F Astra Building",
      line2: "Legaspi Village",
      city: "Makati",
      state: "Metro Manila",
      country: "PH",
      postalCode: "1229",
    },
    socials: {
      facebook: `https://facebook.com/${BRANDING.facilities.branches[1].slug}`,
      instagram: `https://instagram.com/${BRANDING.facilities.branches[1].slug}`,
      twitter: `https://twitter.com/${BRANDING.facilities.branches[1].slug.replace(/-/g, "_")}`,
    },
  },
];
```

- [ ] **Step 2: Update facility-creation description fallback**

Find around line 685:
```ts
? "MyCure demo branch (child facility for hierarchy testing)"
: "MyCure demo clinic for environment verification",
```

Replace with:
```ts
? `${BRANDING.clinicReferenceName} demo branch (child facility for hierarchy testing)`
: `${BRANDING.clinicReferenceName} demo clinic for environment verification`,
```

- [ ] **Step 3: Update privacy-notice clinic name (English + Tagalog)**

Find lines (around 3564 and 3578) referencing `MyCure Demo Clinic respects your privacy` and the Tagalog version. Replace `MyCure Demo Clinic` → `${BRANDING.clinicReferenceName}` (template literal).

- [ ] **Step 4: Verify zero remaining "MyCure Demo Clinic" / "MyCure Demo Branch" hits**

```bash
grep -n -E "MyCure Demo (Clinic|Branch)" scripts/seed.ts
```

Expected: **no output**.

- [ ] **Step 5: Verify --help still compiles**

```bash
mise run seed -- --help 2>&1 | head -3
```

Expected: usage prints, no errors.

- [ ] **Step 6: Commit**

```bash
git add scripts/seed.ts
git commit -m "feat(seed): rebrand facility hierarchy to PhilCare Clinics + 2 Makati branches"
```

---

## Task 6: Rebrand clinician bios and remaining mycure mentions

**Files:**
- Modify: `scripts/seed.ts` — USER_PROFILES object body (lines ~437-600).

- [ ] **Step 1: Replace inline mentions in clinician bios**

Find both occurrences of:
- `"Subspecialty in adult endocrinology. Active consultant at MyCure Demo Clinic."` (around line 455)
- `"at MyCure Demo Clinic."` (around line 492)

Replace `MyCure Demo Clinic` with `${BRANDING.clinicReferenceName}` (template-literal).

- [ ] **Step 2: Update final-summary login URL**

In `main()` near the end (around line 6448), find:
```ts
console.log(`\n${chalk.bold("MyCure Seed Script")}`);
```
and the surrounding summary block. Replace `MyCure Seed Script` → `PhilCare Seed Script`. Find any `https://mycure.preprod.localfirsthealth.com` or similar literal CMS URLs and replace with `BRANDING.cmsUrl` or the `env.cms` variable already in scope.

- [ ] **Step 3: Audit all remaining mycure mentions**

```bash
grep -n -i "mycure" scripts/seed.ts | grep -v "import.meta.dir.*mycure/apps" | grep -v "MYCURE_REPO" | grep -v "alongside.*mycure" | grep -v "sibling.*mycure"
```

The grep filters out **acceptable** mentions (sibling-repo references in comments and path candidates — they describe the actual mycure repo we depend on for templates, NOT branding).

Expected: **no output** OR only clearly non-branding mentions (e.g., comments explaining the relationship to the upstream mycure repo). Surface any remaining hits and replace if branding-leaks.

- [ ] **Step 4: Verify --help still compiles**

```bash
mise run seed -- --help 2>&1 | head -3
```

Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add scripts/seed.ts
git commit -m "feat(seed): rebrand clinician bios and final-summary text"
```

---

## Task 7: Add MYCURE_REPO env var to template-loader path candidates

**Files:**
- Modify: `scripts/seed.ts` — three loader functions: `loadPmeReportPresets`, `loadEmrFormPresets`, `loadDiagnosticReportPresets` (around lines 2890, 3651, 5347).

- [ ] **Step 1: Update each loader to add MYCURE_REPO override**

For each of the three `candidates = [...]` arrays, restructure as a function that prepends a `MYCURE_REPO`-based candidate when the env var is set:

```ts
function templatePathCandidates(relPath: string): string[] {
  const out: string[] = [];
  if (process.env.MYCURE_REPO) {
    out.push(`${process.env.MYCURE_REPO}/${relPath}`);
  }
  out.push(`${import.meta.dir}/../../mycure/${relPath}`);
  out.push(`${import.meta.dir}/../../../mycure/${relPath}`);
  return out;
}
```

Insert this helper once near the top of the file (after BRANDING block). Then update each loader:

```ts
// before
const candidates = [
  `${import.meta.dir}/../../mycure/apps/mycure/src/pages/pme/reportTemplatePresets.ts`,
  `${import.meta.dir}/../../../mycure/apps/mycure/src/pages/pme/reportTemplatePresets.ts`,
];
// after
const candidates = templatePathCandidates("apps/mycure/src/pages/pme/reportTemplatePresets.ts");
```

Apply the equivalent rewrite for `loadEmrFormPresets` and `loadDiagnosticReportPresets` (the latter takes `subdir` so use a template literal: `templatePathCandidates(\`apps/mycure/src/pages/${subdir}/formTemplatePresets.ts\`)`).

- [ ] **Step 2: Update warning messages to mention MYCURE_REPO**

In each loader's "skipped — could not load" yellow log, append:

```
"   To enable, set MYCURE_REPO=/path/to/mycure or clone next to philcare-infra."
```

- [ ] **Step 3: Verify path resolution from philcare-infra**

```bash
bun -e 'console.log(import.meta.dir)' 2>/dev/null || echo "(skip — can't run isolated bun -e)"
ls -d "$PWD/../../mycure" 2>&1 | head -1
ls -d "$PWD/../../../mycure" 2>&1 | head -1
ls -d "$PWD/../../../work/mycure" 2>&1 | head -1
```

Expected: at least one of the three resolves to a directory containing `apps/mycure/src/pages/`. From `philcare-infra/scripts/`, candidate `../../../mycure` resolves to `work/mycure` (existing checkout).

- [ ] **Step 4: Verify --help still compiles**

```bash
mise run seed -- --help 2>&1 | head -3
```

- [ ] **Step 5: Commit**

```bash
git add scripts/seed.ts
git commit -m "feat(seed): add MYCURE_REPO env var override for sibling template repo"
```

---

## Task 8: Local sanity tests (no API contact)

- [ ] **Step 1: Verify --help is clean**

```bash
mise run seed -- --help 2>&1 | head -25
```

Expected: prints `PhilCare Seed Script`, lists `--env staging, production`, no mycure-branded text in user-facing output.

- [ ] **Step 2: Verify fast-fail on bogus URL**

```bash
timeout 10s mise run seed -- --api-url http://invalid-host.local:9999 --patients 0 --patient-accounts 0 2>&1 | head -10
```

Expected: prints initial banner, then errors out within 10s with a connection error. Does not hang.

- [ ] **Step 3: Verify production guard**

```bash
mise run seed -- --env production 2>&1 | head -5
```

Expected: red error `Production requires --confirm flag` and non-zero exit.

- [ ] **Step 4: Verify zero remaining branding leaks**

```bash
grep -n -i "mycure" scripts/seed.ts | grep -v -E "(MYCURE_REPO|alongside.*mycure|sibling.*mycure|next to.*mycure|/\\.\\./.*mycure/apps|/\\.\\.\\./.*mycure/apps|loadEmrFormPresets|loadPmeReportPresets|loadDiagnosticReportPresets|FORM_TEMPLATE_PRESETS\\.ts|reportTemplatePresets\\.ts|formTemplatePresets\\.ts|fromAddr.*mycure\\.stitchtechsolutions|api\\.stg\\.mycure\\.stitchtechsolutions|api\\.mycure\\.stitchtechsolutions|cms\\.stg\\.mycure\\.stitchtechsolutions|cms\\.mycure\\.stitchtechsolutions)" | head -10
```

Expected: empty. Acceptable retained mentions are: sibling-repo path comments + warning text + the `mycure.stitchtechsolutions.com` domain (real philcare-staging hostname).

- [ ] **Step 5: No commit (sanity-only).**

---

## Task 9: Live --reset run against philcare-staging

**Pre-requisites:** philcare-staging hapihub reachable; existing `superadmin@philcare.test` from prior seed has password `PhilCare2026!` (the previous philcare seed used this exact password — `--reset` will succeed).

- [ ] **Step 1: Confirm cluster is reachable**

```bash
curl -fsS -o /dev/null -w "HTTP %{http_code}\n" https://api.stg.mycure.stitchtechsolutions.com/auth/get-session
```

Expected: `HTTP 200`.

- [ ] **Step 2: Run the seed with --reset**

```bash
cd /Users/centipede/Documents/workspace/work/infra-ai/philcare-infra
mise run seed -- --env staging --reset 2>&1 | tee /tmp/philcare-seed-reset.log
```

Expected: ~5-15 minute run. Watch for:
- Green ✓ for sign-up / facility creation / patients / services / partners / lab / imaging / fixtures.
- Yellow ⚠ acceptable for: PME/EMR/LIS/RIS template loaders if sibling repo can't be found (should NOT happen — we know `work/mycure` exists).
- Red ✗ → halt and triage. **Do not proceed to step 3 if any red errors.**

Final output: `SEED COMPLETE` + summary table of accounts.

- [ ] **Step 3: Capture the seeded org IDs from the log**

```bash
grep -E "PhilCare Clinics|Vital Kinetics Makati|Astracare Makati" /tmp/philcare-seed-reset.log | head -5
```

Note the IDs for the next task.

- [ ] **Step 4: No commit.** This is a runtime action against the live cluster.

---

## Task 10: Idempotency check (re-run without --reset)

- [ ] **Step 1: Re-run seed without --reset**

```bash
mise run seed -- --env staging 2>&1 | tee /tmp/philcare-seed-rerun.log
```

Expected: every entity logs `~ already exists` / `skipped`. Few or no green ✓ for created rows. Run completes cleanly.

- [ ] **Step 2: Quantify the diff**

```bash
grep -c "already exists\|skipped" /tmp/philcare-seed-rerun.log
grep -c "✓ created\|✓ inserted\|^   ✓ " /tmp/philcare-seed-rerun.log
```

Expected: skipped count ≫ created count. Created should be near-zero (a small number is OK if some endpoints don't have a clean dedup primary key — investigate any large numbers).

- [ ] **Step 3: No commit.**

---

## Task 11: Live API verification (curl + jq)

- [ ] **Step 1: Sign in as superadmin and capture cookie**

```bash
COOKIE=$(curl -fsS -c - -X POST -H "Content-Type: application/json" \
  -d '{"email":"superadmin@philcare.test","password":"PhilCare2026!"}' \
  https://api.stg.mycure.stitchtechsolutions.com/auth/sign-in/email \
  | grep -E "better-auth\.session_token|__Secure-better-auth" | awk '{print $6"="$7}')
echo "$COOKIE" | head -1
```

Expected: a cookie line like `better-auth.session_token=<token>`.

- [ ] **Step 2: List orgs**

```bash
curl -fsS --cookie "$COOKIE" \
  "https://api.stg.mycure.stitchtechsolutions.com/organizations?limit=50" \
  | jq '[.[] | select(.name | test("PhilCare Clinics|Vital Kinetics Makati|Astracare Makati"))] | length'
```

Expected: `3`.

- [ ] **Step 3: Patient count on parent**

Find parent ID:
```bash
PARENT_ID=$(curl -fsS --cookie "$COOKIE" \
  "https://api.stg.mycure.stitchtechsolutions.com/organizations?limit=50" \
  | jq -r '.[] | select(.name=="PhilCare Clinics") | .id')
echo "Parent: $PARENT_ID"
```

Then:
```bash
curl -fsS --cookie "$COOKIE" \
  "https://api.stg.mycure.stitchtechsolutions.com/medical-patients?facility=$PARENT_ID&limit=1" \
  | jq '.total // (.data | length)'
```

Expected: ≥ 25 (default `--patients`).

- [ ] **Step 4: Service count per facility**

```bash
curl -fsS --cookie "$COOKIE" \
  "https://api.stg.mycure.stitchtechsolutions.com/services?facility=$PARENT_ID&limit=100" \
  | jq 'length'
```

Expected: ~30.

- [ ] **Step 5: HMO partner presence**

```bash
curl -fsS --cookie "$COOKIE" \
  "https://api.stg.mycure.stitchtechsolutions.com/insurance-contracts?facility=$PARENT_ID&limit=50" \
  | jq '[.[] | select(.insurerSubtype=="hmo") | .insurerName]'
```

Expected: includes `Maxicare Healthcare Corporation`, `Intellicare`, `Medicard Philippines`, etc.

- [ ] **Step 6: No commit.**

---

## Task 12: Push seed implementation commits

- [ ] **Step 1: Confirm clean diff**

```bash
git status
git log --oneline origin/main..HEAD
```

Expected: ~7 unpushed commits (Tasks 1-7), tree clean.

- [ ] **Step 2: Push**

```bash
git push 2>&1 | tail -5
```

Expected: pushes to `origin/main`. ArgoCD apps don't watch `scripts/` so no cluster effect.

- [ ] **Step 3: No further action.**

---

## Self-Review

**Spec coverage check:**
- ✓ Single-file monolith — Task 1.
- ✓ BRANDING constants block — Task 2.
- ✓ CLI surface (--env, --api-url, --confirm, --reset, --patients, --patient-accounts) — preserved verbatim from mycure (Task 1) + ENVS rebranded (Task 3).
- ✓ Sibling-repo template resolution + MYCURE_REPO env var — Task 7.
- ✓ Idempotency model — preserved from mycure (Task 1).
- ✓ Reset flow including legacy org names — Task 4 step 8.
- ✓ Tenant-neutral data kept (HMOs, ICD-10, services, etc.) — implicit in Task 1 and explicit in Task 3 (only ENVS replaced, no clinical data touched).
- ✓ Verification protocol — Tasks 8, 9, 10, 11.

**Placeholder scan:** No "TBD", "TODO", or hand-wave instructions. Every step has a concrete action and expected output.

**Type consistency:** `BRANDING` shape used identically across tasks. `templatePathCandidates(relPath: string)` helper introduced in Task 7 step 1 and used immediately in the same step.

**Open risks (carry-forward from spec):**
- Role IDs (`clinic_manager`, `nurse_head`, etc.) may not be recognized by hapihub 11.3.9. Detected during Task 9 — if signup or member-creation fails with role errors, drop unknown roles from the bundle and re-run. Not pre-emptively scoped.
- Existing `PhilCare Demo Clinic` org cleanup. Captured in `BRANDING.legacyOrgNames` (Task 2). Reset flow already handles this.
