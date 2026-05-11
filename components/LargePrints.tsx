"use client";
import { useMarket } from "@/lib/store/marketStore";

export default function LargePrints() {
  const { largePrints } = useMarket();
  return (
    <div className="panel p-3 text-xs">
      <div className="text-muted mb-2">LARGE PRINTS</div>
      <div className="space-y-1 max-h-[200px] overflow-auto scrollbar-thin">
        {largePrints.length === 0 && <div className="text-muted">— waiting —</div>}
        {largePrints.map((t, i) => (
          <div key={i} className="flex justify-between">
            <span className={t.side === "buy" ? "text-buy" : "text-sell"}>{t.side.toUpperCase()}</span>
            <span className="tabular-nums">{t.size.toFixed(3)}</span>
            <span className="tabular-nums">{t.price.toFixed(2)}</span>
            <span className="text-muted">{t.tier}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
