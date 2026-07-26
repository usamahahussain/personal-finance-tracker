data "oci_identity_availability_domains" "ads" {
  compartment_id = var.compartment_ocid
}

data "oci_objectstorage_namespace" "current" {
  compartment_id = var.compartment_ocid
}

resource "oci_objectstorage_bucket" "deployment_artifacts" {
  compartment_id = var.compartment_ocid
  namespace      = data.oci_objectstorage_namespace.current.namespace
  name           = "pft-${var.environment}-deployment-artifacts"
  access_type    = "NoPublicAccess"
  storage_tier   = "Standard"
  versioning     = "Enabled"
}

resource "oci_objectstorage_object" "adb_wallet" {
  namespace = data.oci_objectstorage_namespace.current.namespace
  bucket    = oci_objectstorage_bucket.deployment_artifacts.name
  object    = "finance/Wallet_PFTDEV.zip"
  source    = var.adb_wallet_zip_path
}

resource "oci_objectstorage_preauthrequest" "adb_wallet" {
  namespace    = data.oci_objectstorage_namespace.current.namespace
  bucket       = oci_objectstorage_bucket.deployment_artifacts.name
  name         = "pft-${var.environment}-wallet-bootstrap"
  access_type  = "ObjectRead"
  object_name  = oci_objectstorage_object.adb_wallet.object
  time_expires = var.wallet_download_expiry
}

locals {
  cloud_init = templatefile("${path.module}/cloud-init.yaml.tftpl", {
    application_repository = var.application_repository
    application_ref        = var.application_ref
    application_dir        = var.application_dir
    install_docker_b64     = base64encode(file("${path.module}/../../../scripts/install-docker.sh"))
    deploy_stack_b64       = base64encode(file("${path.module}/../../../scripts/deploy-docker-stack.sh"))
    backend_env_b64        = filebase64(var.backend_env_path)
    wallet_download_url    = "https://objectstorage.${var.region}.oraclecloud.com${oci_objectstorage_preauthrequest.adb_wallet.access_uri}"
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
