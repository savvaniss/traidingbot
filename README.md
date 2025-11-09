# TraidingBot

A modular cryptocurrency trading bot with a **Python backend** and a **React + Tailwind** frontend.  
It streams market data, computes signals, previews orders, and (optionally) auto-places trades with safety guardrails.

> **Repo layout:** `backend/` (API & services) • `ui/` (web app)

---

## ✨ Features

- Live ticker & balances
- Pluggable strategies (buy/sell/hold signals)
- Order preview → place (honors exchange filters)
- Auto-trade mode with cooldowns & exposure limits
- Recent orders feed and status monitor
- REST API (and optional WebSocket) for real-time UI

---

## 🧱 Architecture

```
[ Exchange API / Websocket ]
           │
           ▼
 backend/
 ├─ adapters/         # exchange connectors
 ├─ services/         # signal engine, order router/scheduler
 ├─ repositories/     # persistence (sqlite / postgres)
 ├─ api/              # HTTP endpoints (FastAPI-style)
 └─ config/           # settings & env loading
           ▲
           │  HTTP/WS  (BACKEND_URL)
           ▼
 ui/
 ├─ hooks/            # useTicker, useSignal, useBalances, useOrdersRecent...
 ├─ components/       # StatBox, StrategyForm, OrderPreviewCard, etc.
 ├─ pages/            # App shell
 └─ config.ts         # BACKEND_URL, SYMBOLS
```

> If folder names differ in your repo, adjust references below.

---

## ⚙️ Tech Stack

| Layer    | Tech (expected)                          |
|----------|------------------------------------------|
| Backend  | Python 3.10+, FastAPI, Uvicorn           |
| Frontend | React, Vite, TypeScript, Tailwind CSS    |
| Optional | Docker / Docker Compose                  |
| Storage  | SQLite (dev) / Postgres (prod)           |

---

## 🚀 Getting Started

### 1) Prerequisites
- Node 18+ and npm (or pnpm/yarn)
- Python 3.10+ and `pip`
- *(Optional)* Docker & Docker Compose

### 2) Clone
```bash
git clone https://github.com/savvaniss/traidingbot.git
cd traidingbot
```

### 3) Configure Environment

Create **`backend/.env`** (example):
```env
# Exchange
EXCHANGE=binance
API_KEY=your_api_key
API_SECRET=your_api_secret
PAPER_TRADING=true
BASE_ASSET=USDT
SYMBOLS=BTCUSDT,ETHUSDT  # must match UI

# Engine / Risk
MAX_POSITION_USD=200
MIN_NOTIONAL_USD=5
MAX_OPEN_ORDERS=3
ORDER_COOLDOWN_SEC=15
AUTO_TRADE=false

# Server
HOST=0.0.0.0
PORT=8000

# Storage
DATABASE_URL=sqlite+aiosqlite:///./traidingbot.db
```

Edit **`ui/src/config.ts`** (or the equivalent file in your UI):
```ts
export const BACKEND_URL = "http://localhost:8000";
export const SYMBOLS = ["BTCUSDT", "ETHUSDT"];
```

### 4) Run the Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
# Open http://localhost:8000/docs for API docs if using FastAPI
```

### 5) Run the Frontend
```bash
cd ui
npm install
npm run dev
# Open the printed local URL (typically http://localhost:5173)
```

---

## 📡 API (typical endpoints)

> Adjust names/paths to match your actual implementation.

- `GET /health` — service status
- `GET /ticker?symbol=BTCUSDT` — latest price & stats
- `GET /balances` — account balances
- `GET /signals` — current signals by symbol
- `GET /orders/recent` — last N orders
- `POST /orders/preview` — compute side/qty/fees
- `POST /orders/place` — submit an order (respects guardrails)
- `GET /strategy` / `POST /strategy` — read/update strategy at runtime
- `WS /ws/ticker` — streaming prices (if enabled)

---

## 🖥️ UI Overview

- **Dashboard stats:** P&L, open exposure, auto-trade status  
- **Preferences panel:** min notional, max exposure, cooldown  
- **Strategy form:** thresholds/indicators  
- **Order preview card:** side, qty, notional, est. fees  
- **Recent orders:** execution results & errors  

---

## 🧪 Local Testing Tips

- Start with `PAPER_TRADING=true`
- Keep `AUTO_TRADE=false` until previews look correct
- Use small `MIN_NOTIONAL_USD` (5–10) and few `SYMBOLS`
- Verify `/signals` produces BUY/SELL before enabling auto-trade

---

## 🐳 Docker (optional)

Create a `docker-compose.yml` at repo root:

```yaml
version: "3.9"
services:
  api:
    build: ./backend
    env_file: ./backend/.env
    ports:
      - "8000:8000"

  ui:
    build: ./ui
    environment:
      - VITE_BACKEND_URL=http://api:8000
    ports:
      - "5173:5173"
    depends_on:
      - api
```

Run:
```bash
docker compose up --build
```

---

## 🔒 Security

- Never commit API keys or secrets
- Prefer exchange testnet/paper trading until production-ready
- Enforce guardrails (`MIN_NOTIONAL_USD`, `MAX_POSITION_USD`, cooldowns)
- Use HTTPS and protect the API behind auth/reverse proxy in production

---

## ❗ Troubleshooting (Orders not placing)

- **`AUTO_TRADE=false`** → set `AUTO_TRADE=true` and restart
- **Signal = HOLD** → thresholds never met; check `/signals`
- **Guardrails blocking** → raise `MIN_NOTIONAL_USD` / `MAX_POSITION_USD`
- **Cooldown active** → lower `ORDER_COOLDOWN_SEC`
- **API permissions** → key must allow trading (not read-only)
- **Symbol format** → must match exchange (e.g., `BTCUSDT`)
- **Exchange filters** → round qty/price to tick/lot sizes

---

## 📦 Scripts (suggested)

**UI `package.json`**
```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview --port 5173"
  }
}
```

**Backend `Makefile` (optional)**
```makefile
run:
	uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

---

## 📜 License

MIT (recommended) — add a `LICENSE` file if you open-source contributions.

---

## 🤝 Contributing

1. Fork and create a feature branch  
2. Add tests (unit for services; e2e for UI if applicable)  
3. Use conventional commits  
4. Open a PR with a clear description and screenshots/GIF if possible
