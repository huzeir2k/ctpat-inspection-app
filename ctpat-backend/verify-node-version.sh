#!/usr/bin/env bash
# Builds the backend Dockerfile locally and prints the Node version it actually produces.
set -euo pipefail
cd "$(dirname "$0")"

echo "Building image from Dockerfile..."
docker build --no-cache -t ctpat-backend-verify .

echo ""
echo "Node version inside the built image:"
docker run --rm ctpat-backend-verify node --version
