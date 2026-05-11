"use client";
import { useMarket } from "@/lib/store/marketStore";

const EVENT_COLORS: Record<string, string> = {
  sweep: "text-accent",
  iceberg: "text-cyan-400",
  absorption: "text-purple-400",
  cvd_flip: "text-yellow-400",
  volume_burst: "text-pink-400",
  super_whale: "text-red-400",
};

export default function EventLog() {
  const { events, soundLog } = useMarket();
  return (
    <div className="panel p-3 text-xs flex flex-col h-full">
      <div className="text-muted mb-2">EVENT LOG</div>
      <div className="flex-1 overflow-auto scrollbar-thin space-y-1 max-h-[40vh]">
        {events.length === 0 && <div className="text-muted">— no events yet —</div>}
        {events.map((e, i) => (
          <div key={i} className="flex justify-between gap-2 hover:bg-panel2 px-1 rounded">
            <span className={`${EVENT_COLORS[e.type] ?? "text-text"} uppercase tracking-wide`}>{e.type}</span>
            <span className="text-muted">{e.side ?? ""} {e.price?.toFixed(2) ?? ""} {e.detail ?? ""}</span>
            <span className="text-muted tabular-nums">{new Date(e.ts).toLocaleTimeString()}</span>
          </div>
        ))}
      </div>
      <div className="text-muted mt-3 mb-1 border-t border-border pt-2">SOUND LOG (transparency)</div>
      <div className="flex-1 overflow-auto scrollbar-thin space-y-1 max-h-[30vh]">
        {soundLog.map(s => (
          <div key={s.id} className="flex justify-between gap-2 text-[10px]" title={s.detail}>
            <span className="text-accent">{s.layer}</span>
            <span className="text-muted truncate">{s.detail}</span>
            <span className="text-muted tabular-nums">{new Date(s.ts).toLocaleTimeString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
