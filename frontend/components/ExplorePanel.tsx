"use client";

import { fmt, titleCase, uidToIndex, type Band, type Showcase, type Summary, type UnitIndex } from "@/lib/data";
import { CountUp, Icon, StatusMark } from "./ui";

export type QuickKey = "all" | "outside" | "stacked" | "field" | "wrong";

const KIND: Record<string, { label: string; icon: string; tone: string }> = {
  outside: { label: "Placed abroad", icon: "globe", tone: "bg-field/[.12] text-field" },
  stack: { label: "Stacked on one point", icon: "stack", tone: "bg-review/[.12] text-review" },
  wrong: { label: "In another state", icon: "pinX", tone: "bg-review/[.12] text-review" },
  clock: { label: "Clock audit", icon: "clock", tone: "bg-field/[.12] text-field" },
  register: { label: "Register too large", icon: "people", tone: "bg-field/[.12] text-field" },
};

/** The panel before a unit is chosen: one headline number, one action, four tiles, a short list. */
export default function ExplorePanel({ summary, idx, showcase, onQuick, onOpen, ready }: {
  summary: Summary; idx: UnitIndex; showcase: Showcase[]; ready: boolean;
  onQuick: (k: QuickKey) => void; onOpen: (i: number, k: number) => void;
}) {
  const n = summary.national;
  const tiles: { key: QuickKey; value: number; label: string; icon: string; tone: string }[] = [
    { key: "field", value: n.red, label: "Field checks", icon: "flag", tone: "text-field" },
    { key: "stacked", value: n.stacked_units, label: "Stacked", icon: "stack", tone: "text-review" },
    { key: "wrong", value: n.wrong_state, label: "Wrong state", icon: "pinX", tone: "text-review" },
    { key: "all", value: n.with_coordinates, label: "Checked", icon: "check", tone: "text-ok" },
  ];

  return (
    <div className="pb-2">
      <div className="px-6 pb-6 pt-7">
        <p className="eyebrow">Outside Nigeria</p>
        <p className="mt-2 text-[64px] font-bold leading-[0.95] tracking-[-0.045em] text-field">
          <CountUp value={n.outside_nigeria} delay={200} duration={1500} />
        </p>
        <p className="mt-3 text-[19px] font-semibold leading-snug tracking-tight">
          polling units are mapped abroad.
        </p>
        <p className="mt-1 text-[15px] text-muted">Out of {fmt(n.units)} on INEC’s list.</p>
        <button type="button" className="btn-primary press rise mt-6 w-full !py-3.5 text-[16px]" style={{ animationDelay: "300ms" }}
          disabled={!ready || !showcase[0]} onClick={() => showcase[0] && onOpen(uidToIndex(showcase[0].uid), 0)}>
          <Icon name="play" className="h-4 w-4" />
          Show the school in Canada
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2.5 px-4">
        {tiles.map((t, k) => (
          <button key={t.key} type="button" onClick={() => onQuick(t.key)} style={{ animationDelay: `${380 + k * 60}ms` }}
            className="press rise rounded-[18px] bg-raised p-4 text-left transition-colors hover:bg-line/60">
            <Icon name={t.icon} className={`h-[22px] w-[22px] ${t.tone}`} />
            <span className="mt-3 block text-[24px] font-bold leading-none tracking-tight tabular-nums">
              <CountUp value={t.value} delay={380 + k * 60} />
            </span>
            <span className="mt-1 block text-[13px] font-medium text-muted">{t.label}</span>
          </button>
        ))}
      </div>

      <h2 className="px-6 pb-2 pt-7 text-[20px]">Worth a look</h2>
      <ul className="px-2">
        {showcase.map((s, k) => {
          const i = uidToIndex(s.uid);
          const kind = KIND[s.kind] ?? { label: s.kind, icon: "info", tone: "bg-raised text-muted" };
          return (
            <li key={s.uid} className="rise" style={{ animationDelay: `${650 + k * 60}ms` }}>
              <button type="button" onClick={() => onOpen(i, k)} title={s.caption}
                className="group flex w-full items-center gap-3.5 rounded-[14px] px-4 py-2.5 text-left transition-colors hover:bg-raised">
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-[12px] ${kind.tone}`}>
                  <Icon name={kind.icon} className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold">{kind.label}</span>
                  <span className="flex items-center gap-1.5 text-[13px] text-muted">
                    <StatusMark band={idx.band[i] as Band} size={8} />{titleCase(s.state)}
                  </span>
                </span>
                <Chevron />
              </button>
            </li>
          );
        })}
      </ul>
      <p className="px-6 pb-4 pt-5 text-[12px] leading-relaxed text-muted">
        Registers are synthetic. A flag means “check in the field”, not wrongdoing.
      </p>
    </div>
  );
}

export function Chevron() {
  return <Icon name="chevron" className="h-4 w-4 text-muted/70 transition-transform group-hover:translate-x-0.5" strokeWidth={2} />;
}
