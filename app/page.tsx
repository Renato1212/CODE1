"use client";
import { useEffect, useRef, useState } from "react";
import { BinanceClient } from "@/lib/data/binance";
import { useMarket } from "@/lib/store/marketStore";
import { useSettings } from "@/lib/store/settingsStore";
import { audioEngine } from "@/lib/audio/engine";
import type { WorkerIn, WorkerOut, Trade, EnrichedTrade } from "@/lib/types";
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
  const market = useMarket();
  const settings = useSettings();
  const clientRef = useRef<BinanceClient | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const recvMapRef = useRef<Map<number, number>>(new Map());

  // Push detector config to worker when it changes
  useEffect(() => {
    if (!workerRef.current) return;
    const msg: WorkerIn = { type: "config", payload: settings.detector };
    workerRef.current.postMessage(msg);
  }, [settings.detector]);

  const onStart = async () => {
    await audioEngine.start();
    audioEngine.onLatency = (ms) => useMarket.getState().setLatency(ms);
    audioEngine.onSound = (info) => useMarket.getState().pushSound(info.layer, info.detail, info.ts);
    setStarted(true);
    startPipeline(market.symbol);
  };

  const startPipeline = (symbol: string) => {
    // stop old
    if (clientRef.current) clientRef.current.stop();
    if (workerRef.current) workerRef.current.terminate();
    market.reset();

    const worker = new Worker(new URL("../workers/analytics.worker.ts", import.meta.url), { type: "module" });
    workerRef.current = worker;
    worker.postMessage({ type: "config", payload: settings.detector } as WorkerIn);

    worker.onmessage = (e: MessageEvent<WorkerOut>) => {
      const msg = e.data;
      if (msg.type === "stats") {
        useMarket.getState().setStats(msg.payload);
        audioEngine.updateAmbient(msg.payload);
      } else if (msg.type === "trade_enriched") {
        const t = msg.payload as EnrichedTrade;
        const recv = recvMapRef.current.get(t.ts) ?? performance.now();
        recvMapRef.current.delete(t.ts);
        useMarket.getState().pushTrade(t);
        audioEngine.playTrade(t, recv);
      } else if (msg.type === "event") {
        useMarket.getState().pushEvent(msg.payload);
        audioEngine.playEvent(msg.payload);
      }
    };

    const client = new BinanceClient(symbol, {
      onStatus: (s) => useMarket.getState().setStatus(s),
      onTrade: (t: Trade) => {
        recvMapRef.current.set(t.ts, t.recvTs);
        worker.postMessage({ type: "trade", payload: t } as WorkerIn);
      },
      onBook: (b) => worker.postMessage({ type: "book", payload: b } as WorkerIn),
      onDepth: (d) => worker.postMessage({ type: "depth", payload: d } as WorkerIn),
    });
    client.start();
    clientRef.current = client;
  };

  const onChangeSymbol = (s: string) => {
    useMarket.getState().setSymbol(s);
    if (started) startPipeline(s);
  };

  useEffect(() => () => {
    clientRef.current?.stop();
    workerRef.current?.terminate();
  }, []);

  const status = market.status;
  const statusColor = status === "open" ? "bg-buy" : status === "connecting" ? "bg-yellow-500" : status === "stale" ? "bg-orange-500" : "bg-sell";

  if (!started) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="panel p-8 max-w-xl text-center space-y-4">
          <h1 className="text-4xl font-bold">TapeFeel</h1>
          <p className="text-muted">Multi-layer audio sonification of Binance USDT-M perp order flow.</p>
          <p className="text-xs text-muted">
            Stereo: buys right (+0.7), sells left (-0.7). Size-tiered timbres adapt to the live 5-minute distribution.
            Four independent layers: tape, flow events, ambient drone, speech.
          </p>
          <button onClick={onStart} className="btn btn-active text-base px-6 py-3">Start (engage audio)</button>
          <p className="text-[10px] text-muted">Headphones recommended. Click required by browser autoplay policy.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="panel m-3 mb-0 p-2 flex items-center gap-3 text-xs">
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
