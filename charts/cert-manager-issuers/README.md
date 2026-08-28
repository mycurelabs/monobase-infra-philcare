# cert-manager-issuers

Helm chart for managing cert-manager ClusterIssuers for ACME (HTTP-01 and DNS-01) challenges.

## Overview

This chart enables centralized management of ClusterIssuers for automatic TLS certificate provisioning via the Let's Encrypt ACME protocol. HTTP-01 is the default; DNS-01 is supported for several DNS providers (required for wildcard certificates).

- **HTTP-01 Challenge**: No DNS provider needed, requires port 80 access
- **DNS-01 Challenge**: Needed for wildcard certificates; requires DNS provider credentials

## Supported Providers

| Provider | Challenge Type | Use Case |
|----------|---------------|----------|
| `http01` | HTTP-01 | Default, domains with an A record only |
| `cloudflare` | DNS-01 | Cloudflare-managed zones; wildcard certs |
| `route53` | DNS-01 | AWS Route53-managed zones; wildcard certs |
| `azuredns` | DNS-01 | Azure DNS-managed zones; wildcard certs |
| `clouddns` | DNS-01 | Google Cloud DNS-managed zones; wildcard certs |
| `digitalocean` | DNS-01 | DigitalOcean DNS-managed zones; wildcard certs |

## Installation

This chart is deployed via ArgoCD as part of the infrastructure stack.

```bash
# Standalone installation (for testing)
helm install cert-manager-issuers ./charts/cert-manager-issuers \
  --namespace cert-manager \
  -f values.yaml
```

## Configuration

### HTTP-01 Issuer (Default)

HTTP-01 is the recommended default for client-owned domains where only DNS A records can be created.

```yaml
issuers:
  - name: letsencrypt-prod
    email: "admin@example.com"
    server: production  # or staging
    provider: http01
```

**Limitations:**

- Cannot issue wildcard certificates
- Requires port 80 accessible from internet
- Domain must resolve to Gateway LoadBalancer IP

## Parameters

### Global Parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| `issuers` | Array of ClusterIssuer configurations | `[]` |

### Issuer Parameters

| Parameter | Description | Required |
|-----------|-------------|----------|
| `name` | ClusterIssuer name | Yes |
| `email` | ACME account email | Yes |
| `server` | ACME server (`production`, `staging`, or custom URL) | Yes |
| `provider` | Provider type | Yes |

### Provider-Specific Parameters

For HTTP-01, no additional parameters are required beyond the base issuer configuration.

## Usage in Certificates

Reference the ClusterIssuer in Certificate resources:

```yaml
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: example-tls
  namespace: gateway-system
spec:
  secretName: example-tls
  issuerRef:
    name: letsencrypt-prod  # HTTP-01
    kind: ClusterIssuer
  dnsNames:
    - example.com
```

## Troubleshooting

### Check ClusterIssuer Status

```bash
kubectl get clusterissuer
kubectl describe clusterissuer letsencrypt-prod
```

### Check ACME Account Registration

```bash
kubectl get secret letsencrypt-prod-account-key -n cert-manager
```

### Test Certificate Issuance

```bash
# Check certificate status
kubectl get certificate -A
kubectl describe certificate example-tls -n gateway-system

# Check certificate request
kubectl get certificaterequest -A
kubectl describe certificaterequest <name> -n gateway-system
```

## See Also

- [Certificate Management](../../docs/operations/CERTIFICATE-MANAGEMENT.md)
- [Multi-Domain Gateway](../../docs/architecture/MULTI-DOMAIN-GATEWAY.md)
- [cert-manager Documentation](https://cert-manager.io/docs/)
