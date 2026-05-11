import { create } from "zustand";
import { DEFAULT_DETECTOR_CONFIG, type DetectorConfig } from "@/lib/types";

interface S {
  detector: DetectorConfig;
  setDetector: (p: Partial<DetectorConfig>) => void;
}

export const useSettings = create<S>((set) => ({
  detector: { ...DEFAULT_DETECTOR_CONFIG },
  setDetector: (p) => set((st) => ({ detector: { ...st.detector, ...p } })),
}));
