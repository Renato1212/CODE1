import type { Trade, DepthSnapshot, FlowEvent, DetectorConfig } from "@/lib/types";

export class SweepDetector {
  private buf: Trade[] = [];
  constructor(private cfg: () => DetectorConfig) {}
  push(t: Trade): FlowEvent | null {
    this.buf.push(t);
    if (this.buf.length > 50) this.buf.shift();
    const cfg = this.cfg();
    const cutoff = t.ts - cfg.sweepWindowMs;
    const recent = this.buf.filter(x => x.ts >= cutoff && x.side === t.side);
    const levels = new Set(recent.map(x => x.price));
    if (levels.size >= cfg.sweepLevels) {
      const prices = Array.from(levels).sort((a, b) => a - b);
      const monotonic = t.side === "buy"
        ? prices.every((p, i) => i === 0 || p > prices[i - 1])
        : prices.every((p, i) => i === 0 || p < prices[i - 1]);
      if (monotonic) {
        this.buf = this.buf.filter(x => x.ts < cutoff);
        return {
          type: "sweep", ts: t.ts, side: t.side, price: t.price,
          size: recent.reduce((a, b) => a + b.size, 0),
          detail: `${levels.size} levels`,
        };
      }
    }
    return null;
  }
}

export class IcebergDetector {
  private map = new Map<string, Trade[]>();
  private lastFire = new Map<string, number>();
  constructor(private cfg: () => DetectorConfig) {}
  push(t: Trade): FlowEvent | null {
    const cfg = this.cfg();
    const key = `${t.price.toFixed(8)}_${t.side}`;
    const arr = this.map.get(key) ?? [];
    arr.push(t);
    const cutoff = t.ts - cfg.icebergWindowMs;
    while (arr.length && arr[0].ts < cutoff) arr.shift();
    this.map.set(key, arr);
    if (arr.length >= cfg.icebergMinTrades) {
      const last = this.lastFire.get(key) ?? 0;
      if (t.ts - last > 1500) {
        this.lastFire.set(key, t.ts);
        return {
          type: "iceberg", ts: t.ts, side: t.side, price: t.price,
          size: arr.reduce((a, b) => a + b.size, 0),
          detail: `${arr.length} trades @ ${t.price}`,
        };
      }
    }
    return null;
  }
}

export class AbsorptionDetector {
  private buf: Trade[] = [];
  private lastFire = 0;
  constructor(private cfg: () => DetectorConfig, private p90: () => number) {}
  push(t: Trade): FlowEvent | null {
    const cfg = this.cfg();
    this.buf.push(t);
    const cutoff = t.ts - cfg.absorptionWindowMs;
    while (this.buf.length && this.buf[0].ts < cutoff) this.buf.shift();
    const sameSide = this.buf.filter(x => x.side === t.side);
    const totalVol = sameSide.reduce((a, b) => a + b.size, 0);
    const p90 = this.p90();
    if (totalVol > p90 * 3 && sameSide.length >= 3) {
      const prices = sameSide.map(x => x.price);
      const range = Math.max(...prices) - Math.min(...prices);
      const tickEst = Math.max(0.01, Math.abs(t.price) * 1e-5);
      if (range <= tickEst * cfg.absorptionTolerance && t.ts - this.lastFire > 1500) {
        this.lastFire = t.ts;
        return { type: "absorption", ts: t.ts, side: t.side, price: t.price, size: totalVol };
      }
    }
    return null;
  }
}

export class VolumeBurstDetector {
  private buf: Trade[] = [];
  private lastFire = 0;
  constructor(private cfg: () => DetectorConfig) {}
  push(t: Trade): FlowEvent | null {
    const cfg = this.cfg();
    this.buf.push(t);
    const cutoff5 = t.ts - 5000;
    const cutoff60 = t.ts - 60_000;
    while (this.buf.length && this.buf[0].ts < cutoff60) this.buf.shift();
    const vol5 = this.buf.filter(x => x.ts >= cutoff5).reduce((a, b) => a + b.size, 0);
    const vol60 = this.buf.reduce((a, b) => a + b.size, 0);
    const mean5sIn1m = vol60 / 12;
    if (mean5sIn1m > 0 && vol5 > mean5sIn1m * cfg.volumeBurstMult && t.ts - this.lastFire > 3000) {
      this.lastFire = t.ts;
      return { type: "volume_burst", ts: t.ts, size: vol5, detail: `${(vol5 / mean5sIn1m).toFixed(1)}x` };
    }
    return null;
  }
}

export class CvdFlipDetector {
  private prevSign = 0;
  push(ts: number, cvd1m: number): FlowEvent | null {
    const sign = cvd1m > 0 ? 1 : cvd1m < 0 ? -1 : 0;
    if (this.prevSign !== 0 && sign !== 0 && sign !== this.prevSign) {
      this.prevSign = sign;
      return { type: "cvd_flip", ts, side: sign > 0 ? "buy" : "sell", detail: `CVD flip ${sign > 0 ? "up" : "down"}` };
    }
    if (sign !== 0) this.prevSign = sign;
    return null;
  }
}
