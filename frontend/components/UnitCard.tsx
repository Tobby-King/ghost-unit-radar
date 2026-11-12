"use client";

import { useState } from "react";
import {
  STATUS, clockFlag, clockSentence, fmt, maxAccredited, plainReason, stateName, titleCase, unitDetailsText,
  type Summary, type UnitDetail,
} from "@/lib/data";
import { SourceTag, StatusPill } from "./ui";

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

export default function UnitCard({ unit: u, loading, summary, centroids, spv, inList, listSize, onToggleList, onClose }: Props) {
  const [copied, setCopied] = useState(false);
  if (!u) {
    return (
      <div className="p-5 text-sm text-muted" aria-busy={loading}>
        {loading ? <div className="space-y-3"><div className="h-4 w-24 animate-pulse rounded bg-raised" /><div className="h-6 w-3/4 animate-pulse rounded bg-raised" /><div className="h-24 animate-pulse rounded bg-raised" /></div> : "Unit not found."}
      </div>
    );
  }
  const hours = summary.params.polling_hours;
  const fastest = summary.params.seconds_per_voter_fastest;
  const radius = summary.params.radius_km;
  const reasons = u.reasons.filter((r) => !r.code.startsWith("CLOCK"));
  const clock = u.accredited != null && u.devices ? clockSentence(u.accredited, u.devices, hours, spv, fastest) : null;
  const clockHit = clockFlag(u.accredited, u.devices, hours, spv);
  const ratio = u.register != null && u.adults_share ? u.register / u.adults_share : null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(unitDetailsText(u, spv, hours));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard blocked */ }
  };

  return (
    <article className="flex min-h-full flex-col" aria-labelledby="unit-name">
      <div className="space-y-3 border-b border-line p-5">
        <div className="flex items-start justify-between gap-3">
          <span className="font-mono text-xs text-muted">{u.uid}</span>
          <button type="button" onClick={onClose} className="-m-1 grid h-8 w-8 place-items-center rounded-chip text-muted hover:bg-raised hover:text-ink" aria-label="Close unit card">
            <svg viewBox="0 0 20 20" className="h-4 w-4" stroke="currentColor" strokeWidth="1.8"><path d="m5 5 10 10M15 5 5 15" /></svg>
          </button>
        </div>
        <h2 id="unit-name" className="text-[19px] leading-snug">{titleCase(u.name)}</h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[13px]">
          <dt className="text-muted">Ward</dt><dd>{titleCase(u.ward)}</dd>
          <dt className="text-muted">LGA</dt><dd>{titleCase(u.lga)}</dd>
          <dt className="text-muted">State</dt><dd>{stateName(u.state)}</dd>
        </dl>
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <StatusPill band={u.band} size="lg" />
          <span className="font-mono text-sm text-muted">plausibility <span className="text-ink">{u.score}</span>/100</span>
        </div>
      </div>

      <section className="space-y-3 border-b border-line p-5" aria-labelledby="why">
        <h3 id="why" className="label !mb-0">Why it was flagged</h3>
        {reasons.length === 0 && !clockHit ? (
          <p className="text-sm text-muted">
            {u.band === 3 ? "INEC published no coordinate for this unit, so its location cannot be checked." : "Nothing unusual found: inside its listed state and not stacked with other units."}
          </p>
        ) : (
          <ul className="space-y-3">
            {reasons.map((r) => (
              <li key={r.code} className="rounded-chip border border-line bg-bg/60 p-3">
                <div className="mb-1.5"><SourceTag source={r.source} /></div>
                <p className="text-sm leading-relaxed">{plainReason(r, u, centroids)}</p>
                <p className="mt-1.5 text-xs leading-relaxed text-muted">Possible innocent explanation: {r.innocent}</p>
              </li>
            ))}
          </ul>
        )}
        {u.lat != null && (
          <p className="font-mono text-xs text-muted">Official coordinate {u.lat.toFixed(5)}, {u.lon!.toFixed(5)}</p>
        )}
      </section>

      {clock && (
        <section className="space-y-2 border-b border-line p-5" aria-labelledby="clock">
          <div className="flex items-center justify-between">
            <h3 id="clock" className="label !mb-0">Clock audit</h3>
            <SourceTag source="SYNTHETIC" />
          </div>
          <p className={`rounded-chip border p-3 text-sm leading-relaxed ${clockHit ? "border-field/40 bg-field/5" : "border-line"}`}>
            <span className="font-mono">{clock.text}</span>{" "}
            <span className={clock.flagged ? (clock.secs < fastest ? "font-medium text-field" : "font-medium text-review") : "text-muted"}>
              ({clock.verdict})
            </span>
          </p>
          <p className="text-xs text-muted">
            At {spv} s per voter, {u.devices} device{u.devices === 1 ? "" : "s"} can accredit at most <span className="font-mono">{fmt(maxAccredited(hours, spv, u.devices!))}</span> in {hours} h.
          </p>
        </section>
      )}

      <section className="border-b border-line p-5" aria-labelledby="numbers">
        <h3 id="numbers" className="label">Numbers</h3>
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-chip border border-line bg-line font-mono">
          <Stat label="Registered" note="synthetic" value={fmt(u.register)} />
          <Stat label={`Adults within ${radius} km`} note="WorldPop" value={u.adults_r == null ? "–" : `~${fmt(u.adults_r)}`} />
          <Stat label="Adults this unit serves" note={u.units_r ? `shared by ${fmt(u.units_r)} units` : "estimate"} value={u.adults_share == null ? "–" : `~${fmt(u.adults_share)}`} />
          <Stat label="Register ÷ adults" note="ratio" value={ratio == null ? "–" : `${ratio.toFixed(1)}×`} warn={ratio != null && ratio > 1.2} />
          <Stat label="Buildings nearby" note="Open Buildings" value="pending" muted />
          <Stat label="Accredited" note="synthetic" value={fmt(u.accredited)} />
        </dl>
        {u.lat != null && u.adults_r == null && (
          <p className="mt-2 text-xs leading-relaxed text-muted">
            Catchment not computed: the coordinate is outside Nigeria, in another state or a stacked centre point, so it does not show where the unit really is.
          </p>
        )}
      </section>

      <div className="space-y-2 p-5">
        <button type="button" onClick={onToggleList} className={inList ? "btn-ghost w-full" : "btn-primary w-full"} aria-pressed={inList}>
          {inList ? `✓ On field-verification list (${listSize})` : "Add to field-verification list"}
        </button>
        <button type="button" onClick={copy} className="btn-ghost w-full" aria-live="polite">
          {copied ? "Copied" : "Copy unit details"}
        </button>
      </div>
      <p className="mt-auto border-t border-line px-5 py-4 text-xs leading-relaxed text-muted">
        A flag means this unit needs field verification. It is not evidence of wrongdoing.
        <span className="sr-only"> Status: {STATUS[u.band].label}.</span>
      </p>
    </article>
  );
}

function Stat({ label, note, value, warn, muted }: { label: string; note: string; value: string; warn?: boolean; muted?: boolean }) {
  return (
    <div className="bg-surface px-3 py-2.5">
      <dt className="font-sans text-[11px] leading-tight text-muted">{label} <span className="opacity-70">· {note}</span></dt>
      <dd className={`mt-1 text-[17px] ${warn ? "text-field" : muted ? "text-muted text-sm" : "text-ink"}`}>{value}</dd>
    </div>
  );
}
