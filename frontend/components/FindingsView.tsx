"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BAND_FROM_NAME, LABEL, fmt, getJSON, titleCase, type Findings, type StateFinding, type Summary } from "@/lib/data";
import { CountUp, Icon, StatusPill, TopBar } from "./ui";

const MEASURES: { key: keyof StateFinding; label: string; note: string }[] = [
  { key: "outside", label: "Abroad", note: "Published coordinate falls outside the country" },
  { key: "wrong_state", label: "Wrong state", note: "Coordinate falls in another state (3 km border tolerance)" },
  { key: "stacked", label: "Stacked", note: "10 or more units share one exact coordinate" },
  { key: "no_coordinate", label: "No location", note: "INEC list carries no coordinate" },
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

  const head: { label: string; value: number | undefined; tone?: string }[] = n ? [
    { label: "Polling units", value: n.units },
    { label: "With a location", value: n.with_coordinates },
    { label: "Outside Nigeria", value: n.outside_nigeria, tone: "text-field" },
    { label: "Wrong state", value: n.wrong_state, tone: "text-review" },
    { label: "Stacked", value: n.stacked_units, tone: "text-review" },
    { label: "Field checks", value: n.red, tone: "text-field" },
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
      <main className="mx-auto max-w-6xl px-4 pb-16 pt-12 md:px-8 md:pt-20">
        <header className="rise text-center">
          <p className="eyebrow">INEC polling-unit list · 2022</p>
          <h1 className="mx-auto mt-3 max-w-3xl text-[44px] leading-[1.05] md:text-[64px]">Findings.</h1>
          <p className="mx-auto mt-4 max-w-xl text-[19px] leading-snug text-muted md:text-[21px]">
            Where the published locations don’t add up.
          </p>
          <a href="/data/field_verification.csv" download="ghost-unit-radar_field-verification.csv" className="btn-primary press mt-7">
            <Icon name="download" className="h-[18px] w-[18px]" strokeWidth={2} />
            Field-verification list
          </a>
        </header>

        {error && <p className="mt-6 text-center text-field">Could not load data: {error}</p>}

        <section aria-label="Headline numbers" className="mt-14 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {(head.length ? head : Array.from({ length: 6 }, (): (typeof head)[number] => ({ label: "…", value: undefined }))).map((h, k) => (
            <div key={k} className="panel rise p-5" style={{ animationDelay: `${120 + k * 60}ms` }}>
              <p className={`text-[30px] font-bold leading-none tracking-tight tabular-nums ${h.tone ?? ""}`}>{h.value == null ? "–" : <CountUp value={h.value} delay={k * 90} />}</p>
              <p className="mt-2 text-[13px] font-medium text-muted">{h.label}</p>
            </div>
          ))}
        </section>

        <section className="mt-20" aria-labelledby="by-state">
          <div className="flex flex-col items-center gap-5 text-center">
            <h2 id="by-state" className="text-[32px] md:text-[40px]">By state.</h2>
            <div role="radiogroup" aria-label="Measure" className="inline-flex flex-wrap justify-center gap-0.5 rounded-full bg-line/50 p-1">
              {MEASURES.map((m) => (
                <button key={m.key} type="button" role="radio" aria-checked={measure === m.key} onClick={() => setMeasure(m.key)} title={m.note}
                  className={`rounded-full px-4 py-1.5 text-[13px] font-semibold transition-all ${measure === m.key ? "bg-surface text-ink shadow-[0_2px_8px_rgb(0_0_0/.12)]" : "text-muted hover:text-ink"}`}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-8 grid gap-4 lg:grid-cols-[1fr_280px]">
            <ol key={measure} className="panel space-y-[3px] p-5" onMouseLeave={() => setHover(null)}>
              {bars.map((b) => {
                const v = b[measure] as number;
                return (
                  <li key={b.state}>
                    <button type="button" className={`grid w-full grid-cols-[130px_1fr_60px] items-center gap-3 rounded-[8px] px-2 py-[3px] text-left text-[13px] ${hover === b.state ? "bg-raised" : ""}`}
                      onMouseEnter={() => setHover(b.state)} onFocus={() => setHover(b.state)}
                      aria-label={`${titleCase(b.state)}: ${fmt(v)}`}>
                      <span className="truncate text-muted">{titleCase(b.state)}</span>
                      <span className="flex h-2.5 items-center">
                        <span className={`grow-x h-2.5 rounded-full transition-colors ${hover === b.state ? "bg-field" : "bg-ink/70"}`} style={{ width: v ? `${Math.max(0.8, (v / max) * 100)}%` : 0, animationDelay: `${Math.min(bars.indexOf(b), 20) * 25}ms` }} />
                      </span>
                      <span className="text-right font-semibold tabular-nums">{fmt(v)}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
            {focus && (
              <aside className="panel h-fit p-5 lg:sticky lg:top-20" aria-live="polite">
                <p className="text-[22px] font-bold tracking-tight">{titleCase(focus.state)}</p>
                <p className="text-[13px] text-muted">{fmt(focus.units)} polling units</p>
                <dl className="mt-4 space-y-2 text-[14px]">
                  <Row k="With location" v={focus.with_coordinates} />
                  {MEASURES.map((m) => <Row key={m.key} k={m.label} v={focus[m.key] as number} strong={m.key === measure} />)}
                  <Row k="Field checks" v={focus.red} />
                  <Row k="Review" v={focus.amber} />
                </dl>
              </aside>
            )}
          </div>
        </section>

        <section className="mt-20" aria-labelledby="least">
          <h2 id="least" className="text-center text-[32px] md:text-[40px]">Least plausible.</h2>
          <p className="mt-2 text-center text-[17px] text-muted">The 20 lowest scores. Tap one to see it on the map.</p>
          <div className="panel mt-8 overflow-x-auto">
            <table className="w-full min-w-[720px] text-[14px]">
              <thead className="text-left text-[12px] font-semibold uppercase tracking-[0.05em] text-muted">
                <tr>
                  <th scope="col" className="px-5 py-4" aria-sort={ariaSort("score")}><SortBtn k="score">#</SortBtn></th>
                  <th scope="col" className="px-5 py-4" aria-sort={ariaSort("name")}><SortBtn k="name">Unit</SortBtn></th>
                  <th scope="col" className="px-5 py-4" aria-sort={ariaSort("state")}><SortBtn k="state">State</SortBtn></th>
                  <th scope="col" className="px-5 py-4">Score</th>
                  <th scope="col" className="px-5 py-4">Why</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((u) => (
                  <tr key={u.uid} className="border-t border-line/70 align-top hover:bg-raised/60">
                    <td className="px-5 py-3.5 tabular-nums text-muted">{u.rank}</td>
                    <td className="px-5 py-3.5">
                      <Link href={`/#${u.uid}`} className="font-semibold hover:text-accent-ink">{titleCase(u.name)}</Link>
                      <div className="mt-0.5"><StatusPill band={BAND_FROM_NAME[u.band] ?? 3} /></div>
                    </td>
                    <td className="px-5 py-3.5">{titleCase(u.state)}<div className="text-[12px] text-muted">{titleCase(u.lga)}</div></td>
                    <td className="px-5 py-3.5 text-[17px] font-bold tabular-nums">{u.score}</td>
                    <td className="px-5 py-3.5">
                      <ul className="flex flex-wrap gap-1.5">
                        {u.reasons.map(([code, src]) => (
                          <li key={code} className={`rounded-full px-2.5 py-0.5 text-[12px] font-medium ${src.toUpperCase().startsWith("SYN") ? "bg-review/[.12] text-review" : "bg-raised"}`}
                            title={src.toUpperCase().startsWith("SYN") ? "Synthetic data" : "Real public data"}>{LABEL[code] ?? code}</li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-center text-[12px] text-muted"><span className="rounded-full bg-review/[.12] px-2 py-0.5 font-semibold text-review">Orange</span> tags use synthetic data. Grey tags use real public data.</p>
        </section>

        <footer className="mt-20 text-center text-[12px] leading-relaxed text-muted">
          A flag means “check in the field”, not wrongdoing. No INEC system was accessed. ·{" "}
          <Link href="/methods/" className="text-accent-ink hover:underline">Methods &amp; ethics</Link>
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
