"use client";

import { useMemo } from "react";
import { CHECKS, STATUS, fmt, titleCase, type Band, type Summary, type UnitIndex } from "@/lib/data";
import { StatusMark } from "./ui";

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


export default function FilterPanel({ idx, summary, filters: f, setFilters, counts, spv, setSpv, searching, listSize, onDownloadList, onClearList, onStrangest, results, onPickResult }: Props) {
  const noCoord = useMemo(() => new Set(summary.no_coordinate_states), [summary]);
  const lgaOptions = useMemo(
    () => (f.state < 0 ? [] : idx.lgas.map(([s, name], k) => ({ s, name, k })).filter((x) => x.s === f.state).sort((a, b) => a.name.localeCompare(b.name))),
    [idx, f.state],
  );
  const set = (p: Partial<Filters>) => setFilters({ ...f, ...p });
  const dirty = f.state >= 0 || f.lga >= 0 || f.check || f.q || f.bands.some((b) => !b);

  const reset = () => setFilters({ ...f, state: -1, lga: -1, bands: [true, true, true, true], check: "", q: "" });
  return (
    <div className="flex flex-col text-[14px]">
      <div className="border-b border-line px-4 pb-4 pt-4" aria-live="polite">
        <p className="leading-snug">
          Showing <b className="tabular-nums">{fmt(counts.matched)}</b> polling units, {fmt(counts.mapped)} with a location.
          {counts.outside > 0 && <> <b className="tabular-nums text-field">{fmt(counts.outside)}</b> {counts.outside === 1 ? "is" : "are"} placed outside Nigeria.</>}
        </p>
        {dirty && <button type="button" className="mt-1.5 text-[13px] text-muted underline underline-offset-2 hover:text-ink" onClick={reset}>Clear filters</button>}
      </div>

      <div className="space-y-4 border-b border-line px-4 py-4">
        <div>
          <label htmlFor="q" className="label">Find a polling unit, ward or LGA</label>
          <input id="q" type="search" className="field" placeholder="e.g. Inele, Olamaboro" value={f.q}
            onChange={(e) => set({ q: e.target.value })} autoComplete="off" />
          {searching && <p className="mt-1.5 text-[13px] text-muted">Loading unit names…</p>}
          {results.length > 0 && (
            <ul className="mt-1" aria-label="Search results">
              {results.map((r) => (
                <li key={r.i} className="border-b border-line last:border-0">
                  <button type="button" onClick={() => onPickResult(r.i)} className="flex w-full items-start gap-2 py-2 text-left hover:text-ink">
                    <span className="mt-[5px]"><StatusMark band={r.band as Band} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{r.name}</span>
                      <span className="block truncate text-[12px] text-muted">{r.sub}</span>
                    </span>
                    <span className="sr-only">{STATUS[r.band].label}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="state" className="label">State</label>
            <select id="state" className="field" value={f.state} onChange={(e) => set({ state: Number(e.target.value), lga: -1 })}>
              <option value={-1}>All states</option>
              {idx.states.map((s, k) => (
                <option key={s} value={k}>{titleCase(s)}{noCoord.has(s) ? " (no locations)" : ""}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="lga" className="label">LGA</label>
            <select id="lga" className="field" value={f.lga} disabled={f.state < 0} onChange={(e) => set({ lga: Number(e.target.value) })}>
              <option value={-1}>{f.state < 0 ? "–" : "All LGAs"}</option>
              {lgaOptions.map((o) => <option key={o.k} value={o.k}>{titleCase(o.name)}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label htmlFor="check" className="label">Check</label>
          <select id="check" className="field" value={f.check} onChange={(e) => set({ check: e.target.value })}>
            {CHECKS.map((c) => <option key={c.value} value={c.value}>{c.label}{c.source ? ` (${c.source.toLowerCase()})` : ""}</option>)}
          </select>
        </div>
      </div>

      <fieldset className="border-b border-line px-4 py-4">
        <legend className="sr-only">Status</legend>
        <p className="label" aria-hidden="true">Status</p>
        {STATUS.map((s, b) => (
          <label key={s.key} className="flex cursor-pointer items-center gap-2.5 py-1">
            <input type="checkbox" checked={f.bands[b]} className="h-3.5 w-3.5 accent-[rgb(var(--ink))]"
              onChange={() => { const bands = [...f.bands] as Filters["bands"]; bands[b] = !bands[b]; set({ bands }); }} />
            <StatusMark band={b as Band} />
            <span className={`flex-1 ${f.bands[b] ? "" : "text-muted line-through decoration-muted/50"}`}>{s.label}</span>
            <span className="tabular-nums text-[13px] text-muted">{fmt(counts.byBand[b])}</span>
          </label>
        ))}
      </fieldset>

      <div className="border-b border-line px-4 py-4">
        <label htmlFor="spv" className="label">Clock audit: assume <b className="text-ink">{spv} seconds</b> per voter</label>
        <input id="spv" type="range" min={30} max={120} step={5} value={spv} onChange={(e) => setSpv(Number(e.target.value))}
          className="w-full accent-[rgb(var(--ink))]" />
        <p className="mt-1 text-[13px] leading-relaxed text-muted">A BVAS device takes roughly 30 to 120 seconds per voter. Used only on the synthetic result sheets.</p>
      </div>

      <div className="border-b border-line px-4 py-4">
        <p>Your field-verification list: <b className="tabular-nums">{listSize}</b> unit{listSize === 1 ? "" : "s"}</p>
        <p className="mt-0.5 text-[13px] text-muted">{listSize ? "Kept in this browser only." : "Add units from their card on the map."}</p>
        {listSize > 0 && (
          <p className="mt-2 flex gap-4 text-[13px]">
            <button type="button" className="underline underline-offset-2" onClick={onDownloadList}>Download as CSV</button>
            <button type="button" className="text-muted underline underline-offset-2 hover:text-ink" onClick={onClearList}>Clear</button>
          </p>
        )}
      </div>

      <div className="px-4 py-4">
        <button type="button" className="text-[13px] underline underline-offset-2 hover:text-ink" onClick={onStrangest}>Go to the Kogi school placed in Canada →</button>
        <p className="mt-3 text-[12px] leading-relaxed text-muted">
          Data processed {summary.generated}. Locations are real public data; registers and result sheets are synthetic.
        </p>
      </div>
    </div>
  );
}
