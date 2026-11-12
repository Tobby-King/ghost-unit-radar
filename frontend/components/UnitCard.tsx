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
        {loading ? "Loading unit…" : "Unit not found."}
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
    <article className="flex min-h-full flex-col text-[14px]" aria-labelledby="unit-name">
      <header className="px-5 pb-5 pt-4">
        <div className="flex items-center justify-between gap-3 text-[13px] text-muted">
          <span>Polling unit <span className="font-mono">{u.uid}</span></span>
          <button type="button" onClick={onClose} className="-mr-1 px-1 text-muted hover:text-ink" aria-label="Close unit card">Close ✕</button>
        </div>
        <h2 id="unit-name" className="mt-3 text-[22px] leading-tight">{titleCase(u.name)}</h2>
        <p className="mt-1.5 text-muted">
          {titleCase(u.ward)} ward, {titleCase(u.lga)} LGA, {stateName(u.state)}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
          <StatusPill band={u.band} size="lg" />
          <span className="text-[13px] text-muted">Plausibility score {u.score} of 100</span>
        </div>
      </header>

      <section className="border-t border-line px-5 py-5" aria-labelledby="why">
        <h3 id="why" className="font-sans text-[15px] font-semibold">Why it was flagged</h3>
        {reasons.length === 0 && !clockHit ? (
          <p className="mt-2 text-muted">
            {u.band === 3 ? "INEC published no coordinate for this unit, so its location cannot be checked." : "Nothing unusual: the unit sits inside its listed state and is not stacked with others."}
          </p>
        ) : (
          <ol className="mt-3 space-y-4">
            {reasons.map((r, k) => (
              <li key={r.code} className="grid grid-cols-[18px_1fr] gap-x-2">
                <span className="text-muted">{k + 1}.</span>
                <div>
                  <p className="leading-relaxed">{plainReason(r, u, centroids)}</p>
                  <p className="mt-1 text-[13px] leading-relaxed text-muted">
                    Could be innocent: {r.innocent.charAt(0).toLowerCase() + r.innocent.slice(1)} <SourceTag source={r.source} />
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
        {u.lat != null && (
          <p className="mt-4 text-[13px] text-muted">Published coordinate <span className="font-mono">{u.lat.toFixed(5)}, {u.lon!.toFixed(5)}</span></p>
        )}
      </section>

      {clock && (
        <section className="border-t border-line px-5 py-5" aria-labelledby="clock">
          <h3 id="clock" className="font-sans text-[15px] font-semibold">Clock audit <SourceTag source="SYNTHETIC" /></h3>
          <p className="mt-2 leading-relaxed">
            {clock.text}
            {clock.flagged ? (
              <span className={`font-semibold ${clock.secs < fastest ? "text-field" : "text-review"}`}> — {clock.verdict}.</span>
            ) : <span className="text-muted"> — {clock.verdict}.</span>}
          </p>
          <p className="mt-1.5 text-[13px] text-muted">
            At {spv} seconds per voter, {u.devices} device{u.devices === 1 ? "" : "s"} can accredit at most {fmt(maxAccredited(hours, spv, u.devices!))} voters in {hours} hours.
          </p>
        </section>
      )}

      <section className="border-t border-line px-5 py-5" aria-labelledby="numbers">
        <h3 id="numbers" className="font-sans text-[15px] font-semibold">The figures</h3>
        <table className="mt-2 w-full">
          <tbody className="[&_td]:py-1.5 [&_tr]:border-b [&_tr]:border-dotted [&_tr]:border-line">
            <Fig label="Registered voters" note="synthetic" value={fmt(u.register)} />
            <Fig label="Accredited voters" note="synthetic" value={fmt(u.accredited)} />
            <Fig label={`Adults living within ${radius} km`} note="WorldPop" value={u.adults_r == null ? "–" : `about ${fmt(u.adults_r)}`} />
            <Fig label="Adults this unit plausibly serves" note={u.units_r ? `shared by ${fmt(u.units_r)} units` : ""} value={u.adults_share == null ? "–" : `about ${fmt(u.adults_share)}`} />
            <Fig label="Register ÷ adults served" value={ratio == null ? "–" : `${ratio.toFixed(1)}×`} strong={ratio != null && ratio > 1.2} />
            <Fig label="Buildings nearby" note="Open Buildings" value="not loaded yet" muted />
          </tbody>
        </table>
        {u.lat != null && u.adults_r == null && (
          <p className="mt-3 text-[13px] leading-relaxed text-muted">
            No catchment estimate: the coordinate is abroad, in another state or a shared centre point, so it does not show where the unit really is.
          </p>
        )}
      </section>

      <div className="flex gap-2 border-t border-line px-5 py-4">
        <button type="button" onClick={onToggleList} className={inList ? "btn-ghost flex-1" : "btn-primary flex-1"} aria-pressed={inList}>
          {inList ? `On your list (${listSize})` : "Add to field-verification list"}
        </button>
        <button type="button" onClick={copy} className="btn-ghost" aria-live="polite">{copied ? "Copied" : "Copy details"}</button>
      </div>
      <p className="mt-auto px-5 pb-5 text-[13px] leading-relaxed text-muted">
        A flag means this unit needs field verification. It is not evidence of wrongdoing.
        <span className="sr-only"> Status: {STATUS[u.band].label}.</span>
      </p>
    </article>
  );
}

function Fig({ label, note, value, strong, muted }: { label: string; note?: string; value: string; strong?: boolean; muted?: boolean }) {
  return (
    <tr>
      <td className="pr-3 text-muted">{label}{note ? <span className="text-[12px] italic"> ({note})</span> : null}</td>
      <td className={`whitespace-nowrap text-right tabular-nums ${strong ? "font-semibold text-field" : muted ? "text-muted" : ""}`}>{value}</td>
    </tr>
  );
}
