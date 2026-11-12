"use client";

import { useMemo } from "react";
import { CHECKS, STATUS, fmt, titleCase, type Summary, type UnitIndex } from "@/lib/data";

export interface Filters { state: number; lga: number; bands: [boolean, boolean, boolean, boolean]; check: string; q: string }
export const DEFAULT_FILTERS: Filters = { state: -1, lga: -1, bands: [true, true, true, true], check: "", q: "" };
export interface Counts { matched: number; mapped: number; outside: number; byBand: [number, number, number, number] }

interface Props {
  idx: UnitIndex;
  summary: Summary;
  filters: Filters;
  setFilters: (f: Filters) => void;
  counts: Counts;
  spv: number;
  setSpv: (n: number) => void;
  searching: boolean;
  listSize: number;
  onDownloadList: () => void;
  onClearList: () => void;
  onStrangest: () => void;
  results: { i: number; band: number; name: string; sub: string }[];
  onPickResult: (i: number) => void;
}

const TONE = ["text-ok", "text-review", "text-field", "text-none"];

export default function FilterPanel({ idx, summary, filters: f, setFilters, counts, spv, setSpv, searching, listSize, onDownloadList, onClearList, onStrangest, results, onPickResult }: Props) {
  const noCoord = useMemo(() => new Set(summary.no_coordinate_states), [summary]);
  const lgaOptions = useMemo(
    () => (f.state < 0 ? [] : idx.lgas.map(([s, name], k) => ({ s, name, k })).filter((x) => x.s === f.state).sort((a, b) => a.name.localeCompare(b.name))),
    [idx, f.state],
  );
  const set = (p: Partial<Filters>) => setFilters({ ...f, ...p });
  const dirty = f.state >= 0 || f.lga >= 0 || f.check || f.q || f.bands.some((b) => !b);

  return (
    <div className="flex flex-col gap-5 p-4">
      <div>
        <label htmlFor="q" className="label">Search</label>
        <div className="relative">
          <svg viewBox="0 0 20 20" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="9" cy="9" r="5.5" /><path d="m13.5 13.5 3.5 3.5" /></svg>
          <input id="q" type="search" className="field pl-9" placeholder="Polling unit, ward or LGA" value={f.q}
            onChange={(e) => set({ q: e.target.value })} autoComplete="off" />
        </div>
        {searching && <p className="mt-1.5 text-xs text-muted">Loading unit names…</p>}
        {results.length > 0 && (
          <ul className="mt-2 overflow-hidden rounded-chip border border-line" aria-label="Search results">
            {results.map((r) => (
              <li key={r.i} className="border-b border-line last:border-0">
                <button type="button" onClick={() => onPickResult(r.i)} className="flex w-full items-start gap-2 px-2.5 py-2 text-left hover:bg-raised">
                  <span aria-hidden="true" className={`mt-0.5 w-3 text-[10px] ${TONE[r.band]}`}>{STATUS[r.band].icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{r.name}</span>
                    <span className="block truncate text-[11px] text-muted">{r.sub}</span>
                  </span>
                  <span className="sr-only">{STATUS[r.band].label}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3">
        <div>
          <label htmlFor="state" className="label">State</label>
          <select id="state" className="field" value={f.state} onChange={(e) => set({ state: Number(e.target.value), lga: -1 })}>
            <option value={-1}>All 37 states</option>
            {idx.states.map((s, k) => (
              <option key={s} value={k}>{titleCase(s)}{noCoord.has(s) ? " – no locations published" : ""}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="lga" className="label">LGA</label>
          <select id="lga" className="field" value={f.lga} disabled={f.state < 0} onChange={(e) => set({ lga: Number(e.target.value) })}>
            <option value={-1}>{f.state < 0 ? "Choose a state first" : `All ${lgaOptions.length} LGAs`}</option>
            {lgaOptions.map((o) => <option key={o.k} value={o.k}>{titleCase(o.name)}</option>)}
          </select>
        </div>
      </div>

      <fieldset>
        <legend className="label">Status</legend>
        <div className="grid grid-cols-1 gap-1.5">
          {STATUS.map((s, b) => (
            <label key={s.key} className={`flex cursor-pointer items-center gap-2.5 rounded-chip border px-2.5 py-1.5 text-sm transition-colors ${f.bands[b] ? "border-line bg-raised/60" : "border-transparent opacity-55 hover:opacity-80"}`}>
              <input type="checkbox" className="sr-only" checked={f.bands[b]}
                onChange={() => { const bands = [...f.bands] as Filters["bands"]; bands[b] = !bands[b]; set({ bands }); }} />
              <span aria-hidden="true" className={`w-3 text-center text-[11px] ${TONE[b]}`}>{s.icon}</span>
              <span className="flex-1">{s.label}</span>
              <span className="font-mono text-xs text-muted">{fmt(counts.byBand[b])}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor="check" className="label">Check type</label>
        <select id="check" className="field" value={f.check} onChange={(e) => set({ check: e.target.value })}>
          {CHECKS.map((c) => <option key={c.value} value={c.value}>{c.label}{c.source ? ` (${c.source.toLowerCase()})` : ""}</option>)}
        </select>
      </div>

      <div>
        <label htmlFor="spv" className="label flex justify-between">
          <span>Clock audit · seconds per voter</span><span className="font-mono normal-case tracking-normal text-ink">{spv} s</span>
        </label>
        <input id="spv" type="range" min={30} max={120} step={5} value={spv} onChange={(e) => setSpv(Number(e.target.value))}
          className="w-full accent-[rgb(var(--accent))]" />
        <p className="mt-1 text-xs leading-relaxed text-muted">One BVAS device takes ~30–120 s per voter. Applies to synthetic result sheets.</p>
      </div>

      <div className="rounded-panel border border-line bg-bg/60 p-3.5" aria-live="polite">
        <p className="font-mono text-2xl leading-none">{fmt(counts.matched)}</p>
        <p className="mt-1 text-xs text-muted">units match · {fmt(counts.mapped)} on the map</p>
        <p className="mt-3 flex items-baseline gap-2 border-t border-line pt-3 text-sm">
          <span className="font-mono text-field">{fmt(counts.outside)}</span>
          <span className="text-muted">units placed outside Nigeria</span>
        </p>
        {dirty && (
          <button type="button" className="mt-3 text-xs text-accent-ink underline-offset-2 hover:underline" onClick={() => setFilters({ ...f, state: -1, lga: -1, bands: [true, true, true, true], check: "", q: "" })}>
            Reset filters
          </button>
        )}
      </div>

      <button type="button" className="btn-ghost w-full" onClick={onStrangest}>Show me the strangest one</button>

      <div className="rounded-panel border border-dashed border-line p-3.5">
        <p className="text-sm">My field-verification list <span className="font-mono text-muted">({listSize})</span></p>
        <p className="mt-1 text-xs text-muted">{listSize ? "Saved in this browser only." : "Add units from their Unit Card."}</p>
        {listSize > 0 && (
          <div className="mt-2.5 flex gap-2">
            <button type="button" className="btn-primary flex-1 !px-2 text-xs" onClick={onDownloadList}>Download CSV</button>
            <button type="button" className="btn-ghost !px-2 text-xs" onClick={onClearList}>Clear</button>
          </div>
        )}
      </div>
      <p className="text-[11px] leading-relaxed text-muted">
        Data generated {summary.generated}. Registers and result sheets are synthetic; locations are real public data.
      </p>
    </div>
  );
}
