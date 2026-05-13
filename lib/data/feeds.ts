import type { Trade } from "@/lib/types";

export type FeedSource = "binance" | "coinbase" | "bybit" | "rithmic";

export interface FeedHandlers {
  onTrade: (t: Trade) => void;
  onStatus: (s: "connecting" | "open" | "closed" | "stale") => void;
  onDebug?: (msg: string) => void;
}

export interface RithmicConfig {
  bridgeUrl: string;        // ws://host:port path of your Rithmic bridge
  system?: string;          // e.g. "Rithmic 01", "Rithmic Paper Trading"
  user?: string;
  password?: string;
  exchange?: string;        // "CME", "CBOT", "NYMEX", "COMEX"
}

// Map UI symbol → exchange + (optional) front-month contract. The frontend
// stays exchange-agnostic; the bridge resolves "ES" to ESM5 etc.
interface SymbolDef { exchange: string; root: string; }
const SYMBOL_DEFS: Record<string, SymbolDef> = {
  // CME futures (Rithmic)
  ES: { exchange: "CME", root: "ES" },
  NQ: { exchange: "CME", root: "NQ" },
  YM: { exchange: "CBOT", root: "YM" },
  RTY: { exchange: "CME", root: "RTY" },
  MES: { exchange: "CME", root: "MES" },
  MNQ: { exchange: "CME", root: "MNQ" },
  MYM: { exchange: "CBOT", root: "MYM" },
  M2K: { exchange: "CME", root: "M2K" },
  CL: { exchange: "NYMEX", root: "CL" },
  MCL: { exchange: "NYMEX", root: "MCL" },
  NG: { exchange: "NYMEX", root: "NG" },
  GC: { exchange: "COMEX", root: "GC" },
  MGC: { exchange: "COMEX", root: "MGC" },
  SI: { exchange: "COMEX", root: "SI" },
  HG: { exchange: "COMEX", root: "HG" },
  ZN: { exchange: "CBOT", root: "ZN" },
  ZB: { exchange: "CBOT", root: "ZB" },
  ZF: { exchange: "CBOT", root: "ZF" },
  "6E": { exchange: "CME", root: "6E" },
  "6J": { exchange: "CME", root: "6J" },
  "6B": { exchange: "CME", root: "6B" },
};

interface SymbolMap { binance: string; coinbase: string; bybit: string; }
const CRYPTO_MAP: Record<string, SymbolMap> = {
  BTCUSDT: { binance: "btcusdt", coinbase: "BTC-USD", bybit: "BTCUSDT" },
  ETHUSDT: { binance: "ethusdt", coinbase: "ETH-USD", bybit: "ETHUSDT" },
  SOLUSDT: { binance: "solusdt", coinbase: "SOL-USD", bybit: "SOLUSDT" },
};

export class FeedClient {
  private ws: WebSocket | null = null;
  private h: FeedHandlers;
  private source: FeedSource;
  private symbol: string;
  private rithmic?: RithmicConfig;
  private backoff = 1000;
  private lastMsg = 0;
  private staleTimer: ReturnType<typeof setInterval> | null = null;
  private closed = false;
  msgCount = 0;
  errorCount = 0;
  lastError = "";

  constructor(source: FeedSource, symbol: string, handlers: FeedHandlers, rithmic?: RithmicConfig) {
    this.source = source;
    this.symbol = symbol;
    this.h = handlers;
    this.rithmic = rithmic;
  }

