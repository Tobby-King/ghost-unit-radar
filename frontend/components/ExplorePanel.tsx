"use client";

import { fmt, titleCase, uidToIndex, type Band, type Showcase, type Summary, type UnitIndex } from "@/lib/data";
import { CountUp, StatusMark } from "./ui";

export type QuickKey = "all" | "outside" | "stacked" | "field";

const KIND_LABEL: Record<string, string> = {
  outside: "Placed abroad", stack: "Stacked on one point", wrong: "In another state", clock: "Clock audit", register: "Register too large",
};

/** The panel you see before choosing a unit: the headline finding, four figures, and a short list of units worth a look. */
export default function ExplorePanel({ summary, idx, showcase, onQuick, onOpen, ready }: {
  summary: Summary; idx: UnitIndex; showcase: Showcase[]; ready: boolean;
  onQuick: (k: QuickKey) => void; onOpen: (i: number, k: number) => void;
}) {
  const n = summary.national;
  const places = n.top_foreign_places.slice(0, 3).map(([p, c]) => `${p.split(",")[0]} (${fmt(c)})`);
  const figures: { key: QuickKey; value: number; label: string; fact: string; tone?: string }[] = [
    { key: "outside", value: n.outside_nigeria, label: "placed outside Nigeria", tone: "text-field",
      fact: `Most land in ${places.slice(0, -1).join(", ")} and ${places[places.length - 1]}.` },
    { key: "field", value: n.red, label: "need a field check", tone: "text-field", fact: `Another ${fmt(n.amber)} are marked for review.` },
    { key: "stacked", value: n.stacked_units, label: "stacked on one point",
      fact: `Up to ${fmt(n.largest_stack.size)} units share one spot (${titleCase(n.largest_stack.lga)}, ${titleCase(n.largest_stack.state)}).` },
    { key: "all", value: n.with_coordinates, label: "locations checked",
      fact: `${Math.round((n.with_coordinates / n.units) * 100)}% of the ${fmt(n.units)} units on INEC’s list have one.` },
  ];

  return (
    <div className="text-[14px]">
      <div className="px-5 pb-5 pt-5">
        <p className="text-[13px] text-muted">INEC polling-unit list, 2022 · checked against public map data</p>
        <h1 className="mt-2 text-[23px] leading-[1.2]">
          Of <CountUp value={n.units} duration={1400} /> polling units, <span className="text-field"><CountUp value={n.outside_nigeria} delay={500} duration={1500} /></span> are placed outside Nigeria.
        </h1>
        <p className="mt-2.5 leading-relaxed text-ink/80">
          One Kogi State primary school is mapped to Waterloo, Canada. Every published location is checked, so field teams know where to look first.
        </p>
        <button type="button" className="btn-primary press rise mt-4 w-full !rounded-full !py-3 text-[15px]" style={{ animationDelay: "350ms" }} disabled={!ready || !showcase[0]}
          onClick={() => showcase[0] && onOpen(uidToIndex(showcase[0].uid), 0)}>
          Show the school in Canada
        </button>
      </div>

      <ul className="border-t border-line">
        {figures.map((f, k) => (
          <li key={f.key} className="rise border-b border-line" style={{ animationDelay: `${450 + k * 70}ms` }}>
            <button type="button" onClick={() => onQuick(f.key)} className="group flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-raised/60">
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-2">
                  <span className={`font-display text-[21px] leading-none tabular-nums ${f.tone ?? ""}`}><CountUp value={f.value} delay={450 + k * 70} /></span>
                  <span>{f.label}</span>
                </span>
                <span className="mt-0.5 block text-[13px] leading-snug text-muted">{f.fact}</span>
              </span>
              <Chevron />
            </button>
          </li>
        ))}
      </ul>

      <div className="px-5 pb-2 pt-5">
        <h2 className="font-sans text-[15px] font-semibold">Units worth a look</h2>
      </div>
      <ul className="pb-3">
        {showcase.map((s, k) => {
          const i = uidToIndex(s.uid);
          return (
            <li key={s.uid} className="rise" style={{ animationDelay: `${750 + k * 60}ms` }}>
              <button type="button" onClick={() => onOpen(i, k)} className="flex w-full items-start gap-3 px-5 py-2.5 text-left hover:bg-raised/60">
                <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-raised">
                  <StatusMark band={idx.band[i] as Band} size={11} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{KIND_LABEL[s.kind] ?? s.kind} · {titleCase(s.state)}</span>
                  <span className="block text-[13px] leading-snug text-muted">{s.caption}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="border-t border-line px-5 py-4 text-[12px] leading-relaxed text-muted">
        Locations are real public data. Voter registers and result sheets are synthetic. A flag means a unit needs field verification; it is not evidence of wrongdoing.
      </p>
    </div>
  );
}

export function Chevron() {
  return <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m8 5 5 5-5 5" /></svg>;
}
