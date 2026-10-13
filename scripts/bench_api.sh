#!/usr/bin/env bash
# Measure latency/throughput of the main API endpoints with `hey`.
#
# Usage:
#   BASE="https://domain/imigrasi/api/v1" USER=agent1 PASS=secret ./scripts/bench_api.sh
#
# Requires: curl, hey  (https://github.com/rakyll/hey)
set -euo pipefail

BASE="${BASE:-http://localhost:8000/api/v1}"
USER="${USER:-agent1}"
PASS="${PASS:-Agent123!}"
N="${N:-200}"          # total requests per endpoint
C="${C:-20}"           # concurrency
OUT_DIR="${OUT_DIR:-reports}"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="${OUT_DIR}/bench-${STAMP}.txt"

command -v hey >/dev/null 2>&1 || { echo "ERROR: 'hey' tidak ditemukan. Lihat PERFORMANCE_TESTING.md"; exit 1; }
command -v curl >/dev/null 2>&1 || { echo "ERROR: 'curl' tidak ditemukan"; exit 1; }

mkdir -p "${OUT_DIR}"

echo "=== Login untuk mendapatkan access token ==="
LOGIN_JSON="$(curl -s -X POST "${BASE}/auth/login" \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  --data-urlencode "username=${USER}" \
  --data-urlencode "password=${PASS}")"

TOKEN="$(printf '%s' "${LOGIN_JSON}" | sed -n 's/.*"access_token":"\([^"]*\)".*/\1/p')"
if [ -z "${TOKEN}" ]; then
  echo "Gagal login. Respons: ${LOGIN_JSON}"
  exit 1
fi

AUTH="Authorization: Bearer ${TOKEN}"

run() {
  local label="$1"; shift
  echo "" | tee -a "${OUT}"
  echo "### ${label}" | tee -a "${OUT}"
  echo "    $*" | tee -a "${OUT}"
  # shellcheck disable=SC2068
  hey -n "${N}" -c "${C}" -H "${AUTH}" "$@" 2>&1 | tee -a "${OUT}"
}

echo "Menulis hasil ke ${OUT}"
{
  echo "Benchmark ${STAMP}"
  echo "BASE=${BASE} USER=${USER} N=${N} C=${C}"
} | tee -a "${OUT}"

run "Login (form, tanpa token)" -m POST -T 'application/x-www-form-urlencoded' \
  -d "username=${USER}&password=${PASS}" "${BASE}/auth/login"

run "Passenger list (25/hal)"  "${BASE}/passengers/?page=1&page_size=25"
run "Passenger list + filter+sort" "${BASE}/passengers/?status=pending&sort=created_at&order=desc&page=1&page_size=25"
run "Agent dashboard"          "${BASE}/passengers/dashboard/agent"
run "Supervisor dashboard"     "${BASE}/escalations/dashboard/supervisor"
run "Passenger stats"          "${BASE}/reports/passengers/stats"
run "Audit logs (50/hal)"      "${BASE}/reports/audit-logs?page=1&page_size=50"
run "Unread notifications"     "${BASE}/notifications/unread-count"

echo ""
echo "Selesai. Hasil: ${OUT}"
