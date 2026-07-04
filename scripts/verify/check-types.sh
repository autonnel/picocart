#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
npx prisma generate >/dev/null
npx tsc --noEmit
echo "check-types: OK"
