#!/usr/bin/env bash
set -euo pipefail
PROJECT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
command -v python3 >/dev/null || { echo 'Python 3 is required.'; exit 1; }
exec python3 "$PROJECT_DIR/scripts/dev.py" stop
