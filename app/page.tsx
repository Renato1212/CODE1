"use client";
import { useEffect, useRef, useState } from "react";
import {
  FeedClient, type FeedSource, type RithmicConfig,
  CRYPTO_SYMBOLS, CME_SYMBOLS, SYMBOL_LABELS,
} from "@/lib/data/feeds";
import { RithmicClient, type RithmicGateway } from "@/lib/data/rithmic/client";
import {
  RITHMIC_PROVIDERS, guessProviderFromUser, guessFrontMonth,
  type RithmicProvider,
} from "@/lib/data/rithmic/providers";
import { simpleAudio } from "@/lib/audio/simple";
import PriceLadder from "@/components/PriceLadder";

const BUILD = "v8-rithmic-rawhex-2026-05-11";
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
  provider: RithmicProvider;
  gateway: RithmicGateway;
  system: string;
  appName: string;
  appVersion: string;
  user: string;
  password: string;
  exchange: string;
  contract: string;
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
    const raw = localStorage.getItem("tapefeel:rithmic3");
    if (raw) return { ...blankRithmic(), ...JSON.parse(raw) };
  } catch {}
  return blankRithmic();
}
function blankRithmic(): RithmicLogin {
  const p = RITHMIC_PROVIDERS["rithmic-paper"];
  return {
    provider: "rithmic-paper",
    gateway: p.gateway, system: p.system,
    appName: p.appName, appVersion: p.appVersion,
    user: "", password: "",
    exchange: "CME", contract: "",
    mode: "direct", bridgeUrl: "",
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
    try { localStorage.setItem("tapefeel:rithmic3", JSON.stringify(rithmic)); } catch {}
  }, [rithmic]);

  const resolveContract = (): string => {
    return rithmic.contract.trim() || guessFrontMonth(symbol);
  };

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
      const contract = rithmic.contract.trim() || guessFrontMonth(sym);
      if (rithmic.mode === "direct") {
        if (!rithmic.user || !rithmic.password) {
          setErr("Rithmic user / password required.");
          setShowRithmicCfg(true);
          return;
        }
        setErr(null);
        const r = new RithmicClient(
          {
            gateway: rithmic.gateway, system: rithmic.system,
            user: rithmic.user, password: rithmic.password,
            appName: rithmic.appName, appVersion: rithmic.appVersion,
          },
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
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="panel p-6 max-w-2xl w-full space-y-4">
          <h1 className="text-3xl font-bold text-accent text-center">TapeFeel</h1>
          <p className="text-xs text-muted text-center">Live order-flow audio + price ladder.</p>

          <div className="space-y-3 text-xs">
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
          </div>

          {source === "rithmic" && (
            <RithmicLoginCard rithmic={rithmic} setRithmic={setRithmic} symbol={symbol} />
          )}

          <div className="text-center pt-2">
            <button onClick={start} className="btn btn-active text-base px-8 py-3">
              {source === "rithmic" ? "Connect & Start" : "Start"}
            </button>
          </div>
          <p className="text-[10px] text-muted text-center">Build: {BUILD}</p>
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
          <RithmicLoginCard rithmic={rithmic} setRithmic={setRithmic} symbol={symbol} />
          <div className="pt-2">
            <button className="btn btn-active" onClick={() => { setShowRithmicCfg(false); connect(source, symbol); }}>
              Save & reconnect
            </button>
          </div>
        </div>
      )}

      {source === "rithmic" && symbol && SYMBOL_LABELS[symbol] && (
        <div className="text-[11px] text-muted px-2">
          {SYMBOL_LABELS[symbol]} · contract <span className="text-accent">{rithmic.contract || guessFrontMonth(symbol)}</span> on {rithmic.exchange}
        </div>
      )}

      {status === "open" && msgCount === 0 && source !== "rithmic" && (
        <div className="text-[11px] text-accent px-2">
          Connected but no data — your region/carrier may block this exchange. Try another source.
        </div>
      )}

      {lastDebug && (
        <div className="text-[10px] text-muted px-1 break-all flex items-start gap-2">
          <span className="flex-1">debug: {lastDebug} · build {BUILD}</span>
          {rithmicClientRef.current && (
            <button className="btn shrink-0" onClick={() => {
              const log = rithmicClientRef.current?.rawLog ?? [];
              const text = log.join("\n");
              navigator.clipboard?.writeText(text).catch(() => {});
              setLastDebug(`copied ${log.length} lines of raw protocol trace to clipboard`);
            }}>copy raw trace</button>
          )}
        </div>
      )}

      <PriceLadder trades={trades} lastPrice={lastPrice} tickSize={tickValue} windowMs={LADDER_WINDOW_MS} rows={19} />

      {err && <div className="text-xs text-sell">{err}</div>}
    </div>
  );
}

