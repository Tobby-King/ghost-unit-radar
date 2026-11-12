"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { STATUS, type Band } from "@/lib/data";

/* ---------- Status pill: colour + icon + word, never colour alone ---------- */
const TONE: Record<Band, string> = {
  0: "text-ok border-ok/40 bg-ok/10",
  1: "text-review border-review/45 bg-review/10",
  2: "text-field border-field/45 bg-field/10",
  3: "text-none border-none/45 bg-none/10",
};
export function StatusPill({ band, size = "sm" }: { band: Band; size?: "sm" | "lg" }) {
  const s = STATUS[band];
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-chip border font-medium ${TONE[band]} ${
        size === "lg" ? "px-3 py-1.5 text-[15px]" : "px-2 py-0.5 text-xs"
      }`}
    >
      <span aria-hidden="true" className={size === "lg" ? "text-[13px]" : "text-[10px]"}>{s.icon}</span>
      {s.label}
    </span>
  );
}

export function SourceTag({ source }: { source: string }) {
  const synthetic = source.toUpperCase().startsWith("SYN");
  return (
    <span
      className={`rounded-[4px] border px-1.5 py-px font-mono text-[10px] font-medium tracking-wide ${
        synthetic ? "border-review/50 text-review" : "border-accent/50 text-accent-ink"
      }`}
      title={synthetic ? "Generated for the demo – not real INEC data" : "From real public data"}
    >
      {synthetic ? "SYNTHETIC" : "REAL DATA"}
    </span>
  );
}

/* ---------- Brand mark: a quiet radar ---------- */
export function Logo({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <circle cx="16" cy="16" r="14" fill="none" stroke="rgb(var(--accent))" strokeOpacity=".35" strokeWidth="1.4" />
      <circle cx="16" cy="16" r="8.5" fill="none" stroke="rgb(var(--accent))" strokeOpacity=".6" strokeWidth="1.4" />
      <g className="sweep">
        <path d="M16 16 L16 2 A14 14 0 0 1 28.1 9 Z" fill="rgb(var(--accent))" fillOpacity=".18" />
        <path d="M16 16 L28.1 9" stroke="rgb(var(--accent))" strokeWidth="1.6" strokeLinecap="round" />
      </g>
      <circle cx="22" cy="21" r="2.1" fill="rgb(var(--st-field))" />
      <circle cx="16" cy="16" r="1.6" fill="rgb(var(--accent))" />
    </svg>
  );
}

/* ---------- Theme ---------- */
export function useTheme(): ["dark" | "light", () => void] {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === "light" ? "light" : "dark");
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
    <button type="button" onClick={toggle} className="grid h-8 w-8 place-items-center rounded-chip border border-line text-muted hover:text-ink"
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`} title="Theme">
      {theme === "dark" ? (
        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="10" cy="10" r="3.5" /><path d="M10 1.5v2M10 16.5v2M1.5 10h2M16.5 10h2M4 4l1.4 1.4M14.6 14.6 16 16M4 16l1.4-1.4M14.6 5.4 16 4" /></svg>
      ) : (
        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M16.5 12.5A7 7 0 0 1 7.5 3.5a7 7 0 1 0 9 9Z" /></svg>
      )}
    </button>
  );
}

/* ---------- Top bar ---------- */
const NAV = [
  { href: "/", label: "Map" },
  { href: "/findings/", label: "Findings" },
  { href: "/about.html", label: "How it works" },
  { href: "/methods/", label: "Methods & Ethics" },
];
export function TopBar({ active, children }: { active: "/" | "/findings/" | "/methods/"; children?: React.ReactNode }) {
  return (
    <header className="relative z-30 flex h-14 shrink-0 items-center gap-3 border-b border-line bg-surface px-4 md:gap-5">
      <Link href="/" className="flex items-center gap-2.5" aria-label="Ghost Unit Radar – map">
        <Logo />
        <span className="font-display text-[17px] leading-none tracking-tight max-[440px]:hidden">Ghost Unit Radar</span>
      </Link>
      <span className="hidden rounded-chip border border-review/50 bg-review/10 px-2 py-0.5 font-mono text-[10.5px] font-medium tracking-[0.08em] text-review sm:inline"
        title="Registered-voter and result-sheet numbers are generated for this demo">
        SYNTHETIC REGISTERS · DEMO
      </span>
      <span className="hidden text-xs text-muted xl:inline">
        Polling-unit list: <span className="text-ink/80">INEC, retrieved 2022</span>
      </span>
      <nav className="ml-auto flex items-center gap-0.5 text-sm" aria-label="Main">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} aria-current={active === n.href ? "page" : undefined}
            className={`rounded-chip px-2.5 py-1.5 ${active === n.href ? "bg-raised text-ink" : "text-muted hover:text-ink"} ${n.href === "/methods/" ? "whitespace-nowrap" : ""} ${n.href === "/about.html" ? "hidden whitespace-nowrap lg:inline" : ""}`}>
            {n.href === "/methods/" ? <><span className="hidden sm:inline">Methods &amp; Ethics</span><span className="sm:hidden">Methods</span></> : n.label}
          </Link>
        ))}
      </nav>
      {children}
      <ThemeToggle />
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
