#!/usr/bin/env bash

# Clones the requested revision, renders runtime secrets supplied by cloud-init,
# and starts the complete Docker Compose application stack.
set -euo pipefail

readonly REPOSITORY_URL="${1:?Usage: $0 REPOSITORY_URL GIT_REF APP_DIR}"
readonly GIT_REF="${2:?Usage: $0 REPOSITORY_URL GIT_REF APP_DIR}"
readonly APP_DIR="${3:?Usage: $0 REPOSITORY_URL GIT_REF APP_DIR}"
readonly RUNTIME_DIR="/etc/pft/finance"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run this script as root." >&2
  exit 1
fi

if [[ -e "${APP_DIR}" ]]; then
  echo "${APP_DIR} already exists; a Docker deployment VM must start from a clean checkout." >&2
  exit 1
fi

if [[ ! -s "${RUNTIME_DIR}/backend.env" ]]; then
  echo "Missing backend environment file at ${RUNTIME_DIR}/backend.env." >&2
  exit 1
fi

if [[ ! -s "${RUNTIME_DIR}/wallet.zip" ]]; then
  echo "Missing ADB wallet archive at ${RUNTIME_DIR}/wallet.zip." >&2
  exit 1
fi

install -d -m 0755 "$(dirname "${APP_DIR}")"
git clone "${REPOSITORY_URL}" "${APP_DIR}"
git -C "${APP_DIR}" checkout --detach "${GIT_REF}"

install -d -m 0700 "${RUNTIME_DIR}/wallet"
unzip -o -q "${RUNTIME_DIR}/wallet.zip" -d "${RUNTIME_DIR}/wallet"
chmod 0600 "${RUNTIME_DIR}/backend.env" "${RUNTIME_DIR}/wallet.zip"
find "${RUNTIME_DIR}/wallet" -type d -exec chmod 0700 {} \;
find "${RUNTIME_DIR}/wallet" -type f -exec chmod 0600 {} \;

docker compose --project-directory "${APP_DIR}" --file "${APP_DIR}/infra/docker/compose.yaml" up --build --detach --remove-orphans
