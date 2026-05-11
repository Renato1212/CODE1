import type { Trade, BookTicker, DepthSnapshot } from "@/lib/types";

export interface BinanceHandlers {
  onTrade: (t: Trade) => void;
  onBook: (b: BookTicker) => void;
  onDepth: (d: DepthSnapshot) => void;
  onStatus: (s: "connecting" | "open" | "closed" | "stale") => void;
}

export class BinanceClient {
  private ws: WebSocket | null = null;
  private symbol: string;
  private h: BinanceHandlers;
  private backoff = 1000;
  private lastMsg = 0;
  private staleTimer: ReturnType<typeof setInterval> | null = null;
  private closed = false;

  constructor(symbol: string, handlers: BinanceHandlers) {
    this.symbol = symbol.toLowerCase();
    this.h = handlers;
  }

  start() {
    this.closed = false;
    this.connect();
    this.staleTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN && Date.now() - this.lastMsg > 10_000) {
        this.h.onStatus("stale");
        try { this.ws.close(); } catch {}
      }
    }, 2000);
  }

  stop() {
    this.closed = true;
    if (this.staleTimer) clearInterval(this.staleTimer);
    if (this.ws) {
      try { this.ws.close(); } catch {}
      this.ws = null;
    }
  }

  private connect() {
    if (this.closed) return;
    const s = this.symbol;
    const url = `wss://fstream.binance.com/stream?streams=${s}@aggTrade/${s}@bookTicker/${s}@depth20@100ms`;
    this.h.onStatus("connecting");
    const ws = new WebSocket(url);
    this.ws = ws;

    ws.onopen = () => {
      this.backoff = 1000;
      this.lastMsg = Date.now();
      this.h.onStatus("open");
    };

    ws.onmessage = (ev) => {
      this.lastMsg = Date.now();
      const recvTs = performance.now();
      let msg: any;
      try { msg = JSON.parse(ev.data); } catch { return; }
      const data = msg.data;
      if (!data) return;
      const stream: string = msg.stream || "";

      if (stream.endsWith("@aggTrade")) {
        const price = parseFloat(data.p);
        const size = parseFloat(data.q);
        const side = data.m ? "sell" : "buy";
        this.h.onTrade({
          ts: data.T,
          recvTs,
          price,
          size,
          side,
          symbol: this.symbol.toUpperCase(),
        });
      } else if (stream.endsWith("@bookTicker")) {
        this.h.onBook({
          ts: data.E ?? Date.now(),
          bid: parseFloat(data.b),
          bidSize: parseFloat(data.B),
          ask: parseFloat(data.a),
          askSize: parseFloat(data.A),
        });
      } else if (stream.includes("@depth20")) {
        this.h.onDepth({
          ts: data.E ?? Date.now(),
          bids: (data.b || []).map((l: string[]) => ({ price: parseFloat(l[0]), size: parseFloat(l[1]) })),
          asks: (data.a || []).map((l: string[]) => ({ price: parseFloat(l[0]), size: parseFloat(l[1]) })),
        });
      }
    };

    ws.onclose = () => {
      this.h.onStatus("closed");
      if (this.closed) return;
      const wait = Math.min(this.backoff, 30_000);
      this.backoff = Math.min(this.backoff * 2, 30_000);
      setTimeout(() => this.connect(), wait);
    };

    ws.onerror = () => {
      try { ws.close(); } catch {}
    };
  }
}
