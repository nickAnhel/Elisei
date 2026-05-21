#!/bin/sh
set -eu

RESULTS_DIR="/results"
SCRIPTS_DIR="/scripts"
DEMO_ACCOUNTS_FILE="${SCRIPTS_DIR}/data/demo_accounts.json"

if [ ! -f "${DEMO_ACCOUNTS_FILE}" ]; then
  echo "demo_accounts.json not found. Run demo_seed in the main application before load testing."
  exit 1
fi

mkdir -p "${RESULTS_DIR}"

run_one() {
  script_name="$1"
  profile_name="$2"

  ts="$(date -u +%Y%m%dT%H%M%SZ)"
  testid="${script_name}-${profile_name}-${ts}"
  summary_file="${RESULTS_DIR}/${testid}.json"
  html_file="${RESULTS_DIR}/${testid}.html"
  log_file="${RESULTS_DIR}/${testid}.log"

  echo "[k6_suite] running ${script_name}.js profile=${profile_name} testid=${testid}"

  if ! env PROFILE="${profile_name}" K6_WEB_DASHBOARD_EXPORT="${html_file}" \
    k6 run -o experimental-prometheus-rw --tag "testid=${testid}" "${SCRIPTS_DIR}/${script_name}.js" --summary-export "${summary_file}" >"${log_file}" 2>&1; then
    cat "${log_file}"
    echo "[k6_suite][error] ${script_name}.js profile=${profile_name} failed"
    exit 1
  fi

  cat "${log_file}"
  echo "[k6_suite] saved ${summary_file} ${html_file} ${log_file}"
}

run_one api-read smoke
sleep 5
run_one api-write smoke
sleep 5
run_one api-mixed quick
sleep 5
run_one api-mixed load

echo "[k6_suite] suite completed successfully"
