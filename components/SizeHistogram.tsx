"use client";
import { useMarket } from "@/lib/store/marketStore";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

export default function SizeHistogram() {
  const { stats, lastTrades } = useMarket();
  if (!stats || lastTrades.length === 0) return <div className="panel p-3 text-xs text-muted">size histogram —</div>;
  const sizes = lastTrades.map(t => t.size).filter(s => s > 0);
  if (!sizes.length) return null;
  const max = Math.max(...sizes);
  const bins = 12;
  const buckets = Array.from({ length: bins }, (_, i) => ({ b: ((i + 0.5) * max / bins).toFixed(2), c: 0 }));
  for (const s of sizes) {
    const idx = Math.min(bins - 1, Math.floor((s / max) * bins));
    buckets[idx].c++;
  }
  const markers = [
    { label: "p25", v: stats.sizeP25 },
    { label: "p75", v: stats.sizeP75 },
    { label: "p95", v: stats.sizeP95 },
    { label: "p99", v: stats.sizeP99 },
  ];
  return (
    <div className="panel p-3">
      <div className="text-xs text-muted mb-1">SIZE DISTRIBUTION (last {sizes.length}, adaptive bands)</div>
      <div className="h-32">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={buckets}>
            <XAxis dataKey="b" tick={{ fontSize: 9, fill: "#6b7280" }} />
            <YAxis tick={{ fontSize: 9, fill: "#6b7280" }} width={20} />
            <Tooltip contentStyle={{ background: "#111114", border: "1px solid #23232b", fontSize: 10 }} />
            <Bar dataKey="c" fill="#f59e0b" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex gap-3 text-[10px] text-muted mt-1">
        {markers.map(m => (
          <span key={m.label}>{m.label}: <span className="text-text tabular-nums">{m.v.toFixed(3)}</span></span>
        ))}
      </div>
    </div>
  );
}
