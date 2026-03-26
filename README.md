# 🎮 Multiplayer Tic-Tac-Toe

A production-ready, real-time multiplayer Tic-Tac-Toe game with **server-authoritative** architecture powered by [Nakama](https://heroiclabs.com/nakama/) game server.

## ✨ Features

- **Server-Authoritative Logic** — All game state managed server-side; moves validated before applying
- **Real-time Multiplayer** — Play against others via WebSocket with instant state updates
- **Matchmaking** — Automatic match finding or creation
- **Leaderboard** — Global ranking with wins, losses, draws, and streaks
- **Timer Mode** — 30-second turn limit with auto-forfeit
- **Responsive UI** — Mobile-first dark theme with glassmorphism design
- **Disconnect Handling** — Opponent wins by forfeit if player disconnects

## 🏗️ Architecture

```
┌─────────────────────┐       WebSocket / HTTP       ┌──────────────────────┐
│   React Frontend    │ ◄──────────────────────────► │   Nakama Server      │
│   (Vite SPA)        │   @heroiclabs/nakama-js      │   (Docker)           │
│                     │                              │                      │
│  • Device Auth      │                              │  • Match Handler     │
│  • Game Board UI    │                              │  • Move Validation   │
│  • Matchmaking UI   │                              │  • Matchmaking RPC   │
│  • Leaderboard      │                              │  • Leaderboard       │
│  • Timer Display    │                              │  • Timer Logic       │
└─────────────────────┘                              └──────┬───────────────┘
                                                            │
                                                     ┌──────▼───────────────┐
                                                     │   PostgreSQL         │
                                                     └──────────────────────┘
```

### Design Decisions

| Decision                        | Rationale                                                                    |
| ------------------------------- | ---------------------------------------------------------------------------- |
| **Nakama (TypeScript runtime)** | Built-in matchmaking, storage, leaderboards; authoritative match handler API |
| **React + Vite**                | Fast dev server, optimized builds, easy to deploy as static files            |
| **Device-based auth**           | Zero-friction guest login — players can start playing immediately            |
| **Server-authoritative**        | All game logic runs on server; clients only send move intents                |
| **Docker Compose**              | Single-command setup for Nakama + PostgreSQL + Frontend                      |

### Server-Side Game Flow

1. Player calls `find_match` RPC → server finds/creates a match
2. Both players join match via WebSocket
3. Server assigns marks (X/O), broadcasts `START` event
4. On each move: client sends `MOVE` → server validates → broadcasts updated state
5. Server checks win/draw/timeout → broadcasts `GAME_OVER`
6. Leaderboard & stats updated on game end

## 🚀 Local Setup

### Prerequisites

- [Docker](https://www.docker.com/products/docker-desktop) (Docker Desktop)
- [Node.js](https://nodejs.org/) v18+

### Steps

```bash
# 1. Clone the repository
git clone <repo-url>
cd TicTacToe

# 2. Build the Nakama server module
cd nakama-server
npm install
npm run build
cd ..

# 3. Start Nakama + PostgreSQL
docker compose up -d

# 4. Wait for Nakama to be healthy (~10 seconds)
docker compose ps

# 5. Start the frontend dev server
cd frontend
npm install
npm run dev
```

The game will be available at **http://localhost:5173**

Nakama console (admin): **http://localhost:7351** (default: `admin` / `password`)

### Testing Multiplayer

1. Open **http://localhost:5173** in **two separate browser windows** (or an incognito window)
2. Each window auto-authenticates as a different guest user
3. Set different usernames in each window
4. In Window 1: Click **"Play Classic"** → enters matchmaking
5. In Window 2: Click **"Play Classic"** → matches with Window 1
6. Play the game! Take turns clicking cells
7. Verify: clicking occupied cells or clicking on opponent's turn does nothing
8. After game ends, check the **Leaderboard** for updated stats

### Testing Timer Mode

1. Both windows click **"Play Timed (30s)"**
2. Verify the countdown timer appears
3. Wait 30 seconds without making a move → the idle player forfeits

## ☁️ Cloud Deployment

### Option 1: Single VPS (DigitalOcean / AWS EC2)

```bash
# 1. SSH into your server
ssh user@your-server-ip

# 2. Clone repo and build server module
git clone <repo-url> && cd TicTacToe
cd nakama-server && npm install && npm run build && cd ..

# 3. Update frontend environment (create .env in frontend/)
echo "VITE_NAKAMA_HOST=your-server-ip" > frontend/.env
echo "VITE_NAKAMA_PORT=7350" >> frontend/.env

# 4. Deploy with production compose
docker compose -f docker-compose.prod.yml up -d --build
```

The frontend will be at `http://your-server-ip:80` and Nakama API at `http://your-server-ip:7350`.

### Option 2: Separate Services

- **Frontend**: Deploy `frontend/dist/` to Vercel, Netlify, or S3+CloudFront
- **Backend**: Run `docker compose up` (without frontend service) on your VPS
- Set `VITE_NAKAMA_HOST` and `VITE_NAKAMA_PORT` as build-time environment variables

## 🔧 API / Server Configuration

### Nakama Configuration (`local.yml`)

| Setting                 | Value                  | Description               |
| ----------------------- | ---------------------- | ------------------------- |
| `runtime.js_entrypoint` | `build/index.js`       | Server module entry point |
| `runtime.http_key`      | `tictactoe_server_key` | HTTP API key              |
| `match.max_empty_sec`   | `120`                  | Empty match lifetime      |

### RPCs

| RPC Name          | Payload                 | Response               |
| ----------------- | ----------------------- | ---------------------- |
| `find_match`      | `{ "timedMode": bool }` | `{ "matchId": "..." }` |
| `get_leaderboard` | `""`                    | `{ "records": [...] }` |

### Match Op-Codes

| Code                | Direction       | Description                 |
| ------------------- | --------------- | --------------------------- |
| `1` (MOVE)          | Client → Server | `{ "position": 0-8 }`       |
| `2` (STATE)         | Server → Client | Full game state             |
| `3` (GAME_OVER)     | Server → Client | Winner, reason, final board |
| `4` (MOVE_REJECTED) | Server → Client | `{ "reason": "..." }`       |
| `5` (START)         | Server → Client | Game started, initial state |

### Environment Variables (Frontend)

| Variable           | Default      | Description             |
| ------------------ | ------------ | ----------------------- |
| `VITE_NAKAMA_HOST` | `localhost`  | Nakama server hostname  |
| `VITE_NAKAMA_PORT` | `7350`       | Nakama HTTP/WS API port |
| `VITE_NAKAMA_KEY`  | `defaultkey` | Nakama server key       |
| `VITE_NAKAMA_SSL`  | `false`      | Use SSL for connections |

## 📁 Project Structure

```
TicTacToe/
├── docker-compose.yml          # Local dev: Nakama + PostgreSQL
├── docker-compose.prod.yml     # Production: + Nginx frontend
├── Dockerfile.frontend         # Multi-stage frontend build
├── nginx.conf                  # Nginx SPA config
├── local.yml                   # Nakama server config
├── nakama-server/
│   ├── package.json
│   ├── rollup.config.mjs
│   ├── tsconfig.json
│   ├── src/
│   │   ├── main.ts             # Entry point (InitModule)
│   │   ├── match_handler.ts    # Authoritative game logic
│   │   ├── messages.ts         # Types & op-codes
│   │   ├── rpc.ts              # Matchmaking RPC
│   │   └── leaderboard.ts      # Leaderboard & stats
│   └── build/
│       └── index.js            # Compiled module
└── frontend/
    ├── package.json
    ├── index.html
    ├── vite.config.js
    └── src/
        ├── main.jsx
        ├── App.jsx             # Screen routing
        ├── index.css           # Design system
        ├── nakama/
        │   └── nakamaClient.js # Nakama client singleton
        └── components/
            ├── HomeScreen.jsx
            ├── Matchmaking.jsx
            ├── GameBoard.jsx
            └── Leaderboard.jsx
```

## 📜 License

MIT
