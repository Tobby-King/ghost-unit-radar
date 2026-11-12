"use client";

import { useMemo } from "react";
import { CHECKS, STATUS, fmt, titleCase, type Band, type Summary, type UnitIndex } from "@/lib/data";
import { Icon, StatusMark, Switch } from "./ui";

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

/** Filters laid out like a settings screen: grouped rows, switches, one slider. */
export default function FilterPanel({ idx, summary, filters: f, setFilters, counts, spv, setSpv, listSize, onDownloadList, onClearList }: Props) {
  const noCoord = useMemo(() => new Set(summary.no_coordinate_states), [summary]);
  const lgaOptions = useMemo(
    () => (f.state < 0 ? [] : idx.lgas.map(([s, name], k) => ({ s, name, k })).filter((x) => x.s === f.state).sort((a, b) => a.name.localeCompare(b.name))),
    [idx, f.state],
  );
  const set = (p: Partial<Filters>) => setFilters({ ...f, ...p });
  const dirty = f.state >= 0 || f.lga >= 0 || f.check || f.q || f.bands.some((b) => !b);
  const reset = () => setFilters({ ...f, state: -1, lga: -1, bands: [true, true, true, true], check: "", q: "" });

  return (
    <div className="space-y-6 bg-raised/60 px-4 pb-6 pt-5">
      <div className="flex items-end justify-between px-2" aria-live="polite">
        <div>
          <p className="text-[34px] font-bold leading-none tracking-tight tabular-nums">{fmt(counts.matched)}</p>
          <p className="mt-1 text-[13px] text-muted">units shown{counts.outside > 0 && <> · <span className="text-field">{fmt(counts.outside)} abroad</span></>}</p>
        </div>
        {dirty && <button type="button" className="text-[15px] font-medium text-accent-ink hover:opacity-75" onClick={reset}>Reset</button>}
      </div>

      <Group title="Place">
        <label className="group-row" htmlFor="state">
          <span className="flex-1 text-[15px]">State</span>
          <select id="state" className="row-select" value={f.state} onChange={(e) => set({ state: Number(e.target.value), lga: -1 })}>
            <option value={-1}>All</option>
            {idx.states.map((s, k) => <option key={s} value={k}>{titleCase(s)}{noCoord.has(s) ? " (no locations)" : ""}</option>)}
          </select>
        </label>
        <label className="group-row" htmlFor="lga">
          <span className={`flex-1 text-[15px] ${f.state < 0 ? "text-muted" : ""}`}>LGA</span>
          <select id="lga" className="row-select" value={f.lga} disabled={f.state < 0} onChange={(e) => set({ lga: Number(e.target.value) })}>
            <option value={-1}>{f.state < 0 ? "Pick a state" : "All"}</option>
            {lgaOptions.map((o) => <option key={o.k} value={o.k}>{titleCase(o.name)}</option>)}
          </select>
        </label>
        <label className="group-row" htmlFor="check">
          <span className="flex-1 text-[15px]">Check</span>
          <select id="check" className="row-select" value={f.check} onChange={(e) => set({ check: e.target.value })}>
            {CHECKS.map((c) => <option key={c.value} value={c.value}>{c.value ? c.label : "All"}</option>)}
          </select>
        </label>
      </Group>

      <Group title="Status">
        {STATUS.map((s, b) => (
          <div key={s.key} className="group-row">
            <StatusMark band={b as Band} size={11} />
            <span className="flex-1 text-[15px]">{s.label}</span>
            <span className="text-[13px] tabular-nums text-muted">{fmt(counts.byBand[b])}</span>
            <Switch label={s.label} checked={f.bands[b]} onChange={() => { const bands = [...f.bands] as Filters["bands"]; bands[b] = !bands[b]; set({ bands }); }} />
          </div>
        ))}
      </Group>

      <Group title="Clock audit" note="Seconds a BVAS device needs per voter. Synthetic result sheets only.">
        <div className="px-4 py-3.5">
          <div className="flex items-baseline justify-between">
            <label htmlFor="spv" className="text-[15px]">Pace</label>
            <span className="text-[15px] font-semibold tabular-nums">{spv} s</span>
          </div>
          <input id="spv" type="range" min={30} max={120} step={5} value={spv} onChange={(e) => setSpv(Number(e.target.value))}
            className="mt-2 w-full accent-[rgb(var(--ink))]" />
          <div className="flex justify-between text-[11px] text-muted"><span>30 s</span><span>120 s</span></div>
        </div>
      </Group>

      <Group title="My field list" note={listSize ? "Saved in this browser." : "Add units from their card."}>
        <div className="group-row">
          <Icon name="flag" className="h-5 w-5 text-muted" />
          <span className="flex-1 text-[15px]">{listSize} unit{listSize === 1 ? "" : "s"}</span>
          {listSize > 0 && (
            <>
              <button type="button" className="rounded-full bg-ink px-3.5 py-1.5 text-[13px] font-semibold text-bg" onClick={onDownloadList} aria-label="Download as CSV">
                Download CSV
              </button>
              <button type="button" className="grid h-8 w-8 place-items-center rounded-full text-muted hover:bg-raised hover:text-field" onClick={onClearList} aria-label="Clear list">
                <Icon name="trash" className="h-[18px] w-[18px]" />
              </button>
            </>
          )}
        </div>
      </Group>
    </div>
  );
}

function Group({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="eyebrow px-4 pb-1.5">{title}</h3>
      <div className="group-list">{children}</div>
      {note && <p className="px-4 pt-1.5 text-[12px] text-muted">{note}</p>}
    </section>
  );
}
