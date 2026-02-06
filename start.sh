#!/bin/bash
set -euo pipefail

# One-click start (Docker Compose)
# Usage:
#   export AMAP_API_KEY=xxxx
#   ./start.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [[ -z "${AMAP_API_KEY:-}" ]]; then
  echo "[start.sh] Missing AMAP_API_KEY env var" >&2
  echo "Example: export AMAP_API_KEY=YOUR_AMAP_KEY" >&2
  exit 2
fi

echo "[start.sh] Starting services with docker compose..."
docker compose up --build
