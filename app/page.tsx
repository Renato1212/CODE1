"use client";
import { useEffect, useRef, useState } from "react";
import { FeedClient, type FeedSource } from "@/lib/data/feeds";
import { simpleAudio } from "@/lib/audio/simple";
import PriceLadder from "@/components/PriceLadder";

const BUILD = "v3-ladder-2026-05-11";
const SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT"];
const SOURCES: { value: FeedSource; label: string }[] = [
  { value: "binance", label: "Binance Futures" },
  { value: "coinbase", label: "Coinbase Spot" },
  { value: "bybit", label: "Bybit Futures" },
];
const MAX_TRADES = 2000;
const LADDER_WINDOW_MS = 60_000;
const IMBALANCE_COOLDOWN_MS = 4000;

interface UiTrade { side: "buy" | "sell"; size: number; ts: number; price: number; }

export default function Page() {
  const [started, setStarted] = useState(false);
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [source, setSource] = useState<FeedSource>("binance");
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
  const clientRef = useRef<FeedClient | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastTradeTsRef = useRef<number>(0);
  const lastAlertTsRef = useRef<{ buy: number; sell: number }>({ buy: 0, sell: 0 });
  const rollingDeltaRef = useRef<{ buyVol: number; sellVol: number; ts: number }[]>([]);

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

  const connect = (src: FeedSource, sym: string) => {
    clientRef.current?.stop();
    setTrades([]);
    setLastPrice(null);
    setMsgCount(0);
    setLastDebug("");
    lastTradeTsRef.current = 0;
    rollingDeltaRef.current = [];
    const c = new FeedClient(src, sym, {
      onStatus: setStatus,
      onDebug: setLastDebug,
      onTrade: (t) => {
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
      },
    });
    c.start();
    clientRef.current = c;
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = setInterval(() => {
      setMsgCount(c.msgCount);
      setLastTradeAge(lastTradeTsRef.current ? Date.now() - lastTradeTsRef.current : 0);
    }, 500);
  };

  const onChange = (src: FeedSource, sym: string) => {
    setSource(src);
    setSymbol(sym);
    if (started) connect(src, sym);
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
    const basePrice = lastPrice ?? 100_000;
    const price = basePrice + (Math.random() - 0.5) * 20;
    simpleAudio.play(side, size);
    setLastPrice(price);
    const ui = { side, size, price, ts: Date.now() };
    setTrades(prev => {
      const next = [...prev, ui];
      if (next.length > MAX_TRADES) next.splice(0, next.length - MAX_TRADES);
      return next;
    });
    checkImbalance(ui);
  };

  useEffect(() => () => {
    clientRef.current?.stop();
    if (tickRef.current) clearInterval(tickRef.current);
  }, []);

  const statusColor =
    status === "open" ? "bg-buy" :
    status === "connecting" ? "bg-yellow-500" :
    status === "stale" ? "bg-orange-500" : "bg-sell";

  const tickValue = tickOverride === "auto" ? undefined : parseFloat(tickOverride);

  if (!started) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="panel p-8 max-w-xl text-center space-y-4">
          <h1 className="text-4xl font-bold text-accent">TapeFeel</h1>
          <p className="text-muted">Live order-flow audio + price ladder.</p>
          <ul className="text-xs text-muted text-left list-disc pl-6 space-y-1">
            <li><span className="text-buy">Buys</span> — bright FM bell, upward glide, right pan</li>
            <li><span className="text-sell">Sells</span> — dark triangle thud + noise burst, left pan</li>
            <li>Bigger orders → higher pitch (buys) / deeper thud (sells)</li>
            <li>Price-ladder histogram: buy vs sell volume at each price level</li>
            <li>Two-tone "ding-ding" alert when one side dominates flow ≥ 80%</li>
          </ul>
          <div className="text-xs text-muted">
            Source:&nbsp;
            <select value={source} onChange={e => setSource(e.target.value as FeedSource)}
                    className="bg-panel2 border border-border rounded px-2 py-1">
              {SOURCES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <button onClick={start} className="btn btn-active text-base px-6 py-3">Start</button>
          <p className="text-[10px] text-muted">Headphones recommended. Build: {BUILD}</p>
          {err && <p className="text-xs text-sell">{err}</p>}
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
        <select value={source} onChange={e => onChange(e.target.value as FeedSource, symbol)}
                className="bg-panel2 border border-border rounded px-2 py-1">
          {SOURCES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select value={symbol} onChange={e => onChange(source, e.target.value)}
                className="bg-panel2 border border-border rounded px-2 py-1">
          {SYMBOLS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
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
          <option value="0.1">0.1</option>
          <option value="0.5">0.5</option>
          <option value="1">1</option>
          <option value="5">5</option>
          <option value="10">10</option>
          <option value="25">25</option>
          <option value="50">50</option>
          <option value="100">100</option>
        </select>
        <button className="btn" onClick={testSound} title="Play all four sound types">test audio</button>
        <button className="btn" onClick={fakeTrade} title="Simulate a random trade">test trade</button>
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

      {status === "open" && msgCount === 0 && (
        <div className="text-[11px] text-accent px-2">
          Connected but no data — your region/carrier may block this exchange. Try Coinbase or Bybit from the dropdown.
        </div>
      )}

      {lastDebug && <div className="text-[10px] text-muted px-1 break-all">debug: {lastDebug} · build {BUILD}</div>}

      <PriceLadder trades={trades} lastPrice={lastPrice} tickSize={tickValue} windowMs={LADDER_WINDOW_MS} rows={19} />

      {err && <div className="text-xs text-sell">{err}</div>}
    </div>
  );
}
