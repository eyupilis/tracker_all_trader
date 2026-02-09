#!/bin/sh

echo "=== Starting deployment script ==="
echo "Node version: $(node --version)"
echo "NPM version: $(npm --version)"

echo "=== Running database migrations ==="
npm run db:migrate || echo "Migration failed, continuing..."

echo "=== Generating Prisma client ==="
npm run db:generate || echo "Generate failed, continuing..."

echo "=== Checking dist folder ==="
ls -la dist/ || echo "dist folder not found!"

echo "=== Environment Check ==="
echo "NODE_ENV: $NODE_ENV"
echo "PORT: $PORT"
echo "DATABASE_URL: ${DATABASE_URL:0:30}..." # Show first 30 chars only
echo "INGEST_API_KEY: ${INGEST_API_KEY:+SET}" # Show "SET" if defined

echo "=== Starting application ==="
echo "Command: node dist/index.js"
exec node dist/index.js 2>&1
