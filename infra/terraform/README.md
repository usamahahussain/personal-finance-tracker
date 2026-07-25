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

## VM web proxy

After provisioning an Oracle Linux application VM, install and configure Nginx
as the public HTTP reverse proxy for the loopback-only Next.js server:

```bash
sudo ./infra/scripts/setup-nginx.sh
```

The script is idempotent and defaults to proxying port 80 to
`http://127.0.0.1:3000`. Override the upstream when required:

```bash
sudo UPSTREAM_HOST=127.0.0.1 UPSTREAM_PORT=3000 ./infra/scripts/setup-nginx.sh
```

It installs and enables Nginx and firewalld, opens the host HTTP service,
configures the SELinux network-connect policy for Nginx, validates the Nginx
configuration, and restarts the service. The OCI NSG must separately permit
TCP port 80 from the intended client CIDRs.
