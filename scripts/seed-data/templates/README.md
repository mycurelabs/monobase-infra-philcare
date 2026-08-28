# Vendored form/report template presets

These files are vendored copies of preset arrays consumed by `scripts/seed.ts`
when seeding EMR / PME / LIS / RIS templates per facility. The seed script
imports them directly from this folder, so seeding has no runtime
dependency on a product frontend repo.

## Source of truth

Upstream lives in the product frontend repo:

| Local file                         | Upstream path                                                |
| ---------------------------------- | ------------------------------------------------------------ |
| `emr/formTemplatePresets.ts`       | `apps/<app>/src/pages/emr/formTemplatePresets.ts`           |
| `pme/reportTemplatePresets.ts`     | `apps/<app>/src/pages/pme/reportTemplatePresets.ts`         |
| `lis/formTemplatePresets.ts`       | `apps/<app>/src/pages/lis/formTemplatePresets.ts`           |
| `ris/formTemplatePresets.ts`       | `apps/<app>/src/pages/ris/formTemplatePresets.ts`           |

## Re-vendoring

When upstream presets change, refresh from the sibling product checkout:

```bash
APP_REPO=/path/to/product-frontend  # adjust to your checkout
cp $APP_REPO/apps/<app>/src/pages/emr/formTemplatePresets.ts   scripts/seed-data/templates/emr/
cp $APP_REPO/apps/<app>/src/pages/pme/reportTemplatePresets.ts scripts/seed-data/templates/pme/
cp $APP_REPO/apps/<app>/src/pages/lis/formTemplatePresets.ts   scripts/seed-data/templates/lis/
cp $APP_REPO/apps/<app>/src/pages/ris/formTemplatePresets.ts   scripts/seed-data/templates/ris/
```

Each file is self-contained — exports its preset array and the matching
interface types, with no transitive imports. So the copy is literal.

## Do not edit in place

Treat these as read-only mirrors. If you need a custom preset for a tenant,
add it to `scripts/seed.ts` (or extend the seed-config layer there); don't
fork a vendored file or upstream changes will be hard to merge back in.
