#!/usr/bin/env bash
#
# dev.sh — local development bootstrap for Torq-Reclip
#
# Usage:
#   ./dev.sh           # incremental: reuse existing .venv if present
#   ./dev.sh --clean   # destructive: rm -rf .venv and rebuild from scratch
#
# Starts the Flask backend (reclip.py) in the background and Vite on :3000.

set -euo pipefail

CLEAN=0
for arg in "$@"; do
    case "$arg" in
        --clean) CLEAN=1 ;;
        -h|--help)
            sed -n '2,11p' "$0"
            exit 0
            ;;
        *)
            echo "dev.sh: unknown argument '$arg' (use --clean or --help)" >&2
            exit 2
            ;;
    esac
done

if [ "$CLEAN" -eq 1 ]; then
    echo "[dev.sh] --clean specified: removing existing .venv"
    rm -rf .venv
fi

# Create venv if missing. python3 -m venv ships pip — no get-pip.py needed.
if [ ! -d .venv ]; then
    echo "[dev.sh] Creating .venv"
    python3 -m venv .venv
fi

# shellcheck disable=SC1091
source .venv/bin/activate

# Upgrade pip + install pinned requirements
python3 -m pip install --upgrade pip > pip_setup.log 2>&1
python3 -m pip install -r requirements.txt > pip_install.log 2>&1

# Run backend in the background (logs to reclip_backend.log, both gitignored)
python3 reclip.py > reclip_backend.log 2>&1 &
BACKEND_PID=$!
echo "[dev.sh] Flask backend started (PID $BACKEND_PID, logs: reclip_backend.log)"

# Trap to clean up backend when Vite exits
trap "echo '[dev.sh] Stopping backend (PID $BACKEND_PID)'; kill $BACKEND_PID 2>/dev/null || true" EXIT

# Start Vite dev server (foreground)
vite --port=3000 --host=0.0.0.0
