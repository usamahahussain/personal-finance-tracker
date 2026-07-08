variable "oci_profile" {
  type    = string
  default = "oracle"
}

variable "region" {
  type    = string
  default = "uk-london-1"
}

variable "compartment_ocid" {
  type        = string
  description = "OCI compartment OCID. Pass via TF_VAR_compartment_ocid or a local tfvars file."
}

variable "environment" {
  type    = string
  default = "dev"
}

variable "vcn_cidr" {
  type    = string
  default = "10.0.0.0/16"
}

variable "existing_vcn_id" {
  type        = string
  description = "OCID of the existing VCN to use."
}

variable "existing_public_route_table_id" {
  type        = string
  description = "OCID of the existing public route table with default route to the internet gateway."
}

variable "app_subnet_cidr" {
  type    = string
  default = "10.0.10.0/24"
}

variable "db_subnet_cidr" {
  type    = string
  default = "10.0.20.0/24"
}

variable "admin_allowed_cidrs" {
  type        = list(string)
  description = "Public CIDR blocks allowed to reach SSH, HTTP, and HTTPS on the app VM."

  validation {
    condition     = length(var.admin_allowed_cidrs) > 0 && alltrue([for cidr in var.admin_allowed_cidrs : can(cidrnetmask(cidr))])
    error_message = "admin_allowed_cidrs must contain at least one valid CIDR block, for example [\"203.0.113.10/32\"]."
  }
}

variable "ssh_public_key" {
  type        = string
  description = "SSH public key to install on the app VM."
}

variable "adb_admin_password" {
  type        = string
  sensitive   = true
  description = "Admin password for the Autonomous Database. Pass via TF_VAR_adb_admin_password or a local tfvars file."
}

variable "compute_shape" {
  type    = string
  default = "VM.Standard.E4.Flex"
}

variable "compute_image_id" {
  type        = string
  description = "Pinned OCI image OCID for the app VM. Changing this replaces the boot volume."

  validation {
    condition     = can(regex("^ocid1\\.image\\.", var.compute_image_id))
    error_message = "compute_image_id must be a valid OCI image OCID."
  }
}

variable "compute_ocpus" {
  type    = number
  default = 1
}

variable "compute_memory_gb" {
  type    = number
  default = 8
}

variable "adb_cpu_core_count" {
  type    = number
  default = 1
}

variable "adb_data_storage_size_in_tbs" {
  type    = number
  default = 1
}
