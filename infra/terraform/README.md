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

## Docker application VM

The application VM is an immutable Docker Compose deployment. Its only public
container is the Nginx ingress on port 80. The ingress serves the app launcher
at `/` and the Personal Finance Tracker at `/finance`; the FastAPI backend is
reachable only on the internal Docker network through the Next.js proxy route.

Cloud-init installs Docker, checks out the exact `application_ref` commit,
creates the ADB wallet and backend environment files under `/etc/pft/finance`,
then runs `docker compose up --build --detach`. Docker restart policies restore
the stack after a VM reboot. No host Nginx or `pft-*` systemd user service is
installed by this deployment.

`application_ref` is required and must be the full commit SHA of a revision
already pushed to `application_repository` that includes the Docker deployment
assets. This prevents a replacement VM from accidentally building an older
repository revision that lacks its Compose configuration.

The rendered cloud-init is an instance replacement trigger. Changing the
application commit, Docker configuration, cloud-init, or sensitive deployment
inputs causes Terraform to replace the VM so the first-boot deployment runs.

Set `backend_env` and `adb_wallet_zip_base64` through `TF_VAR_` environment
variables or an ignored local tfvars file. These sensitive values are written
to the instance user-data and Terraform state; use the remote state workflow
below and restrict VM/OCI metadata access accordingly.

## Remote state bootstrap

Create the private, versioned Object Storage bucket once using
`infra/terraform/bootstrap`. Then copy
`environments/dev/backend.hcl.example` to an ignored `backend.hcl`, configure
the Object Storage namespace, and store the Terraform operator's OCI customer
secret key in an AWS credentials profile named `pft-oracle`. The dedicated
profile prevents credentials for another OCI tenancy from being selected.
Then migrate the existing state:

```bash
cd infra/terraform/environments/dev
terraform init -migrate-state -backend-config=backend.hcl
```

The bucket is encrypted at rest by OCI and must be restricted to the Terraform
operators. Do not commit `backend.hcl`, access keys, wallets, or tfvars files.
