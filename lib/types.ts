export type Side = "buy" | "sell";

export interface Trade {
  ts: number;
  recvTs: number;
  price: number;
  size: number;
  side: Side;
  symbol: string;
}

export interface BookTicker {
  ts: number;
  bid: number;
  bidSize: number;
  ask: number;
  askSize: number;
}

export interface DepthLevel { price: number; size: number; }
export interface DepthSnapshot { ts: number; bids: DepthLevel[]; asks: DepthLevel[]; }

export type FlowEventType =
  | "sweep" | "iceberg" | "absorption" | "cvd_flip" | "volume_burst" | "super_whale";

export interface FlowEvent {
  type: FlowEventType;
  ts: number;
  side?: Side;
  price?: number;
  size?: number;
  detail?: string;
}

export type WorkerOut =
  | { type: "stats"; payload: Stats }
  | { type: "trade_enriched"; payload: EnrichedTrade }
  | { type: "event"; payload: FlowEvent };

export type WorkerIn =
  | { type: "trade"; payload: Trade }
  | { type: "book"; payload: BookTicker }
  | { type: "depth"; payload: DepthSnapshot }
  | { type: "config"; payload: Partial<DetectorConfig> }
  | { type: "reset" };

export interface Stats {
  vwap1m: number; vwap5m: number; vwap30m: number;
  std5m: number;
  cvd10s: number; cvd1m: number; cvd5m: number; cvdSession: number;
  tradesPerSec: number;
  sizeP25: number; sizeP50: number; sizeP75: number; sizeP95: number; sizeP99: number;
  spread: number;
  bid: number; ask: number;
}

export type SizeTier = "dust" | "normal" | "size" | "whale" | "super_whale";

export interface EnrichedTrade extends Trade {
  tier: SizeTier;
  zScore: number;
  vwap5m: number;
}

export interface DetectorConfig {
  sweepLevels: number;
  sweepWindowMs: number;
  icebergMinTrades: number;
  icebergWindowMs: number;
  absorptionTolerance: number;
  absorptionWindowMs: number;
  volumeBurstMult: number;
}

export const DEFAULT_DETECTOR_CONFIG: DetectorConfig = {
  sweepLevels: 3,
  sweepWindowMs: 300,
  icebergMinTrades: 5,
  icebergWindowMs: 5000,
  absorptionTolerance: 1,
  absorptionWindowMs: 2000,
  volumeBurstMult: 3,
};
