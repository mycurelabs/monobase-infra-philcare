# Per-cluster OpenTofu root for cluster IaC (this example targets AWS EKS).
# State: an S3 bucket (S3 backend, native locking). Credentials via env:
#   AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY   (or AWS_PROFILE)
# (.env.local, auto-loaded by mise. Never committed.)
# Entry points: mise run cluster-init | cluster-plan | cluster-apply.
# Rule: a plan line containing "forces replacement" is an automatic stop.

terraform {
  required_version = ">= 1.10"

  backend "s3" {
    bucket       = "<tfstate-bucket>"
    key          = "cluster/aws-main/terraform.tfstate"
    region       = "<region>"  # e.g. us-east-1
    use_lockfile = true         # S3-native state locking (no DynamoDB table needed)
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.region
  # Credentials from env: AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY, or AWS_PROFILE.
}

module "eks_cluster" {
  source = "../../../../terraform/modules/aws-eks"

  cluster_name       = var.cluster_name
  region             = var.region
  kubernetes_version = var.kubernetes_version
  vpc_cidr           = var.vpc_cidr

  # Custom node groups mirror the role-based pools the deployment overlays
  # schedule onto (node-pool label + matching taint). Empty => module presets.
  node_groups = var.node_groups

  # Addons
  enable_ebs_csi_driver     = var.enable_ebs_csi_driver
  enable_cluster_autoscaler = var.enable_cluster_autoscaler
  enable_irsa               = var.enable_irsa
  enable_flow_logs          = var.enable_flow_logs

  # IAM policy scoping (recommended): pass the Velero bucket + Route53 zone ARNs.
  velero_backup_bucket = var.velero_backup_bucket
  route53_zone_arns    = var.route53_zone_arns

  tags = var.tags
}
