# TapeFeel — Multi-Layer Audio Order Flow

Audio sonification of Binance USDT-M perpetual futures order flow. 100% client-side, free data, no backend.

## The four differentiators (vs TickStrike / PriceSquawk)

1. **True stereo spatial accuracy** — Aggressive buys pan to +0.7 (right), aggressive sells to -0.7 (left), via a per-voice `StereoPannerNode`. Aggressor classification is taken directly from Binance `aggTrade.m` (buyer-is-maker).
2. **Adaptive thresholds** — Size tiers (`dust / normal / size / whale / super_whale`) are recomputed every 5 s from the trailing 5-minute size distribution (`p25/p50/p75/p95/p99`). No hand-tuned static thresholds — the ear stays calibrated as the symbol's pace shifts.
3. **Multi-layer sonification** — Four independent audio layers (Tape, Flow events, Ambient drone, Speech) each with its own gain / mute / solo, routed through a master limiter at -1 dBFS. You can hear individual prints, structural events, and the macro feel of pace simultaneously without masking.
4. **Transparency** — Every sound the engine emits has a corresponding row in the on-screen Event Log + Sound Log. You can always answer "what just made that sound?"

## Stack

- Next.js 14 App Router, TypeScript strict
- Tailwind, Zustand, Recharts
- Raw Web Audio (low-latency one-shots) + procedural synths
- Web Worker for analytics (VWAP/CVD/percentiles/detectors)

## Run

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000 and click "Start" to engage the audio context (browser autoplay policy).

## Deploy

Push to GitHub and connect the repo to Vercel — no env vars needed. The Web Worker is bundled by Next.

## Layers

| Layer | What it sonifies | How |
| --- | --- | --- |
| **Tape** | every aggTrade | pan = side, timbre = size tier, detune = z-score vs 5m VWAP |
| **Flow** | sweep / iceberg / absorption / CVD flip / volume burst | distinct, non-overlapping signatures |
| **Ambient** | spread, trade rate, 10s CVD direction | continuous drone, pitch / LFO / pan modulation |
| **Speech** | super-whales, iceberg confirmations, CVD flips | `window.speechSynthesis`, queue depth 2, non-blocking |

## Latency budget

Each WebSocket frame stamps `performance.now()` on arrival. When the corresponding sound is scheduled, the delta is displayed in the top bar (`latency:`). Target is <50 ms.

## Files

```
app/                  page.tsx, layout.tsx, globals.css
components/           Mixer, EventLog, PriceHeader, SizeHistogram, LargePrints, SoundLegend
lib/audio/            engine.ts, synths.ts, speech.ts, voicePool.ts
lib/data/             binance.ts
lib/analytics/        vwap.ts, cvd.ts, percentiles.ts, detectors.ts
lib/store/            marketStore.ts, audioStore.ts, settingsStore.ts
workers/              analytics.worker.ts
```
