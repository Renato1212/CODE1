"use client";
import { useMemo } from "react";

export interface LadderTrade { side: "buy" | "sell"; size: number; price: number; ts: number; }

interface Props {
  trades: LadderTrade[];
  lastPrice: number | null;
  tickSize?: number;        // bin width in price units; auto if undefined
  rows?: number;            // number of price rows to display (centered on last)
  windowMs?: number;        // only count trades within this lookback
}

interface Row {
  price: number;
  buyVol: number;
  sellVol: number;
  ratio: number;  // buyVol / (buyVol + sellVol), or 0.5 if empty
  total: number;
}

export default function PriceLadder({ trades, lastPrice, tickSize, rows = 21, windowMs = 60_000 }: Props) {
  const data = useMemo(() => buildLadder(trades, lastPrice, tickSize, rows, windowMs), [trades, lastPrice, tickSize, rows, windowMs]);
  if (!data) {
    return (
      <div className="panel p-4 text-xs text-muted">price ladder — waiting for trades…</div>
    );
  }
  const { rows: r, tick, maxRowVol, totalBuy, totalSell, currentPrice, imbalancedRows } = data;
  const delta = totalBuy - totalSell;
  const totalVol = totalBuy + totalSell;
  const deltaPct = totalVol > 0 ? (delta / totalVol) * 100 : 0;

  return (
    <div className="panel p-3">
      <div className="flex items-center justify-between mb-2 text-xs">
        <div className="flex gap-3 items-baseline">
          <div className="text-text font-bold">PRICE LADDER</div>
          <div className="text-muted">last <span className="text-text tabular-nums">{currentPrice.toFixed(2)}</span></div>
          <div className="text-muted">tick <span className="text-text tabular-nums">{tick.toFixed(tick < 1 ? 4 : 2)}</span></div>
          <div className="text-muted">window <span className="text-text tabular-nums">{Math.round(windowMs / 1000)}s</span></div>
        </div>
        <div className="flex items-center gap-2">
          <DeltaGauge totalBuy={totalBuy} totalSell={totalSell} />
          <div className={`tabular-nums ${delta >= 0 ? "text-buy" : "text-sell"}`}>
            Δ {delta >= 0 ? "+" : ""}{delta.toFixed(2)} ({deltaPct >= 0 ? "+" : ""}{deltaPct.toFixed(0)}%)
          </div>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_84px_1fr] gap-0 text-[11px]" role="grid">
        <div className="text-right text-buy pb-1 pr-2 border-b border-border">BUY ←</div>
        <div className="text-center text-muted pb-1 border-b border-border">price</div>
        <div className="text-left text-sell pb-1 pl-2 border-b border-border">→ SELL</div>
        {r.map((row) => {
          const isCurrent = Math.abs(row.price - currentPrice) < tick * 0.5;
          const buyW = maxRowVol > 0 ? (row.buyVol / maxRowVol) * 100 : 0;
          const sellW = maxRowVol > 0 ? (row.sellVol / maxRowVol) * 100 : 0;
          const imbalanced = imbalancedRows.has(row.price);
          const buyDominant = imbalanced && row.ratio > 0.7;
          const sellDominant = imbalanced && row.ratio < 0.3;
          return (
            <Row key={row.price}
                 price={row.price}
                 buyVol={row.buyVol}
                 sellVol={row.sellVol}
                 buyW={buyW}
                 sellW={sellW}
                 isCurrent={isCurrent}
                 buyDominant={buyDominant}
                 sellDominant={sellDominant} />
          );
        })}
      </div>

      <div className="flex justify-between text-[10px] text-muted mt-2">
        <span>BUY {totalBuy.toFixed(2)}</span>
        <span className="text-accent">{imbalancedRows.size > 0 ? `${imbalancedRows.size} imbalanced level${imbalancedRows.size === 1 ? "" : "s"} · trading opportunity` : "balanced flow"}</span>
        <span>SELL {totalSell.toFixed(2)}</span>
      </div>
    </div>
  );
}

