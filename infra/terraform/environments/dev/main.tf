data "oci_identity_availability_domains" "ads" {
  compartment_id = var.compartment_ocid
}

locals {
  backend_env_contents = "${join("\n", concat(
    ["PFT_DB_WALLET_DIR=/opt/oracle/wallet"],
    [for key in sort(keys(var.backend_env)) : "${key}=${var.backend_env[key]}"]
  ))}\n"

  cloud_init = templatefile("${path.module}/cloud-init.yaml.tftpl", {
    application_repository = var.application_repository
    application_ref        = var.application_ref
    application_dir        = var.application_dir
    install_docker_b64     = base64encode(file("${path.module}/../../../scripts/install-docker.sh"))
    deploy_stack_b64       = base64encode(file("${path.module}/../../../scripts/deploy-docker-stack.sh"))
    backend_env_b64        = base64encode(local.backend_env_contents)
    adb_wallet_zip_b64     = var.adb_wallet_zip_base64
  })
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
  admin_allowed_cidrs            = var.admin_allowed_cidrs
}

module "compute" {
  source = "../../modules/compute"

  compartment_ocid    = var.compartment_ocid
  environment         = var.environment
  availability_domain = data.oci_identity_availability_domains.ads.availability_domains[0].name
  subnet_id           = module.network.app_subnet_id
  nsg_ids             = [module.network.app_nsg_id]
  ssh_public_key      = var.ssh_public_key
  cloud_init          = local.cloud_init
  image_id            = var.compute_image_id
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
