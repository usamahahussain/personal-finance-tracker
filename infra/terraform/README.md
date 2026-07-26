# OCI Terraform deployment runbook

This directory is the source of truth for provisioning and replacing the
Personal Finance Tracker development environment in OCI. Keep this runbook
updated whenever a deployment prerequisite, input, bootstrap step, or
verification command changes.

## What Terraform deploys

The dev environment manages:

- application and database subnets inside an existing VCN;
- network security groups for SSH, HTTP, HTTPS, and private ADB connectivity;
- an Oracle Autonomous AI Database;
- a private deployment-artifacts bucket containing the ADB wallet;
- an Oracle Linux application VM; and
- cloud-init that installs Docker and starts the version-controlled Compose
  stack.

Only the Nginx ingress container publishes a VM port. It serves the launcher at
`/` and Personal Finance Tracker at `/finance`. The Next.js frontend and
FastAPI backend communicate on private Docker networks.

The VM is immutable. Changes to rendered cloud-init, application revision, or
runtime inputs replace it so first-boot provisioning runs again.

## Prerequisites

### Workstation tools

Install these on the machine from which Terraform will run:

| Requirement | Minimum/current expectation | Where to get it |
| --- | --- | --- |
| Terraform | 1.12 or newer; 1.14 is currently tested | [HashiCorp installation guide](https://developer.hashicorp.com/terraform/install) |
| OCI CLI | A version supporting Autonomous Database wallet generation | [OCI CLI installation guide](https://docs.oracle.com/en-us/iaas/Content/API/SDKDocs/cliinstall.htm) |
| Git | Any maintained version | [Git downloads](https://git-scm.com/downloads) |
| OpenSSH | `ssh`, `ssh-keygen`, and `scp` | Included with macOS/Linux or install OpenSSH |

Verify:

```bash
terraform version
oci --version
git --version
ssh -V
```

### OCI access

You need an OCI user with permission to manage the following resources in the
target compartment:

- compute instances, VNICs, subnets, NSGs, and security rules;
- Autonomous Database;
- Object Storage buckets, objects, and pre-authenticated requests; and
- availability-domain and Object Storage namespace discovery.

Ask the tenancy administrator to grant these permissions through
**Identity & Security → Policies**. Administrator access is sufficient for a
personal development tenancy; use narrower policies for shared or production
tenancies.

Configure an OCI CLI/API-key profile named `oracle`:

```bash
oci setup config
oci --profile oracle iam region list --output table
```

OCI API keys are managed under **Profile → My profile → API keys**. The
`oracle` section in `~/.oci/config` must point to the target tenancy, user,
region, API-key fingerprint, and private key.

The Terraform backend is the native OCI backend. AWS/S3 customer secret keys
are not required.

### Existing OCI network

The current network module expects:

- an existing VCN;
- an Internet Gateway attached to that VCN; and
- an existing public route table containing `0.0.0.0/0` to the Internet
  Gateway.

Find these in **Networking → Virtual cloud networks**, or with:

```bash
oci --profile oracle network vcn list --compartment-id <compartment-ocid>
oci --profile oracle network route-table list \
  --compartment-id <compartment-ocid> \
  --vcn-id <vcn-ocid>
```

Record the compartment OCID, VCN OCID, and public route-table OCID.

Choose non-overlapping application and database subnet CIDRs within the VCN.
The defaults are `10.0.10.0/24` and `10.0.20.0/24`.

### SSH key and permitted client networks

Generate a dedicated SSH key if one does not already exist:

```bash
ssh-keygen -t ed25519 -f keys/pft_dev_vm -C pft-dev-vm
```

Place the contents of `keys/pft_dev_vm.pub` in `ssh_public_key`. Keep the
private key out of Git.

Add each trusted public client network to `admin_allowed_cidrs`. For a single
workstation, use its public IPv4 address with `/32`. Avoid `0.0.0.0/0`.

### OCI compute image

Choose an Oracle Linux 9 image compatible with the configured compute shape.
Find the image OCID under **Compute → Custom images / Platform images**, or:

```bash
oci --profile oracle compute image list \
  --compartment-id <compartment-ocid> \
  --operating-system "Oracle Linux" \
  --operating-system-version "9" \
  --shape VM.Standard.E4.Flex \
  --sort-by TIMECREATED \
  --sort-order DESC
```

Pin the chosen OCID in `compute_image_id`. Changing it replaces the VM.

### Application revision

`application_ref` must be the full 40-character SHA of a commit already pushed
to `application_repository`. That commit must contain `infra/docker`.

```bash
git push origin main
git rev-parse origin/main
```

### Backend environment file

Create an ignored environment file from `backend/.env.example`. It must define:

- `LUNCHFLOW_URL` and `LUNCHFLOW_API_KEY`, obtained from the Lunchflow account;
- `PFT_DB_USERNAME` and `PFT_DB_PASSWORD`;
- `PFT_DB_DSN`, matching a service in the generated `tnsnames.ora`;
- `PFT_DB_WALLET_DIR=/opt/oracle/wallet`; and
- `PFT_DB_WALLET_PASSWORD`, matching the password used to download/generate
  the wallet.

Recommended location:

```text
infra/terraform/environments/dev/backend.env
```

Restrict it:

```bash
chmod 0600 infra/terraform/environments/dev/backend.env
```

`backend.env` is ignored by Git. Its content is nevertheless stored in
Terraform state and OCI instance user-data, so access to both must be
restricted.

### ADB wallet and application schema

For an existing ADB, obtain `Wallet_PFTDEV.zip` from **Oracle Database →
Autonomous Database → Database connection → Download wallet**, or run:

```bash
read -r -s -p "Wallet password: " PFT_WALLET_PASSWORD
printf '\n'

oci --profile oracle db autonomous-database generate-wallet \
  --autonomous-database-id <adb-ocid> \
  --password "${PFT_WALLET_PASSWORD}" \
  --generate-type SINGLE \
  --file Wallet_PFTDEV.zip

unset PFT_WALLET_PASSWORD
```

Keep the archive out of Git. Terraform uploads it to the private
deployment-artifacts bucket and cloud-init downloads it through a time-limited
pre-authenticated URL.

Important: Terraform currently creates the ADB infrastructure but does not
create the `finance_app` database user, tables, grants, or seed data. There is
currently no version-controlled schema migration in this repository. For a
completely new database, create that schema manually before expecting the
application to work. Obtain the schema from the owner of an existing deployment
or export it from the current ADB using Oracle SQL Developer, SQLcl, or Data
Pump. Record any repeatable SQL as a future IaC/migration improvement.

## 1. Clone and choose the deployment revision

```bash
git clone https://github.com/usamahahussain/personal-finance-tracker.git
cd personal-finance-tracker
git checkout main
git pull --ff-only
git rev-parse HEAD
```

Use the resulting SHA as `application_ref`.

## 2. Bootstrap remote state

The state bucket itself must exist before the dev configuration can use it.
This one-time bootstrap uses local state:

```bash
cd infra/terraform/bootstrap
cp terraform.tfvars.example terraform.tfvars
```

Set `compartment_ocid`, `region`, and a tenancy-unique `bucket_name`, then run:

```bash
terraform init
terraform plan -out=/private/tmp/pft-state-bootstrap.tfplan
terraform apply /private/tmp/pft-state-bootstrap.tfplan
terraform output
```

Retain and protect the bootstrap directory's local state. The created bucket
is private, encrypted by OCI, and versioned.

## 3. Configure the native OCI backend

```bash
cd ../environments/dev
cp backend.hcl.example backend.hcl
```

Set `namespace` using the bootstrap output. Confirm `bucket`, `region`, and
`config_file_profile = "oracle"`.

For a completely new environment:

```bash
terraform init -backend-config=backend.hcl
```

To migrate existing local state:

```bash
terraform init \
  -migrate-state \
  -force-copy \
  -backend-config=backend.hcl

terraform state list
```

The native OCI backend stores `dev/terraform.tfstate` in Object Storage and
uses OCI lock objects to prevent concurrent writes.

## 4. Configure environment inputs

```bash
cp terraform.tfvars.example terraform.tfvars
```

Populate every placeholder, including:

- OCI compartment, VCN, route table, image, and SSH values;
- allowed client CIDRs;
- a strong ADB administrator password;
- the pushed `application_ref`;
- absolute `backend_env_path`; and
- absolute `adb_wallet_zip_path`.

Do not commit `terraform.tfvars`, `backend.hcl`, `backend.env`, wallets, keys,
plans, or state.

### Brand-new ADB two-stage bootstrap

Because the wallet is generated only after the ADB exists, a new tenancy needs
a staged first deployment:

1. Create temporary local files satisfying `backend_env_path` and
   `adb_wallet_zip_path`; these are not uploaded during the targeted database
   phase. For example:

   ```bash
   printf 'PFT_DB_WALLET_DIR=/opt/oracle/wallet\n' \
     > /private/tmp/pft-placeholder.env
   touch /private/tmp/pft-placeholder-wallet.zip
   ```

   Point the two path variables at these files temporarily.
2. Create the network and database:

   ```bash
   terraform plan \
     -target=module.network \
     -target=module.database \
     -out=/private/tmp/pft-database-bootstrap.tfplan

   terraform apply /private/tmp/pft-database-bootstrap.tfplan
   terraform output -raw adb_id
   ```

3. Download the wallet using the OCI Console or CLI command above.
4. Create the application database user/schema and complete `backend.env`.
5. Replace the temporary paths in `terraform.tfvars` with the real files.
6. Continue with the full plan below. The full plan reconciles any dependencies
   omitted by targeted bootstrap.

## 5. Plan the complete deployment

```bash
terraform fmt -check -recursive
terraform validate
terraform plan -out=/private/tmp/pft-deployment.tfplan
terraform show /private/tmp/pft-deployment.tfplan
```

Review all destructive actions. A changed application/cloud-init input replaces
the VM. Do not apply if Terraform proposes an unexpected database replacement
or deletion.

## 6. Apply

```bash
terraform apply /private/tmp/pft-deployment.tfplan
```

For a VM replacement, expect the public IP to change and allow time for
cloud-init to install Docker, clone the pinned revision, build images, and start
the stack.

## 7. Verify

```bash
APP_IP=$(terraform output -raw app_vm_public_ip)

ssh -i ../../../../keys/pft_dev_vm "opc@${APP_IP}" \
  'sudo cloud-init status --wait'

ssh -i ../../../../keys/pft_dev_vm "opc@${APP_IP}" \
  'sudo docker compose \
    --project-directory /opt/personal-finance-tracker \
    --file /opt/personal-finance-tracker/infra/docker/compose.yaml \
    ps'

curl --fail "http://${APP_IP}/"
curl --fail "http://${APP_IP}/finance"
```

If a container is unhealthy or absent:

```bash
ssh -i ../../../../keys/pft_dev_vm "opc@${APP_IP}" \
  'sudo docker compose \
    --project-directory /opt/personal-finance-tracker \
    --file /opt/personal-finance-tracker/infra/docker/compose.yaml \
    logs --tail=200'
```

## Updating an existing deployment

1. Commit and push the application/infrastructure changes.
2. Set `application_ref` to the new full commit SHA.
3. Run `terraform plan` and confirm only intended changes.
4. Apply the saved plan.
5. Repeat the verification checks.

Do not edit files directly on the VM; replacements rebuild from Git and
Terraform inputs.

## Security and operational notes

- Never commit credentials, tfvars, backend config, wallets, plans, or state.
- Restrict Object Storage state access because state includes backend secrets.
- The wallet download URL expires at `wallet_download_expiry`; extend it before
  a later VM replacement if necessary.
- Object Storage bucket versioning enables state recovery but is not a
  substitute for tested backups.
- HTTP is currently exposed only to `admin_allowed_cidrs`. HTTPS and a stable
  public hostname are future improvements.
- `prod` is not implemented; `environments/prod` is currently a placeholder.
