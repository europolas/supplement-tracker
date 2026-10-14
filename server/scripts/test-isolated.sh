#!/usr/bin/env bash
# Ephemeral MariaDB only. Never reads .runtime/compose.env or deployment secrets.
set -euo pipefail
cd "$(dirname "$0")/.."
check_dir=$(mktemp -d)
check_network="supplement-checks-$$"
check_db="supplement-checks-db-$$"
cleanup() { docker rm -f "$check_db" >/dev/null 2>&1 || true; docker network rm "$check_network" >/dev/null 2>&1 || true; rm -rf "$check_dir"; }
trap cleanup EXIT
head -c 32 /dev/urandom | base64 > "$check_dir/root"
chmod 600 "$check_dir/root"
docker network create "$check_network" >/dev/null
docker run -d --name "$check_db" --network "$check_network" --network-alias tracker-checks-db --tmpfs /var/lib/mysql:rw,size=512m -v "$check_dir/root:/run/secrets/test_db_root:ro" -e MARIADB_ROOT_PASSWORD_FILE=/run/secrets/test_db_root mariadb:11.4 >/dev/null
for attempt in {1..60}; do
 if docker exec "$check_db" healthcheck.sh --connect --innodb_initialized >/dev/null 2>&1; then break; fi
 sleep 1
done
docker run --rm --user "$(id -u):$(id -g)" --network "$check_network" -e DB_TEST_HOST=tracker-checks-db -v "$check_dir/root:/run/secrets/test_db_root:ro" -v "$PWD/test:/app/test:ro" supplement-tracker-api node --test test/*.test.mjs
