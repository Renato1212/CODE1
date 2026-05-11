"use client";
import { useMemo } from "react";

interface Trade { side: "buy" | "sell"; size: number; ts: number; price: number; }

export default function SideHistograms({ trades, bins = 12 }: { trades: Trade[]; bins?: number }) {
  const { buyBuckets, sellBuckets, maxCount, edges } = useMemo(() => {
    const sizes = trades.map(t => t.size).filter(s => s > 0);
    if (!sizes.length) return { buyBuckets: [], sellBuckets: [], maxCount: 0, edges: [] as number[] };
    const maxSize = Math.max(...sizes);
    const minSize = Math.min(...sizes);
    // log-spaced bins so dust + whales are both visible
    const logMin = Math.log10(Math.max(minSize, 1e-9));
    const logMax = Math.log10(Math.max(maxSize, 1e-9));
    const span = Math.max(logMax - logMin, 1e-9);
    const edges = Array.from({ length: bins + 1 }, (_, i) => Math.pow(10, logMin + (i / bins) * span));
    const buy = new Array(bins).fill(0);
    const sell = new Array(bins).fill(0);
    for (const t of trades) {
      if (t.size <= 0) continue;
      const lg = Math.log10(Math.max(t.size, 1e-9));
      let idx = Math.floor(((lg - logMin) / span) * bins);
      if (idx < 0) idx = 0;
      if (idx >= bins) idx = bins - 1;
      (t.side === "buy" ? buy : sell)[idx]++;
    }
    const maxCount = Math.max(1, ...buy, ...sell);
    return { buyBuckets: buy, sellBuckets: sell, maxCount, edges };
  }, [trades, bins]);

  const totalBuy = trades.filter(t => t.side === "buy").length;
  const totalSell = trades.filter(t => t.side === "sell").length;

  return (
    <div className="panel p-4">
      <div className="flex justify-between text-xs mb-2">
        <div className="text-buy">BUY orders <span className="tabular-nums">({totalBuy})</span></div>
        <div className="text-muted">size bins (log) — pitch rises with size</div>
        <div className="text-sell">SELL orders <span className="tabular-nums">({totalSell})</span></div>
      </div>
      <div className="grid grid-cols-2 gap-4 h-64">
        <Histogram buckets={buyBuckets} maxCount={maxCount} color="#10b981" align="right" edges={edges} />
        <Histogram buckets={sellBuckets} maxCount={maxCount} color="#ef4444" align="left" edges={edges} />
      </div>
      <div className="flex justify-between text-[10px] text-muted mt-1 tabular-nums">
        <span>{edges[0]?.toFixed(3) ?? "—"}</span>
        <span>{edges[Math.floor(edges.length / 2)]?.toFixed(3) ?? "—"}</span>
        <span>{edges[edges.length - 1]?.toFixed(3) ?? "—"}</span>
      </div>
      <div className="text-[10px] text-muted text-center">order size →</div>
    </div>
  );
}

function Histogram({
  buckets, maxCount, color, align, edges,
}: { buckets: number[]; maxCount: number; color: string; align: "left" | "right"; edges: number[] }) {
  // align "right" mirrors so largest size is in the middle for the buy chart.
  const ordered = align === "right" ? [...buckets].reverse() : buckets;
  const labelEdges = align === "right" ? [...edges].reverse() : edges;
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 flex items-end gap-[2px]">
        {ordered.map((c, i) => {
          const h = maxCount > 0 ? (c / maxCount) * 100 : 0;
          return (
            <div
              key={i}
              className="flex-1 rounded-t"
              style={{ height: `${h}%`, background: color, minHeight: c > 0 ? 2 : 0, opacity: c > 0 ? 0.85 : 0.15 }}
              title={`${labelEdges[i]?.toFixed(3)} – ${labelEdges[i + 1]?.toFixed(3)}: ${c}`}
            />
          );
        })}
      </div>
    </div>
  );
}
