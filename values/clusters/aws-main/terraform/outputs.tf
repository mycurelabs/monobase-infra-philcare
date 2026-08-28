output "cluster_id" { value = module.eks_cluster.cluster_id }
output "cluster_name" { value = module.eks_cluster.cluster_name }
output "cluster_endpoint" { value = module.eks_cluster.cluster_endpoint }
output "cluster_version" { value = module.eks_cluster.cluster_version }
output "region" { value = var.region }
output "vpc_id" { value = module.eks_cluster.vpc_id }
output "oidc_provider_arn" { value = module.eks_cluster.oidc_provider_arn }

output "kubeconfig_command" {
  value = "aws eks update-kubeconfig --region ${var.region} --name ${var.cluster_name}"
}

# IRSA role ARNs to wire into the ServiceAccounts (External Secrets, Velero, cert-manager).
output "external_secrets_role_arn" { value = module.eks_cluster.external_secrets_role_arn }
output "velero_role_arn" { value = module.eks_cluster.velero_role_arn }
output "cert_manager_role_arn" { value = module.eks_cluster.cert_manager_role_arn }