  start() {
    this.closed = false;
    this.connect();
    this.staleTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN && Date.now() - this.lastMsg > 15_000) {
        this.h.onStatus("stale");
        try { this.ws.close(); } catch {}
      }
    }, 2000);
  }
  stop() {
    this.closed = true;
    if (this.staleTimer) clearInterval(this.staleTimer);
    if (this.ws) { try { this.ws.close(); } catch {} this.ws = null; }
  }
  private debug(m: string) { this.h.onDebug?.(m); }

  private buildUrl(): string {
    if (this.source === "binance") {
      const s = CRYPTO_MAP[this.symbol] ?? CRYPTO_MAP.BTCUSDT;
      return `wss://fstream.binance.com/ws/${s.binance}@aggTrade`;
    }
    if (this.source === "coinbase") return `wss://ws-feed.exchange.coinbase.com`;
    if (this.source === "bybit") return `wss://stream.bybit.com/v5/public/linear`;
    if (this.source === "rithmic") return this.rithmic?.bridgeUrl || "";
    return "";
  }

  private subscribeAfterOpen() {
    if (!this.ws) return;
    if (this.source === "coinbase") {
      const s = CRYPTO_MAP[this.symbol] ?? CRYPTO_MAP.BTCUSDT;
      this.ws.send(JSON.stringify({ type: "subscribe", product_ids: [s.coinbase], channels: ["matches"] }));
    } else if (this.source === "bybit") {
      const s = CRYPTO_MAP[this.symbol] ?? CRYPTO_MAP.BTCUSDT;
      this.ws.send(JSON.stringify({ op: "subscribe", args: [`publicTrade.${s.bybit}`] }));
    } else if (this.source === "rithmic") {
      const def = SYMBOL_DEFS[this.symbol] ?? { exchange: this.rithmic?.exchange ?? "CME", root: this.symbol };
      // Bridge contract: client sends a login + subscribe message;
      // bridge handles Rithmic R-API|+ protocol and re-broadcasts trades as JSON.
      this.ws.send(JSON.stringify({
        type: "login",
        system: this.rithmic?.system ?? "Rithmic Paper Trading",
        user: this.rithmic?.user ?? "",
        password: this.rithmic?.password ?? "",
      }));
      this.ws.send(JSON.stringify({
        type: "subscribe",
        symbol: def.root,
        exchange: def.exchange,
      }));
    }
  }

  private parse(raw: string) {
    let msg: any;
    try { msg = JSON.parse(raw); } catch (e: any) {
      this.errorCount++; this.lastError = `parse: ${e?.message ?? e}`; return;
    }
    if (this.source === "binance") {
      const data = msg.data ?? msg;
      if (data && data.e === "aggTrade" && data.p && data.q) {
        this.h.onTrade({
          ts: data.T ?? data.E ?? Date.now(),
          recvTs: performance.now(),
          price: parseFloat(data.p),
          size: parseFloat(data.q),
          side: data.m ? "sell" : "buy",
          symbol: this.symbol,
        });
      }
    } else if (this.source === "coinbase") {
      if (msg.type === "match" && msg.price && msg.size) {
        this.h.onTrade({
          ts: msg.time ? Date.parse(msg.time) : Date.now(),
          recvTs: performance.now(),
          price: parseFloat(msg.price),
          size: parseFloat(msg.size),
          side: msg.side === "buy" ? "buy" : "sell",
          symbol: this.symbol,
        });
      }
    } else if (this.source === "bybit") {
      if (msg.topic && typeof msg.topic === "string" && msg.topic.startsWith("publicTrade.") && Array.isArray(msg.data)) {
        for (const t of msg.data) {
          this.h.onTrade({
            ts: t.T ?? Date.now(),
            recvTs: performance.now(),
            price: parseFloat(t.p),
            size: parseFloat(t.v),
            side: t.S === "Buy" ? "buy" : "sell",
            symbol: this.symbol,
          });
        }
      }
    } else if (this.source === "rithmic") {
      // Bridge contract: {type:"trade", symbol, ts, price, size, side}
      // side = "buy" | "sell" (aggressor side, inferred bridge-side via NBBO)
      // Optional aggregate form: {type:"trade", trades:[{...}, ...]}
      if (msg.type === "trade") {
        const t = msg;
        if (Array.isArray(msg.trades)) {
          for (const x of msg.trades) this.emitTrade(x);
        } else if (t.price !== undefined && t.size !== undefined && t.side) {
          this.emitTrade(t);
        }
      } else if (msg.type === "error") {
        this.lastError = `bridge: ${msg.message ?? "unknown"}`;
        this.debug(this.lastError);
      } else if (msg.type === "status") {
        this.debug(`bridge status: ${msg.message ?? ""}`);
      }
    }
  }

  private emitTrade(t: any) {
    if (t.price === undefined || t.size === undefined || !t.side) return;
    this.h.onTrade({
      ts: typeof t.ts === "number" ? t.ts : Date.now(),
      recvTs: performance.now(),
      price: typeof t.price === "number" ? t.price : parseFloat(t.price),
      size: typeof t.size === "number" ? t.size : parseFloat(t.size),
      side: t.side === "buy" ? "buy" : "sell",
      symbol: this.symbol,
    });
  }

  private connect() {
    if (this.closed) return;
    const url = this.buildUrl();
    if (!url) {
      this.lastError = this.source === "rithmic" ? "Rithmic bridge URL not configured" : "no url";
      this.debug(this.lastError);
      this.h.onStatus("closed");
      return;
    }
    this.debug(`[${this.source}] connecting ${url}`);
    this.h.onStatus("connecting");
    let ws: WebSocket;
    try { ws = new WebSocket(url); }
    catch (e: any) {
      this.lastError = `ctor: ${e?.message ?? e}`;
      this.debug(this.lastError);
      this.scheduleReconnect();
      return;
    }
    this.ws = ws;

    ws.onopen = () => {
      this.backoff = 1000;
      this.lastMsg = Date.now();
      this.debug(`[${this.source}] open`);
      this.h.onStatus("open");
      this.subscribeAfterOpen();
    };

    ws.onmessage = (ev) => {
      this.lastMsg = Date.now();
      this.msgCount++;
      const d = ev.data;
      if (typeof d === "string") this.parse(d);
      else if (d instanceof Blob) d.text().then(s => this.parse(s));
      else if (d instanceof ArrayBuffer) this.parse(new TextDecoder().decode(d));
    };

    ws.onerror = (e: any) => {
      this.errorCount++;
      this.lastError = `error: ${e?.message ?? "ws error"}`;
      this.debug(`[${this.source}] ${this.lastError}`);
    };

    ws.onclose = (e) => {
      this.debug(`[${this.source}] close code=${e.code}`);
      this.h.onStatus("closed");
      if (this.closed) return;
      this.scheduleReconnect();
    };
  }

  private scheduleReconnect() {
    const wait = Math.min(this.backoff, 30_000);
    this.backoff = Math.min(this.backoff * 2, 30_000);
    setTimeout(() => this.connect(), wait);
  }
}

