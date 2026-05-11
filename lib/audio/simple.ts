// Two unmistakably different sounds.
// Buy:  bright FM "bell" with upward pitch glide + sparkle harmonic. Right pan.
// Sell: dark triangle "thud" with downward glide + noise burst. Left pan.
// Alert: high "ding-ding" two-tone for imbalance/opportunity events.

export class SimpleAudio {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  limiter: DynamicsCompressorNode | null = null;
  masterVolume = 0.7;
  muted = false;
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

  private normSize(size: number): number {
    if (size > this.maxSize) this.maxSize = size;
    const ref = Math.max(this.maxSize, 1e-6);
    return Math.min(1, Math.log10(1 + size) / Math.log10(1 + ref));
  }

  play(side: "buy" | "sell", size: number) {
    if (!this.ctx || !this.limiter) return;
    if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
    const norm = this.normSize(size);
    if (side === "buy") this.playBuy(norm);
    else this.playSell(norm);
  }

  private playBuy(norm: number) {
    const ctx = this.ctx!;
    const t0 = ctx.currentTime;
    const baseFreq = 440 * Math.pow(2, norm * 1.5); // 440 → ~1245 Hz
    const panner = new StereoPannerNode(ctx, { pan: 0.7 });
    const out = ctx.createGain();
    panner.connect(out).connect(this.limiter!);

    const mod = ctx.createOscillator();
    mod.type = "sine";
    mod.frequency.value = baseFreq * 2.0;
    const modGain = ctx.createGain();
    modGain.gain.value = baseFreq * 0.8;
    mod.connect(modGain);

    const car = ctx.createOscillator();
    car.type = "sine";
    car.frequency.setValueAtTime(baseFreq, t0);
    car.frequency.exponentialRampToValueAtTime(baseFreq * 1.15, t0 + 0.035);
    modGain.connect(car.frequency);
    car.connect(panner);

    const spark = ctx.createOscillator();
    spark.type = "sine";
    spark.frequency.setValueAtTime(baseFreq * 4, t0);
    const sparkGain = ctx.createGain();
    sparkGain.gain.value = 0.18;
    spark.connect(sparkGain).connect(panner);

    const amp = 0.18 + 0.32 * norm;
    const dur = 0.25 + 0.35 * norm;
    out.gain.setValueAtTime(0, t0);
    out.gain.linearRampToValueAtTime(amp, t0 + 0.002);
    out.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    car.start(t0); mod.start(t0); spark.start(t0);
    car.stop(t0 + dur + 0.02); mod.stop(t0 + dur + 0.02); spark.stop(t0 + dur + 0.02);
    setTimeout(() => { try { car.disconnect(); mod.disconnect(); spark.disconnect(); panner.disconnect(); out.disconnect(); modGain.disconnect(); sparkGain.disconnect(); } catch {} }, (dur + 0.1) * 1000);
  }

  private playSell(norm: number) {
    const ctx = this.ctx!;
    const t0 = ctx.currentTime;
    const baseFreq = 280 * Math.pow(0.55, norm); // 280 → ~154 Hz
    const panner = new StereoPannerNode(ctx, { pan: -0.7 });
    const out = ctx.createGain();
    panner.connect(out).connect(this.limiter!);

    const o = ctx.createOscillator();
    o.type = "triangle";
    o.frequency.setValueAtTime(baseFreq * 2.2, t0);
    o.frequency.exponentialRampToValueAtTime(baseFreq * 0.7, t0 + 0.2);
    o.connect(panner);

    const sub = ctx.createOscillator();
    sub.type = "sine";
    sub.frequency.setValueAtTime(baseFreq * 0.5, t0);
    const subGain = ctx.createGain();
    subGain.gain.value = 0.4 * norm;
    sub.connect(subGain).connect(panner);

    const noise = makeNoise(ctx, 0.08);
    const noiseFilt = ctx.createBiquadFilter();
    noiseFilt.type = "lowpass";
    noiseFilt.frequency.value = 900;
    noiseFilt.Q.value = 1.5;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.5, t0);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.05);
    noise.connect(noiseFilt).connect(noiseGain).connect(panner);

    const amp = 0.22 + 0.32 * norm;
    const dur = 0.3 + 0.5 * norm;
    out.gain.setValueAtTime(0, t0);
    out.gain.linearRampToValueAtTime(amp, t0 + 0.005);
    out.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    o.start(t0); sub.start(t0); noise.start(t0);
    o.stop(t0 + dur + 0.02); sub.stop(t0 + dur + 0.02); noise.stop(t0 + 0.1);
    setTimeout(() => { try { o.disconnect(); sub.disconnect(); subGain.disconnect(); noise.disconnect(); noiseFilt.disconnect(); noiseGain.disconnect(); panner.disconnect(); out.disconnect(); } catch {} }, (dur + 0.15) * 1000);
  }

  alert(direction: "buy" | "sell") {
    if (!this.ctx || !this.limiter) return;
    if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
    const ctx = this.ctx;
    const t0 = ctx.currentTime;
    const out = ctx.createGain();
    out.connect(this.limiter);
    const pan = new StereoPannerNode(ctx, { pan: direction === "buy" ? 0.5 : -0.5 });
    pan.connect(out);
    const f1 = direction === "buy" ? 1320 : 660;
    const f2 = direction === "buy" ? 1760 : 440;
    const playPing = (f: number, when: number) => {
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = f;
      const g = ctx.createGain();
      o.connect(g).connect(pan);
      g.gain.setValueAtTime(0, t0 + when);
      g.gain.linearRampToValueAtTime(0.25, t0 + when + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + when + 0.18);
      o.start(t0 + when); o.stop(t0 + when + 0.2);
      setTimeout(() => { try { o.disconnect(); g.disconnect(); } catch {} }, (when + 0.25) * 1000);
    };
    playPing(f1, 0);
    playPing(f2, 0.11);
    setTimeout(() => { try { pan.disconnect(); out.disconnect(); } catch {} }, 500);
  }
}

function makeNoise(ctx: AudioContext, seconds: number): AudioBufferSourceNode {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const ch = buf.getChannelData(0);
  for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  return src;
}

export const simpleAudio = new SimpleAudio();
