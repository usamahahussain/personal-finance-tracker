# Terraform state bootstrap

This one-time local-state configuration creates the private, versioned OCI
Object Storage bucket used by the environment Terraform state.

```bash
cd infra/terraform/bootstrap
cp terraform.tfvars.example terraform.tfvars
terraform init
terraform apply
```

Create an OCI customer secret key for the Terraform operator, then configure
the S3-compatible backend for the dev environment using the resulting access
key and secret. The credentials are not Terraform variables and must not be
committed.
