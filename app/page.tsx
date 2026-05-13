"use client";
import { useEffect, useRef, useState } from "react";
import {
  FeedClient, type FeedSource, type RithmicConfig,
  CRYPTO_SYMBOLS, CME_SYMBOLS, SYMBOL_LABELS,
} from "@/lib/data/feeds";
import { RithmicClient, type RithmicGateway } from "@/lib/data/rithmic/client";
import { simpleAudio } from "@/lib/audio/simple";
import PriceLadder from "@/components/PriceLadder";

const BUILD = "v5-rithmic-direct-2026-05-11";
const SOURCES: { value: FeedSource; label: string }[] = [
  { value: "binance", label: "Binance Futures (crypto)" },
  { value: "coinbase", label: "Coinbase Spot (crypto)" },
  { value: "bybit", label: "Bybit Futures (crypto)" },
  { value: "rithmic", label: "Rithmic — CME futures" },
];
const MAX_TRADES = 2000;
const LADDER_WINDOW_MS = 60_000;
const IMBALANCE_COOLDOWN_MS = 4000;

interface UiTrade { side: "buy" | "sell"; size: number; ts: number; price: number; }

interface RithmicLogin {
  gateway: RithmicGateway;
  system: string;
  user: string;
  password: string;
  exchange: string;
  contract: string;        // e.g. "ESM6" — full Rithmic contract code
  mode: "direct" | "bridge";
  bridgeUrl: string;
}

function symbolsFor(src: FeedSource): string[] {
  return src === "rithmic" ? CME_SYMBOLS : CRYPTO_SYMBOLS;
}
function defaultSymbol(src: FeedSource): string {
  return src === "rithmic" ? "ES" : "BTCUSDT";
}

function loadRithmic(): RithmicLogin {
  if (typeof window === "undefined") return blankRithmic();
  try {
    const raw = localStorage.getItem("tapefeel:rithmic2");
    if (raw) return { ...blankRithmic(), ...JSON.parse(raw) };
  } catch {}
  return blankRithmic();
}
function blankRithmic(): RithmicLogin {
  return {
    gateway: "test",
    system: "Rithmic Paper Trading",
    user: "",
    password: "",
    exchange: "CME",
    contract: "",
    mode: "direct",
    bridgeUrl: "",
  };
}

