import type { EnrichedTrade, FlowEvent, Stats } from "@/lib/types";
import { VoicePool } from "./voicePool";
import {
  fireTapeOneShot, fireSweep, fireIceberg, fireAbsorption,
  fireCvdFlip, fireVolumeBurst,
} from "./synths";
import { SpeechQueue } from "./speech";

export type LayerKey = "tape" | "flow" | "ambient" | "speech";

interface LayerNodes {
  gain: GainNode;
  muted: boolean;
  solo: boolean;
  volume: number; // 0-1
}

export class AudioEngine {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  limiter: DynamicsCompressorNode | null = null;
  private layers: Record<LayerKey, LayerNodes> | null = null;
  private pool = new VoicePool(32);
  speech = new SpeechQueue();
  masterVolume = 0.8;
  masterMute = false;
  private ambient: { drone1: OscillatorNode; drone2: OscillatorNode; lfo: OscillatorNode; lfoGain: GainNode; panner: StereoPannerNode; filter: BiquadFilterNode } | null = null;
  lastLatencyMs = 0;
  onLatency?: (ms: number) => void;
  onSound?: (info: { layer: LayerKey; detail: string; ts: number }) => void;

  async start() {
    if (this.ctx) return;
    const Ctx = (window.AudioContext || (window as any).webkitAudioContext);
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

    this.layers = {
      tape: this.makeLayer(1.0),
      flow: this.makeLayer(1.0),
      ambient: this.makeLayer(0.0625), // -24 dB default
      speech: this.makeLayer(1.0),
    };

    this.startAmbient();
  }

  private makeLayer(vol: number): LayerNodes {
    const g = this.ctx!.createGain();
    g.gain.value = vol;
    g.connect(this.limiter!);
    return { gain: g, muted: false, solo: false, volume: vol };
  }

  private startAmbient() {
    if (!this.ctx || !this.layers) return;
    const ctx = this.ctx;
    const dest = this.layers.ambient.gain;
    const o1 = ctx.createOscillator(); o1.type = "sine"; o1.frequency.value = 60;
    const o2 = ctx.createOscillator(); o2.type = "sawtooth"; o2.frequency.value = 60.5;
    const filter = ctx.createBiquadFilter(); filter.type = "lowpass"; filter.frequency.value = 200; filter.Q.value = 2;
    const panner = new StereoPannerNode(ctx, { pan: 0 });
    const lfo = ctx.createOscillator(); lfo.type = "sine"; lfo.frequency.value = 2;
    const lfoGain = ctx.createGain(); lfoGain.gain.value = 0.4;
    const ampMod = ctx.createGain(); ampMod.gain.value = 0.6;
    lfo.connect(lfoGain).connect(ampMod.gain);
    o1.connect(filter); o2.connect(filter);
    filter.connect(ampMod).connect(panner).connect(dest);
    o1.start(); o2.start(); lfo.start();
    this.ambient = { drone1: o1, drone2: o2, lfo, lfoGain, panner, filter };
  }

  updateAmbient(stats: Stats) {
    if (!this.ctx || !this.ambient) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const spreadFactor = Math.min(1, stats.spread / Math.max(0.01, stats.bid * 0.0005));
    const droneFreq = 60 * (1 - 0.3 * spreadFactor);
    this.ambient.drone1.frequency.linearRampToValueAtTime(droneFreq, now + 0.2);
    this.ambient.drone2.frequency.linearRampToValueAtTime(droneFreq + 0.5, now + 0.2);
    const lfoRate = Math.max(1, Math.min(20, stats.tradesPerSec * 2));
    this.ambient.lfo.frequency.linearRampToValueAtTime(lfoRate, now + 0.2);
    const cvd = stats.cvd10s;
    const norm = Math.tanh(cvd / Math.max(1, Math.abs(stats.cvd1m) || 1));
    this.ambient.panner.pan.linearRampToValueAtTime(Math.max(-1, Math.min(1, norm)), now + 0.2);
  }

