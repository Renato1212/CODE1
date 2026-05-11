"use client";
import { useEffect, useRef, useState } from "react";
import { BinanceClient } from "@/lib/data/binance";
import { simpleAudio } from "@/lib/audio/simple";
import SideHistograms from "@/components/SideHistograms";

const SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT"];
const MAX_TRADES = 500;

interface UiTrade { side: "buy" | "sell"; size: number; ts: number; price: number; }

export default function Page() {
  const [started, setStarted] = useState(false);
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [trades, setTrades] = useState<UiTrade[]>([]);
  const [status, setStatus] = useState<"connecting" | "open" | "closed" | "stale">("closed");
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(0.7);
  const [err, setErr] = useState<string | null>(null);
  const [lastPrice, setLastPrice] = useState<number | null>(null);
  const [msgCount, setMsgCount] = useState(0);
  const [lastDebug, setLastDebug] = useState<string>("");
  const clientRef = useRef<BinanceClient | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = async (sym: string) => {
    try {
      await simpleAudio.start();
      setStarted(true);
      connect(sym);
    } catch (e: any) {
      setErr(`Audio failed: ${e?.message ?? e}`);
    }
  };

  const connect = (sym: string) => {
    clientRef.current?.stop();
    setTrades([]);
    setLastPrice(null);
    setMsgCount(0);
    const c = new BinanceClient(sym, {
      onStatus: setStatus,
      onDebug: (m) => setLastDebug(m),
      onTrade: (t) => {
        simpleAudio.play(t.side, t.size);
        setLastPrice(t.price);
        setTrades(prev => {
          const next = [...prev, { side: t.side, size: t.size, ts: t.ts, price: t.price }];
          if (next.length > MAX_TRADES) next.splice(0, next.length - MAX_TRADES);
          return next;
        });
      },
    });
    c.start();
    clientRef.current = c;
    // Poll the client's internal counters so msgCount appears in the UI
    // even before the first parsable trade lands.
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = setInterval(() => {
      setMsgCount(c.msgCount);
    }, 500);
  };

  const onSymbol = (s: string) => {
    setSymbol(s);
    if (started) connect(s);
  };

  useEffect(() => () => {
    clientRef.current?.stop();
    if (tickRef.current) clearInterval(tickRef.current);
  }, []);

  const statusColor =
    status === "open" ? "bg-buy" :
    status === "connecting" ? "bg-yellow-500" :
    status === "stale" ? "bg-orange-500" : "bg-sell";

  if (!started) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="panel p-8 max-w-xl text-center space-y-4">
          <h1 className="text-4xl font-bold text-accent">TapeFeel</h1>
          <p className="text-muted">Hear every Binance USDT-M perp market order.</p>
          <ul className="text-xs text-muted text-left list-disc pl-6 space-y-1">
            <li>Buy market orders → bright triangle, panned right (+0.7)</li>
            <li>Sell market orders → dark sawtooth, panned left (−0.7)</li>
            <li>Larger order → higher pitch (log-scaled, auto-calibrated)</li>
            <li>Side-by-side histograms of recent buy vs sell order sizes</li>
          </ul>
          <button onClick={() => start(symbol)} className="btn btn-active text-base px-6 py-3">Start</button>
          <p className="text-[10px] text-muted">Headphones recommended. Click required by browser autoplay policy.</p>
          {err && <p className="text-xs text-sell">{err}</p>}
        </div>
      </div>
    );
  }

  const totalBuy = trades.filter(t => t.side === "buy").length;
  const totalSell = trades.filter(t => t.side === "sell").length;

  return (
    <div className="min-h-screen flex flex-col gap-3 p-3">
      <header className="panel p-3 flex items-center gap-4 text-xs flex-wrap">
        <span className="text-lg font-bold text-accent">TapeFeel</span>
        <select value={symbol} onChange={e => onSymbol(e.target.value)}
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

      {lastDebug && <div className="text-[10px] text-muted px-1 break-all">debug: {lastDebug}</div>}

      <SideHistograms trades={trades} bins={14} />

      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="panel p-3">
          <div className="text-buy mb-1">recent BUYS ({totalBuy})</div>
          <div className="space-y-[2px] max-h-40 overflow-auto scrollbar-thin">
            {trades.filter(t => t.side === "buy").slice(-15).reverse().map((t, i) => (
              <div key={i} className="flex justify-between">
                <span className="tabular-nums">{t.size.toFixed(4)}</span>
                <span className="tabular-nums text-muted">@ {t.price.toFixed(2)}</span>
                <span className="text-muted">{new Date(t.ts).toLocaleTimeString()}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="panel p-3">
          <div className="text-sell mb-1">recent SELLS ({totalSell})</div>
          <div className="space-y-[2px] max-h-40 overflow-auto scrollbar-thin">
            {trades.filter(t => t.side === "sell").slice(-15).reverse().map((t, i) => (
              <div key={i} className="flex justify-between">
                <span className="tabular-nums">{t.size.toFixed(4)}</span>
                <span className="tabular-nums text-muted">@ {t.price.toFixed(2)}</span>
                <span className="text-muted">{new Date(t.ts).toLocaleTimeString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {err && <div className="text-xs text-sell">{err}</div>}
    </div>
  );
}
