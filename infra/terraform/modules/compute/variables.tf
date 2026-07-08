variable "compartment_ocid" {
  type = string
}

variable "environment" {
  type = string
}

variable "availability_domain" {
  type = string
}

variable "subnet_id" {
  type = string
}

variable "nsg_ids" {
  type = list(string)
}

variable "ssh_public_key" {
  type = string
}

variable "cloud_init" {
  type        = string
  description = "Optional cloud-init config to run on first boot."
  default     = null
}

variable "image_id" {
  type        = string
  description = "Pinned OCI image OCID to use for the boot volume. Changing this replaces the boot volume."
}

variable "shape" {
  type    = string
  default = "VM.Standard.E4.Flex"
}

variable "ocpus" {
  type    = number
  default = 1
}

variable "memory_in_gbs" {
  type    = number
  default = 8
}

variable "boot_volume_size_in_gbs" {
  type    = number
  default = 50
}
