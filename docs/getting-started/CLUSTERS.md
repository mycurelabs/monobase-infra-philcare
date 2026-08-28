# Cluster Provisioning Guide

Complete guide for provisioning Kubernetes clusters. Each cluster's OpenTofu root
lives at `values/clusters/<cluster>/terraform/`. The template ships one reference
cluster, `values/clusters/aws-main/`, and per-provider starting points under
`terraform/examples/`.

## Quick Reference

| Provider | Module | Profile | Use Case |
|----------|--------|---------|----------|
| **AWS EKS** | `terraform/modules/aws-eks` | Production | Multi-client production (the `aws-main` reference cluster) |
| **Azure AKS** | `terraform/modules/azure-aks` | Production | Azure-based production |
| **GCP GKE** | `terraform/modules/gcp-gke` | Production | GCP-based production |
| **DigitalOcean DOKS** | `terraform/modules/do-doks` | Cost-effective | Budget-conscious prod |
| **On-Prem K3s** | `terraform/modules/on-prem-k3s` | Bare-metal | Air-gapped / edge |
| **Local k3d** | `terraform/modules/local-k3d` | Development | Local testing/dev |

## Workflow

Each cluster gets its own directory under `values/clusters/<cluster>/`, holding both
its OpenTofu root (`terraform/`) and its cluster-scoped ArgoCD config (`argocd/`).
Provisioning is driven through mise tasks that `cd` into that terraform root for you.

### 1. Copy the Reference Cluster

```bash
# Copy the shipped example cluster to your own name
cp -r values/clusters/aws-main values/clusters/<cluster>
```

The reference cluster targets AWS EKS. To target another provider, swap the
module source in `values/clusters/<cluster>/terraform/main.tf` to the matching module
under `terraform/modules/` (see `terraform/examples/` for provider-specific starting
`main.tf` / `terraform.tfvars` snippets), then adjust the variables.

### 2. Customize Configuration

```bash
vim values/clusters/<cluster>/terraform/terraform.tfvars
```

**Required changes:**

- `cluster_name` - Your cluster identifier
- `region` - Your provider region
- `node_pools` (or `node_groups`) - Your node sizing

Also update the backend `key` in `terraform/main.tf` so this cluster gets its own
state path.

### 3. Provision Cluster

```bash
mise run cluster-init  <cluster>   # tofu init  (once)
mise run cluster-plan  <cluster>   # tofu plan  (exit 2 = changes pending)
mise run cluster-apply <cluster>   # tofu apply (backs up state first)
```

Each task `cd`s into `values/clusters/<cluster>/terraform` and runs the corresponding
OpenTofu command. Point your `kubectl` context at the new cluster once it is up.

### 4. Bootstrap GitOps

```bash
# Install ArgoCD and enable auto-discovery (one-time)
mise run bootstrap
```

## Configuration Options

### Deployment Profiles (Recommended)

Most modules support size presets for quick configuration:

```hcl
# terraform.tfvars
deployment_profile = "small"   # 1-5 clients, 3 nodes, ~12 vCPU
deployment_profile = "medium"  # 5-15 clients, 5 nodes, ~20 vCPU
deployment_profile = "large"   # 15+ clients, 5+ larger nodes, ~40+ vCPU
```

### Custom Node Groups (Advanced)

For fine-grained control over node configuration:

```hcl
# terraform.tfvars
node_groups = {
  general = {
    instance_types = ["m6i.xlarge"]  # 4 vCPU, 16GB RAM
    desired_size   = 3
    min_size       = 3
    max_size       = 10
    disk_size      = 100
    labels         = { role = "general" }
    taints         = []
  }

  compute = {
    instance_types = ["c6i.2xlarge"]  # 8 vCPU, 16GB RAM
    desired_size   = 2
    min_size       = 0
    max_size       = 5
    labels         = { role = "compute" }
  }
}
```

## Provider-Specific Details

### AWS EKS

**Module:** [terraform/modules/aws-eks](../../terraform/modules/aws-eks/README.md)

**Features:**

- Automatic VPC creation with public/private subnets
- IRSA (IAM Roles for Service Accounts) enabled
- Node groups with auto-scaling
- EBS CSI driver for persistent storage
- Add-ons: vpc-cni, kube-proxy, coredns

**Authentication:**

