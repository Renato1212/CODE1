"use client";
import { useMarket } from "@/lib/store/marketStore";
import { LineChart, Line, ResponsiveContainer } from "recharts";

export default function PriceHeader() {
  const { stats, lastTrades, cvdSpark } = useMarket();
  const last = lastTrades[0];
  const tickSpread = stats ? stats.spread : 0;
  const change1m = stats && stats.vwap1m && last ? ((last.price - stats.vwap1m) / stats.vwap1m) * 100 : 0;
  return (
    <div className="panel p-4 grid grid-cols-2 md:grid-cols-5 gap-4">
      <div>
        <div className="text-xs text-muted">PRICE</div>
        <div className="text-3xl tabular-nums">{last ? last.price.toFixed(2) : "—"}</div>
        <div className={`text-xs ${change1m >= 0 ? "text-buy" : "text-sell"}`}>
          {change1m >= 0 ? "+" : ""}{change1m.toFixed(3)}% 1m
        </div>
      </div>
      <div>
        <div className="text-xs text-muted">SPREAD</div>
        <div className="text-xl tabular-nums">{tickSpread.toFixed(2)}</div>
        <div className="text-xs text-muted">bid {stats?.bid.toFixed(2) ?? "—"} / ask {stats?.ask.toFixed(2) ?? "—"}</div>
      </div>
      <div>
        <div className="text-xs text-muted">CVD (1m / 5m / sess)</div>
        <div className="text-sm tabular-nums">
          <span className={stats && stats.cvd1m >= 0 ? "text-buy" : "text-sell"}>{stats?.cvd1m.toFixed(2) ?? "—"}</span>
          {" / "}
          <span className={stats && stats.cvd5m >= 0 ? "text-buy" : "text-sell"}>{stats?.cvd5m.toFixed(2) ?? "—"}</span>
          {" / "}
          <span className={stats && stats.cvdSession >= 0 ? "text-buy" : "text-sell"}>{stats?.cvdSession.toFixed(0) ?? "—"}</span>
        </div>
        <div className="h-6 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={cvdSpark}>
              <Line type="monotone" dataKey="v" stroke="#f59e0b" strokeWidth={1} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div>
        <div className="text-xs text-muted">TRADES/s</div>
        <div className="text-xl tabular-nums">{stats?.tradesPerSec.toFixed(1) ?? "—"}</div>
      </div>
      <div>
        <div className="text-xs text-muted">VWAP 5m</div>
        <div className="text-xl tabular-nums">{stats && stats.vwap5m ? stats.vwap5m.toFixed(2) : "—"}</div>
        <div className="text-xs text-muted">σ {stats?.std5m.toFixed(2) ?? "—"}</div>
      </div>
    </div>
  );
}
