output "app_vm_public_ip" {
  value = module.compute.public_ip
}

output "app_vm_private_ip" {
  value = module.compute.private_ip
}

output "adb_private_endpoint" {
  value = module.database.private_endpoint
}

output "adb_connection_strings" {
  value     = module.database.connection_strings
  sensitive = true
}

