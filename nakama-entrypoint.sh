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

# Use Render's PORT for the HTTP/WebSocket API (what clients connect to)
HTTP_PORT="${PORT:-7350}"
# gRPC on a different internal port (not exposed)
GRPC_PORT="7349"
CONSOLE_PORT="7351"

echo "Running database migrations..."
/nakama/nakama migrate up --database.address "$DB_ADDR" || echo "Migration warning (may be ok if already up to date)"

echo "Starting Nakama server on HTTP port $HTTP_PORT..."
exec /nakama/nakama \
  --name nakama1 \
  --database.address "$DB_ADDR" \
  --logger.level INFO \
  --session.token_expiry_sec 7200 \
  --config /nakama/data/local.yml \
  --socket.server_key "${NAKAMA_SERVER_KEY:-defaultkey}" \
  --socket.port "$HTTP_PORT" \
  --port "$GRPC_PORT" \
  --console.port "$CONSOLE_PORT"
