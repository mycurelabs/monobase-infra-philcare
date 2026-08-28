# Cluster config. `tofu plan` should be empty once applied (the drift gate).

cluster_name       = "aws-main"
region             = "us-east-1"
kubernetes_version = "1.31"
vpc_cidr           = "10.0.0.0/16"

# Role-based node groups mirror the node-pool labels/taints the deployment
# overlays schedule onto. EKS taint effects use NO_SCHEDULE (lands on the node
# as node-pool=<x>:NoSchedule, which the pod tolerations match).
node_groups = {
  infra = {
    instance_types = ["m6i.large"] # 2 vCPU, 8 GB
    desired_size   = 2
    min_size       = 2
    max_size       = 2
    labels         = { "node-pool" = "infra" }
    taints         = [{ key = "node-pool", value = "infra", effect = "NO_SCHEDULE" }]
  }
  prod-db = {
    instance_types = ["m6i.xlarge"] # 4 vCPU, 16 GB
    desired_size   = 1
    min_size       = 1
    max_size       = 1
    labels         = { "node-pool" = "prod-db" }
    taints         = [{ key = "node-pool", value = "prod-db", effect = "NO_SCHEDULE" }]
  }
  prod-apps = {
    instance_types = ["m6i.xlarge"] # 4 vCPU, 16 GB
    desired_size   = 2
    min_size       = 2
    max_size       = 3
    labels         = { "node-pool" = "prod-apps" }
    taints         = [{ key = "node-pool", value = "prod-apps", effect = "NO_SCHEDULE" }]
  }
  nonprod = {
    instance_types = ["c6i.xlarge"] # 4 vCPU, 8 GB
    desired_size   = 2
    min_size       = 2
    max_size       = 4
    labels         = { "node-pool" = "nonprod" }
  }
}

enable_ebs_csi_driver     = true # required for persistent storage (gp3)
enable_cluster_autoscaler = true
enable_irsa               = true # required for External Secrets / Velero / cert-manager IRSA
enable_flow_logs          = true

# IAM policy scoping (recommended): the Velero S3 bucket + Route53 zone ARNs.
velero_backup_bucket = "<velero-bucket>"
route53_zone_arns    = [] # e.g. ["arn:aws:route53:::hostedzone/Z0123456789ABCDEFGHIJ"]

tags = {
  ManagedBy = "opentofu"
  Project   = "monobase-infra"
}
