#!/usr/bin/env bash
# Build the frontend and report chunk sizes (raw + gzip).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "${ROOT}/frontend"

if [ ! -d node_modules ]; then
  echo "Menjalankan npm ci ..."
  npm ci --no-audit --no-fund
fi

npm run build

echo ""
echo "=== Ukuran chunk (mentah + gzip) ==="
printf "%-42s %10s %10s\n" "FILE" "RAW" "GZIP"
for f in dist/assets/*.js dist/assets/*.css; do
  [ -e "$f" ] || continue
  raw="$(wc -c < "$f" | tr -d ' ')"
  gz="$(gzip -c "$f" | wc -c | tr -d ' ')"
  printf "%-42s %10s %10s\n" "$(basename "$f")" "$raw" "$gz"
done | sort -k2 -n -r

echo ""
echo "Total dist:"
du -sh dist 2>/dev/null || true
