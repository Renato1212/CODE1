// Simple two-sound audio engine for buy/sell market orders.
// Buy = bright triangle, panned right. Sell = darker sawtooth, panned left.
// Pitch rises logarithmically with order size.

export class SimpleAudio {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  limiter: DynamicsCompressorNode | null = null;
  masterVolume = 0.7;
  muted = false;
  // Track a rolling max size to scale pitch sensibly per symbol.
  private maxSize = 0;
  private decayTimer: ReturnType<typeof setInterval> | null = null;

  async start() {
    if (this.ctx) return;
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    this.ctx = new Ctx({ latencyHint: "interactive" });
    await this.ctx.resume();
    this.limiter = this.ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -1;
    this.limiter.knee.value = 0;
    this.limiter.ratio.value = 20;
    this.limiter.attack.value = 0.001;
    this.limiter.release.value = 0.05;
    this.master = this.ctx.createGain();
    this.master.gain.value = this.masterVolume;
    this.limiter.connect(this.master).connect(this.ctx.destination);
    // Slowly decay the rolling max so pitch range stays calibrated.
    this.decayTimer = setInterval(() => { this.maxSize *= 0.98; }, 1000);
  }

  setVolume(v: number) {
    this.masterVolume = v;
    if (this.master && this.ctx) this.master.gain.linearRampToValueAtTime(this.muted ? 0 : v, this.ctx.currentTime + 0.02);
  }
  setMuted(m: boolean) {
    this.muted = m;
    if (this.master && this.ctx) this.master.gain.linearRampToValueAtTime(m ? 0 : this.masterVolume, this.ctx.currentTime + 0.02);
  }

  play(side: "buy" | "sell", size: number) {
    if (!this.ctx || !this.limiter) return;
    if (size > this.maxSize) this.maxSize = size;
    const ref = Math.max(this.maxSize, 1e-6);
    // Normalize size to [0, 1] log-scaled.
    const norm = Math.min(1, Math.log10(1 + size) / Math.log10(1 + ref));
    // Map to frequency: bigger order → higher pitch.
    const minHz = 220;
    const maxHz = 1760;
    const freq = minHz * Math.pow(maxHz / minHz, norm);

    const t0 = this.ctx.currentTime;
    const panner = new StereoPannerNode(this.ctx, { pan: side === "buy" ? 0.7 : -0.7 });
    const gain = this.ctx.createGain();
    panner.connect(gain).connect(this.limiter);

    const osc = this.ctx.createOscillator();
    osc.type = side === "buy" ? "triangle" : "sawtooth";
    osc.frequency.value = freq;
    osc.connect(panner);

    // Loudness also scales gently with size so whales feel weightier.
    const amp = 0.15 + 0.25 * norm;
    const dur = 0.12 + 0.25 * norm;
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(amp, t0 + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
    setTimeout(() => { try { osc.disconnect(); panner.disconnect(); gain.disconnect(); } catch {} }, (dur + 0.1) * 1000);
  }
}

export const simpleAudio = new SimpleAudio();
