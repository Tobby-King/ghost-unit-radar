"use client";

import { fmt, titleCase, type Summary } from "@/lib/data";

type Key = "all" | "outside" | "stacked" | "field";

/** Four headline figures, each followed by one specific fact rather than decoration. */
export default function SummaryStrip({ summary, onPick }: { summary: Summary; onPick: (key: Key) => void }) {
  const n = summary.national;
  const places = n.top_foreign_places.slice(0, 3).map(([p, c]) => `${p.split(",")[0]} (${fmt(c)})`);
  const ls = n.largest_stack;
  const items: { key: Key; value: number; title: string; fact: string; tone?: string }[] = [
    { key: "all", value: n.with_coordinates, title: "units checked",
      fact: `${Math.round((n.with_coordinates / n.units) * 100)}% of the ${fmt(n.units)} on INEC’s list have a published location.` },
    { key: "outside", value: n.outside_nigeria, title: "placed outside Nigeria", tone: "text-field",
      fact: `Most land in ${places.slice(0, -1).join(", ")} and ${places[places.length - 1]}.` },
    { key: "stacked", value: n.stacked_units, title: "stacked on one point",
      fact: `The largest stack puts ${fmt(ls.size)} units on one spot in ${titleCase(ls.lga)}, ${titleCase(ls.state)}.` },
    { key: "field", value: n.red, title: "need a field check", tone: "text-field",
      fact: `Another ${fmt(n.amber)} are marked for review. None of this is evidence of wrongdoing.` },
  ];
  return (
    <div className="grid grid-cols-2 border-t border-line bg-bg lg:grid-cols-4">
      {items.map((t, k) => (
        <button key={t.key} type="button" onClick={() => onPick(t.key)}
          className={`group px-4 py-3 text-left hover:bg-surface ${k > 0 ? "lg:border-l lg:border-line" : ""} ${k % 2 ? "border-l border-line" : ""}`}
          aria-label={`${fmt(t.value)} ${t.title}. Show on the map.`}>
          <p className="flex items-baseline gap-2">
            <span className={`font-display text-[24px] leading-none tabular-nums ${t.tone ?? ""}`}>{fmt(t.value)}</span>
            <span className="text-[14px]">{t.title}</span>
          </p>
          <p className="mt-1 text-[13px] leading-snug text-muted">
            {t.fact} <span className="whitespace-nowrap underline-offset-2 group-hover:text-ink group-hover:underline">Show on map</span>
          </p>
        </button>
      ))}
    </div>
  );
}
