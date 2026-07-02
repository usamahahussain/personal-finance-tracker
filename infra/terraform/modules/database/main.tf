resource "oci_database_autonomous_database" "main" {
  compartment_id           = var.compartment_ocid
  db_name                  = var.db_name
  display_name             = var.display_name
  admin_password           = var.admin_password
  db_workload              = "OLTP"
  compute_count            = var.cpu_core_count
  compute_model            = "ECPU"
  data_storage_size_in_tbs = var.data_storage_size_in_tbs
  license_model            = "LICENSE_INCLUDED"
  db_version               = "26ai"

  is_mtls_connection_required = true
  nsg_ids                     = var.nsg_ids
  private_endpoint_label      = "pft-${var.environment}-adb"
  subnet_id                   = var.subnet_id
}

