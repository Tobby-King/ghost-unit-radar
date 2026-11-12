"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { STATUS, type Band } from "@/lib/data";

/* ---------- Status: a drawn shape + the word. Never colour alone. ---------- */
const FILL: Record<Band, string> = { 0: "rgb(var(--st-ok))", 1: "rgb(var(--st-review))", 2: "rgb(var(--st-field))", 3: "rgb(var(--st-none))" };
export function StatusMark({ band, size = 10 }: { band: Band; size?: number }) {
  const c = FILL[band];
  return (
    <svg viewBox="0 0 10 10" width={size} height={size} aria-hidden="true" className="shrink-0">
      {band === 0 && <circle cx="5" cy="5" r="4" fill={c} />}
      {band === 1 && <path d="M5 1 9.2 9H.8Z" fill={c} />}
      {band === 2 && <path d="M5 .6 9.4 5 5 9.4.6 5Z" fill={c} />}
      {band === 3 && <circle cx="5" cy="5" r="3.4" fill="none" stroke={c} strokeWidth="1.4" />}
    </svg>
  );
}
const TINT: Record<Band, string> = { 0: "bg-ok/[.12] text-ok", 1: "bg-review/[.12] text-review", 2: "bg-field/[.12] text-field", 3: "bg-nodata/15 text-muted" };
export function StatusPill({ band, size = "sm" }: { band: Band; size?: "sm" | "lg" }) {
  const s = STATUS[band];
  if (size === "lg") {
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[14px] font-semibold ${TINT[band]}`}>
        <StatusMark band={band} size={10} />
        {s.label}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[13px]">
      <StatusMark band={band} />
      {s.label}
    </span>
  );
}

export function SourceTag({ source }: { source: string }) {
  const synthetic = source.toUpperCase().startsWith("SYN");
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-[1px] align-middle text-[11px] font-semibold ${synthetic ? "bg-review/[.12] text-review" : "bg-raised text-muted"}`}
      title={synthetic ? "Generated for the demo – not real INEC data" : "From real public data"}>
      {synthetic ? "Synthetic" : "Real data"}
    </span>
  );
}

/* ---------- Score ring: plausibility out of 100, drawn like an activity ring ---------- */
const RING: Record<Band, string> = { 0: "rgb(var(--st-ok))", 1: "rgb(var(--st-review))", 2: "rgb(var(--st-field))", 3: "rgb(var(--st-none))" };
export function ScoreRing({ score, band, size = 64 }: { score: number; band: Band; size?: number }) {
  const r = 26, len = 2 * Math.PI * r, off = len * (1 - Math.max(0, Math.min(100, score)) / 100);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`Plausibility score ${score} of 100`}>
      <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" stroke="rgb(var(--line) / .7)" strokeWidth="7" />
        <circle cx="32" cy="32" r={r} fill="none" stroke={RING[band]} strokeWidth="7" strokeLinecap="round"
          strokeDasharray={len} strokeDashoffset={off} className="ring-anim" style={{ ["--ring-len" as string]: `${len}` }} />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-[17px] font-bold tabular-nums">{score}</span>
    </div>
  );
}

/* ---------- iOS-style switch ---------- */
export function Switch({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={onChange}
      className={`relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors duration-200 ${checked ? "bg-ok" : "bg-line"}`}>
      <span className={`absolute left-[2px] top-[2px] h-[27px] w-[27px] rounded-full bg-white shadow-[0_3px_8px_rgb(0_0_0/.15),0_1px_1px_rgb(0_0_0/.16)] transition-transform duration-200 ${checked ? "translate-x-[20px]" : ""}`} />
    </button>
  );
}