```bash
aws configure
# OR
export AWS_ACCESS_KEY_ID=xxx
export AWS_SECRET_ACCESS_KEY=xxx
```

**Outputs:**

- `cluster_endpoint` - EKS API server endpoint
- `kubeconfig_command` - Command to configure kubectl
- `oidc_provider_arn` - For IRSA integration

### DigitalOcean DOKS

**Module:** [terraform/modules/do-doks](../../terraform/modules/do-doks/README.md)

**Features:**

- Managed Kubernetes (simpler than EKS/AKS/GKE)
- Cost-effective ($12/node/month for basic droplets)
- Automatic LoadBalancer integration
- Built-in monitoring and logging

**Authentication:**

```bash
export DIGITALOCEAN_TOKEN=your-token
```

**Best for:** Budget-conscious production deployments, startups, small teams

### Local k3d

**Module:** [terraform/modules/local-k3d](../../terraform/modules/local-k3d/README.md)

**Features:**

- Runs in Docker containers (no VMs needed)
- Fast cluster creation (~30 seconds)
- Port forwarding for LoadBalancer services
- Ideal for local development and testing

**Prerequisites:**

- Docker Desktop or Docker Engine running
- k3d installed: `brew install k3d` or `curl -s https://raw.githubusercontent.com/k3d-io/k3d/main/install.sh | bash`

**Best for:** Local development, testing, CI pipelines

### Azure AKS

**Module:** [terraform/modules/azure-aks](../../terraform/modules/azure-aks/README.md)

**Authentication:**

```bash
az login
```

### GCP GKE

**Module:** [terraform/modules/gcp-gke](../../terraform/modules/gcp-gke/README.md)

**Authentication:**

```bash
gcloud auth application-default login
```

### On-Premises K3s

**Module:** [terraform/modules/on-prem-k3s](../../terraform/modules/on-prem-k3s/README.md)

**Best for:** Bare-metal servers, edge computing, air-gapped environments

## Next Steps

After cluster provisioning:

### 1. Verify Cluster

```bash
kubectl cluster-info
kubectl get nodes
```

### 2. Bootstrap GitOps

```bash
mise run bootstrap
```

This installs:

- ArgoCD (GitOps engine)
- Infrastructure ApplicationSet (cluster-wide components)
- Auto-discovery ApplicationSet (per-client deployments)

### 3. Create First Deployment

```bash
# Copy a shipped example file to your own name (it keeps `extends: base`)
cp values/deployments/mycure-production.yaml   values/deployments/myclient-production.yaml

# Customize
vim values/deployments/myclient-production.yaml
# Change: domain, namespace, image tags — keep the `extends: base` line

# Deploy via Git
git add values/deployments/myclient-production.yaml
git commit -m "Add myclient-production deployment"
git push  # ArgoCD auto-deploys!
```

## Cleanup

To destroy a cluster:

```bash
mise run cluster-destroy <cluster>
```

**⚠️ Warning:** This destroys ALL cluster resources. Ensure you have:

- ✅ Velero backups configured and tested
- ✅ Database dumps if needed
- ✅ Important data backed up externally

## Troubleshooting

### Terraform Initialization Fails

```bash
cd values/clusters/<cluster>/terraform
rm -rf .terraform .terraform.lock.hcl
tofu init
```

### Cluster Creation Times Out

Check cloud provider quotas:

- **AWS**: VPC limits, EIP limits, instance quotas
- **Azure**: Core quotas per region
- **GCP**: Compute Engine API quota

### Kubeconfig Not Working

```bash
# Re-export kubeconfig
cd values/clusters/<cluster>/terraform
tofu output -raw kubeconfig > ~/.kube/$(grep cluster_name terraform.tfvars | cut -d'"' -f2)
export KUBECONFIG=~/.kube/$(grep cluster_name terraform.tfvars | cut -d'"' -f2)
kubectl cluster-info
```

## Related Documentation

- [Infrastructure Requirements](./INFRASTRUCTURE-REQUIREMENTS.md) - Minimum cluster specs
- [Deployment Guide](./DEPLOYMENT.md) - Application deployment workflow
- [GitOps Architecture](../architecture/GITOPS-ARGOCD.md) - How ArgoCD manages deployments
- [Cluster Provisioning Details](./CLUSTER-PROVISIONING.md) - Deep dive into provisioning process
