#!/usr/bin/env bash
set -euo pipefail
here="$(dirname "$0")"
bash "$here/check-no-refs.sh" autonnel
bash "$here/check-schema.sh"
bash "$here/check-types.sh"
bash "$here/check-tests.sh"
echo "verify-all: OK"
