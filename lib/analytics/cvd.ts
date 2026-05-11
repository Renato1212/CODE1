interface CvdPt { ts: number; signed: number; }

export class RollingCVD {
  private buf: CvdPt[] = [];
  private sum = 0;
  constructor(private windowMs: number) {}
  add(ts: number, signedVol: number) {
    this.buf.push({ ts, signed: signedVol });
    this.sum += signedVol;
    const cutoff = ts - this.windowMs;
    while (this.buf.length && this.buf[0].ts < cutoff) {
      this.sum -= this.buf.shift()!.signed;
    }
  }
  value() { return this.sum; }
  reset() { this.buf = []; this.sum = 0; }
}

export class SessionCVD {
  private val = 0;
  private dayKey = "";
  add(ts: number, signedVol: number) {
    const d = new Date(ts);
    const key = `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
    if (key !== this.dayKey) { this.dayKey = key; this.val = 0; }
    this.val += signedVol;
  }
  value() { return this.val; }
}
