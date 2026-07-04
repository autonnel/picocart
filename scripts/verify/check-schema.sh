#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
npx prisma validate
npx prisma generate
echo "check-schema: OK"