/* ---------- Icons (line glyphs, 20×20) ---------- */
const ICONS: Record<string, React.ReactNode> = {
  globe: <><circle cx="10" cy="10" r="7.2" /><path d="M2.8 10h14.4M10 2.8c2.6 2.4 2.6 12 0 14.4M10 2.8c-2.6 2.4-2.6 12 0 14.4" /></>,
  stack: <><path d="m10 3 7 3.6-7 3.6-7-3.6Z" /><path d="m3 10.2 7 3.6 7-3.6M3 13.6l7 3.6 7-3.6" /></>,
  pinX: <><path d="M10 17.5s-5.5-5-5.5-9.2a5.5 5.5 0 0 1 11 0c0 4.2-5.5 9.2-5.5 9.2Z" /><path d="m8 6.3 4 4m0-4-4 4" /></>,
  clock: <><circle cx="10" cy="10" r="7.2" /><path d="M10 6v4.3l2.8 1.7" /></>,
  people: <><circle cx="7.5" cy="7" r="2.6" /><path d="M2.8 16c.5-2.8 2.4-4.3 4.7-4.3s4.2 1.5 4.7 4.3" /><circle cx="14" cy="7.8" r="2" /><path d="M13.6 11.8c1.9.1 3.2 1.4 3.6 3.6" /></>,
  flag: <><path d="M4.5 17.5V3.5M4.5 4h10l-2 3.5 2 3.5h-10" /></>,
  check: <><circle cx="10" cy="10" r="7.2" /><path d="m6.8 10.2 2.2 2.2 4.2-4.6" /></>,
  plus: <path d="M10 4.5v11M4.5 10h11" />,
  minus: <path d="M4.5 10h11" />,
  done: <path d="m5 10.5 3.2 3.2L15 6.8" />,
  copy: <><rect x="7" y="7" width="9.5" height="9.5" rx="2.2" /><path d="M13 4.6A2 2 0 0 0 11.2 3.5H5.6a2.1 2.1 0 0 0-2.1 2.1v5.6A2 2 0 0 0 4.6 13" /></>,
  close: <path d="m6 6 8 8M14 6l-8 8" />,
  chevron: <path d="m8 5 5 5-5 5" />,
  back: <path d="M12.5 4.5 7 10l5.5 5.5" />,
  play: <path d="M7 4.8v10.4a.6.6 0 0 0 .9.5l8.2-5.2a.6.6 0 0 0 0-1L7.9 4.3a.6.6 0 0 0-.9.5Z" fill="currentColor" stroke="none" />,
  search: <><circle cx="8.8" cy="8.8" r="5.3" /><path d="m12.8 12.8 4 4" /></>,
  sliders: <><path d="M3 6h9M15 6h2M3 14h2M8 14h9" /><circle cx="13.5" cy="6" r="1.8" /><circle cx="6.5" cy="14" r="1.8" /></>,
  menu: <path d="M3.5 6h13M3.5 10h13M3.5 14h13" />,
  locate: <><path d="M16.8 3.2 3.4 8.9l5.6 2.1 2.1 5.6Z" /></>,
  download: <path d="M10 3.5v9.5m0 0-3.8-3.8M10 13l3.8-3.8M4 16.5h12" />,
  chart: <path d="M4 16.5V10M8 16.5V5M12 16.5v-8.5M16 16.5V3.5" />,
  book: <><path d="M3.5 4.5c2.6-.8 4.8-.5 6.5 1v11c-1.7-1.5-3.9-1.8-6.5-1Z" /><path d="M16.5 4.5c-2.6-.8-4.8-.5-6.5 1v11c1.7-1.5 3.9-1.8 6.5-1Z" /></>,
  info: <><circle cx="10" cy="10" r="7.2" /><path d="M10 9v4.5M10 6.6v.1" /></>,
  moon: <path d="M16.5 12.5A7 7 0 0 1 7.5 3.5a7 7 0 1 0 9 9Z" />,
  sun: <><circle cx="10" cy="10" r="3.5" /><path d="M10 1.5v2M10 16.5v2M1.5 10h2M16.5 10h2M4 4l1.4 1.4M14.6 14.6 16 16M4 16l1.4-1.4M14.6 5.4 16 4" /></>,
  present: <><rect x="2.5" y="3.5" width="15" height="10" rx="2" /><path d="M7 17h6M10 13.5V17" /></>,
  trash: <path d="M4 6h12M8 6V4.5h4V6M5.5 6l.8 10h7.4l.8-10" />,
};
export function Icon({ name, className = "h-5 w-5", strokeWidth = 1.7 }: { name: keyof typeof ICONS | string; className?: string; strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 20 20" className={`shrink-0 ${className}`} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}

/* ---------- Brand mark: a pin whose point has drifted away from it ----------
   The pin is where a polling unit should be; its centre is empty (the "ghost"); the red point
   has drifted off along a dashed trail - which is exactly what the tool finds in the data. */
export const MARK = {
  pin: "M13 29.4C10.8 26.5 4.6 20.3 4.6 13.5a8.4 8.4 0 0 1 16.8 0c0 6.8-6.2 13-8.4 15.9ZM13 9.9a3.6 3.6 0 1 0 .001 0Z",
  tether: "M15.4 11L23.6 7.7",
};
export function Logo({ className = "h-6 w-6", animate = false, loop = false }: { className?: string; animate?: boolean; loop?: boolean }) {
  return (
    <svg viewBox="0 0 32 32" className={`${className} ${animate ? "logo-anim" : ""} ${loop ? "logo-loop" : ""}`} aria-hidden="true">
      <path className="logo-pin" d={MARK.pin} fill="rgb(var(--ink))" fillRule="evenodd" />
      <path className="logo-tether" d={MARK.tether} stroke="#E2574C" strokeWidth="1.4" strokeDasharray="1.5 1.5" strokeLinecap="round" />
      <circle className="logo-dot" cx="26.2" cy="5.8" r="3.1" fill="#E2574C" />
    </svg>
  );
}

/* ---------- Count-up for headline numbers (skipped when reduced motion is on) ---------- */
/** Figures already counted up on this page load. Remounting a panel shows them settled
 *  instead of replaying the animation, so a half-counted number never reads as real data. */
const counted = new Set<number>();
export function useCountUp(target: number, duration = 1300, delay = 0) {
  const [v, setV] = useState(() => (counted.has(target) ? target : 0));
  useEffect(() => {
    if (counted.has(target) || window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setV(target); return; }
    counted.add(target);
    let raf = 0;
    const t0 = performance.now() + delay;
    const tick = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - t0) / duration));
      setV(Math.round(target * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, delay]);
  return v;
}
export function CountUp({ value, delay = 0, duration }: { value: number; delay?: number; duration?: number }) {
  const v = useCountUp(value, duration, delay);
  return <span className="tabular-nums">{v.toLocaleString("en-NG")}</span>;
}

/* ---------- Theme ---------- */
export function useTheme(): ["dark" | "light", () => void] {
  const [theme, setTheme] = useState<"dark" | "light">("light");
  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light");
  }, []);
  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("gur-theme", next); } catch { /* private mode */ }
    setTheme(next);
    window.dispatchEvent(new CustomEvent("gur-theme", { detail: next }));
  };
  return [theme, toggle];
}

