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
const SOLID: Record<Band, string> = { 0: "bg-ok", 1: "bg-review", 2: "bg-field", 3: "bg-nodata" };
export function StatusPill({ band, size = "sm" }: { band: Band; size?: "sm" | "lg" }) {
  const s = STATUS[band];
  if (size === "lg") {
    // A flat, printed-looking stamp: solid colour, dark ink, square corners.
    return (
      <span className={`inline-flex items-center gap-2 rounded-[3px] px-2.5 py-1 text-[15px] font-semibold text-[#141414] ${SOLID[band]}`}>
        <svg viewBox="0 0 10 10" width="11" height="11" aria-hidden="true">
          {band === 0 && <circle cx="5" cy="5" r="4" fill="#141414" />}
          {band === 1 && <path d="M5 1 9.2 9H.8Z" fill="#141414" />}
          {band === 2 && <path d="M5 .6 9.4 5 5 9.4.6 5Z" fill="#141414" />}
          {band === 3 && <circle cx="5" cy="5" r="3.4" fill="none" stroke="#141414" strokeWidth="1.4" />}
        </svg>
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
    <span className={`text-xs italic ${synthetic ? "text-review" : "text-muted"}`}
      title={synthetic ? "Generated for the demo – not real INEC data" : "From real public data"}>
      {synthetic ? "synthetic data" : "real public data"}
    </span>
  );
}

/* ---------- Brand mark: a plain survey crosshair ---------- */
export function Logo({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <circle cx="16" cy="16" r="9" fill="none" stroke="rgb(var(--ink))" strokeWidth="2" />
      <path d="M16 3v6M16 23v6M3 16h6M23 16h6" stroke="rgb(var(--ink))" strokeWidth="2" />
      <circle cx="16" cy="16" r="2.6" fill="rgb(var(--st-field))" />
    </svg>
  );
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
    <button type="button" onClick={toggle} className="grid h-8 w-8 place-items-center rounded-[4px] text-muted hover:text-ink"
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
    <header className="relative z-30 flex h-[52px] shrink-0 items-center gap-4 border-b border-line bg-bg px-4 md:gap-6">
      <Link href="/" className="flex items-center gap-2" aria-label="Ghost Unit Radar – map">
        <Logo />
        <span className="font-display text-[18px] leading-none max-[440px]:hidden">Ghost Unit Radar</span>
      </Link>
      <p className="hidden items-center gap-1.5 text-[13px] text-muted sm:flex" title="Registered-voter and result-sheet numbers are generated for this demo">
        <span className="inline-block h-2 w-2 bg-review" aria-hidden="true" />
        Demo: voter registers are synthetic
        <span className="hidden xl:inline">· polling-unit list from INEC, retrieved 2022</span>
      </p>
      <nav className="ml-auto flex items-center gap-4 text-[14px]" aria-label="Main">
        {NAV.map((n) => n.href.endsWith(".html") ? (
          <a key={n.href} href={n.href} className="hidden whitespace-nowrap text-muted hover:text-ink lg:inline">{n.label}</a>
        ) : (
          <Link key={n.href} href={n.href} aria-current={active === n.href ? "page" : undefined}
            className={`whitespace-nowrap border-b-2 py-[14px] ${active === n.href ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink"}`}>
            {n.href === "/methods/" ? <><span className="hidden sm:inline">Methods &amp; ethics</span><span className="sm:hidden">Methods</span></> : n.label}
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
