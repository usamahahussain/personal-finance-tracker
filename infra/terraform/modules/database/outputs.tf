output "autonomous_database_id" {
  value = oci_database_autonomous_database.main.id
}

output "connection_strings" {
  value     = oci_database_autonomous_database.main.connection_strings
  sensitive = true
}

output "private_endpoint" {
  value = oci_database_autonomous_database.main.private_endpoint
}

