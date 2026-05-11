interface Pt { ts: number; size: number; }

export class SizePercentiles {
  private buf: Pt[] = [];
  private cached = { p25: 0, p50: 0, p75: 0, p95: 0, p99: 0 };
  private lastCompute = 0;
  constructor(private windowMs: number, private recomputeMs = 5000) {}

  add(ts: number, size: number) {
    this.buf.push({ ts, size });
    const cutoff = ts - this.windowMs;
    while (this.buf.length && this.buf[0].ts < cutoff) this.buf.shift();
    if (ts - this.lastCompute > this.recomputeMs) {
      this.recompute();
      this.lastCompute = ts;
    }
  }

  private recompute() {
    if (!this.buf.length) return;
    const arr = this.buf.map(p => p.size).sort((a, b) => a - b);
    const q = (p: number) => arr[Math.min(arr.length - 1, Math.floor(arr.length * p))];
    this.cached = { p25: q(0.25), p50: q(0.5), p75: q(0.75), p95: q(0.95), p99: q(0.99) };
  }

  values() { return this.cached; }

  tier(size: number): "dust" | "normal" | "size" | "whale" | "super_whale" {
    const c = this.cached;
    if (c.p99 === 0) return "normal";
    if (size > c.p99) return "super_whale";
    if (size >= c.p95) return "whale";
    if (size >= c.p75) return "size";
    if (size >= c.p25) return "normal";
    return "dust";
  }
}
