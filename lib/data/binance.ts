import type { Trade } from "@/lib/types";

export interface BinanceHandlers {
  onTrade: (t: Trade) => void;
  onStatus: (s: "connecting" | "open" | "closed" | "stale") => void;
  onDebug?: (msg: string) => void;
}

// Single-stream client for aggregate trades. Uses the raw /ws/<stream>
// endpoint which is simpler and more reliable on mobile than combined streams.
export class BinanceClient {
  private ws: WebSocket | null = null;
  private symbol: string;
  private h: BinanceHandlers;
  private backoff = 1000;
  private lastMsg = 0;
  private staleTimer: ReturnType<typeof setInterval> | null = null;
  private closed = false;
  msgCount = 0;
  errorCount = 0;
  lastError = "";

  constructor(symbol: string, handlers: BinanceHandlers) {
    this.symbol = symbol.toLowerCase();
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

  private connect() {
    if (this.closed) return;
    const url = `wss://fstream.binance.com/ws/${this.symbol}@aggTrade`;
    this.debug(`connecting ${url}`);
    this.h.onStatus("connecting");

    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch (e: any) {
      this.lastError = `ctor: ${e?.message ?? e}`;
      this.debug(this.lastError);
      this.scheduleReconnect();
      return;
    }
    this.ws = ws;

    ws.onopen = () => {
      this.backoff = 1000;
      this.lastMsg = Date.now();
      this.debug("open");
      this.h.onStatus("open");
    };

    ws.onmessage = (ev) => {
      this.lastMsg = Date.now();
      this.msgCount++;
      const recvTs = performance.now();

      const handleString = (s: string) => {
        let msg: any;
        try { msg = JSON.parse(s); } catch (e: any) {
          this.errorCount++;
          this.lastError = `parse: ${e?.message ?? e}`;
          return;
        }
        // Raw stream returns the aggTrade object directly (no envelope).
        // Combined stream wraps it as {stream, data}; support both.
        const data = msg.data ?? msg;
        if (data && data.e === "aggTrade" && data.p && data.q) {
          this.h.onTrade({
            ts: data.T ?? data.E ?? Date.now(),
            recvTs,
            price: parseFloat(data.p),
            size: parseFloat(data.q),
            side: data.m ? "sell" : "buy",
            symbol: this.symbol.toUpperCase(),
          });
        }
      };

      const d = ev.data;
      if (typeof d === "string") handleString(d);
      else if (d instanceof Blob) d.text().then(handleString);
      else if (d instanceof ArrayBuffer) handleString(new TextDecoder().decode(d));
    };

    ws.onerror = (e: any) => {
      this.errorCount++;
      this.lastError = `error: ${e?.message ?? "ws error"}`;
      this.debug(this.lastError);
    };

    ws.onclose = (e) => {
      this.debug(`close code=${e.code} reason=${e.reason || "—"}`);
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
