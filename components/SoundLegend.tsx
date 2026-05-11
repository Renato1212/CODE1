"use client";
import { useState } from "react";
import { audioEngine } from "@/lib/audio/engine";
import {
  fireSweep, fireIceberg, fireAbsorption, fireCvdFlip, fireVolumeBurst, fireTapeOneShot,
} from "@/lib/audio/synths";

const ITEMS: { label: string; desc: string; demo: () => void }[] = [
  { label: "Dust (<p25)", desc: "1500 Hz sine pluck — barely there", demo: () => playTier("dust") },
  { label: "Normal (p25-p75)", desc: "800 Hz triangle pluck", demo: () => playTier("normal") },
  { label: "Size (p75-p95)", desc: "FM bell, 400 ms", demo: () => playTier("size") },
  { label: "Whale (p95-p99)", desc: "Low gong, 1 s", demo: () => playTier("whale") },
  { label: "Super whale (>p99)", desc: "Gong + voice announcement", demo: () => playTier("super_whale") },
  { label: "Sweep", desc: "Frequency riser — multi-level lift/hit", demo: () => audioEngine.ctx && fireSweep(audioEngine.ctx, audioEngine.ctx.destination, "buy") },
  { label: "Iceberg", desc: "Sonar ping — refilling hidden order", demo: () => audioEngine.ctx && fireIceberg(audioEngine.ctx, audioEngine.ctx.destination) },
  { label: "Absorption", desc: "Low thud — heavy aggression, no movement", demo: () => audioEngine.ctx && fireAbsorption(audioEngine.ctx, audioEngine.ctx.destination, "buy") },
  { label: "CVD flip", desc: "Soft chime — net flow direction inverts", demo: () => audioEngine.ctx && fireCvdFlip(audioEngine.ctx, audioEngine.ctx.destination, true) },
  { label: "Volume burst", desc: "Low rumble — sudden pace spike", demo: () => audioEngine.ctx && fireVolumeBurst(audioEngine.ctx, audioEngine.ctx.destination) },
];

function playTier(tier: any) {
  const ctx = audioEngine.ctx;
  if (!ctx) return;
  fireTapeOneShot({ ctx, dest: ctx.destination, pan: 0, detuneCents: 0, tier });
}

export default function SoundLegend() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn" onClick={() => setOpen(true)}>What does each sound mean?</button>
      {open && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="panel p-4 max-w-2xl w-full max-h-[80vh] overflow-auto scrollbar-thin" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between mb-3">
              <div className="text-lg">Sound Legend</div>
              <button className="btn" onClick={() => setOpen(false)}>close</button>
            </div>
            <div className="space-y-2 text-xs">
              {ITEMS.map(it => (
                <div key={it.label} className="flex items-center justify-between border-b border-border pb-1">
                  <div>
                    <div className="text-text">{it.label}</div>
                    <div className="text-muted">{it.desc}</div>
                  </div>
                  <button className="btn" onClick={it.demo}>play</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
