#!/bin/sh
set -e

# Parse DATABASE_URL (postgres://user:pass@host:port/dbname?sslmode=X)
# into Nakama's format (user:pass@host:port/dbname?sslmode=X)
if [ -n "$DATABASE_URL" ]; then
  DB_ADDR=$(echo "$DATABASE_URL" | sed 's|^postgres://||; s|^postgresql://||')
  echo "Using DATABASE_URL for database connection"
else
  DB_ADDR="${DB_USER:-postgres}:${DB_PASSWORD:-localdb}@${DB_HOST:-postgres}:${DB_PORT:-5432}/${DB_NAME:-nakama}"
  echo "Using individual DB_* env vars for database connection"
fi

# Render exposes a single PORT env var — use it for the HTTP/WebSocket API
HTTP_PORT="${PORT:-7350}"

echo "Running database migrations..."
/nakama/nakama migrate up --database.address "$DB_ADDR" || echo "Migration warning (may be ok if already up to date)"

echo "Starting Nakama server on port $HTTP_PORT..."
exec /nakama/nakama \
  --name nakama1 \
  --database.address "$DB_ADDR" \
  --logger.level INFO \
  --session.token_expiry_sec 7200 \
  --config /nakama/data/local.yml \
  --socket.server_key "${NAKAMA_SERVER_KEY:-defaultkey}" \
  --socket.port "$HTTP_PORT" \
  --console.port 7351
