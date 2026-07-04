#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
npx vitest run
echo "check-tests: OK"
