variable "compartment_ocid" {
  type = string
}

variable "environment" {
  type = string
}

variable "vcn_cidr" {
  type = string
}

variable "existing_vcn_id" {
  type        = string
  description = "OCID of the existing VCN to use."
}

variable "existing_public_route_table_id" {
  type        = string
  description = "OCID of an existing route table in the VCN with a default route to an internet gateway."
}

variable "app_subnet_cidr" {
  type = string
}

variable "db_subnet_cidr" {
  type = string
}

variable "admin_allowed_cidrs" {
  type        = list(string)
  description = "Public CIDR blocks allowed to reach SSH, HTTP, and HTTPS on the app VM."

  validation {
    condition     = length(var.admin_allowed_cidrs) > 0 && alltrue([for cidr in var.admin_allowed_cidrs : can(cidrnetmask(cidr))])
    error_message = "admin_allowed_cidrs must contain at least one valid CIDR block."
  }
}
