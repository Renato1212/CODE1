"use client";
import { useEffect, useRef, useState } from "react";
import { BinanceClient } from "@/lib/data/binance";
import { useMarket } from "@/lib/store/marketStore";
import { useSettings } from "@/lib/store/settingsStore";
import { audioEngine } from "@/lib/audio/engine";
import { AnalyticsEngine } from "@/lib/analytics/engine";
import PriceHeader from "@/components/PriceHeader";
import Mixer from "@/components/Mixer";
import EventLog from "@/components/EventLog";
import SizeHistogram from "@/components/SizeHistogram";
import LargePrints from "@/components/LargePrints";
import SoundLegend from "@/components/SoundLegend";

const SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT"];

export default function Page() {
  const [started, setStarted] = useState(false);
  const [mixerOpen, setMixerOpen] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const market = useMarket();
  const settings = useSettings();
  const clientRef = useRef<BinanceClient | null>(null);
  const analyticsRef = useRef<AnalyticsEngine | null>(null);
  const recvMapRef = useRef<Map<number, number>>(new Map());

  // Push detector config when it changes
  useEffect(() => {
    analyticsRef.current?.setConfig(settings.detector);
  }, [settings.detector]);

  const onStart = async () => {
    try {
      await audioEngine.start();
      audioEngine.onLatency = (ms) => useMarket.getState().setLatency(ms);
      audioEngine.onSound = (info) => useMarket.getState().pushSound(info.layer, info.detail, info.ts);
      setStarted(true);
      startPipeline(market.symbol);
    } catch (e: any) {
      setErr(`Audio engine failed to start: ${e?.message ?? e}`);
    }
  };

  const startPipeline = (symbol: string) => {
    try {
      if (clientRef.current) clientRef.current.stop();
      analyticsRef.current?.stop();
      useMarket.getState().reset();

      const analytics = new AnalyticsEngine({
        onStats: (s) => {
          useMarket.getState().setStats(s);
          audioEngine.updateAmbient(s);
        },
        onTrade: (t) => {
          const recv = recvMapRef.current.get(t.ts) ?? performance.now();
          recvMapRef.current.delete(t.ts);
          useMarket.getState().pushTrade(t);
          audioEngine.playTrade(t, recv);
        },
        onEvent: (e) => {
          useMarket.getState().pushEvent(e);
          audioEngine.playEvent(e);
        },
      });
      analytics.setConfig(settings.detector);
      analytics.start();
      analyticsRef.current = analytics;

      const client = new BinanceClient(symbol, {
        onStatus: (s) => useMarket.getState().setStatus(s),
        onTrade: (t) => {
          recvMapRef.current.set(t.ts, t.recvTs);
          analytics.pushTrade(t);
        },
        onBook: (b) => analytics.pushBook(b),
        onDepth: () => { /* reserved */ },
      });
      client.start();
      clientRef.current = client;
    } catch (e: any) {
      setErr(`Pipeline error: ${e?.message ?? e}`);
    }
  };

  const onChangeSymbol = (s: string) => {
    useMarket.getState().setSymbol(s);
    if (started) startPipeline(s);
  };

  useEffect(() => () => {
    clientRef.current?.stop();
    analyticsRef.current?.stop();
  }, []);

  const status = market.status;
  const statusColor =
    status === "open" ? "bg-buy" :
    status === "connecting" ? "bg-yellow-500" :
    status === "stale" ? "bg-orange-500" : "bg-sell";

  if (!started) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="panel p-8 max-w-xl text-center space-y-4">
          <h1 className="text-4xl font-bold text-accent">TapeFeel</h1>
          <p className="text-muted">Multi-layer audio sonification of Binance USDT-M perp order flow.</p>
          <p className="text-xs text-muted">
            Stereo: buys right (+0.7), sells left (−0.7). Size-tiered timbres adapt to the live 5-minute distribution.
            Four independent layers: tape, flow events, ambient drone, speech.
          </p>
          <button onClick={onStart} className="btn btn-active text-base px-6 py-3">Start (engage audio)</button>
          <p className="text-[10px] text-muted">Headphones recommended. Click required by browser autoplay policy.</p>
          {err && <p className="text-xs text-sell">{err}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="panel m-3 mb-0 p-2 flex items-center gap-3 text-xs flex-wrap">
        <span className="text-lg font-bold text-accent">TapeFeel</span>
        <select value={market.symbol} onChange={e => onChangeSymbol(e.target.value)}
                className="bg-panel2 border border-border rounded px-2 py-1">
          {SYMBOLS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <div className="flex items-center gap-1">
          <span className={`dot ${statusColor}`} />
          <span className="text-muted">{status}</span>
        </div>
        <div className="text-muted">latency: <span className={market.latencyMs < 50 ? "text-buy" : "text-sell"}>{market.latencyMs.toFixed(1)}ms</span></div>
        {err && <div className="text-sell">{err}</div>}
        <div className="ml-auto flex items-center gap-2">
          <SoundLegend />
          <button className="btn" onClick={() => setMixerOpen(v => !v)}>{mixerOpen ? "hide mixer" : "show mixer"}</button>
        </div>
      </header>

      <main className="flex-1 grid gap-3 p-3" style={{ gridTemplateColumns: mixerOpen ? "260px 1fr 320px" : "1fr 320px" }}>
        {mixerOpen && <aside><Mixer /></aside>}
        <section className="space-y-3 min-w-0">
          <PriceHeader />
          <SizeHistogram />
          <LargePrints />
        </section>
        <aside><EventLog /></aside>
      </main>
    </div>
  );
}
