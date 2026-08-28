---
name: iac
description: Terraform/OpenTofu modules for 6 providers
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

# Infrastructure as Code Skill

## Quick Operations

Each cluster has its own OpenTofu root at `values/clusters/<cluster>/terraform` (with its own
`main.tf`, `variables.tf`, `outputs.tf`, `terraform.tfvars`, and remote backend). The root
consumes a provider module from `terraform/modules/`. Drive it via the `mise run cluster-*`
tasks, which `cd` into the cluster root for you.

### plan — Preview infrastructure changes

```bash
# Preferred: the mise task (cd's into values/clusters/<cluster>/terraform)
mise run cluster-plan <cluster>   # exit code 2 = changes pending

# Or run OpenTofu directly in the cluster root
cd values/clusters/<cluster>/terraform
tofu plan -detailed-exitcode

# Examples:
mise run cluster-plan aws-main
```

### apply — Apply infrastructure changes ⚠️ DESTRUCTIVE

```bash
# ⚠️ CONFIRM BEFORE EXECUTING - modifies cloud infrastructure and costs money

# Preferred: the mise task (backs up state first, interactive approval,
# STOP on any 'forces replacement' plan line)
mise run cluster-apply <cluster>

# Or run OpenTofu directly in the cluster root
cd values/clusters/<cluster>/terraform
tofu apply

# Examples:
mise run cluster-apply aws-main
```

### state — Inspect current Terraform state

```bash
# List all resources in state
cd values/clusters/<cluster>/terraform
tofu state list

# Show specific resource
tofu state show {resource_address}

# Show all outputs
tofu output

# Show specific output
tofu output -raw configure_kubectl

# Examples:
cd values/clusters/aws-main/terraform
tofu state list
tofu state show 'module.eks_cluster.aws_eks_cluster.main'
tofu output -raw configure_kubectl
```

### destroy — Destroy infrastructure ⚠️ VERY DESTRUCTIVE

```bash
# ⚠️ EXTREME CAUTION - destroys all cluster resources permanently

# Preferred: the mise task
mise run cluster-destroy <cluster>

# Or run OpenTofu directly in the cluster root
cd values/clusters/<cluster>/terraform
tofu destroy
```

### init — Initialize module (first time or after provider changes)

```bash
# Preferred: the mise task
mise run cluster-init <cluster>

# Or run OpenTofu directly in the cluster root
cd values/clusters/<cluster>/terraform
tofu init

# Upgrade providers
tofu init -upgrade

# Reconfigure backend
tofu init -reconfigure
```

---

## Available Modules

```
!ls terraform/modules/
```

## Module Overview

| Module | Provider | Key Features | Required CLI |
|--------|----------|--------------|-------------|
| `aws-eks` | AWS | EKS + VPC + IRSA + EBS CSI | `aws` |
| `azure-aks` | Azure | AKS + VNet + Workload Identity | `az` |
| `gcp-gke` | GCP | GKE + VPC + Workload Identity | `gcloud` |
| `do-doks` | DigitalOcean | DOKS + VPC + node pools | `doctl` |
| `on-prem-k3s` | On-premises | K3s + Longhorn + MetalLB | SSH access |
| `local-k3d` | Local dev | k3d + Gateway API CRDs | `docker` |

All modules share common patterns:

- Deployment profiles: `small`, `medium`, `large` (auto-configures node sizes/counts)
- Outputs: `cluster_name`, `cluster_endpoint`, `configure_kubectl`
- Terraform >= 1.6 required

## Standard Module Structure

```
terraform/modules/{provider}/
  main.tf           # Primary resources
  variables.tf      # Input variables
  outputs.tf        # Output values
  versions.tf       # Provider requirements
  README.md         # Module usage notes
```

A module is not applied directly. Each cluster's root at
`values/clusters/<cluster>/terraform` sets `source = "../../../../terraform/modules/<provider>"`
and wires the module's variables from its own `terraform.tfvars`.

## Provisioning Workflow

```bash
# 1. Create a cluster root (copy the example root, then edit)
cp -r values/clusters/aws-main values/clusters/<cluster>
#    - point module source at the desired terraform/modules/<provider>
#    - set the backend key and edit terraform.tfvars

# 2. Initialize
mise run cluster-init <cluster>

# 3. Plan (review changes)
mise run cluster-plan <cluster>

# 4. Apply
mise run cluster-apply <cluster>

# 5. Configure kubectl
cd values/clusters/<cluster>/terraform && eval "$(tofu output -raw configure_kubectl)"

# 6. Bootstrap GitOps
mise run bootstrap
```

Or use the automated script:

```bash
mise run provision
```

## Validation Commands

```bash
# Validate all Terraform modules
mise run validate-tf

# Lint Terraform files
mise run lint-tf

# Format Terraform code
mise run fmt
```

## Key Variables (Common Across Providers)

| Variable | Description | Default |
|----------|-------------|---------|
| `cluster_name` | Cluster identifier | (required) |
| `kubernetes_version` | K8s version | `"1.28"` |
| `deployment_profile` | Size preset | `"small"` |

## Provider-Specific Notes

### AWS EKS

- Requires: VPC CIDR, availability zones, API access CIDRs
- Creates: VPC, subnets, NAT gateway, EKS cluster, managed node groups
- Static IPs: Elastic IPs (one per subnet/AZ) — see `docs/infrastructure/static-ip-aws.md`
- Auth: IRSA (IAM Roles for Service Accounts) for ESO, Velero, cert-manager

### Azure AKS

- Requires: resource group name, location
- Creates: VNet, AKS cluster, node pools, managed identities
- Static IPs: Public IP in node resource group (MC_*) — see `docs/infrastructure/static-ip-azure.md`
- Auth: Workload Identity for ESO, Velero

### GCP GKE

- Requires: project ID, region
- Creates: VPC, GKE cluster, node pools, service accounts
- Static IPs: Regional static IP — see `docs/infrastructure/static-ip-gcp.md`
- Auth: Workload Identity Federation for ESO, Velero, cert-manager

### DigitalOcean DOKS

- Requires: region
- Creates: VPC, DOKS cluster, node pool
- Static IPs: LoadBalancer name or FLIPOP operator — see `docs/infrastructure/static-ip-digitalocean.md`
- Auth: API token for ESO via External Secrets

### On-Prem K3s

- Requires: server IPs, SSH access, K3s token
- Creates: K3s cluster via SSH, optional Longhorn + MetalLB
- HA mode requires 3+ servers

### Local k3d

- Development/testing only
- Creates: k3d cluster with port mappings (8080→80, 8443→443)
- Disables Traefik (uses NGINX Gateway Fabric instead)
- Auto-installs Gateway API CRDs

## Teardown (Destructive)

```bash
# Preferred (backs up state, interactive approval)
mise run cluster-destroy <cluster>

# Manual
cd values/clusters/<cluster>/terraform
tofu destroy
```
