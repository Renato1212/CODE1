import type { SizeTier } from "@/lib/types";

export interface OneShotParams {
  ctx: AudioContext;
  dest: AudioNode;
  pan: number;
  detuneCents: number;
  tier: SizeTier;
}

export function fireTapeOneShot(p: OneShotParams): { duration: number; cleanup: () => void } {
  const { ctx, dest, pan, detuneCents, tier } = p;
  const t0 = ctx.currentTime;
  const panner = new StereoPannerNode(ctx, { pan });
  const gain = ctx.createGain();
  panner.connect(gain).connect(dest);

  let duration = 0.1;
  const nodes: { stop?: () => void; disconnect?: () => void }[] = [];

  const detuneMul = Math.pow(2, detuneCents / 1200);

  switch (tier) {
    case "dust": {
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = 1500 * detuneMul;
      o.connect(panner);
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(dB(-18), t0 + 0.001);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.08);
      o.start(t0); o.stop(t0 + 0.09);
      nodes.push(o);
      duration = 0.09;
      break;
    }
    case "normal": {
      const o = ctx.createOscillator();
      o.type = "triangle";
      o.frequency.value = 800 * detuneMul;
      o.connect(panner);
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(dB(-12), t0 + 0.001);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.12);
      o.start(t0); o.stop(t0 + 0.13);
      nodes.push(o);
      duration = 0.13;
      break;
    }
    case "size": {
      // FM bell: carrier 600, mod 1.5x
      const car = ctx.createOscillator();
      const mod = ctx.createOscillator();
      const modGain = ctx.createGain();
      car.type = "sine"; mod.type = "sine";
      car.frequency.value = 600 * detuneMul;
      mod.frequency.value = 600 * 1.5 * detuneMul;
      modGain.gain.value = 300;
      mod.connect(modGain).connect(car.frequency);
      car.connect(panner);
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(dB(-8), t0 + 0.002);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.4);
      car.start(t0); mod.start(t0);
      car.stop(t0 + 0.42); mod.stop(t0 + 0.42);
      nodes.push(car, mod);
      duration = 0.42;
      break;
    }
    case "whale":
    case "super_whale": {
      // Low gong: filtered noise + 110 Hz sine
      const sine = ctx.createOscillator();
      sine.type = "sine";
      sine.frequency.value = 110 * detuneMul;
      const noise = makeNoise(ctx, 1.0);
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass"; lp.frequency.value = 400; lp.Q.value = 4;
      noise.connect(lp).connect(panner);
      sine.connect(panner);
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(dB(tier === "super_whale" ? -2 : -4), t0 + 0.003);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.0);
      sine.start(t0); sine.stop(t0 + 1.05);
      noise.start(t0); noise.stop(t0 + 1.05);
      nodes.push(sine, noise);
      duration = 1.05;
      break;
    }
  }

  const cleanup = () => {
    try { panner.disconnect(); gain.disconnect(); } catch {}
  };
  setTimeout(cleanup, duration * 1000 + 50);
  return { duration: duration * 1000, cleanup };
}

export function fireSweep(ctx: AudioContext, dest: AudioNode, side: "buy" | "sell") {
  const t0 = ctx.currentTime;
  const panner = new StereoPannerNode(ctx, { pan: side === "buy" ? 0.7 : -0.7 });
  const gain = ctx.createGain();
  panner.connect(gain).connect(dest);
  const o = ctx.createOscillator();
  o.type = "sawtooth";
  const start = side === "buy" ? 300 : 900;
  const end = side === "buy" ? 1200 : 200;
  o.frequency.setValueAtTime(start, t0);
  o.frequency.exponentialRampToValueAtTime(end, t0 + 0.6);
  o.connect(panner);
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(dB(-10), t0 + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.6);
  o.start(t0); o.stop(t0 + 0.65);
  setTimeout(() => { try { panner.disconnect(); gain.disconnect(); } catch {} }, 700);
  return 600;
}

export function fireIceberg(ctx: AudioContext, dest: AudioNode) {
  const t0 = ctx.currentTime;
  const o = ctx.createOscillator();
  o.type = "sine";
  o.frequency.value = 880;
  const gain = ctx.createGain();
  o.connect(gain).connect(dest);
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(dB(-12), t0 + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.5);
  o.start(t0); o.stop(t0 + 0.55);
  setTimeout(() => { try { gain.disconnect(); } catch {} }, 600);
  return 500;
}

export function fireAbsorption(ctx: AudioContext, dest: AudioNode, side: "buy" | "sell") {
  const t0 = ctx.currentTime;
  const panner = new StereoPannerNode(ctx, { pan: side === "buy" ? 0.5 : -0.5 });
  const gain = ctx.createGain();
  panner.connect(gain).connect(dest);
  const o = ctx.createOscillator();
  o.type = "sine"; o.frequency.value = 60;
  const o2 = ctx.createOscillator();
  o2.type = "triangle"; o2.frequency.value = 120;
  o.connect(panner); o2.connect(panner);
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(dB(-8), t0 + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.6);
  o.start(t0); o.stop(t0 + 0.65);
  o2.start(t0); o2.stop(t0 + 0.65);
  setTimeout(() => { try { panner.disconnect(); gain.disconnect(); } catch {} }, 700);
  return 600;
}

export function fireCvdFlip(ctx: AudioContext, dest: AudioNode, up: boolean) {
  const t0 = ctx.currentTime;
  const gain = ctx.createGain();
  gain.connect(dest);
  const o = ctx.createOscillator();
  o.type = "sine";
  o.frequency.setValueAtTime(up ? 600 : 900, t0);
  o.frequency.exponentialRampToValueAtTime(up ? 1200 : 400, t0 + 0.3);
  o.connect(gain);
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(dB(-14), t0 + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.4);
  o.start(t0); o.stop(t0 + 0.45);
  setTimeout(() => { try { gain.disconnect(); } catch {} }, 500);
  return 400;
}

export function fireVolumeBurst(ctx: AudioContext, dest: AudioNode) {
  const t0 = ctx.currentTime;
  const gain = ctx.createGain();
  gain.connect(dest);
  const o = ctx.createOscillator();
  o.type = "sine";
  o.frequency.setValueAtTime(40, t0);
  o.frequency.linearRampToValueAtTime(80, t0 + 0.5);
  o.frequency.linearRampToValueAtTime(40, t0 + 1.5);
  o.connect(gain);
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(dB(-8), t0 + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.5);
  o.start(t0); o.stop(t0 + 1.55);
  setTimeout(() => { try { gain.disconnect(); } catch {} }, 1600);
  return 1500;
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

function dB(d: number) { return Math.pow(10, d / 20); }
