"use client";

import { useState } from "react";
import {
  LABEL, STATUS, clockFlag, clockSentence, fmt, maxAccredited, plainReason, stateName, titleCase, unitDetailsText,
  type Summary, type UnitDetail,
} from "@/lib/data";
import { Icon, ScoreRing, SourceTag, StatusPill } from "./ui";

interface Props {
  unit: UnitDetail | null;
  loading: boolean;
  summary: Summary;
  centroids: Record<string, [number, number]>;
  spv: number;
  inList: boolean;
  listSize: number;
  onToggleList: () => void;
  onClose: () => void;
}

const REASON_ICON: Record<string, string> = {
  OUTSIDE_NIGERIA: "globe", WRONG_STATE: "pinX", STACKED: "stack", NO_COORDINATE: "info",
  REGISTER_ABOVE_ADULTS: "people", EMPTY_CATCHMENT: "people", FEW_ROOFTOPS: "info", NEW_BUILDINGS: "info",
};

export default function UnitCard({ unit: u, loading, summary, centroids, spv, inList, listSize, onToggleList, onClose }: Props) {
  const [copied, setCopied] = useState(false);
  if (!u) {
    return (
      <div className="flex items-center gap-3 p-6 text-[15px] text-muted" aria-busy={loading}>
        {loading ? <><span className="loading-bar h-1 w-16 rounded-full bg-line" />Loading</> : "Unit not found."}
      </div>
    );
  }
  const hours = summary.params.polling_hours;
  const fastest = summary.params.seconds_per_voter_fastest;
  const reasons = u.reasons.filter((r) => !r.code.startsWith("CLOCK"));
  const clock = u.accredited != null && u.devices ? clockSentence(u.accredited, u.devices, hours, spv, fastest) : null;
  const clockHit = clockFlag(u.accredited, u.devices, hours, spv);
  const ratio = u.register != null && u.adults_share ? u.register / u.adults_share : null;
  const cap = u.devices ? maxAccredited(hours, spv, u.devices) : 0;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(unitDetailsText(u, spv, hours));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard blocked */ }
  };

  return (
    <article className="flex min-h-full flex-col" aria-labelledby="unit-name">
      <header className="rise px-6 pb-5 pt-5">
        <div className="flex items-center justify-between gap-3">
          <span className="font-mono text-[12px] text-muted">{u.uid}</span>
          <button type="button" onClick={onClose} className="-mr-2 grid h-8 w-8 place-items-center rounded-full bg-raised text-muted hover:text-ink" aria-label="Close unit card">
            <Icon name="close" className="h-4 w-4" strokeWidth={2.2} />
          </button>
        </div>
        <h2 id="unit-name" className="mt-2 text-[26px] leading-[1.12]">{titleCase(u.name)}</h2>
        <p className="mt-1.5 text-[15px] text-muted" title={`${titleCase(u.ward)} ward`}>
          {titleCase(u.lga)} · {stateName(u.state)}
        </p>
        <div className="mt-5 flex items-center gap-4">
          <ScoreRing score={u.score} band={u.band} />
          <div className="min-w-0">
            <span className="pop inline-block"><StatusPill band={u.band} size="lg" /></span>
            <p className="mt-1.5 text-[13px] text-muted">Plausibility out of 100</p>
          </div>
        </div>
      </header>

      <section className="rise px-4 pb-2" style={{ animationDelay: "100ms" }} aria-labelledby="why">
        <h3 id="why" className="eyebrow px-2 pb-2">Why</h3>
        {reasons.length === 0 && !clockHit ? (
          <p className="rounded-[16px] bg-raised px-4 py-3.5 text-[15px] text-muted">
            {u.band === 3 ? "No location was published for this unit." : "Nothing unusual found."}
          </p>
        ) : (
          <ul className="space-y-2">
            {reasons.map((r, k) => (
              <li key={r.code} className="rise rounded-[16px] bg-raised px-4 py-3.5" style={{ animationDelay: `${180 + k * 100}ms` }}>
                <div className="flex gap-3">
                  <Icon name={REASON_ICON[r.code] ?? "info"} className={`mt-0.5 h-5 w-5 ${u.band === 2 ? "text-field" : "text-review"}`} />
                  <div className="min-w-0">
                    <p className="text-[16px] font-semibold leading-snug">{LABEL[r.code] ?? r.code}</p>
                    <p className="mt-0.5 text-[13px] leading-snug text-muted">{plainReason(r, u, centroids)}</p>
                  </div>
                </div>
                <details className="group mt-2 pl-8">
                  <summary className="flex cursor-pointer items-center gap-1 text-[13px] font-medium text-muted hover:text-ink">
                    Possible innocent cause <Icon name="chevron" className="disclose h-3.5 w-3.5 transition-transform" strokeWidth={2} />
                  </summary>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{r.innocent} <SourceTag source={r.source} /></p>
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>

      {clock && u.accredited != null && (
        <section className="rise px-4 pt-4" style={{ animationDelay: "260ms" }} aria-labelledby="clock">
          <h3 id="clock" className="eyebrow flex items-center gap-2 px-2 pb-2">Clock audit <SourceTag source="SYNTHETIC" /></h3>
          <div className="rounded-[16px] bg-raised px-4 py-4">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-[28px] font-bold leading-none tracking-tight tabular-nums">
                {clock.secs < 10 ? clock.secs.toFixed(1) : fmt(clock.secs)}<span className="ml-1 text-[15px] font-semibold text-muted">s / voter</span>
              </p>
              <span className={`text-[13px] font-semibold ${clock.flagged ? (clock.secs < fastest ? "text-field" : "text-review") : "text-ok"}`}>
                {clock.flagged ? (clock.secs < fastest ? "Too fast" : "Fast") : "Normal"}
              </span>
            </div>
            <Meter value={u.accredited} max={Math.max(cap, u.accredited)} limit={cap} hot={clockHit} />
            <p className="mt-2 text-[13px] text-muted">
              {fmt(u.accredited)} accredited · limit {fmt(cap)} at {spv} s · {u.devices} BVAS
            </p>
          </div>
        </section>
      )}

      <section className="rise px-4 pt-4" style={{ animationDelay: "340ms" }} aria-labelledby="numbers">
        <h3 id="numbers" className="eyebrow px-2 pb-2">Numbers</h3>
        <div className="grid grid-cols-3 gap-2">
          <Tile value={fmt(u.register)} label="Register" tag="Synthetic" />
          <Tile value={u.adults_share == null ? "–" : `≈${fmt(u.adults_share)}`} label="Adults it serves" />
          <Tile value={ratio == null ? "–" : `${ratio.toFixed(1)}×`} label="Ratio" hot={ratio != null && ratio > 1.2} />
        </div>
        {u.lat != null && u.adults_r == null && (
          <p className="px-2 pt-2 text-[12px] text-muted">No estimate: this coordinate isn’t where the unit really is.</p>
        )}
        {u.lat != null && (
          <p className="px-2 pt-3 font-mono text-[12px] text-muted">{u.lat.toFixed(5)}, {u.lon!.toFixed(5)}</p>
        )}
      </section>

      <div className="flex gap-2 px-4 pb-3 pt-5">
        <button type="button" onClick={onToggleList} className={`press flex-1 ${inList ? "btn-ghost" : "btn-primary"}`} aria-pressed={inList}>
          <Icon name={inList ? "done" : "plus"} className="h-[18px] w-[18px]" strokeWidth={2.2} />
          {inList ? `On your list · ${listSize}` : "Add to field list"}
        </button>
        <button type="button" onClick={copy} className="btn-ghost press !px-4" aria-live="polite" aria-label={copied ? "Copied" : "Copy details"}>
          <Icon name={copied ? "done" : "copy"} className="h-[18px] w-[18px]" />
        </button>
      </div>
      <p className="mt-auto px-6 pb-5 pt-2 text-[12px] text-muted">
        A flag means “check in the field”, not wrongdoing.
        <span className="sr-only"> Status: {STATUS[u.band].label}.</span>
      </p>
    </article>
  );
}

function Tile({ value, label, tag, hot }: { value: string; label: string; tag?: string; hot?: boolean }) {
  return (
    <div className="rounded-[16px] bg-raised px-3 py-3">
      <p className={`truncate text-[19px] font-bold leading-tight tracking-tight tabular-nums ${hot ? "text-field" : ""}`}>{value}</p>
      <p className="mt-1 text-[11.5px] leading-tight text-muted">{label}</p>
      {tag && <p className="mt-1 text-[10.5px] font-semibold text-review">{tag}</p>}
    </div>
  );
}

function Meter({ value, max, limit, hot }: { value: number; max: number; limit: number; hot: boolean }) {
  const pct = max ? (value / max) * 100 : 0;
  const lim = max ? (limit / max) * 100 : 0;
  return (
    <div className="relative mt-3 h-2 rounded-full bg-line/70" aria-hidden="true">
      <div className={`grow-x h-2 rounded-full ${hot ? "bg-field" : "bg-ok"}`} style={{ width: `${Math.max(2, pct)}%` }} />
      <div className="absolute -top-1 h-4 w-[2px] rounded-full bg-ink/70" style={{ left: `calc(${Math.min(99.5, lim)}% - 1px)` }} />
    </div>
  );
}
