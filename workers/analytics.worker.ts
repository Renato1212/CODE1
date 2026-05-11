/// <reference lib="webworker" />
import { RollingVWAP } from "@/lib/analytics/vwap";
import { RollingCVD, SessionCVD } from "@/lib/analytics/cvd";
import { SizePercentiles } from "@/lib/analytics/percentiles";
import {
  SweepDetector, IcebergDetector, AbsorptionDetector,
  VolumeBurstDetector, CvdFlipDetector,
} from "@/lib/analytics/detectors";
import type { WorkerIn, WorkerOut, Trade, BookTicker, DetectorConfig, EnrichedTrade } from "@/lib/types";
import { DEFAULT_DETECTOR_CONFIG } from "@/lib/types";

const ctx = self as unknown as DedicatedWorkerGlobalScope;

const vwap1m = new RollingVWAP(60_000);
const vwap5m = new RollingVWAP(5 * 60_000);
const vwap30m = new RollingVWAP(30 * 60_000);
const cvd10s = new RollingCVD(10_000);
const cvd1m = new RollingCVD(60_000);
const cvd5m = new RollingCVD(5 * 60_000);
const sessionCvd = new SessionCVD();
const pct = new SizePercentiles(5 * 60_000);

let cfg: DetectorConfig = { ...DEFAULT_DETECTOR_CONFIG };
const cfgGet = () => cfg;
const p90Get = () => {
  const v = pct.values();
  return (v.p75 + v.p95) / 2;
};

const sweep = new SweepDetector(cfgGet);
const iceberg = new IcebergDetector(cfgGet);
const absorption = new AbsorptionDetector(cfgGet, p90Get);
const burst = new VolumeBurstDetector(cfgGet);
const cvdFlip = new CvdFlipDetector();

let lastBook: BookTicker | null = null;
let tradeRate = 0;
let lastTradeTs = 0;
let statsTimer: any = null;

function post(msg: WorkerOut) { ctx.postMessage(msg); }

function emitStats() {
  const p = pct.values();
  post({
    type: "stats",
    payload: {
      vwap1m: vwap1m.vwap(),
      vwap5m: vwap5m.vwap(),
      vwap30m: vwap30m.vwap(),
      std5m: vwap5m.stddev(),
      cvd10s: cvd10s.value(),
      cvd1m: cvd1m.value(),
      cvd5m: cvd5m.value(),
      cvdSession: sessionCvd.value(),
      tradesPerSec: tradeRate,
      sizeP25: p.p25, sizeP50: p.p50, sizeP75: p.p75, sizeP95: p.p95, sizeP99: p.p99,
      spread: lastBook ? lastBook.ask - lastBook.bid : 0,
      bid: lastBook?.bid ?? 0,
      ask: lastBook?.ask ?? 0,
    },
  });
}

function handleTrade(t: Trade) {
  vwap1m.add(t.ts, t.price, t.size);
  vwap5m.add(t.ts, t.price, t.size);
  vwap30m.add(t.ts, t.price, t.size);
  pct.add(t.ts, t.size);
  const signed = t.side === "buy" ? t.size : -t.size;
  cvd10s.add(t.ts, signed);
  cvd1m.add(t.ts, signed);
  cvd5m.add(t.ts, signed);
  sessionCvd.add(t.ts, signed);

  const dt = lastTradeTs ? (t.ts - lastTradeTs) / 1000 : 0.5;
  lastTradeTs = t.ts;
  const inst = dt > 0 ? 1 / dt : 0;
  tradeRate = tradeRate + 0.1 * (inst - tradeRate);

  const tier = pct.tier(t.size);
  const v5 = vwap5m.vwap();
  const sd = vwap5m.stddev() || 1;
  const z = (t.price - v5) / sd;
  const enriched: EnrichedTrade = { ...t, tier, zScore: z, vwap5m: v5 };
  post({ type: "trade_enriched", payload: enriched });

  for (const ev of [
    tier === "super_whale" ? { type: "super_whale" as const, ts: t.ts, side: t.side, price: t.price, size: t.size } : null,
    sweep.push(t),
    iceberg.push(t),
    absorption.push(t),
    burst.push(t),
    cvdFlip.push(t.ts, cvd1m.value()),
  ]) {
    if (ev) post({ type: "event", payload: ev });
  }
}

ctx.addEventListener("message", (e: MessageEvent<WorkerIn>) => {
  const msg = e.data;
  switch (msg.type) {
    case "trade": handleTrade(msg.payload); break;
    case "book": lastBook = msg.payload; break;
    case "depth": /* reserved */ break;
    case "config": cfg = { ...cfg, ...msg.payload }; break;
    case "reset":
      vwap1m.reset(); vwap5m.reset(); vwap30m.reset();
      cvd10s.reset(); cvd1m.reset(); cvd5m.reset();
      break;
  }
});

statsTimer = setInterval(emitStats, 250);
