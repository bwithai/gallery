#!/bin/bash

# Script to seed collections into the database
# This script should be run from the backend directory

set -e

echo "🌱 Seeding collections into the database..."

cd "$(dirname "$0")/.."

# Run the collections seeding script
python -m app.seed_collections

echo "✅ Collections seeding completed!"
