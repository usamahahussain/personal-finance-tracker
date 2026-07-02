output "vcn_id" {
  value = var.existing_vcn_id
}

output "app_subnet_id" {
  value = oci_core_subnet.app.id
}

output "db_subnet_id" {
  value = oci_core_subnet.db.id
}

output "app_nsg_id" {
  value = oci_core_network_security_group.app.id
}

output "db_nsg_id" {
  value = oci_core_network_security_group.db.id
}
