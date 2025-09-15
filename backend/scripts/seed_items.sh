#!/usr/bin/env bash

set -e

cd "$(dirname "$0")/.."

echo "Running items seeding script..."
python -m app.seed_items
