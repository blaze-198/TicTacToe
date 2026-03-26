#!/bin/sh
set -e

# Parse DATABASE_URL (postgres://user:pass@host:port/dbname) into Nakama's format (user:pass@host:port/dbname)
if [ -n "$DATABASE_URL" ]; then
  DB_ADDR=$(echo "$DATABASE_URL" | sed 's|^postgres://||; s|^postgresql://||; s|?.*||')
  echo "Using DATABASE_URL for database connection"
else
  DB_ADDR="${DB_USER:-postgres}:${DB_PASSWORD:-localdb}@${DB_HOST:-postgres}:${DB_PORT:-5432}/${DB_NAME:-nakama}"
  echo "Using individual DB_* env vars for database connection"
fi

echo "Running database migrations..."
/nakama/nakama migrate up --database.address "$DB_ADDR"

echo "Starting Nakama server..."
exec /nakama/nakama \
  --name nakama1 \
  --database.address "$DB_ADDR" \
  --logger.level INFO \
  --session.token_expiry_sec 7200 \
  --config /nakama/data/local.yml \
  --socket.server_key "${NAKAMA_SERVER_KEY:-defaultkey}" \
  --port "${PORT:-7350}" \
  --socket.port "${PORT:-7350}" \
  --console.port 7351