export const CRYPTO_SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT"];
export const CME_SYMBOLS = [
  "ES", "NQ", "YM", "RTY",
  "MES", "MNQ", "MYM", "M2K",
  "CL", "MCL", "NG",
  "GC", "MGC", "SI", "HG",
  "ZN", "ZB", "ZF",
  "6E", "6J", "6B",
];
export const SYMBOL_LABELS: Record<string, string> = {
  ES: "ES — E-mini S&P 500",
  NQ: "NQ — E-mini Nasdaq-100",
  YM: "YM — E-mini Dow",
  RTY: "RTY — E-mini Russell 2000",
  MES: "MES — Micro E-mini S&P",
  MNQ: "MNQ — Micro E-mini Nasdaq",
  MYM: "MYM — Micro E-mini Dow",
  M2K: "M2K — Micro E-mini Russell",
  CL: "CL — WTI Crude Oil",
  MCL: "MCL — Micro WTI Crude",
  NG: "NG — Natural Gas",
  GC: "GC — Gold",
  MGC: "MGC — Micro Gold",
  SI: "SI — Silver",
  HG: "HG — Copper",
  ZN: "ZN — 10Y T-Note",
  ZB: "ZB — 30Y T-Bond",
  ZF: "ZF — 5Y T-Note",
  "6E": "6E — Euro FX",
  "6J": "6J — Japanese Yen",
  "6B": "6B — British Pound",
};
