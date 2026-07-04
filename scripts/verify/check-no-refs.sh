#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
if [ "$#" -lt 1 ]; then
  echo "usage: check-no-refs.sh <keyword>" >&2
  exit 2
fi
keyword="$1"
hits=$(grep -rn --include='*.ts' --include='*.astro' --include='*.tsx' \
  --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.astro \
  -e "$keyword" src tests 2>/dev/null || true)
if [ -n "$hits" ]; then
  echo "check-no-refs: FAIL — found references to '$keyword':" >&2
  echo "$hits" >&2
  exit 1
fi
echo "check-no-refs: OK (0 hits for '$keyword')"
