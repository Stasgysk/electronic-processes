#!/bin/bash

set -e

PACKAGE_NAME=$(node -p "require('./package.json').name")

if [ -z "$PACKAGE_NAME" ]; then
  echo "Error: Could not determine package name from package.json."
  exit 1
fi

echo "Building the node..."
npm run build

echo "Deployment complete."

echo "Stopping old containers..."
docker compose down || true

echo "Starting n8n in detached mode..."
docker compose up --build -d

echo "✅ n8n is running in background."
