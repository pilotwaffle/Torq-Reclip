#!/usr/bin/env bash

# Force recreation of the environment
rm -rf .venv

# Setup Python backend
python3 -m venv .venv
source .venv/bin/activate

# Use Node.js to download get-pip.py
node -e "const https = require('https'); const fs = require('fs'); const file = fs.createWriteStream('get-pip.py'); https.get('https://bootstrap.pypa.io/get-pip.py', function(response) { response.pipe(file); file.on('finish', () => file.close()); });"

# Wait a second for it to finish downloading properly
sleep 2

python3 get-pip.py > pip_setup.log 2>&1
python3 -m pip install -r requirements.txt > pip_install.log 2>&1

# Run backend in the background
python3 reclip.py > reclip_backend.log 2>&1 &

# Start Vite server
vite --port=3000 --host=0.0.0.0



