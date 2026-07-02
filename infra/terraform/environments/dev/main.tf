data "oci_identity_availability_domains" "ads" {
  compartment_id = var.compartment_ocid
}

module "network" {
  source = "../../modules/network"

  compartment_ocid               = var.compartment_ocid
  environment                    = var.environment
  vcn_cidr                       = var.vcn_cidr
  existing_vcn_id                = var.existing_vcn_id
  existing_public_route_table_id = var.existing_public_route_table_id
  app_subnet_cidr                = var.app_subnet_cidr
  db_subnet_cidr                 = var.db_subnet_cidr
  admin_allowed_cidr             = var.admin_allowed_cidr
}

module "compute" {
  source = "../../modules/compute"

  compartment_ocid    = var.compartment_ocid
  environment         = var.environment
  availability_domain = data.oci_identity_availability_domains.ads.availability_domains[0].name
  subnet_id           = module.network.app_subnet_id
  nsg_ids             = [module.network.app_nsg_id]
  ssh_public_key      = var.ssh_public_key
  cloud_init          = file("${path.module}/cloud-init-docker.yaml")
  shape               = var.compute_shape
  ocpus               = var.compute_ocpus
  memory_in_gbs       = var.compute_memory_gb
}

module "database" {
  source = "../../modules/database"

  compartment_ocid         = var.compartment_ocid
  environment              = var.environment
  db_name                  = "PFTDEV"
  display_name             = "pft-dev-adb"
  admin_password           = var.adb_admin_password
  cpu_core_count           = var.adb_cpu_core_count
  data_storage_size_in_tbs = var.adb_data_storage_size_in_tbs
  subnet_id                = module.network.db_subnet_id
  nsg_ids                  = [module.network.db_nsg_id]
}
