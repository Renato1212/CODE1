import { create } from "zustand";

export type LayerKey = "tape" | "flow" | "ambient" | "speech";

interface LayerState { volume: number; muted: boolean; solo: boolean; }

interface S {
  started: boolean;
  masterVolume: number;
  masterMute: boolean;
  layers: Record<LayerKey, LayerState>;
  speechEnabled: boolean;
  setStarted: (b: boolean) => void;
  setMasterVolume: (v: number) => void;
  setMasterMute: (b: boolean) => void;
  setLayer: (k: LayerKey, patch: Partial<LayerState>) => void;
  setSpeech: (b: boolean) => void;
  loadPreset: (p: PresetPayload) => void;
  preset: () => PresetPayload;
}

export interface PresetPayload {
  masterVolume: number;
  layers: Record<LayerKey, LayerState>;
  speechEnabled: boolean;
}

export const useAudio = create<S>((set, get) => ({
  started: false,
  masterVolume: 0.8,
  masterMute: false,
  layers: {
    tape: { volume: 1.0, muted: false, solo: false },
    flow: { volume: 1.0, muted: false, solo: false },
    ambient: { volume: 0.0625, muted: false, solo: false },
    speech: { volume: 1.0, muted: false, solo: false },
  },
  speechEnabled: true,
  setStarted: (b) => set({ started: b }),
  setMasterVolume: (v) => set({ masterVolume: v }),
  setMasterMute: (b) => set({ masterMute: b }),
  setLayer: (k, patch) => set(st => ({ layers: { ...st.layers, [k]: { ...st.layers[k], ...patch } } })),
  setSpeech: (b) => set({ speechEnabled: b }),
  loadPreset: (p) => set({ masterVolume: p.masterVolume, layers: p.layers, speechEnabled: p.speechEnabled }),
  preset: () => {
    const s = get();
    return { masterVolume: s.masterVolume, layers: s.layers, speechEnabled: s.speechEnabled };
  },
}));
