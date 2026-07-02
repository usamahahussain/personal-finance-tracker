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

variable "admin_allowed_cidr" {
  type        = string
  description = "Public CIDR allowed to reach SSH and the frontend/backend ports on the app VM."
}
