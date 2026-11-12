"use client";

import { fmt, titleCase, type Summary } from "@/lib/data";

type Bar = { label: string; value: number };
interface Tile { key: string; title: string; value: number; sub: string; bars: Bar[]; tone: string; onClick: () => void; meter?: number }

/** Four headline tiles. Each mini chart is a single-hue bar list (one series → no legend);
 *  every bar has a hover title with its exact value, and the headline number is always text. */
export default function SummaryStrip({ summary, onPick }: { summary: Summary; onPick: (key: "all" | "outside" | "stacked" | "field") => void }) {
  const n = summary.national;
  const topStates = (field: string) =>
    Object.entries(summary.states).map(([s, v]) => ({ label: titleCase(s), value: v[field] || 0 }))
      .sort((a, b) => b.value - a.value).slice(0, 5);
  const tiles: Tile[] = [
    { key: "all", title: "Units checked", value: n.with_coordinates, tone: "text-accent-ink",
      sub: `of ${fmt(n.units)} have a published location`, bars: [], meter: n.with_coordinates / n.units, onClick: () => onPick("all") },
    { key: "outside", title: "Outside Nigeria", value: n.outside_nigeria, tone: "text-field",
      sub: "top landing places", bars: n.top_foreign_places.slice(0, 5).map(([label, value]) => ({ label, value })), onClick: () => onPick("outside") },
    { key: "stacked", title: "Stacked on one point", value: n.stacked_units, tone: "text-review",
      sub: `on ${fmt(n.stacked_points)} points · top states`, bars: topStates("STACKED"), onClick: () => onPick("stacked") },
    { key: "field", title: "Need field check", value: n.red, tone: "text-field",
      sub: "◆ field check · top states", bars: topStates("red"), onClick: () => onPick("field") },
  ];
  return (
    <div className="grid grid-cols-2 gap-px border-t border-line bg-line lg:grid-cols-4">
      {tiles.map((t) => <TileView key={t.key} t={t} />)}
    </div>
  );
}

function TileView({ t }: { t: Tile }) {
  const max = Math.max(1, ...t.bars.map((b) => b.value));
  return (
    <button type="button" onClick={t.onClick} className="group flex items-end gap-4 bg-surface px-4 py-3 text-left hover:bg-raised/70"
      aria-label={`${t.title}: ${fmt(t.value)}. Show on map.`}>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">{t.title}</p>
        <p className="mt-1 font-mono text-[22px] leading-none text-ink">{fmt(t.value)}</p>
        <p className="mt-1 truncate text-[11px] text-muted">{t.sub}</p>
      </div>
      {t.meter != null ? (
        <div className="w-24 shrink-0" title={`${(t.meter * 100).toFixed(1)}% have a published location`}>
          <div className="flex h-2 gap-[2px]">
            <div className="rounded-l-[4px] bg-accent" style={{ width: `${t.meter * 100}%` }} />
            <div className="flex-1 rounded-r-[4px] bg-line" />
          </div>
          <p className="mt-1 text-right font-mono text-[11px] text-muted">{(t.meter * 100).toFixed(0)}%</p>
        </div>
      ) : (
        <div className="hidden w-28 shrink-0 space-y-[3px] sm:block" aria-hidden="true">
          {t.bars.map((b) => (
            <div key={b.label} className="flex items-center gap-1.5" title={`${b.label}: ${fmt(b.value)}`}>
              <div className="h-[5px] rounded-r-[3px] bg-muted/60 group-hover:bg-accent/80" style={{ width: `${Math.max(4, (b.value / max) * 100)}%` }} />
            </div>
          ))}
        </div>
      )}
    </button>
  );
}
