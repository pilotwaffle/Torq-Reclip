#!/usr/bin/env bash
set -e

echo "Starting ReClip setup..."

# Check Python 3
if ! command -v python3 &> /dev/null; then
    echo "Error: Python 3 is required but could not be found."
    echo "Please install Python 3 and try again."
    exit 1
fi

# Check ffmpeg
if ! command -v ffmpeg &> /dev/null; then
    echo "Error: ffmpeg is required but could not be found."
    echo "To install:"
    echo "  macOS (Homebrew): brew install ffmpeg"
    echo "  Debian/Ubuntu:    sudo apt update && sudo apt install ffmpeg"
    exit 1
fi

# Create venv if missing
if [ ! -d ".venv" ]; then
    echo "Creating virtual environment in .venv..."
    python3 -m venv .venv
fi

# Activate venv
source .venv/bin/activate

# Install requirements
echo "Installing/updating requirements..."
python3 -m pip install -q -r requirements.txt

echo -e "\n========================================"
echo "    ReClip is running!"
echo "    Open: http://localhost:8899"
echo "========================================\n"

# Run server
python3 reclip.py
