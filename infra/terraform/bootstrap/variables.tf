variable "compartment_ocid" {
  type        = string
  description = "OCI compartment in which to create the Terraform state bucket."
}

variable "region" {
  type    = string
  default = "uk-london-1"
}

variable "oci_profile" {
  type    = string
  default = "oracle"
}

variable "bucket_name" {
  type        = string
  description = "Private Object Storage bucket name used exclusively for Terraform state."
  default     = "pft-terraform-state"
}
