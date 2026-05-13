# TapeFeel ↔ Rithmic bridge

A ~150-line Python relay. Authenticates to Rithmic with your account, subscribes to last-trade + BBO, and re-broadcasts every trade to TapeFeel over plain WebSocket JSON. Aggressor side is inferred from the prevailing NBBO (`price ≥ best_ask` → buy, `≤ best_bid` → sell, inside → carry last).

## One-time setup

1. **Sign up for Rithmic paper trading** (free, ~5 min): https://yyy3.rithmic.com → R-Trader → request paper trading credentials. They email you a system name + user + password.
2. **Sign Rithmic's MSPA** in R-Trader the first time you log in, and accept exchange-specific market-data agreements (CME free for non-pro, NYMEX/COMEX free for non-pro). Without this, you'll connect but see no ticks.
3. **Clone this repo and `cd bridge/python`.**

## Run with Docker (recommended)

```bash
cp .env.example .env          # edit RITHMIC_USER / RITHMIC_PASSWORD
docker compose up --build -d
docker compose logs -f
```

The bridge is now listening on `ws://localhost:8787/`. Open TapeFeel, pick **Rithmic — CME futures (via bridge)**, click **⚙ Rithmic**, set Bridge WS URL to `ws://localhost:8787/`, leave User/Password blank (they're already in `.env`), Save & reconnect.

## Run without Docker

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
RITHMIC_USER=xxx RITHMIC_PASSWORD=xxx python main.py
```

## Make it reachable from a deployed TapeFeel (https GitHub Pages)

Browsers won't allow `wss://`→`ws://` from an https origin. Three options:

1. **Run TapeFeel locally too** (`pnpm dev` at http://localhost:3000) — plain `ws://` works there.
2. **Cloudflare Tunnel** (free, fastest): `cloudflared tunnel --url ws://localhost:8787` gives you a free `wss://<random>.trycloudflare.com` URL that you paste into the Rithmic config.
3. **Caddy in front** with TLS to your own domain:
   ```
   bridge.yourdomain.com {
     reverse_proxy localhost:8787
   }
   ```

## Protocol

Already documented in the top-level README. Recap:

- Client → bridge: `{type:"login", system, user, password}`, `{type:"subscribe", symbol, exchange}`
- Bridge → client: `{type:"trade", symbol, ts, price, size, side}` per trade, `{type:"status"|"error", message}` for control

## Files

- `main.py` — the bridge
- `requirements.txt` — `async-rithmic` + `websockets`
- `Dockerfile` + `docker-compose.yml` — one-command deploy
- `.env.example` — credential template (the real `.env` is gitignored)
