#!/bin/sh
echo "Running database migrations..."
npm run db:migrate || echo "Migration failed, continuing..."
npm run db:generate || echo "Generate failed, continuing..."

echo "Starting application..."
node dist/index.js
