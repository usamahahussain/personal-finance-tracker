# Terraform

Terraform will manage the OCI infrastructure for the application.

Planned modules:

- `network`: project subnets and NSGs inside an existing VCN.
- `database`: Oracle Autonomous Database.
- `compute`: application VM and instance metadata.
- `load_balancer`: public HTTPS entrypoint.
- `vault`: production secrets.

Planned environments:

- `environments/dev`
- `environments/prod`

Do not commit `.tfvars`, state files, provider keys, database wallets, or generated credentials.

The dev environment can reuse an existing VCN. Supply the compartment OCID,
VCN OCID, route table OCID, SSH public key, admin CIDR, and database password
from a local `.tfvars` file or `TF_VAR_` environment variables. Do not commit
real OCI resource identifiers or local network details.