function RithmicLoginCard({
  rithmic, setRithmic, symbol,
}: { rithmic: RithmicLogin; setRithmic: (r: RithmicLogin) => void; symbol: string; }) {
  const set = (patch: Partial<RithmicLogin>) => setRithmic({ ...rithmic, ...patch });
  const onProvider = (p: RithmicProvider) => {
    const preset = RITHMIC_PROVIDERS[p];
    set({
      provider: p,
      gateway: preset.gateway, system: preset.system,
      appName: preset.appName, appVersion: preset.appVersion,
    });
  };
  const onUserChange = (v: string) => {
    const next: Partial<RithmicLogin> = { user: v };
    // Auto-detect provider from username prefix the first time, only if currently
    // on the default Rithmic Paper preset (so we don't override a manual pick).
    if (rithmic.provider === "rithmic-paper") {
      const guess = guessProviderFromUser(v);
      if (guess) {
        const preset = RITHMIC_PROVIDERS[guess];
        next.provider = guess;
        next.gateway = preset.gateway;
        next.system = preset.system;
        next.appName = preset.appName;
        next.appVersion = preset.appVersion;
      }
    }
    setRithmic({ ...rithmic, ...next });
  };
  const front = rithmic.contract || guessFrontMonth(symbol);
  const presetHint = RITHMIC_PROVIDERS[rithmic.provider]?.hint;

  return (
    <div className="border border-border rounded p-4 bg-panel2 space-y-3 text-xs">
      <div className="flex items-center justify-between">
        <div className="text-accent font-bold text-sm">⚡ Connect to Rithmic</div>
        <span className="text-[10px] text-muted">stored on this device · localStorage</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {(Object.keys(RITHMIC_PROVIDERS) as RithmicProvider[]).map(p => (
          <button key={p}
                  className={`btn text-left ${rithmic.provider === p ? "btn-active" : ""}`}
                  onClick={() => onProvider(p)}>
            {RITHMIC_PROVIDERS[p].label}
          </button>
        ))}
      </div>
      {presetHint && <p className="text-[10px] text-muted">{presetHint}</p>}

      <Row label="Username">
        <input value={rithmic.user} onChange={e => onUserChange(e.target.value)}
               placeholder="e.g. LT-L4X9J9X3"
               className="bg-bg border border-border rounded px-2 py-2 w-full font-mono" />
      </Row>
      <Row label="Password">
        <input type="password" value={rithmic.password} onChange={e => set({ password: e.target.value })}
               placeholder="••••••••••••"
               className="bg-bg border border-border rounded px-2 py-2 w-full font-mono" />
      </Row>

      <details className="text-muted">
        <summary className="cursor-pointer select-none">Advanced (system / gateway / contract / mode)</summary>
        <div className="space-y-2 pt-2">
          <Row label="Mode">
            <select value={rithmic.mode} onChange={e => set({ mode: e.target.value as "direct" | "bridge" })}
                    className="bg-bg border border-border rounded px-2 py-1">
              <option value="direct">Direct (browser → Rithmic WSS)</option>
              <option value="bridge">Bridge (local relay)</option>
            </select>
          </Row>
          {rithmic.mode === "direct" ? (
            <>
              <Row label="Gateway">
                <select value={rithmic.gateway} onChange={e => set({ gateway: e.target.value as RithmicGateway })}
                        className="bg-bg border border-border rounded px-2 py-1">
                  <option value="test">Test / Paper (rprotocol-mobile)</option>
                  <option value="chicago">Chicago (rprotocol)</option>
                  <option value="europe">Europe (rprotocol-europe)</option>
                </select>
              </Row>
              <Row label="System">
                <input value={rithmic.system} onChange={e => set({ system: e.target.value })}
                       className="bg-bg border border-border rounded px-2 py-1 w-full" />
              </Row>
              <Row label="App name">
                <input value={rithmic.appName} onChange={e => set({ appName: e.target.value })}
                       placeholder="Lucid Trading"
                       className="bg-bg border border-border rounded px-2 py-1 w-full font-mono" />
              </Row>
              <Row label="App version">
                <input value={rithmic.appVersion} onChange={e => set({ appVersion: e.target.value })}
                       className="bg-bg border border-border rounded px-2 py-1 w-full font-mono" />
              </Row>
              <p className="text-[10px] text-muted">
                Rithmic only accepts logins from app names allowlisted for your system. If you get
                "permission denied" (close 1011), try alternates like "R | Trader Pro",
                "Rithmic Test", "Quantower", or your platform's exact name.
              </p>
              <Row label="Exchange">
                <select value={rithmic.exchange} onChange={e => set({ exchange: e.target.value })}
                        className="bg-bg border border-border rounded px-2 py-1">
                  {["CME", "CBOT", "NYMEX", "COMEX"].map(x => <option key={x} value={x}>{x}</option>)}
                </select>
              </Row>
              <Row label="Contract">
                <input value={rithmic.contract} onChange={e => set({ contract: e.target.value })}
                       placeholder={`auto: ${front}`}
                       className="bg-bg border border-border rounded px-2 py-1 w-full font-mono" />
              </Row>
              <p className="text-[10px] text-muted">
                Auto-pick uses today's calendar to guess the front-month contract for the selected root.
                Override only if you want a back month.
              </p>
            </>
          ) : (
            <Row label="Bridge WS URL">
              <input value={rithmic.bridgeUrl} onChange={e => set({ bridgeUrl: e.target.value })}
                     placeholder="ws://localhost:8787/"
                     className="bg-bg border border-border rounded px-2 py-1 w-full" />
            </Row>
          )}
        </div>
      </details>

      <p className="text-[10px] text-muted">
        Don't have credentials? Free paper trading at <a className="underline" href="https://yyy3.rithmic.com" target="_blank" rel="noreferrer">yyy3.rithmic.com</a>. MSPA must be accepted once in R-Trader before market data flows.
      </p>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-2 items-center">
      <label className="text-muted">{label}</label>
      <div>{children}</div>
    </div>
  );
}
