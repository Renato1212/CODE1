"use client";
import { useAudio, type LayerKey } from "@/lib/store/audioStore";
import { useSettings } from "@/lib/store/settingsStore";
import { audioEngine } from "@/lib/audio/engine";

const LAYERS: { k: LayerKey; label: string; desc: string }[] = [
  { k: "tape", label: "Tape", desc: "Per-trade" },
  { k: "flow", label: "Flow", desc: "Events" },
  { k: "ambient", label: "Ambient", desc: "Drone" },
  { k: "speech", label: "Speech", desc: "Voice" },
];

export default function Mixer() {
  const { layers, setLayer, masterVolume, setMasterVolume, masterMute, setMasterMute, speechEnabled, setSpeech } = useAudio();
  const { detector, setDetector } = useSettings();

  return (
    <div className="panel p-3 space-y-3 text-xs">
      <div>
        <div className="text-muted mb-1">MASTER</div>
        <div className="flex items-center gap-2">
          <input type="range" min={0} max={1} step={0.01} value={masterVolume}
                 onChange={e => { const v = +e.target.value; setMasterVolume(v); audioEngine.setMasterVolume(v); }}
                 className="flex-1" />
          <button className={`btn ${masterMute ? "btn-active" : ""}`}
                  onClick={() => { setMasterMute(!masterMute); audioEngine.setMasterMute(!masterMute); }}>
            {masterMute ? "MUTED" : "MUTE"}
          </button>
        </div>
      </div>

      <div className="border-t border-border pt-3 space-y-2">
        <div className="text-muted">LAYERS</div>
        {LAYERS.map(({ k, label, desc }) => {
          const l = layers[k];
          return (
            <div key={k} className="space-y-1">
              <div className="flex justify-between items-center">
                <div><span className="text-text">{label}</span> <span className="text-muted">{desc}</span></div>
                <div className="flex gap-1">
                  <button className={`btn ${l.muted ? "btn-active" : ""}`}
                          onClick={() => { setLayer(k, { muted: !l.muted }); audioEngine.setLayerMute(k, !l.muted); }}>M</button>
                  <button className={`btn ${l.solo ? "btn-active" : ""}`}
                          onClick={() => { setLayer(k, { solo: !l.solo }); audioEngine.setLayerSolo(k, !l.solo); }}>S</button>
                </div>
              </div>
              <input type="range" min={0} max={1} step={0.01} value={l.volume}
                     onChange={e => { const v = +e.target.value; setLayer(k, { volume: v }); audioEngine.setLayerVolume(k, v); }}
                     className="w-full" />
            </div>
          );
        })}
        <div className="flex items-center gap-2 pt-1">
          <input id="speech-en" type="checkbox" checked={speechEnabled}
                 onChange={e => { setSpeech(e.target.checked); audioEngine.speech.enabled = e.target.checked; if (!e.target.checked) audioEngine.speech.cancel(); }} />
          <label htmlFor="speech-en" className="text-muted">Enable speech</label>
        </div>
      </div>

      <div className="border-t border-border pt-3 space-y-2">
        <div className="text-muted">DETECTORS</div>
        <NumRow label="Sweep levels" v={detector.sweepLevels} step={1} min={2} max={10} onChange={n => setDetector({ sweepLevels: n })} />
        <NumRow label="Sweep window ms" v={detector.sweepWindowMs} step={50} min={50} max={2000} onChange={n => setDetector({ sweepWindowMs: n })} />
        <NumRow label="Iceberg min trades" v={detector.icebergMinTrades} step={1} min={2} max={20} onChange={n => setDetector({ icebergMinTrades: n })} />
        <NumRow label="Iceberg window ms" v={detector.icebergWindowMs} step={500} min={500} max={30000} onChange={n => setDetector({ icebergWindowMs: n })} />
        <NumRow label="Absorption ticks" v={detector.absorptionTolerance} step={1} min={0} max={10} onChange={n => setDetector({ absorptionTolerance: n })} />
        <NumRow label="Volume burst mult" v={detector.volumeBurstMult} step={0.1} min={1} max={10} onChange={n => setDetector({ volumeBurstMult: n })} />
      </div>

      <PresetSection />
    </div>
  );
}

function NumRow({ label, v, step, min, max, onChange }: { label: string; v: number; step: number; min: number; max: number; onChange: (n: number) => void }) {
  return (
    <div className="flex justify-between items-center gap-2">
      <span className="text-muted">{label}</span>
      <input type="number" value={v} step={step} min={min} max={max}
             onChange={e => onChange(+e.target.value)}
             className="bg-panel2 border border-border rounded px-2 py-1 w-20 text-right tabular-nums" />
    </div>
  );
}

function PresetSection() {
  const audio = useAudio();
  const onSave = () => {
    localStorage.setItem("tapefeel:preset", JSON.stringify(audio.preset()));
  };
  const onLoad = () => {
    const raw = localStorage.getItem("tapefeel:preset");
    if (!raw) return;
    try {
      const p = JSON.parse(raw);
      audio.loadPreset(p);
      audioEngine.setMasterVolume(p.masterVolume);
      (Object.keys(p.layers) as LayerKey[]).forEach(k => {
        audioEngine.setLayerVolume(k, p.layers[k].volume);
        audioEngine.setLayerMute(k, p.layers[k].muted);
        audioEngine.setLayerSolo(k, p.layers[k].solo);
      });
    } catch {}
  };
  return (
    <div className="border-t border-border pt-3 flex gap-2">
      <button className="btn flex-1" onClick={onSave}>Save preset</button>
      <button className="btn flex-1" onClick={onLoad}>Load preset</button>
    </div>
  );
}
