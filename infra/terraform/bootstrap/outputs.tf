output "bucket_name" {
  value = oci_objectstorage_bucket.terraform_state.name
}

output "namespace" {
  value = data.oci_objectstorage_namespace.current.namespace
}
