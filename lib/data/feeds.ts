import type { Trade } from "@/lib/types";

export type FeedSource = "binance" | "coinbase" | "bybit";

export interface FeedHandlers {
  onTrade: (t: Trade) => void;
  onStatus: (s: "connecting" | "open" | "closed" | "stale") => void;
  onDebug?: (msg: string) => void;
}

interface SymbolMap { binance: string; coinbase: string; bybit: string; }
const SYMBOL_MAP: Record<string, SymbolMap> = {
  BTCUSDT: { binance: "btcusdt", coinbase: "BTC-USD", bybit: "BTCUSDT" },
  ETHUSDT: { binance: "ethusdt", coinbase: "ETH-USD", bybit: "ETHUSDT" },
  SOLUSDT: { binance: "solusdt", coinbase: "SOL-USD", bybit: "SOLUSDT" },
};

export class FeedClient {
  private ws: WebSocket | null = null;
  private h: FeedHandlers;
  private source: FeedSource;
  private symbol: string;
  private backoff = 1000;
  private lastMsg = 0;
  private staleTimer: ReturnType<typeof setInterval> | null = null;
  private closed = false;
  msgCount = 0;
  errorCount = 0;
  lastError = "";

  constructor(source: FeedSource, symbol: string, handlers: FeedHandlers) {
    this.source = source;
    this.symbol = symbol;
    this.h = handlers;
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
    const s = SYMBOL_MAP[this.symbol] ?? SYMBOL_MAP.BTCUSDT;
    if (this.source === "binance") return `wss://fstream.binance.com/ws/${s.binance}@aggTrade`;
    if (this.source === "coinbase") return `wss://ws-feed.exchange.coinbase.com`;
    if (this.source === "bybit") return `wss://stream.bybit.com/v5/public/linear`;
    return "";
  }

  private subscribeAfterOpen() {
    if (!this.ws) return;
    const s = SYMBOL_MAP[this.symbol] ?? SYMBOL_MAP.BTCUSDT;
    if (this.source === "coinbase") {
      this.ws.send(JSON.stringify({
        type: "subscribe",
        product_ids: [s.coinbase],
        channels: ["matches"],
      }));
    } else if (this.source === "bybit") {
      this.ws.send(JSON.stringify({ op: "subscribe", args: [`publicTrade.${s.bybit}`] }));
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
        // Coinbase: side === "buy" means the taker BOUGHT (aggressive buy)
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
      // Bybit linear: { topic: "publicTrade.BTCUSDT", data: [{ T, p, v, S }] }
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
    }
  }

  private connect() {
    if (this.closed) return;
    const url = this.buildUrl();
    this.debug(`[${this.source}] connecting`);
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
