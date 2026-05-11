import { create } from "zustand";
import type { EnrichedTrade, FlowEvent, Stats } from "@/lib/types";

interface SparkPt { ts: number; v: number; }

interface SoundLog { id: number; ts: number; layer: string; detail: string; }

interface State {
  symbol: string;
  status: "connecting" | "open" | "closed" | "stale";
  stats: Stats | null;
  lastTrades: EnrichedTrade[];
  largePrints: EnrichedTrade[];
  events: FlowEvent[];
  soundLog: SoundLog[];
  cvdSpark: SparkPt[];
  latencyMs: number;
  setSymbol: (s: string) => void;
  setStatus: (s: State["status"]) => void;
  pushTrade: (t: EnrichedTrade) => void;
  pushEvent: (e: FlowEvent) => void;
  setStats: (s: Stats) => void;
  setLatency: (n: number) => void;
  pushSound: (l: string, d: string, ts: number) => void;
  reset: () => void;
}

let soundId = 1;

export const useMarket = create<State>((set) => ({
  symbol: "BTCUSDT",
  status: "closed",
  stats: null,
  lastTrades: [],
  largePrints: [],
  events: [],
  soundLog: [],
  cvdSpark: [],
  latencyMs: 0,
  setSymbol: (s) => set({ symbol: s }),
  setStatus: (s) => set({ status: s }),
  pushTrade: (t) => set((st) => {
    const lt = [t, ...st.lastTrades].slice(0, 50);
    const isLarge = t.tier === "size" || t.tier === "whale" || t.tier === "super_whale";
    const lp = isLarge ? [t, ...st.largePrints].slice(0, 10) : st.largePrints;
    return { lastTrades: lt, largePrints: lp };
  }),
  pushEvent: (e) => set((st) => ({ events: [e, ...st.events].slice(0, 50) })),
  setStats: (s) => set((st) => {
    const spark = [...st.cvdSpark, { ts: Date.now(), v: s.cvd1m }].slice(-60);
    return { stats: s, cvdSpark: spark };
  }),
  setLatency: (n) => set({ latencyMs: n }),
  pushSound: (layer, detail, ts) => set((st) => ({
    soundLog: [{ id: soundId++, layer, detail, ts }, ...st.soundLog].slice(0, 100),
  })),
  reset: () => set({
    lastTrades: [], largePrints: [], events: [], soundLog: [],
    cvdSpark: [], stats: null,
  }),
}));
