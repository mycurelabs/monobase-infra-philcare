<!-- Conventional-commit title, e.g. `feat(hapihub): ...`, `fix(cadence): ...`, `docs: ...` -->

## Summary

<!-- What does this change and why? -->

## Type

- [ ] feat
- [ ] fix
- [ ] chore
- [ ] docs
- [ ] refactor

## Testing

<!-- How was this verified? -->

- [ ] `mise run lint` passes (yamllint + helm render + tflint + markdownlint)
- [ ] `mise run validate` passes (terraform validate + helm template)
- [ ] Affected charts render: `helm template ... -f values/...`

## Checklist

- [ ] No secrets, credentials, or `.env` files committed
- [ ] Tenant-specific config stays under `values/` only
- [ ] Docs updated if behavior/structure changed
