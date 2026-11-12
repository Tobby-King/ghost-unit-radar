"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BAND_FROM_NAME, LABEL, fmt, getJSON, titleCase, type Findings, type StateFinding, type Summary } from "@/lib/data";
import { CountUp, SourceTag, StatusPill, TopBar } from "./ui";

const MEASURES: { key: keyof StateFinding; label: string; note: string }[] = [
  { key: "outside", label: "Outside Nigeria", note: "Published coordinate falls outside the country" },
  { key: "wrong_state", label: "In a different state", note: "Coordinate falls in another state (3 km border tolerance)" },
  { key: "stacked", label: "Stacked on one point", note: "10 or more units share one exact coordinate" },
  { key: "no_coordinate", label: "No location published", note: "INEC list carries no coordinate" },
];
type SortKey = "score" | "name" | "state";

export default function FindingsView() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [data, setData] = useState<Findings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [measure, setMeasure] = useState<keyof StateFinding>("outside");
  const [hover, setHover] = useState<string | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "score", dir: 1 });

  useEffect(() => {
    Promise.all([getJSON<Summary>("/data/summary.json"), getJSON<Findings>("/data/findings.json")])
      .then(([s, f]) => { setSummary(s); setData(f); })
      .catch((e: Error) => setError(e.message));
  }, []);

  const bars = useMemo(() => (data ? [...data.byState].sort((a, b) => (b[measure] as number) - (a[measure] as number)) : []), [data, measure]);
  const max = Math.max(1, ...bars.map((b) => b[measure] as number));
  const focus = bars.find((b) => b.state === hover) ?? bars[0];
  const rows = useMemo(() => {
    if (!data) return [];
    const r = data.top.map((u, k) => ({ ...u, rank: k + 1 }));
    const val = (u: (typeof r)[number]) => (sort.key === "score" ? u.rank : sort.key === "name" ? u.name : `${u.state} ${u.lga}`);
    return r.sort((a, b) => (val(a) < val(b) ? -1 : val(a) > val(b) ? 1 : 0) * sort.dir);
  }, [data, sort]);
  const n = summary?.national;

  const head: { label: string; value: number | undefined; tone?: string; note?: string }[] = n ? [
    { label: "Polling units", value: n.units, note: "INEC list, 2022" },
    { label: "With a published location", value: n.with_coordinates, note: `${((n.with_coordinates / n.units) * 100).toFixed(0)}% of all units` },
    { label: "Outside Nigeria", value: n.outside_nigeria, tone: "text-field", note: `top: ${n.top_foreign_places[0]?.[0]}` },
    { label: "In a different state", value: n.wrong_state, tone: "text-review" },
    { label: "Stacked on one point", value: n.stacked_units, tone: "text-review", note: `largest stack ${fmt(n.largest_stack.size)} units` },
    { label: "Need field check", value: n.red, tone: "text-field", note: `◆ plus ${fmt(n.amber)} ▲ review` },
  ] : [];

  const SortBtn = ({ k, children }: { k: SortKey; children: React.ReactNode }) => (
    <button type="button" className="inline-flex items-center gap-1 hover:text-ink" onClick={() => setSort((s) => ({ key: k, dir: s.key === k ? (-s.dir as 1 | -1) : 1 }))}>
      {children}<span aria-hidden="true" className={sort.key === k ? "text-ink" : "opacity-30"}>{sort.key === k && sort.dir === -1 ? "↓" : "↑"}</span>
    </button>
  );
  const ariaSort = (k: SortKey) => (sort.key === k ? (sort.dir === 1 ? "ascending" : "descending") : "none");

  return (
    <div className="min-h-dvh">
      <TopBar active="/findings/" />
      <main className="mx-auto max-w-6xl px-4 py-8 md:px-8 md:py-12">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[13px] text-muted">Report · data as published by INEC, 2022</p>
            <h1 className="text-3xl md:text-4xl">Findings</h1>
            <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted">
              Location findings use the real public INEC polling-unit list (2022). Register and result-sheet numbers are synthetic.
              Every flag is a lead for field verification, not a finding of wrongdoing.
            </p>
          </div>
          <a href="/data/field_verification.csv" download="ghost-unit-radar_field-verification.csv" className="btn-primary">
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M10 3v10m0 0-4-4m4 4 4-4M4 16h12" /></svg>
            Download field-verification list (CSV)
          </a>
        </header>

        {error && <p className="mt-6 text-field">Could not load data: {error}</p>}

        <section aria-label="Headline numbers" className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-[6px] border border-line bg-line md:grid-cols-3 lg:grid-cols-6">
          {(head.length ? head : Array.from({ length: 6 }, (): (typeof head)[number] => ({ label: "…", value: undefined }))).map((h, k) => (
            <div key={k} className="bg-surface p-4">
              <p className="text-[13px] text-muted">{h.label}</p>
              <p className="mt-1 font-display text-[28px] leading-none tabular-nums">{h.value == null ? "–" : <CountUp value={h.value} delay={k * 90} />}</p>
              {h.note && <p className="mt-1.5 truncate text-xs text-muted">{h.note}</p>}
            </div>
          ))}
        </section>

        <section className="mt-12" aria-labelledby="by-state">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="by-state" className="text-xl">Location problems by state</h2>
              <p className="mt-1 text-sm text-muted">{MEASURES.find((m) => m.key === measure)?.note}. Real data.</p>
            </div>
            <div role="radiogroup" aria-label="Measure" className="flex flex-wrap gap-1 rounded-[6px] border border-line bg-surface p-1">
              {MEASURES.map((m) => (
                <button key={m.key} type="button" role="radio" aria-checked={measure === m.key} onClick={() => setMeasure(m.key)}
                  className={`rounded-chip px-2.5 py-1.5 text-xs ${measure === m.key ? "bg-ink text-bg" : "text-muted hover:text-ink"}`}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_260px]">
            <ol key={measure} className="panel space-y-[3px] p-4" onMouseLeave={() => setHover(null)}>
              {bars.map((b) => {
                const v = b[measure] as number;
                return (
                  <li key={b.state}>
                    <button type="button" className={`grid w-full grid-cols-[140px_1fr_64px] items-center gap-3 rounded-[4px] px-1 py-[3px] text-left text-xs ${hover === b.state ? "bg-raised" : ""}`}
                      onMouseEnter={() => setHover(b.state)} onFocus={() => setHover(b.state)}
                      aria-label={`${titleCase(b.state)}: ${fmt(v)}`}>
                      <span className="truncate text-muted">{titleCase(b.state)}</span>
                      <span className="flex h-3 items-center">
                        <span className={`grow-x h-3 rounded-r-[4px] transition-colors ${hover === b.state ? "bg-ink" : "bg-ink/55"}`} style={{ width: v ? `${Math.max(0.6, (v / max) * 100)}%` : 0, animationDelay: `${Math.min(bars.indexOf(b), 20) * 25}ms` }} />
                      </span>
                      <span className="text-right tabular-nums text-ink">{fmt(v)}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
            {focus && (
              <aside className="panel h-fit p-4 lg:sticky lg:top-6" aria-live="polite">
                
                <p className="font-display text-lg">{titleCase(focus.state)}</p>
                <dl className="mt-3 space-y-1.5 text-sm">
                  <Row k="Polling units" v={focus.units} />
                  <Row k="With location" v={focus.with_coordinates} />
                  {MEASURES.map((m) => <Row key={m.key} k={m.label} v={focus[m.key] as number} strong={m.key === measure} />)}
                  <Row k="◆ Field check needed" v={focus.red} />
                  <Row k="▲ Review" v={focus.amber} />
                </dl>
              </aside>
            )}
          </div>
        </section>

        <section className="mt-12" aria-labelledby="least">
          <h2 id="least" className="text-xl">The 20 least plausible units</h2>
          <p className="mt-1 text-sm text-muted">Ranked by plausibility score (lowest first). Click a unit to open it on the map.</p>
          <div className="panel mt-5 overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="border-b border-line text-left text-[13px] text-muted">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium" aria-sort={ariaSort("score")}><SortBtn k="score">#</SortBtn></th>
                  <th scope="col" className="px-4 py-3 font-medium" aria-sort={ariaSort("name")}><SortBtn k="name">Polling unit</SortBtn></th>
                  <th scope="col" className="px-4 py-3 font-medium" aria-sort={ariaSort("state")}><SortBtn k="state">State · LGA</SortBtn></th>
                  <th scope="col" className="px-4 py-3 font-medium">Score</th>
                  <th scope="col" className="px-4 py-3 font-medium">Status</th>
                  <th scope="col" className="px-4 py-3 font-medium">Why</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((u) => (
                  <tr key={u.uid} className="border-b border-line align-top last:border-0 hover:bg-raised/50">
                    <td className="px-4 py-3 tabular-nums text-muted">{u.rank}</td>
                    <td className="px-4 py-3">
                      <Link href={`/#${u.uid}`} className="font-medium hover:underline underline-offset-2 hover:text-muted">{titleCase(u.name)}</Link>
                      <div className="font-mono text-xs text-muted">{u.uid}</div>
                    </td>
                    <td className="px-4 py-3">{titleCase(u.state)}<div className="text-xs text-muted">{titleCase(u.lga)}</div></td>
                    <td className="px-4 py-3 tabular-nums">{u.score}</td>
                    <td className="px-4 py-3"><StatusPill band={BAND_FROM_NAME[u.band] ?? 3} /></td>
                    <td className="px-4 py-3">
                      <ul className="space-y-1">
                        {u.reasons.map(([code, src]) => (
                          <li key={code} className="flex items-center gap-2 text-xs"><SourceTag source={src} /> {LABEL[code] ?? code}</li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <footer className="mt-12 border-t border-line pt-6 text-xs leading-relaxed text-muted">
          A flag means a unit needs field verification. It is not evidence of wrongdoing. No INEC system was accessed: only static public files were used.
          See <Link href="/methods/" className="underline underline-offset-2 hover:text-muted">Methods &amp; Ethics</Link>.
        </footer>
      </main>
    </div>
  );
}

function Row({ k, v, strong }: { k: string; v: number; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className={strong ? "text-ink" : "text-muted"}>{k}</dt>
      <dd className={`tabular-nums ${strong ? "font-semibold" : ""}`}>{fmt(v)}</dd>
    </div>
  );
}
