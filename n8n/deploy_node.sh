#!/bin/bash

set -e

PACKAGE_NAME=$(node -p "require('./package.json').name")

if [ -z "$PACKAGE_NAME" ]; then
  echo "Error: Could not determine package name from package.json."
  exit 1
fi

TARGET_DIR="./custom/$PACKAGE_NAME"

echo "Detected package name: '$PACKAGE_NAME'"
echo "Target deployment directory: '$TARGET_DIR'"

echo "Building the node..."
pnpm run build

SOURCE_DIR="./dist"

echo "Deploying build output from '$SOURCE_DIR' to '$TARGET_DIR'..."

rm -rf "$TARGET_DIR"
mkdir -p "$TARGET_DIR"
cp -r "$SOURCE_DIR/"* "$TARGET_DIR/"

echo "Deployment complete."

echo "Restarting n8n container..."
docker compose restart n8n

echo "Waiting for logs..."
docker compose logs -f n8n
