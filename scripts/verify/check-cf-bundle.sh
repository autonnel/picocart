#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."

MAX_KB=$((10 * 1024))

npm run build:cf

# wrangler bundles src/cf-worker.ts + dist/server at deploy time, so the
# server build output is the measurable proxy for the worker bundle.
bundle=""
for candidate in dist/_worker.js dist/server; do
  if [ -e "$candidate" ]; then
    bundle="$candidate"
    break
  fi
done
if [ -z "$bundle" ]; then
  echo "check-cf-bundle: FAIL — no worker bundle found under dist/" >&2
  exit 1
fi

size_kb=$(du -sk "$bundle" | cut -f1)
if [ "$size_kb" -gt "$MAX_KB" ]; then
  echo "check-cf-bundle: FAIL — $bundle is ${size_kb}KB (limit ${MAX_KB}KB)" >&2
  exit 1
fi
echo "check-cf-bundle: OK ($bundle is ${size_kb}KB, limit ${MAX_KB}KB)"
