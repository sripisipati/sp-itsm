#!/bin/sh
set -eu
cd /app/database
npx prisma migrate deploy
if [ "${SEED_ON_START:-false}" = "true" ]; then
  npx prisma db seed
fi
cd /app
exec node backend/dist/main.js
