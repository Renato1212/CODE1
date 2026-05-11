interface Bucket { ts: number; price: number; size: number; }

export class RollingVWAP {
  private buf: Bucket[] = [];
  private sumPV = 0;
  private sumV = 0;
  constructor(private windowMs: number) {}

  add(ts: number, price: number, size: number) {
    this.buf.push({ ts, price, size });
    this.sumPV += price * size;
    this.sumV += size;
    this.evict(ts);
  }

  private evict(now: number) {
    const cutoff = now - this.windowMs;
    while (this.buf.length && this.buf[0].ts < cutoff) {
      const b = this.buf.shift()!;
      this.sumPV -= b.price * b.size;
      this.sumV -= b.size;
    }
  }

  vwap(): number { return this.sumV > 0 ? this.sumPV / this.sumV : 0; }

  stddev(): number {
    if (this.buf.length < 2 || this.sumV <= 0) return 0;
    const m = this.vwap();
    let sq = 0;
    for (const b of this.buf) sq += b.size * (b.price - m) * (b.price - m);
    return Math.sqrt(sq / this.sumV);
  }

  reset() { this.buf = []; this.sumPV = 0; this.sumV = 0; }
}