export default function Page() {
  const [started, setStarted] = useState(false);
  const [source, setSource] = useState<FeedSource>("binance");
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [trades, setTrades] = useState<UiTrade[]>([]);
  const [status, setStatus] = useState<"connecting" | "open" | "closed" | "stale">("closed");
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(0.7);
  const [err, setErr] = useState<string | null>(null);
  const [lastPrice, setLastPrice] = useState<number | null>(null);
  const [msgCount, setMsgCount] = useState(0);
  const [lastDebug, setLastDebug] = useState<string>("");
  const [lastTradeAge, setLastTradeAge] = useState<number>(0);
  const [tickOverride, setTickOverride] = useState<string>("auto");
  const [imbalanceFlash, setImbalanceFlash] = useState<"buy" | "sell" | null>(null);
  const [rithmic, setRithmic] = useState<RithmicLogin>(() => loadRithmic());
  const [showRithmicCfg, setShowRithmicCfg] = useState(false);

  const cryptoClientRef = useRef<FeedClient | null>(null);
  const rithmicClientRef = useRef<RithmicClient | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastTradeTsRef = useRef<number>(0);
  const lastAlertTsRef = useRef<{ buy: number; sell: number }>({ buy: 0, sell: 0 });
  const rollingDeltaRef = useRef<{ buyVol: number; sellVol: number; ts: number }[]>([]);

  useEffect(() => {
    try { localStorage.setItem("tapefeel:rithmic2", JSON.stringify(rithmic)); } catch {}
  }, [rithmic]);

  const start = async () => {
    try {
      await simpleAudio.start();
      setStarted(true);
      connect(source, symbol);
    } catch (e: any) {
      setErr(`Audio failed: ${e?.message ?? e}`);
    }
  };

  const checkImbalance = (t: UiTrade) => {
    const w = rollingDeltaRef.current;
    w.push({
      buyVol: t.side === "buy" ? t.size : 0,
      sellVol: t.side === "sell" ? t.size : 0,
      ts: t.ts,
    });
    const cutoff = t.ts - 5_000;
    while (w.length && w[0].ts < cutoff) w.shift();
    const buy = w.reduce((a, b) => a + b.buyVol, 0);
    const sell = w.reduce((a, b) => a + b.sellVol, 0);
    const tot = buy + sell;
    if (tot < 0.001 || w.length < 6) return;
    const now = Date.now();
    if (buy / tot > 0.8 && now - lastAlertTsRef.current.buy > IMBALANCE_COOLDOWN_MS) {
      simpleAudio.alert("buy");
      lastAlertTsRef.current.buy = now;
      setImbalanceFlash("buy");
      setTimeout(() => setImbalanceFlash(null), 600);
    } else if (sell / tot > 0.8 && now - lastAlertTsRef.current.sell > IMBALANCE_COOLDOWN_MS) {
      simpleAudio.alert("sell");
      lastAlertTsRef.current.sell = now;
      setImbalanceFlash("sell");
      setTimeout(() => setImbalanceFlash(null), 600);
    }
  };

  const handleTrade = (t: { side: "buy" | "sell"; size: number; price: number; ts: number }) => {
    simpleAudio.play(t.side, t.size);
    setLastPrice(t.price);
    lastTradeTsRef.current = Date.now();
    const ui: UiTrade = { side: t.side, size: t.size, ts: t.ts, price: t.price };
    setTrades(prev => {
      const next = [...prev, ui];
      if (next.length > MAX_TRADES) next.splice(0, next.length - MAX_TRADES);
      return next;
    });
    checkImbalance(ui);
  };

  const connect = (src: FeedSource, sym: string) => {
    cryptoClientRef.current?.stop();
    rithmicClientRef.current?.stop();
    setTrades([]);
    setLastPrice(null);
    setMsgCount(0);
    setLastDebug("");
    lastTradeTsRef.current = 0;
    rollingDeltaRef.current = [];

    if (src === "rithmic") {
      const contract = rithmic.contract.trim() || sym;
      if (rithmic.mode === "direct") {
        if (!rithmic.user || !rithmic.password) {
          setErr("Rithmic user / password required.");
          setShowRithmicCfg(true);
          return;
        }
        setErr(null);
        const r = new RithmicClient(
          { gateway: rithmic.gateway, system: rithmic.system, user: rithmic.user, password: rithmic.password },
          { symbol: contract, exchange: rithmic.exchange },
          { onStatus: setStatus, onDebug: setLastDebug, onTrade: handleTrade },
        );
        r.start();
        rithmicClientRef.current = r;
        if (tickRef.current) clearInterval(tickRef.current);
        tickRef.current = setInterval(() => {
          setMsgCount(r.msgCount);
          setLastTradeAge(lastTradeTsRef.current ? Date.now() - lastTradeTsRef.current : 0);
        }, 500);
        return;
      } else {
        if (!rithmic.bridgeUrl) {
          setErr("Bridge WS URL required for bridge mode.");
          setShowRithmicCfg(true);
          return;
        }
        // Fall through to bridge via FeedClient
      }
    }
    setErr(null);
    const bridgeCfg: RithmicConfig | undefined = src === "rithmic"
      ? { bridgeUrl: rithmic.bridgeUrl, system: rithmic.system, user: rithmic.user, password: rithmic.password, exchange: rithmic.exchange }
      : undefined;
    const c = new FeedClient(src, sym, {
      onStatus: setStatus,
      onDebug: setLastDebug,
      onTrade: (t) => handleTrade(t),
    }, bridgeCfg);
    c.start();
    cryptoClientRef.current = c;
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = setInterval(() => {
      setMsgCount(c.msgCount);
      setLastTradeAge(lastTradeTsRef.current ? Date.now() - lastTradeTsRef.current : 0);
    }, 500);
  };

  const onSourceChange = (src: FeedSource) => {
    setSource(src);
    const next = symbolsFor(src).includes(symbol) ? symbol : defaultSymbol(src);
    setSymbol(next);
    if (started) connect(src, next);
  };
  const onSymbolChange = (sym: string) => {
    setSymbol(sym);
    if (started) connect(source, sym);
  };

  const testSound = () => {
    simpleAudio.play("buy", 0.5);
    setTimeout(() => simpleAudio.play("sell", 0.5), 350);
    setTimeout(() => simpleAudio.play("buy", 8), 700);
    setTimeout(() => simpleAudio.play("sell", 50), 1100);
    setTimeout(() => simpleAudio.alert("buy"), 1700);
    setTimeout(() => simpleAudio.alert("sell"), 2300);
  };

  const fakeTrade = () => {
    const side: "buy" | "sell" = Math.random() > 0.5 ? "buy" : "sell";
    const size = Math.random() * 20 + 0.1;
    const basePrice = lastPrice ?? (source === "rithmic" ? 5000 : 100_000);
    const price = basePrice + (Math.random() - 0.5) * 20;
    handleTrade({ side, size, price, ts: Date.now() });
  };

  useEffect(() => () => {
    cryptoClientRef.current?.stop();
    rithmicClientRef.current?.stop();
    if (tickRef.current) clearInterval(tickRef.current);
  }, []);

  const statusColor =
    status === "open" ? "bg-buy" :
    status === "connecting" ? "bg-yellow-500" :
    status === "stale" ? "bg-orange-500" : "bg-sell";

  const tickValue = tickOverride === "auto" ? undefined : parseFloat(tickOverride);
  const symbols = symbolsFor(source);

  if (!started) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="panel p-8 max-w-2xl w-full space-y-4">
          <h1 className="text-4xl font-bold text-accent text-center">TapeFeel</h1>
          <p className="text-muted text-center">Live order-flow audio + price ladder.</p>
          <div className="text-xs text-muted space-y-3">
            <Row label="Source">
              <select value={source} onChange={e => { const s = e.target.value as FeedSource; setSource(s); setSymbol(defaultSymbol(s)); }}
                      className="bg-panel2 border border-border rounded px-2 py-1 w-full">
                {SOURCES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </Row>
            <Row label="Symbol">
              <select value={symbol} onChange={e => setSymbol(e.target.value)}
                      className="bg-panel2 border border-border rounded px-2 py-1 w-full">
                {symbols.map(s => <option key={s} value={s}>{SYMBOL_LABELS[s] ?? s}</option>)}
              </select>
            </Row>
            {source === "rithmic" && <RithmicLoginForm rithmic={rithmic} setRithmic={setRithmic} />}
          </div>
          <div className="text-center">
            <button onClick={start} className="btn btn-active text-base px-6 py-3">Start</button>
          </div>
          <p className="text-[10px] text-muted text-center">Headphones recommended. Build: {BUILD}</p>
          {err && <p className="text-xs text-sell text-center">{err}</p>}
        </div>
      </div>
    );
  }

  const flashBg =
    imbalanceFlash === "buy" ? "shadow-[0_0_0_2px_rgba(16,185,129,0.6)]" :
    imbalanceFlash === "sell" ? "shadow-[0_0_0_2px_rgba(239,68,68,0.6)]" : "";

  return (
    <div className={`min-h-screen flex flex-col gap-3 p-3 transition-shadow duration-200 ${flashBg}`}>
      <header className="panel p-3 flex items-center gap-3 text-xs flex-wrap">
        <span className="text-lg font-bold text-accent">TapeFeel</span>
        <select value={source} onChange={e => onSourceChange(e.target.value as FeedSource)}
                className="bg-panel2 border border-border rounded px-2 py-1">
          {SOURCES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select value={symbol} onChange={e => onSymbolChange(e.target.value)}
                className="bg-panel2 border border-border rounded px-2 py-1">
          {symbols.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        {source === "rithmic" && (
          <button className="btn" onClick={() => setShowRithmicCfg(v => !v)}>⚙ Rithmic</button>
        )}
        <div className="flex items-center gap-1">
          <span className={`dot ${statusColor}`} />
          <span className="text-muted">{status}</span>
        </div>
        <div className="text-muted">price <span className="text-text tabular-nums">{lastPrice?.toFixed(2) ?? "—"}</span></div>
        <div className="text-muted">trades <span className="text-text tabular-nums">{trades.length}</span></div>
        <div className="text-muted">msgs <span className="text-text tabular-nums">{msgCount}</span></div>
        {lastTradeAge > 0 && <div className="text-muted">last <span className="text-text tabular-nums">{(lastTradeAge / 1000).toFixed(1)}s</span></div>}
        <label className="text-muted">tick</label>
        <select value={tickOverride} onChange={e => setTickOverride(e.target.value)}
                className="bg-panel2 border border-border rounded px-1 py-1">
          <option value="auto">auto</option>
          <option value="0.05">0.05</option>
          <option value="0.1">0.1</option>
          <option value="0.25">0.25</option>
          <option value="0.5">0.5</option>
          <option value="1">1</option>
          <option value="5">5</option>
          <option value="10">10</option>
          <option value="25">25</option>
          <option value="50">50</option>
          <option value="100">100</option>
        </select>
        <button className="btn" onClick={testSound}>test audio</button>
        <button className="btn" onClick={fakeTrade}>test trade</button>
        <div className="ml-auto flex items-center gap-2">
          <label className="text-muted">vol</label>
          <input type="range" min={0} max={1} step={0.01} value={volume}
                 onChange={e => { const v = +e.target.value; setVolume(v); simpleAudio.setVolume(v); }} />
          <button className={`btn ${muted ? "btn-active" : ""}`}
                  onClick={() => { const m = !muted; setMuted(m); simpleAudio.setMuted(m); }}>
            {muted ? "MUTED" : "MUTE"}
          </button>
        </div>
      </header>

      {showRithmicCfg && source === "rithmic" && (
        <div className="panel p-3">
          <RithmicLoginForm rithmic={rithmic} setRithmic={setRithmic} />
          <div className="pt-2">
            <button className="btn btn-active" onClick={() => { setShowRithmicCfg(false); connect(source, symbol); }}>
              Save & reconnect
            </button>
            <span className="text-[10px] text-muted ml-2">Stored in localStorage on this device only.</span>
          </div>
        </div>
      )}

      {source === "rithmic" && symbol && SYMBOL_LABELS[symbol] && (
        <div className="text-[11px] text-muted px-2">{SYMBOL_LABELS[symbol]}{rithmic.contract ? ` · contract ${rithmic.contract}` : ""}</div>
      )}

      {status === "open" && msgCount === 0 && source !== "rithmic" && (
        <div className="text-[11px] text-accent px-2">
          Connected but no data — your region/carrier may block this exchange. Try another source.
        </div>
      )}

      {lastDebug && <div className="text-[10px] text-muted px-1 break-all">debug: {lastDebug} · build {BUILD}</div>}

      <PriceLadder trades={trades} lastPrice={lastPrice} tickSize={tickValue} windowMs={LADDER_WINDOW_MS} rows={19} />

      {err && <div className="text-xs text-sell">{err}</div>}
    </div>
  );
}

function RithmicLoginForm({ rithmic, setRithmic }: { rithmic: RithmicLogin; setRithmic: (r: RithmicLogin) => void }) {
  const set = (patch: Partial<RithmicLogin>) => setRithmic({ ...rithmic, ...patch });
  return (
    <div className="space-y-2 text-left">
      <div className="text-accent font-bold text-xs">Rithmic login</div>
      <p className="text-[11px] text-muted">
        Connects in-browser to Rithmic's WebSocket gateway (Protocol Buffers).
        You need a free paper-trading account at <a className="underline" href="https://yyy3.rithmic.com" target="_blank" rel="noreferrer">yyy3.rithmic.com</a> and the MSPA accepted in R-Trader.
      </p>
      <Row label="Mode">
        <select value={rithmic.mode} onChange={e => set({ mode: e.target.value as "direct" | "bridge" })}
                className="bg-panel2 border border-border rounded px-2 py-1">
          <option value="direct">Direct (browser → Rithmic WSS)</option>
          <option value="bridge">Bridge (local relay)</option>
        </select>
      </Row>
      {rithmic.mode === "direct" ? (
        <>
          <Row label="Gateway">
            <select value={rithmic.gateway} onChange={e => set({ gateway: e.target.value as RithmicGateway })}
                    className="bg-panel2 border border-border rounded px-2 py-1">
              <option value="test">Test / Paper (rprotocol-mobile)</option>
              <option value="chicago">Chicago (rprotocol)</option>
              <option value="europe">Europe (rprotocol-europe)</option>
            </select>
          </Row>
          <Row label="System">
            <input value={rithmic.system} onChange={e => set({ system: e.target.value })}
                   placeholder="Rithmic Paper Trading"
                   className="bg-panel2 border border-border rounded px-2 py-1 w-full" />
          </Row>
          <Row label="User">
            <input value={rithmic.user} onChange={e => set({ user: e.target.value })}
                   className="bg-panel2 border border-border rounded px-2 py-1 w-full" />
          </Row>
          <Row label="Password">
            <input type="password" value={rithmic.password} onChange={e => set({ password: e.target.value })}
                   className="bg-panel2 border border-border rounded px-2 py-1 w-full" />
          </Row>
          <Row label="Exchange">
            <select value={rithmic.exchange} onChange={e => set({ exchange: e.target.value })}
                    className="bg-panel2 border border-border rounded px-2 py-1">
              {["CME", "CBOT", "NYMEX", "COMEX"].map(x => <option key={x} value={x}>{x}</option>)}
            </select>
          </Row>
          <Row label="Contract">
            <input value={rithmic.contract} onChange={e => set({ contract: e.target.value })}
                   placeholder="ESM6 (root + month letter + year digit)"
                   className="bg-panel2 border border-border rounded px-2 py-1 w-full" />
          </Row>
          <p className="text-[10px] text-muted">
            Rithmic needs the exact contract code, not just the root. Month codes: H=Mar, M=Jun, U=Sep, Z=Dec for equity indices; F/G/J/K/N/Q/V/X/Z for energy &amp; metals. e.g. ESM6 = E-mini S&amp;P June 2026.
          </p>
        </>
      ) : (
        <>
          <Row label="Bridge WS URL">
            <input value={rithmic.bridgeUrl} onChange={e => set({ bridgeUrl: e.target.value })}
                   placeholder="ws://localhost:8787/"
                   className="bg-panel2 border border-border rounded px-2 py-1 w-full" />
          </Row>
          <Row label="System">
            <input value={rithmic.system} onChange={e => set({ system: e.target.value })}
                   className="bg-panel2 border border-border rounded px-2 py-1 w-full" />
          </Row>
          <Row label="User">
            <input value={rithmic.user} onChange={e => set({ user: e.target.value })}
                   className="bg-panel2 border border-border rounded px-2 py-1 w-full" />
          </Row>
          <Row label="Password">
            <input type="password" value={rithmic.password} onChange={e => set({ password: e.target.value })}
                   className="bg-panel2 border border-border rounded px-2 py-1 w-full" />
          </Row>
        </>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-2 items-center">
      <label className="text-muted">{label}</label>
      <div>{children}</div>
    </div>
  );
}
