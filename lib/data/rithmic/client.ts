import type { Trade } from "@/lib/types";
import type * as protobuf from "protobufjs";
import {
  Envelope,
  RequestRithmicSystemInfo, ResponseRithmicSystemInfo,
  RequestLogin, ResponseLogin,
  RequestHeartbeat,
  RequestMarketDataUpdate, ResponseMarketDataUpdate,
  LastTrade, BestBidOffer,
  TEMPLATE, INFRA_TYPE, MDU_BITS, MDU_REQ,
} from "./protos";

export type RithmicGateway = "test" | "chicago" | "europe";

export interface RithmicHandlers {
  onTrade: (t: Trade) => void;
  onStatus: (s: "connecting" | "open" | "closed" | "stale") => void;
  onDebug?: (msg: string) => void;
}

export interface RithmicCredentials {
  gateway: RithmicGateway;
  system: string;        // e.g. "Rithmic Paper Trading"
  user: string;
  password: string;
  appName?: string;      // Rithmic-side allowlisted app identifier
  appVersion?: string;
}

export interface RithmicSubscription {
  symbol: string;        // e.g. "ESM5" or whatever Rithmic accepts as a tradeable
  exchange: string;      // "CME" | "CBOT" | "NYMEX" | "COMEX"
}

const GATEWAY_URL: Record<RithmicGateway, string> = {
  test: "wss://rprotocol-mobile.rithmic.com:443",
  chicago: "wss://rprotocol.rithmic.com:443",
  europe: "wss://rprotocol-europe.rithmic.com:443",
};

export class RithmicClient {
  private ws: WebSocket | null = null;
  private h: RithmicHandlers;
  private creds: RithmicCredentials;
  private sub: RithmicSubscription;
  private hbTimer: ReturnType<typeof setInterval> | null = null;
  private closed = false;
  private hbInterval = 30_000;
  private backoff = 1000;
  msgCount = 0;
  errorCount = 0;
  lastError = "";
  rawLog: string[] = [];
  private nbbo = new Map<string, { bid?: number; ask?: number; lastSide?: "buy" | "sell" }>();

  constructor(creds: RithmicCredentials, sub: RithmicSubscription, h: RithmicHandlers) {
    this.creds = creds;
    this.sub = sub;
    this.h = h;
  }

  start() {
    this.closed = false;
    this.connect();
  }
  stop() {
    this.closed = true;
    if (this.hbTimer) { clearInterval(this.hbTimer); this.hbTimer = null; }
    if (this.ws) {
      try { this.ws.close(); } catch {}
      this.ws = null;
    }
  }

  private debug(s: string) {
    const line = `${new Date().toISOString().substr(11, 12)} ${s}`;
    this.rawLog.push(line);
    if (this.rawLog.length > 500) this.rawLog.shift();
    this.h.onDebug?.(s);
  }

  private hex(buf: Uint8Array, max = 96): string {
    const n = Math.min(buf.length, max);
    let out = "";
    for (let i = 0; i < n; i++) out += buf[i].toString(16).padStart(2, "0");
    return out + (buf.length > max ? `…(+${buf.length - max}B)` : "");
  }

  private connect() {
    if (this.closed) return;
    const url = GATEWAY_URL[this.creds.gateway];
    this.debug(`[rithmic] connecting ${url}`);
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
    ws.binaryType = "arraybuffer";
    this.ws = ws;

    ws.onopen = () => {
      this.backoff = 1000;
      this.debug("[rithmic] socket open — requesting system info first");
      this.h.onStatus("open");
      // Canonical Rithmic handshake: ask the gateway which systems are reachable,
      // THEN log in. Some gateways close with permission_denied if we skip this.
      this.send(RequestRithmicSystemInfo, { template_id: TEMPLATE.RequestRithmicSystemInfo });
    };
    ws.onmessage = (ev) => {
      this.msgCount++;
      const buf = ev.data instanceof ArrayBuffer ? new Uint8Array(ev.data)
                : typeof ev.data === "string" ? new TextEncoder().encode(ev.data)
                : null;
      if (!buf) return;
      this.rawLog.push(`RX#${this.msgCount} len=${buf.length} hex=${this.hex(buf)}`);
      if (this.rawLog.length > 500) this.rawLog.shift();
      this.dispatch(buf);
    };
    ws.onerror = () => {
      this.errorCount++;
      this.lastError = "ws error";
      this.debug("[rithmic] ws error");
    };
    ws.onclose = (e) => {
      let hint = "";
      if (e.code === 1011 && /permission/i.test(e.reason || "")) {
        hint = ` — app_name "${this.creds.appName ?? ""}" not allowlisted for system "${this.creds.system}"; try a different provider preset or set Advanced → App name`;
      }
      this.debug(`[rithmic] close code=${e.code} reason=${e.reason || "—"}${hint}`);
      if (this.hbTimer) { clearInterval(this.hbTimer); this.hbTimer = null; }
      this.h.onStatus("closed");
      if (!this.closed) this.scheduleReconnect();
    };
  }

  private scheduleReconnect() {
    const wait = Math.min(this.backoff, 30_000);
    this.backoff = Math.min(this.backoff * 2, 30_000);
    setTimeout(() => this.connect(), wait);
  }