function Row({ price, buyVol, sellVol, buyW, sellW, isCurrent, buyDominant, sellDominant }:
  { price: number; buyVol: number; sellVol: number; buyW: number; sellW: number; isCurrent: boolean; buyDominant: boolean; sellDominant: boolean; }) {
  const rowBg = isCurrent ? "bg-accent/10" : "";
  const buyBg = buyDominant ? "bg-buy/80 outline outline-1 outline-buy" : "bg-buy/60";
  const sellBg = sellDominant ? "bg-sell/80 outline outline-1 outline-sell" : "bg-sell/60";
  return (
    <>
      <div className={`flex justify-end items-center ${rowBg} pr-1 py-[1px]`}>
        <span className="tabular-nums text-[10px] text-text mr-1">{buyVol > 0 ? buyVol.toFixed(2) : ""}</span>
        <div className={`h-4 ${buyBg} rounded-l`} style={{ width: `${buyW}%`, minWidth: buyVol > 0 ? 2 : 0 }} title={`buy ${buyVol.toFixed(4)}`} />
      </div>
      <div className={`text-center tabular-nums py-[1px] ${rowBg} ${isCurrent ? "text-accent font-bold" : "text-muted"} border-x border-border`}>
        {price.toFixed(2)}{isCurrent ? " ◀" : ""}
      </div>
      <div className={`flex items-center ${rowBg} pl-1 py-[1px]`}>
        <div className={`h-4 ${sellBg} rounded-r`} style={{ width: `${sellW}%`, minWidth: sellVol > 0 ? 2 : 0 }} title={`sell ${sellVol.toFixed(4)}`} />
        <span className="tabular-nums text-[10px] text-text ml-1">{sellVol > 0 ? sellVol.toFixed(2) : ""}</span>
      </div>
    </>
  );
}

function DeltaGauge({ totalBuy, totalSell }: { totalBuy: number; totalSell: number }) {
  const total = totalBuy + totalSell;
  const buyPct = total > 0 ? (totalBuy / total) * 100 : 50;
  return (
    <div className="flex items-center w-32 h-3 rounded overflow-hidden border border-border">
      <div className="h-full bg-buy" style={{ width: `${buyPct}%` }} title={`buy ${buyPct.toFixed(1)}%`} />
      <div className="h-full bg-sell flex-1" title={`sell ${(100 - buyPct).toFixed(1)}%`} />
    </div>
  );
}

function buildLadder(trades: LadderTrade[], lastPrice: number | null, tickSize: number | undefined, rows: number, windowMs: number) {
  if (!lastPrice || !trades.length) return null;
  const now = Date.now();
  const cutoff = now - windowMs;
  const recent = trades.filter(t => t.ts >= cutoff);
  if (!recent.length) return null;
  const prices = recent.map(t => t.price);
  const range = Math.max(...prices) - Math.min(...prices);
  const auto = tickSize ?? autoTick(lastPrice, range, rows);
  const tick = auto;
  const center = Math.round(lastPrice / tick) * tick;
  const half = Math.floor(rows / 2);
  const minP = center - half * tick;
  const maxP = center + half * tick;
  const buckets = new Map<number, { buy: number; sell: number }>();
  for (const t of recent) {
    const k = Math.round(t.price / tick) * tick;
    if (k < minP - tick / 2 || k > maxP + tick / 2) continue;
    const b = buckets.get(k) ?? { buy: 0, sell: 0 };
    if (t.side === "buy") b.buy += t.size; else b.sell += t.size;
    buckets.set(k, b);
  }
  const r: Row[] = [];
  for (let i = rows - 1; i >= 0; i--) {
    const p = minP + i * tick;
    const key = Math.round(p / tick) * tick;
    const b = buckets.get(key) ?? { buy: 0, sell: 0 };
    const total = b.buy + b.sell;
    const ratio = total > 0 ? b.buy / total : 0.5;
    r.push({ price: p, buyVol: b.buy, sellVol: b.sell, ratio, total });
  }
  const maxRowVol = Math.max(1e-9, ...r.flatMap(x => [x.buyVol, x.sellVol]));
  const totalBuy = r.reduce((a, x) => a + x.buyVol, 0);
  const totalSell = r.reduce((a, x) => a + x.sellVol, 0);
  const avgVol = (totalBuy + totalSell) / Math.max(1, r.length);
  const imbalancedRows = new Set<number>();
  for (const row of r) {
    if (row.total > avgVol && (row.ratio > 0.7 || row.ratio < 0.3)) imbalancedRows.add(row.price);
  }
  return { rows: r, tick, maxRowVol, totalBuy, totalSell, currentPrice: lastPrice, imbalancedRows };
}

function autoTick(price: number, range: number, rows: number): number {
  // Aim for the visible range to span ~rows*tick. Round to a "nice" tick.
  const target = Math.max(range / Math.max(1, rows - 1), price * 1e-5);
  const mag = Math.pow(10, Math.floor(Math.log10(target)));
  const norm = target / mag;
  let nice: number;
  if (norm <= 1) nice = 1;
  else if (norm <= 2) nice = 2;
  else if (norm <= 5) nice = 5;
  else nice = 10;
  return nice * mag;
}
