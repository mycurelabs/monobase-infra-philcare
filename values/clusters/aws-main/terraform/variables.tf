variable "cluster_name" { type = string }
variable "region" { type = string }
variable "kubernetes_version" { type = string }
variable "vpc_cidr" { type = string }

variable "node_groups" {
  description = "EKS managed node groups (empty => module deployment_profile presets)"
  type = map(object({
    instance_types = list(string)
    desired_size   = number
    max_size       = number
    min_size       = number
    disk_size      = optional(number, 100)
    labels         = optional(map(string), {})
    taints = optional(list(object({
      key    = string
      value  = string
      effect = string
    })), [])
  }))
  default = {}
}

variable "enable_ebs_csi_driver" {
  type    = bool
  default = true
}
variable "enable_cluster_autoscaler" {
  type    = bool
  default = true
}
variable "enable_irsa" {
  type    = bool
  default = true
}
variable "enable_flow_logs" {
  type    = bool
  default = true
}

variable "velero_backup_bucket" {
  type    = string
  default = ""
}
variable "route53_zone_arns" {
  type    = list(string)
  default = []
}
variable "tags" {
  type    = map(string)
  default = {}
}