  private send(type: protobuf.Type, message: Record<string, any>) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const err = type.verify(message);
    if (err) { this.debug(`[rithmic] verify error: ${err}`); return; }
    const buf = type.encode(type.create(message)).finish();
    const u8 = new Uint8Array(buf);
    this.rawLog.push(`TX ${type.name} tid=${message.template_id} len=${u8.length} hex=${this.hex(u8)}`);
    this.ws.send(buf);
  }

  private sendLogin() {
    const appName = this.creds.appName || "Rithmic Test";
    const appVersion = this.creds.appVersion || "1.0.0.0";
    this.debug(`[rithmic] login user=${this.creds.user} system="${this.creds.system}" app="${appName}" v${appVersion}`);
    this.send(RequestLogin, {
      template_id: TEMPLATE.RequestLogin,
      template_version: "3.9",
      user: this.creds.user,
      password: this.creds.password,
      app_name: appName,
      app_version: appVersion,
      system_name: this.creds.system,
      infra_type: INFRA_TYPE.TICKER_PLANT,
      aggregated_quotes: false,
    });
  }

  private sendSubscribe() {
    this.send(RequestMarketDataUpdate, {
      template_id: TEMPLATE.RequestMarketDataUpdate,
      symbol: this.sub.symbol,
      exchange: this.sub.exchange,
      request: MDU_REQ.SUBSCRIBE,
      update_bits: MDU_BITS.LAST_TRADE | MDU_BITS.BBO,
    });
    this.debug(`[rithmic] subscribed ${this.sub.symbol} ${this.sub.exchange}`);
  }

  private startHeartbeat() {
    if (this.hbTimer) clearInterval(this.hbTimer);
    this.hbTimer = setInterval(() => {
      this.send(RequestHeartbeat, { template_id: TEMPLATE.RequestHeartbeat });
    }, Math.max(5_000, this.hbInterval - 5_000));
  }

  private dispatch(buf: Uint8Array) {
    let tid = 0;
    try {
      const env: any = Envelope.decode(buf);
      tid = env.template_id ?? 0;
    } catch (e: any) {
      this.errorCount++;
      this.lastError = `envelope decode: ${e?.message ?? e}`;
      this.debug(this.lastError);
      return;
    }
    try {
      switch (tid) {
        case TEMPLATE.ResponseRithmicSystemInfo: {
          const m: any = ResponseRithmicSystemInfo.decode(buf);
          const systems = (m.system_name ?? []).join(", ");
          const rp = m.rp_code ?? [];
          this.debug(`[rithmic] systems available: [${systems}] rp=[${rp.join(",")}]`);
          if (rp.length === 0 || rp[0] === "0") {
            this.sendLogin();
          } else {
            this.lastError = `system_info denied: rp=${rp.join(",")}`;
            try { this.ws?.close(); } catch {}
          }
          break;
        }
        case TEMPLATE.ResponseLogin: {
          const m: any = ResponseLogin.decode(buf);
          const rp = m.rp_code ?? [];
          const ok = rp.length === 0 || rp[0] === "0";
          this.hbInterval = (m.heartbeat_interval ?? 30) * 1000;
          const um = (m.user_msg ?? []).join(" | ");
          this.debug(`[rithmic] login ${ok ? "OK" : "FAIL"} rp_code=[${rp.join(",")}]${um ? " msg=" + um : ""} hb=${this.hbInterval}ms`);
          if (ok) {
            this.startHeartbeat();
            this.sendSubscribe();
          } else {
            this.lastError = `login failed: rp=${rp.join(",")} ${um}`;
            try { this.ws?.close(); } catch {}
          }
          break;
        }
        case TEMPLATE.ResponseHeartbeat: break;
        case TEMPLATE.ResponseMarketDataUpdate: {
          const m: any = ResponseMarketDataUpdate.decode(buf);
          const rp = m.rp_code ?? [];
          const um = (m.user_msg ?? []).join(" | ");
          this.debug(`[rithmic] sub ack rp_code=[${rp.join(",")}]${um ? " msg=" + um : ""}`);
          break;
        }
        case TEMPLATE.BestBidOffer: {
          const m: any = BestBidOffer.decode(buf);
          const key = `${m.symbol}|${m.exchange}`;
          const cur = this.nbbo.get(key) ?? {};
          if (m.bid_price !== undefined) cur.bid = m.bid_price;
          if (m.ask_price !== undefined) cur.ask = m.ask_price;
          this.nbbo.set(key, cur);
          break;
        }
        case TEMPLATE.LastTrade: {
          const m: any = LastTrade.decode(buf);
          const price = m.trade_price ?? 0;
          const size = m.trade_size ?? 0;
          if (price === 0 || size === 0) return;
          let side: "buy" | "sell";
          if (m.aggressor === 1) side = "buy";
          else if (m.aggressor === 2) side = "sell";
          else {
            const key = `${m.symbol}|${m.exchange}`;
            const nbbo = this.nbbo.get(key) ?? {};
            if (nbbo.ask !== undefined && price >= nbbo.ask) side = "buy";
            else if (nbbo.bid !== undefined && price <= nbbo.bid) side = "sell";
            else side = nbbo.lastSide ?? "buy";
            this.nbbo.set(key, { ...nbbo, lastSide: side });
          }
          const ssboe: number = m.ssboe ?? 0;
          const usecs: number = m.usecs ?? 0;
          const ts = ssboe ? ssboe * 1000 + Math.floor(usecs / 1000) : Date.now();
          this.h.onTrade({
            ts, recvTs: performance.now(),
            price, size, side,
            symbol: m.symbol ?? this.sub.symbol,
          });
          break;
        }
        default:
          this.debug(`[rithmic] unhandled template_id=${tid} len=${buf.length}`);
      }
    } catch (e: any) {
      this.errorCount++;
      this.lastError = `decode tid=${tid}: ${e?.message ?? e}`;
      this.debug(this.lastError);
    }
  }
}
