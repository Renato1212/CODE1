// Main-thread analytics engine. Replaces the Web Worker so static exports
// don't have to bundle a separate worker chunk (which has caused issues on
// some hosts). Pure JS, no DOM dependencies — runs anywhere.

import { RollingVWAP } from "./vwap";
import { RollingCVD, SessionCVD } from "./cvd";
import { SizePercentiles } from "./percentiles";
import {
  SweepDetector, IcebergDetector, AbsorptionDetector,
  VolumeBurstDetector, CvdFlipDetector,
} from "./detectors";
import type {
  Trade, BookTicker, DetectorConfig, EnrichedTrade, Stats, FlowEvent,
} from "@/lib/types";
import { DEFAULT_DETECTOR_CONFIG } from "@/lib/types";

export interface AnalyticsCallbacks {
  onStats: (s: Stats) => void;
  onTrade: (t: EnrichedTrade) => void;
  onEvent: (e: FlowEvent) => void;
}

export class AnalyticsEngine {
  private vwap1m = new RollingVWAP(60_000);
  private vwap5m = new RollingVWAP(5 * 60_000);
  private vwap30m = new RollingVWAP(30 * 60_000);
  private cvd10s = new RollingCVD(10_000);
  private cvd1m = new RollingCVD(60_000);
  private cvd5m = new RollingCVD(5 * 60_000);
  private sessionCvd = new SessionCVD();
  private pct = new SizePercentiles(5 * 60_000);
  private cfg: DetectorConfig = { ...DEFAULT_DETECTOR_CONFIG };
  private sweep: SweepDetector;
  private iceberg: IcebergDetector;
  private absorption: AbsorptionDetector;
  private burst: VolumeBurstDetector;
  private cvdFlip = new CvdFlipDetector();
  private lastBook: BookTicker | null = null;
  private tradeRate = 0;
  private lastTradeTs = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private cb: AnalyticsCallbacks;

  constructor(cb: AnalyticsCallbacks) {
    this.cb = cb;
    const getCfg = () => this.cfg;
    const getP90 = () => {
      const v = this.pct.values();
      return (v.p75 + v.p95) / 2;
    };
    this.sweep = new SweepDetector(getCfg);
    this.iceberg = new IcebergDetector(getCfg);
    this.absorption = new AbsorptionDetector(getCfg, getP90);
    this.burst = new VolumeBurstDetector(getCfg);
  }

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => this.emitStats(), 250);
  }
  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
  setConfig(p: Partial<DetectorConfig>) { this.cfg = { ...this.cfg, ...p }; }

  pushBook(b: BookTicker) { this.lastBook = b; }

  pushTrade(t: Trade) {
    this.vwap1m.add(t.ts, t.price, t.size);
    this.vwap5m.add(t.ts, t.price, t.size);
    this.vwap30m.add(t.ts, t.price, t.size);
    this.pct.add(t.ts, t.size);
    const signed = t.side === "buy" ? t.size : -t.size;
    this.cvd10s.add(t.ts, signed);
    this.cvd1m.add(t.ts, signed);
    this.cvd5m.add(t.ts, signed);
    this.sessionCvd.add(t.ts, signed);

    const dt = this.lastTradeTs ? (t.ts - this.lastTradeTs) / 1000 : 0.5;
    this.lastTradeTs = t.ts;
    const inst = dt > 0 ? 1 / dt : 0;
    this.tradeRate = this.tradeRate + 0.1 * (inst - this.tradeRate);

    const tier = this.pct.tier(t.size);
    const v5 = this.vwap5m.vwap();
    const sd = this.vwap5m.stddev() || 1;
    const z = (t.price - v5) / sd;
    const enriched: EnrichedTrade = { ...t, tier, zScore: z, vwap5m: v5 };
    this.cb.onTrade(enriched);

    if (tier === "super_whale") {
      this.cb.onEvent({ type: "super_whale", ts: t.ts, side: t.side, price: t.price, size: t.size });
    }
    const ev1 = this.sweep.push(t); if (ev1) this.cb.onEvent(ev1);
    const ev2 = this.iceberg.push(t); if (ev2) this.cb.onEvent(ev2);
    const ev3 = this.absorption.push(t); if (ev3) this.cb.onEvent(ev3);
    const ev4 = this.burst.push(t); if (ev4) this.cb.onEvent(ev4);
    const ev5 = this.cvdFlip.push(t.ts, this.cvd1m.value()); if (ev5) this.cb.onEvent(ev5);
  }

  private emitStats() {
    const p = this.pct.values();
    this.cb.onStats({
      vwap1m: this.vwap1m.vwap(),
      vwap5m: this.vwap5m.vwap(),
      vwap30m: this.vwap30m.vwap(),
      std5m: this.vwap5m.stddev(),
      cvd10s: this.cvd10s.value(),
      cvd1m: this.cvd1m.value(),
      cvd5m: this.cvd5m.value(),
      cvdSession: this.sessionCvd.value(),
      tradesPerSec: this.tradeRate,
      sizeP25: p.p25, sizeP50: p.p50, sizeP75: p.p75, sizeP95: p.p95, sizeP99: p.p99,
      spread: this.lastBook ? this.lastBook.ask - this.lastBook.bid : 0,
      bid: this.lastBook?.bid ?? 0,
      ask: this.lastBook?.ask ?? 0,
    });
  }
}
