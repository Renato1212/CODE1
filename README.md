# TapeFeel — Audio Order Flow

Hear every market trade. Two unmistakable sounds for buy vs sell, pitch by size, a live price-ladder histogram, and imbalance alerts. Fully client-side static export — runs on GitHub Pages / Vercel / any static host.

Live: https://renato1212.github.io/CODE1/

## Sources

| Source | Auth | Cost | Notes |
| --- | --- | --- | --- |
| Binance USDT-M Futures | none | free | direct WSS, may be geo-blocked |
| Coinbase Spot | none | free | US-friendly fallback |
| Bybit USDT Linear | none | free | most regions |
| **Rithmic — CME futures** | login | paid | requires running a local bridge (see below) |

CME products available with Rithmic: ES, NQ, YM, RTY (and Micros MES/MNQ/MYM/M2K), CL/MCL/NG, GC/MGC/SI/HG, ZN/ZB/ZF, 6E/6J/6B.

## Sounds

- **Buy** — bright FM bell, sine carrier + 2× modulator, upward 35 ms pitch glide, sparkle harmonic 4 octaves up. Pan +0.7 (right). Bigger order → higher pitch (440 → 1245 Hz log scale).
- **Sell** — dark triangle thud with downward glide (2.2× → 0.7× over 200 ms), sub-octave sine layer that grows with size, 80 ms filtered noise transient. Pan −0.7 (left). Bigger order → deeper, more menacing (280 → 154 Hz).
- **Imbalance alert** — two-tone "ding-ding" (1320→1760 Hz for buy, 660→440 Hz for sell). Fires when one side dominates the last 5 s of flow by ≥ 80 %. 4-second cooldown per side. Accompanies a green/red page glow.

## Price-ladder visualisation

Vertical price axis centered on last traded price. Each row shows green buy-volume bars extending left, red sell-volume bars extending right, over a rolling 60-second window. Tick size auto-detected or pick from `0.05` → `100` in the dropdown. Rows where one side captured > 70 % of that level's volume AND total volume there is above the row mean get **solid-color outlines** — that's your imbalance / opportunity callout.

Top-right delta gauge: green/red horizontal split of total buy vs sell volume in the window.

## Running the Rithmic bridge

Rithmic uses a proprietary TCP / Protocol Buffers protocol (R-API|+). It is not browser-reachable directly. You run a small relay on a machine that can reach Rithmic (any cloud VM, your home box, your trading laptop), and point TapeFeel's "Bridge WS URL" at it.

The TapeFeel client speaks plain JSON to the bridge. Implement these four message types on either side.

### Client → bridge (after `open`)

```jsonc
{ "type": "login",
  "system": "Rithmic Paper Trading",
  "user": "<your rithmic user>",
  "password": "<your rithmic password>" }

{ "type": "subscribe",
  "symbol": "ES",        // root contract, bridge resolves to ESM5 etc.
  "exchange": "CME" }    // CME | CBOT | NYMEX | COMEX
```

### Bridge → client (per trade)

```jsonc
{ "type": "trade",
  "symbol": "ES",
  "ts": 1748520000123,   // ms since epoch
  "price": 5234.25,
  "size": 3,
  "side": "buy" }        // aggressor side, inferred bridge-side via NBBO

// or batched:
{ "type": "trade", "trades": [ {…}, {…}, … ] }
```

### Bridge → client (status / error)

```jsonc
{ "type": "status", "message": "logged in, market data ok" }
{ "type": "error",  "message": "invalid credentials" }
```

### Aggressor classification

Rithmic ships `last_trade` ticks without an explicit aggressor flag. The bridge should derive it from the best bid/offer snapshot at trade time:

- `trade.price >= best_ask` → `side: "buy"` (taker lifted the offer)
- `trade.price <= best_bid` → `side: "sell"` (taker hit the bid)
- inside → use the prior tick's NBBO mid, or persist the last classification

Recommended bridge stacks: Node + `async-rithmic` (or any Rithmic SDK wrapping their .proto files); Python + `pyrithmic` or `rithmic-py`. Either runs ~80 lines of glue.

## Stack

Next.js 14 (App Router, static export), TypeScript strict, Tailwind. No backend, no database. Audio is raw Web Audio with procedural synths. Builds to ~92 kB First Load JS.

## Run locally

```bash
pnpm install
pnpm dev          # http://localhost:3000
pnpm build        # next build with output: "export"
```

Set `GH_PAGES=1 pnpm build` to build with `basePath=/CODE1` for GitHub Pages.

## Files

```
app/                page.tsx, layout.tsx, globals.css
components/         PriceLadder.tsx
lib/audio/          simple.ts            # two-sound + alert engine
lib/data/           feeds.ts             # Binance/Coinbase/Bybit/Rithmic client
lib/types.ts
```
