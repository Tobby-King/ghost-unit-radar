"use client";

import dynamic from "next/dynamic";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import type { Feature, FeatureCollection, LineString, Point } from "geojson";
import {
  FLAG_BITS, STATUS, clockFlag, fmt, getJSON, inNigeriaBox, indexToUid, loadUnit, titleCase, uidToIndex,
  type Band, type SearchIndex, type Showcase, type Summary, type UnitDetail, type UnitIndex,
} from "@/lib/data";
import FilterPanel, { DEFAULT_FILTERS, type Counts, type Filters } from "./FilterPanel";
import type { PointProps, RadarMapHandle } from "./RadarMap";
import Sheet from "./Sheet";
import SummaryStrip from "./SummaryStrip";
import UnitCard from "./UnitCard";
import { Logo, StatusMark, TopBar, usePrefersReducedMotion } from "./ui";

const RadarMap = dynamic(() => import("./RadarMap"), { ssr: false });
const DRAWER = 380;
const WORLD: [[number, number], [number, number]] = [[-128, -12], [96, 60]];

function useMediaQuery(q: string) {
  const [m, setM] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(q);
    setM(mq.matches);
    const on = () => setM(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [q]);
  return m;
}

export default function MapApp() {
  const [idx, setIdx] = useState<UnitIndex | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [showcase, setShowcase] = useState<Showcase[]>([]);
  const [centroids, setCentroids] = useState<Record<string, [number, number]>>({});
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState<SearchIndex | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const q = useDeferredValue(filters.q);
  const [spv, setSpv] = useState(45);
  const [sel, setSel] = useState<number | null>(null);
  const selRef = useRef<number | null>(null);
  const [detail, setDetail] = useState<UnitDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [intro, setIntro] = useState(true);
  const [presenting, setPresenting] = useState(false);
  const [step, setStep] = useState(0);
  const [mobileFilters, setMobileFilters] = useState(false);
  const [fv, setFv] = useState<string[]>([]);
  const [mapReady, setMapReady] = useState(false);
  const booted = useRef(false);
  const mapApi = useRef<RadarMapHandle>(null);
  const isMobile = useMediaQuery("(max-width: 767px)");
  const reduced = usePrefersReducedMotion();

  // ---------- load ----------
  useEffect(() => {
    Promise.all([
      getJSON<UnitIndex>("/data/units.json"),
      getJSON<Summary>("/data/summary.json"),
      getJSON<Showcase[]>("/data/showcase.json"),
      getJSON<Record<string, [number, number]>>("/data/state_centroids.json"),
    ]).then(([u, s, sc, c]) => {
      setIdx(u); setSummary(s); setShowcase(sc); setCentroids(c);
      setSpv(s.params.seconds_per_voter);
    }).catch((e: Error) => setError(e.message));
    try { setFv(JSON.parse(localStorage.getItem("gur-fv") || "[]")); } catch { /* storage blocked */ }
  }, []);

  useEffect(() => {
    if (!filters.q || search || searchLoading) return;
    setSearchLoading(true);
    getJSON<SearchIndex>("/data/search.json").then(setSearch).catch(() => {}).finally(() => setSearchLoading(false));
  }, [filters.q, search, searchLoading]);

  // ---------- filtering (same rules as the original app) ----------
  const result = useMemo(() => {
    if (!idx || !summary) return null;
    const hours = summary.params.polling_hours;
    const needle = q.trim().toUpperCase();
    const useQ = needle.length > 0 && search != null;
    const bit = filters.check && filters.check !== "CLOCK" ? FLAG_BITS[filters.check] : 0;
    const list: number[] = [];
    const counts: Counts = { matched: 0, mapped: 0, outside: 0, byBand: [0, 0, 0, 0] };
    for (let i = 0; i < idx.band.length; i++) {
      if (filters.state >= 0 && idx.state[i] !== filters.state) continue;
      if (filters.lga >= 0 && idx.lga[i] !== filters.lga) continue;
      if (bit && !(idx.flags[i] & bit)) continue;
      if (filters.check === "CLOCK" && !clockFlag(idx.acc[i], idx.dev[i], hours, spv)) continue;
      if (useQ && !`${search!.name[i]} ${search!.ward[i]} ${idx.lgas[idx.lga[i]][1]}`.toUpperCase().includes(needle)) continue;
      const b = idx.band[i];
      counts.byBand[b]++;
      if (!filters.bands[b]) continue;
      list.push(i);
      if (idx.lat[i] != null) counts.mapped++;
      if (idx.flags[i] & 1) counts.outside++;
    }
    counts.matched = list.length;
    return { list, counts };
  }, [idx, summary, filters.state, filters.lga, filters.check, filters.bands, q, search, spv]);

  const points = useMemo<FeatureCollection<Point, PointProps>>(() => {
    const features: Feature<Point, PointProps>[] = [];
    if (idx && result) for (const i of result.list) {
      const lat = idx.lat[i], lon = idx.lon[i];
      if (lat != null && lon != null) features.push({ type: "Feature", properties: { i, b: idx.band[i] }, geometry: { type: "Point", coordinates: [lon, lat] } });
    }
    return { type: "FeatureCollection", features };
  }, [idx, result]);

  const links = useMemo<FeatureCollection<LineString>>(() => {
    const features: Feature<LineString>[] = [];
    if (idx && result) for (const i of result.list) {
      if (!(idx.flags[i] & 1) || idx.lat[i] == null) continue;
      const c = centroids[idx.states[idx.state[i]]];
      if (c) features.push({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [[idx.lon[i]!, idx.lat[i]!], c] } });
    }
    return { type: "FeatureCollection", features };
  }, [idx, result, centroids]);

  const searchResults = useMemo(() => {
    if (!idx || !search || !q.trim() || !result) return [];
    return result.list.slice(0, 8).map((i) => ({
      i, band: idx.band[i], name: titleCase(search.name[i]),
      sub: `${titleCase(search.ward[i])} · ${titleCase(idx.lgas[idx.lga[i]][1])} · ${titleCase(idx.states[idx.state[i]])}`,
    }));
  }, [idx, search, q, result]);

  // ---------- selection ----------
  const pad = useCallback(() => ({ padRight: isMobile ? 0 : DRAWER, padBottom: isMobile ? window.innerHeight * 0.5 : 0 }), [isMobile]);
  const openUnit = useCallback(async (i: number, fly: boolean, duration?: number) => {
    if (!idx) return;
    selRef.current = i;
    setSel(i); setDetail(null); setDetailLoading(true); setIntro(false); setMobileFilters(false);
    try { history.replaceState(null, "", `#${indexToUid(i)}`); } catch { /* sandboxed */ }
    const lat = idx.lat[i], lon = idx.lon[i];
    if (fly && lat != null && lon != null) mapApi.current?.flyTo(lon, lat, idx.flags[i] & 1 ? 11 : 14, { ...pad(), duration });
    const d = await loadUnit(indexToUid(i), idx.states[idx.state[i]]).catch(() => null);
    if (selRef.current === i) { setDetail(d); setDetailLoading(false); }
  }, [idx, pad]);
  const closeUnit = useCallback(() => {
    selRef.current = null; setSel(null); setDetail(null);
    try { history.replaceState(null, "", location.pathname); } catch { /* sandboxed */ }
  }, []);

  const strangest = useCallback(() => {
    const s = showcase[0];
    if (!s) return;
    setFilters(DEFAULT_FILTERS);
    openUnit(uidToIndex(s.uid), true, 5200);
  }, [showcase, openUnit]);

  // Deep link (#PU000002, also the old #N~PU000002 form) once data and map are ready.
  useEffect(() => {
    if (!idx || !mapReady || booted.current) return;
    booted.current = true;
    const m = /PU\d{6}/.exec(decodeURIComponent(location.hash));
    if (m) openUnit(uidToIndex(m[0]), true, 2500);
  }, [idx, mapReady, openUnit]);

  // Fit to a chosen state / LGA.
  useEffect(() => {
    if (!idx || filters.state < 0) return;
    let w = 180, s = 90, e = -180, n = -90, any = false;
    for (let i = 0; i < idx.band.length; i++) {
      if (idx.state[i] !== filters.state || (filters.lga >= 0 && idx.lga[i] !== filters.lga)) continue;
      const lat = idx.lat[i], lon = idx.lon[i];
      if (lat == null || lon == null || !inNigeriaBox(lat, lon)) continue;
      any = true; w = Math.min(w, lon); e = Math.max(e, lon); s = Math.min(s, lat); n = Math.max(n, lat);
    }
    if (any) mapApi.current?.fitBounds([[w, s], [e, n]], { padRight: sel != null && !isMobile ? DRAWER : 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, filters.state, filters.lga]);

  const pickTile = (key: "all" | "outside" | "stacked" | "field") => {
    closeUnit();
    if (key === "all") { setFilters(DEFAULT_FILTERS); mapApi.current?.fitNigeria(); }
    if (key === "outside") { setFilters({ ...DEFAULT_FILTERS, check: "OUTSIDE_NIGERIA" }); mapApi.current?.fitBounds(WORLD, { padRight: 0 }); }
    if (key === "stacked") { setFilters({ ...DEFAULT_FILTERS, check: "STACKED" }); mapApi.current?.fitNigeria(); }
    if (key === "field") { setFilters({ ...DEFAULT_FILTERS, bands: [false, false, true, false] }); mapApi.current?.fitNigeria(); }
  };

  // ---------- field-verification list ----------
  const saveFv = (list: string[]) => { setFv(list); try { localStorage.setItem("gur-fv", JSON.stringify(list)); } catch { /* storage blocked */ } };
  const toggleFv = () => { if (!detail) return; saveFv(fv.includes(detail.uid) ? fv.filter((x) => x !== detail.uid) : [...fv, detail.uid]); };
  const downloadFv = async () => {
    if (!idx) return;
    const units = (await Promise.all(fv.map((uid) => loadUnit(uid, idx.states[idx.state[uidToIndex(uid)]]).catch(() => null)))).filter(Boolean) as UnitDetail[];
    const cell = (v: unknown) => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const head = ["uid", "state", "lga", "ward", "name", "lat", "lon", "band", "score", "register_SYNTHETIC", "accredited_SYNTHETIC",
      "bvas_devices_SYNTHETIC", "adults_within_radius", "flags", "reasons", "innocent_explanations"];
    const band = ["green", "amber", "red", "grey"];
    const rows = units.map((u) => [u.uid, u.state, u.lga, u.ward, u.name, u.lat, u.lon, band[u.band], u.score, u.register, u.accredited,
      u.devices, u.adults_r, u.reasons.map((r) => r.code).join("|"), u.reasons.map((r) => `[${r.source}] ${r.text}`).join(" | "),
      u.reasons.map((r) => r.innocent).join(" | ")].map(cell).join(","));
    const note = "# Ghost Unit Radar field-verification list. Registers/result sheets are SYNTHETIC. Flags need field verification and are not findings of fraud.";
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([[note, head.join(","), ...rows].join("\n")], { type: "text/csv" }));
    a.download = "ghost-unit-radar_my-field-verification-list.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  // ---------- presentation mode ----------
  const goStep = useCallback((k: number) => {
    const s = showcase[k];
    if (!s) return;
    setStep(k);
    openUnit(uidToIndex(s.uid), true, 4500);
  }, [showcase, openUnit]);
  const togglePresent = useCallback(() => {
    setPresenting((p) => {
      if (!p) { setFilters(DEFAULT_FILTERS); setTimeout(() => goStep(0), 50); }
      return !p;
    });
  }, [goStep]);
  useEffect(() => { document.documentElement.classList.toggle("presenting", presenting); }, [presenting]);
  useEffect(() => () => document.documentElement.classList.remove("presenting"), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.metaKey || e.ctrlKey || e.altKey || /INPUT|SELECT|TEXTAREA/.test(t.tagName)) return;
      if (e.key === "p" || e.key === "P") { e.preventDefault(); togglePresent(); return; }
      if (presenting) {
        if (["ArrowRight", "PageDown", " "].includes(e.key)) { e.preventDefault(); goStep(Math.min(showcase.length - 1, step + 1)); }
        if (["ArrowLeft", "PageUp"].includes(e.key)) { e.preventDefault(); goStep(Math.max(0, step - 1)); }
        if (e.key === "Escape") setPresenting(false);
      } else if (e.key === "Escape" && sel != null) closeUnit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [presenting, step, showcase.length, goStep, togglePresent, sel, closeUnit]);

  // ---------- render ----------
  const cardOpen = sel != null;
  const card = summary && (
    <UnitCard unit={detail} loading={detailLoading} summary={summary} centroids={centroids} spv={spv}
      inList={!!detail && fv.includes(detail.uid)} listSize={fv.length} onToggleList={toggleFv} onClose={closeUnit} />
  );
  const panel = idx && summary && result && (
    <FilterPanel idx={idx} summary={summary} filters={filters} setFilters={setFilters} counts={result.counts} spv={spv} setSpv={setSpv}
      searching={searchLoading} listSize={fv.length} onDownloadList={downloadFv} onClearList={() => saveFv([])} onStrangest={strangest}
      results={searchResults} onPickResult={(i) => openUnit(i, true, 2500)} />
  );

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      {!presenting && (
        <TopBar active="/">
          <button type="button" onClick={togglePresent} className="hidden text-[14px] text-muted hover:text-ink md:inline"
            title="Presentation mode (keyboard: P)" aria-keyshortcuts="P">
            Present
          </button>
        </TopBar>
      )}

      <div className="relative flex min-h-0 flex-1">
        {!presenting && !isMobile && (
          <aside className="w-[320px] shrink-0 overflow-y-auto border-r border-line bg-bg" aria-label="Search and filters">{panel}</aside>
        )}

        <main className="relative min-w-0 flex-1 overflow-hidden">
          {idx && (
            <RadarMap apiRef={mapApi} points={points} links={links} reducedMotion={reduced}
              selected={sel != null && idx.lat[sel] != null ? [idx.lon[sel]!, idx.lat[sel]!] : null}
              onSelect={(i) => openUnit(i, false)} onReady={() => setMapReady(true)}
              padRight={cardOpen && !isMobile ? DRAWER : 0} padBottom={cardOpen && isMobile ? 300 : 0} />
          )}

          {!idx && (
            <div className="absolute inset-0 grid place-items-center">
              <div className="flex items-center gap-3 text-sm text-muted">
                <Logo className="h-8 w-8" />
                {error ? <span>Could not load data: {error}</span> : <span>Loading 176,623 polling units…</span>}
              </div>
            </div>
          )}

          {presenting && (
            <div className="absolute left-4 top-4 z-10 flex items-center gap-3 border border-line bg-bg px-3 py-2">
              <Logo />
              <span className="font-display text-lg">Ghost Unit Radar</span>
              <span className="flex items-center gap-1.5 text-[13px] text-muted"><span className="inline-block h-2 w-2 bg-review" aria-hidden="true" />Demo: voter registers are synthetic</span>
            </div>
          )}

          {intro && summary && !presenting && (
            <section className="absolute left-3 right-3 top-[64px] z-10 max-w-[400px] border border-line bg-bg p-5 md:left-4 md:right-auto md:top-4" aria-labelledby="intro-h">
              <p className="text-[13px] text-muted">INEC polling-unit list, 2022 · checked against public map data</p>
              <h1 id="intro-h" className="mt-2 text-[24px] leading-[1.2]">
                Of {fmt(summary.national.units)} polling units, {fmt(summary.national.outside_nigeria)} are placed outside Nigeria.
              </h1>
              <p className="mt-3 leading-relaxed text-ink/85">
                One Kogi State primary school is mapped to Waterloo, Canada. This map checks all {fmt(summary.national.with_coordinates)} published
                locations, and the population around them, so field teams know where to look first.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-4">
                <button type="button" className="btn-primary" onClick={strangest} disabled={!mapReady}>Show the school in Canada</button>
                <button type="button" className="text-[14px] text-muted underline underline-offset-2 hover:text-ink" onClick={() => setIntro(false)}>Explore the map</button>
              </div>
            </section>
          )}

          {!presenting && !isMobile && idx && (
            <div className="pointer-events-none absolute bottom-3 left-3 z-10 max-w-[380px] border border-line bg-bg px-3 py-2 text-[12px]" aria-label="Map legend">
              <ul className="flex flex-wrap gap-x-3 gap-y-1">
                {STATUS.slice(0, 3).map((s, b) => (
                  <li key={s.key} className="flex items-center gap-1.5"><StatusMark band={b as Band} />{s.label}</li>
                ))}
              </ul>
              <p className="mt-1 text-muted">Circles group nearby units; their outline shows the most serious status inside. Dashed lines join a misplaced unit to its state.</p>
            </div>
          )}

          {isMobile && idx && !presenting && (
            <div className="absolute inset-x-3 top-3 z-10 flex gap-2">
              <button type="button" className="flex flex-1 items-center gap-2 rounded-[4px] border border-line bg-bg px-3 py-2.5 text-left text-sm"
                onClick={() => { setMobileFilters(true); setIntro(false); }}>
                <svg viewBox="0 0 20 20" className="h-4 w-4 text-muted" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="9" cy="9" r="5.5" /><path d="m13.5 13.5 3.5 3.5" /></svg>
                <span className="flex-1 truncate text-muted">{filters.q || "Search and filter"}</span>
                <span className="tabular-nums text-xs text-muted">{fmt(result?.counts.matched)} units</span>
              </button>
            </div>
          )}

          {presenting && showcase.length > 0 && (
            <div className="absolute bottom-5 left-4 z-20 flex justify-center" style={{ right: (cardOpen ? DRAWER : 0) + 16 }}>
              <div className="flex w-full max-w-[760px] items-center gap-4 border border-line bg-bg px-4 py-3" role="group" aria-label="Presentation controls">
              <span className="tabular-nums text-sm text-muted">{step + 1} of {showcase.length}</span>
              <p className="flex-1 font-display text-[17px] leading-snug">{showcase[step]?.caption}</p>
              <div className="flex gap-1.5">
                <button type="button" className="btn-ghost !px-2.5" onClick={() => goStep(Math.max(0, step - 1))} disabled={step === 0} aria-label="Previous unit">←</button>
                <button type="button" className="btn-primary !px-2.5" onClick={() => goStep(Math.min(showcase.length - 1, step + 1))} disabled={step === showcase.length - 1} aria-label="Next unit">→</button>
                <button type="button" className="btn-ghost !px-2.5 text-xs" onClick={() => setPresenting(false)}>Exit <kbd className="font-mono opacity-70">Esc</kbd></button>
              </div>
            </div>
            </div>
          )}

          {!isMobile && (
            <aside aria-label="Unit card" aria-hidden={!cardOpen}
              className={`absolute bottom-0 right-0 top-0 z-20 w-[380px] overflow-y-auto border-l border-line bg-bg transition-transform duration-300 ease-out ${cardOpen ? "translate-x-0" : "pointer-events-none translate-x-full"}`}>
              {cardOpen && card}
            </aside>
          )}
        </main>
      </div>

      {!presenting && !isMobile && summary && <SummaryStrip summary={summary} onPick={pickTile} />}

      {isMobile && (
        <>
          <Sheet open={mobileFilters} onClose={() => setMobileFilters(false)} label="Search and filters" initial={0.62}>{panel}</Sheet>
          <Sheet open={cardOpen && !mobileFilters} onClose={closeUnit} label="Unit card" initial={0.5}>{card}</Sheet>
        </>
      )}
    </div>
  );
}