  setLayerVolume(k: LayerKey, v: number) {
    if (!this.layers || !this.ctx) return;
    this.layers[k].volume = v;
    this.applyLayerGain(k);
  }
  setLayerMute(k: LayerKey, m: boolean) {
    if (!this.layers) return;
    this.layers[k].muted = m;
    this.applyLayerGain(k);
  }
  setLayerSolo(k: LayerKey, s: boolean) {
    if (!this.layers) return;
    this.layers[k].solo = s;
    (Object.keys(this.layers) as LayerKey[]).forEach(x => this.applyLayerGain(x));
  }
  private anySolo(): boolean {
    if (!this.layers) return false;
    return Object.values(this.layers).some(l => l.solo);
  }
  private applyLayerGain(k: LayerKey) {
    if (!this.layers || !this.ctx) return;
    const l = this.layers[k];
    const anySolo = this.anySolo();
    const audible = !l.muted && (!anySolo || l.solo);
    const target = audible ? l.volume : 0;
    l.gain.gain.linearRampToValueAtTime(target, this.ctx.currentTime + 0.02);
  }

  setMasterVolume(v: number) {
    this.masterVolume = v;
    if (this.master && this.ctx) this.master.gain.linearRampToValueAtTime(this.masterMute ? 0 : v, this.ctx.currentTime + 0.02);
  }
  setMasterMute(m: boolean) {
    this.masterMute = m;
    if (this.master && this.ctx) this.master.gain.linearRampToValueAtTime(m ? 0 : this.masterVolume, this.ctx.currentTime + 0.02);
  }

  playTrade(t: EnrichedTrade, recvTsMs: number) {
    if (!this.ctx || !this.layers) return;
    const pan = t.side === "buy" ? 0.7 : -0.7;
    const detune = Math.max(-100, Math.min(100, t.zScore * 30));
    const { duration } = fireTapeOneShot({
      ctx: this.ctx,
      dest: this.layers.tape.gain,
      pan,
      detuneCents: detune,
      tier: t.tier,
    });
    this.pool.acquire(performance.now(), duration, () => {});
    this.lastLatencyMs = performance.now() - recvTsMs;
    this.onLatency?.(this.lastLatencyMs);
    this.onSound?.({ layer: "tape", detail: `${t.side} ${t.size} @ ${t.price} [${t.tier}]`, ts: t.ts });

    if (t.tier === "super_whale") {
      this.speech.speak(`Super whale ${t.side === "buy" ? "buy" : "sell"} ${Math.round(t.size)}`);
      this.onSound?.({ layer: "speech", detail: `super whale ${t.side}`, ts: t.ts });
    }
  }

  playEvent(e: FlowEvent) {
    if (!this.ctx || !this.layers) return;
    const dest = this.layers.flow.gain;
    switch (e.type) {
      case "sweep":
        fireSweep(this.ctx, dest, e.side ?? "buy");
        this.onSound?.({ layer: "flow", detail: `sweep ${e.side} ${e.detail ?? ""}`, ts: e.ts });
        break;
      case "iceberg":
        fireIceberg(this.ctx, dest);
        this.onSound?.({ layer: "flow", detail: `iceberg @ ${e.price}`, ts: e.ts });
        this.speech.speak(`Iceberg ${e.side} at ${e.price}`);
        break;
      case "absorption":
        fireAbsorption(this.ctx, dest, e.side ?? "buy");
        this.onSound?.({ layer: "flow", detail: `absorption ${e.side}`, ts: e.ts });
        break;
      case "cvd_flip":
        fireCvdFlip(this.ctx, dest, e.side === "buy");
        this.onSound?.({ layer: "flow", detail: e.detail ?? "cvd flip", ts: e.ts });
        this.speech.speak(`CVD flip ${e.side === "buy" ? "up" : "down"}`);
        break;
      case "volume_burst":
        fireVolumeBurst(this.ctx, dest);
        this.onSound?.({ layer: "flow", detail: `volume burst ${e.detail ?? ""}`, ts: e.ts });
        break;
    }
  }
}

export const audioEngine = new AudioEngine();
