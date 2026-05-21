#!/usr/bin/env bash
set -euo pipefail

: "${DEMO_DB_NAME:?DEMO_DB_NAME is required}"
: "${LOADTEST_DB_NAME:?LOADTEST_DB_NAME is required}"
: "${POSTGRES_USER:?POSTGRES_USER is required}"
: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}"
: "${DB_HOST:?DB_HOST is required}"
: "${DB_PORT:?DB_PORT is required}"

if [[ "${DEMO_DB_NAME}" == "${LOADTEST_DB_NAME}" ]]; then
  echo "[loadtest_db_prepare][error] DEMO_DB_NAME and LOADTEST_DB_NAME must be different"
  exit 1
fi

name_lc="$(printf '%s' "${LOADTEST_DB_NAME}" | tr '[:upper:]' '[:lower:]')"
case "${name_lc}" in
  *loadtest*|*test*|*perf*) ;;
  *)
    echo "[loadtest_db_prepare][error] LOADTEST_DB_NAME='${LOADTEST_DB_NAME}' must contain loadtest/test/perf"
    exit 1
    ;;
esac

echo "[loadtest_db_prepare] source DB: ${DEMO_DB_NAME}"
echo "[loadtest_db_prepare] target DB: ${LOADTEST_DB_NAME}"
echo "[loadtest_db_prepare] target DB will be dropped and recreated"

export PGPASSWORD="${POSTGRES_PASSWORD}"

psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${POSTGRES_USER}" -d postgres -v ON_ERROR_STOP=1 \
  -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${LOADTEST_DB_NAME}' AND pid <> pg_backend_pid();"

psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${POSTGRES_USER}" -d postgres -v ON_ERROR_STOP=1 \
  -c "DROP DATABASE IF EXISTS \"${LOADTEST_DB_NAME}\";"

psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${POSTGRES_USER}" -d postgres -v ON_ERROR_STOP=1 \
  -c "CREATE DATABASE \"${LOADTEST_DB_NAME}\";"

pg_dump -h "${DB_HOST}" -p "${DB_PORT}" -U "${POSTGRES_USER}" -d "${DEMO_DB_NAME}" -Fc \
  | pg_restore -h "${DB_HOST}" -p "${DB_PORT}" -U "${POSTGRES_USER}" -d "${LOADTEST_DB_NAME}" --no-owner --no-privileges

if [[ ! -f /seed-output/demo_accounts.json ]]; then
  echo "demo_accounts.json not found. Run demo_seed in the main application before load testing."
  exit 1
fi

cp /seed-output/demo_accounts.json /k6-data/demo_accounts.json
echo "[loadtest_db_prepare] copied demo_accounts.json for k6"
