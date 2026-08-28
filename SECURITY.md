# Security Policy

## Reporting a Vulnerability

Please report security vulnerabilities **privately** — do not open a public issue.

- Use [GitHub Private Vulnerability Reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability)
  (Security → Report a vulnerability), or
- Email `security@example.com` _(replace with your security contact)_.

Include a description, reproduction steps, and impact assessment. We aim to
acknowledge reports within 3 business days.

## Scope

This repository is infrastructure-as-code (Helm charts, Terraform/OpenTofu
modules, GitOps config). Report:

- Insecure defaults in charts or modules (over-permissive RBAC, missing
  NetworkPolicies, disabled Pod Security, unencrypted storage).
- Secrets committed to the repo. **Never commit secrets** — all secrets flow
  through External Secrets Operator; see `docs/operations/SECRETS-MANAGEMENT.md`.
- Supply-chain issues (unpinned images, vulnerable dependencies).

## Supported Versions

Only the latest `main` is supported. Fixes land on `main` and flow to forks via
`git merge upstream/main`.