export function ThemeToggle() {
  const [theme, toggle] = useTheme();
  return (
    <button type="button" onClick={toggle} className="grid h-8 w-8 place-items-center rounded-full text-muted hover:bg-raised hover:text-ink"
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`} title="Theme">
      <Icon name={theme === "dark" ? "sun" : "moon"} className="h-[17px] w-[17px]" />
    </button>
  );
}

/* ---------- Top bar: thin frosted strip ---------- */
const NAV = [
  { href: "/", label: "Map" },
  { href: "/findings/", label: "Findings" },
  { href: "/methods/", label: "Methods" },
];
export function TopBar({ active, children }: { active: "/" | "/findings/" | "/methods/"; children?: React.ReactNode }) {
  return (
    <header className="glass sticky top-0 z-30 !shadow-[0_.5px_0_rgb(var(--line))]">
      <div className="mx-auto flex h-12 max-w-6xl items-center gap-5 px-4 md:px-8">
        <Link href="/" className="flex items-center gap-2" aria-label="Ghost Unit Radar – map">
          <Logo animate className="h-[22px] w-[22px]" />
          <span className="text-[15px] font-semibold tracking-tight max-[420px]:hidden">Ghost Unit Radar</span>
        </Link>
        <nav className="ml-auto flex items-center gap-1 text-[13px]" aria-label="Main">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} aria-current={active === n.href ? "page" : undefined}
              className={`rounded-full px-3 py-1.5 transition-colors ${active === n.href ? "bg-ink text-bg" : "text-muted hover:text-ink"}`}>
              {n.label}
            </Link>
          ))}
        </nav>
        {children}
        <ThemeToggle />
      </div>
    </header>
  );
}

export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}
