"use client";

import dynamic from "next/dynamic";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import type { Feature, FeatureCollection, LineString, Point } from "geojson";
import {
  FLAG_BITS, STATUS, clockFlag, fmt, getJSON, haversineKm, inNigeriaBox, indexToUid, loadUnit, stateName, titleCase, uidToIndex,
  type Band, type SearchIndex, type Showcase, type Summary, type UnitDetail, type UnitIndex,
} from "@/lib/data";
import ExplorePanel, { Chevron, type QuickKey } from "./ExplorePanel";
import FilterPanel, { DEFAULT_FILTERS, type Counts, type Filters } from "./FilterPanel";
import type { Pad, PointProps, RadarMapHandle } from "./RadarMap";
import Sheet from "./Sheet";
import UnitCard from "./UnitCard";
import { Logo, StatusMark, useTheme, usePrefersReducedMotion } from "./ui";

const RadarMap = dynamic(() => import("./RadarMap"), { ssr: false });
const PANEL = 400; // desktop floating panel width
const SHEET = 0.46; // mobile sheet resting height (fraction of the screen)
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
  const [view, setView] = useState<"explore" | "filters">("explore");
  const [menu, setMenu] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [presenting, setPresenting] = useState(false);
  const [step, setStep] = useState(0);
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
  const pad = useCallback((): Pad => (isMobile ? { top: 110, bottom: window.innerHeight * SHEET } : { left: PANEL + 24, top: 50 }), [isMobile]);
  const openUnit = useCallback(async (i: number, fly: boolean, duration?: number) => {
    if (!idx) return;
    selRef.current = i;
    setSel(i); setDetail(null); setDetailLoading(true); setMenu(false);
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
    const i = uidToIndex(s.uid);
    const c = centroids[s.state];
    if (idx && c && idx.lat[i] != null) {
      const km = haversineKm(idx.lat[i]!, idx.lon[i]!, c[1], c[0]);
      setToast(`Following the official coordinate · ${fmt(km)} km from ${stateName(s.state)}`);
      setTimeout(() => setToast(null), reduced ? 3000 : 5600);
    }
    openUnit(i, true, 5200);
  }, [showcase, openUnit, centroids, idx, reduced]);

  // Deep link (#PU000002, also the old #N~PU000002 form) once data and map are ready.
  useEffect(() => {
    if (!idx || !mapReady || booted.current) return;
    booted.current = true;
    const m = /PU\d{6}/.exec(decodeURIComponent(location.hash));
    if (m) openUnit(uidToIndex(m[0]), true, 2500);
  }, [idx, mapReady, openUnit]);
  useEffect(() => {
    const onHash = () => {
      const m = /PU\d{6}/.exec(decodeURIComponent(location.hash));
      if (m && uidToIndex(m[0]) !== selRef.current) openUnit(uidToIndex(m[0]), true, 2500);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [openUnit]);

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
    if (any) mapApi.current?.fitBounds([[w, s], [e, n]], pad());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, filters.state, filters.lga]);

  const quick = (key: QuickKey) => {
    closeUnit();
    if (key === "all") { setFilters(DEFAULT_FILTERS); mapApi.current?.fitNigeria(pad()); }
    if (key === "outside") { setFilters({ ...DEFAULT_FILTERS, check: "OUTSIDE_NIGERIA" }); mapApi.current?.fitBounds(WORLD, pad()); }
    if (key === "stacked") { setFilters({ ...DEFAULT_FILTERS, check: "STACKED" }); mapApi.current?.fitNigeria(pad()); }
    if (key === "field") { setFilters({ ...DEFAULT_FILTERS, bands: [false, false, true, false] }); mapApi.current?.fitNigeria(pad()); }
  };

  // Chips under the search bar: each toggles one simple filter, like the category chips in a maps app.
  const B = filters.bands;
  const chips: { key: string; label: string; band?: Band; active: boolean; on: () => void }[] = [
    { key: "field", label: "Field check needed", band: 2, active: !B[0] && !B[1] && B[2] && !B[3],
      on: () => setFilters({ ...filters, bands: !B[0] && !B[1] && B[2] && !B[3] ? [true, true, true, true] : [false, false, true, false] }) },
    { key: "review", label: "Review", band: 1, active: !B[0] && B[1] && !B[2] && !B[3],
      on: () => setFilters({ ...filters, bands: !B[0] && B[1] && !B[2] && !B[3] ? [true, true, true, true] : [false, true, false, false] }) },
    ...([["OUTSIDE_NIGERIA", "Outside Nigeria"], ["WRONG_STATE", "Wrong state"], ["STACKED", "Stacked"], ["CLOCK", "Clock audit"], ["REGISTER_ABOVE_ADULTS", "Register too large"]] as const)
      .map(([check, label]) => ({ key: check, label, active: filters.check === check,
        on: () => {
          const next = filters.check === check ? "" : check;
          setFilters({ ...filters, check: next });
          if (check === "OUTSIDE_NIGERIA") next ? mapApi.current?.fitBounds(WORLD, pad()) : mapApi.current?.fitNigeria(pad());
        } })),
  ];
  const filtersActive = filters.state >= 0 || filters.lga >= 0 || !!filters.check || B.some((x) => !x);

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
  const [theme, toggleTheme] = useTheme();
  const cardOpen = sel != null;
  const searching = filters.q.trim().length > 0;
  const card = summary && (
    <UnitCard unit={detail} loading={detailLoading} summary={summary} centroids={centroids} spv={spv}
      inList={!!detail && fv.includes(detail.uid)} listSize={fv.length} onToggleList={toggleFv} onClose={closeUnit} />
  );
  const filterPanel = idx && summary && result && (
    <FilterPanel idx={idx} summary={summary} filters={filters} setFilters={setFilters} counts={result.counts} spv={spv} setSpv={setSpv}
      searching={searchLoading} listSize={fv.length} onDownloadList={downloadFv} onClearList={() => saveFv([])} onStrangest={strangest}
      results={[]} onPickResult={() => {}} />
  );
  const resultsList = (
    <div className="text-[14px]">
      <p className="px-5 pb-2 pt-4 text-[13px] text-muted">
        {searchLoading || !search ? "Loading unit names…" : `${fmt(result?.counts.matched)} match${result?.counts.matched === 1 ? "" : "es"} for “${filters.q.trim()}”`}
      </p>
      <ul>
        {searchResults.map((r) => (
          <li key={r.i}>
            <button type="button" onClick={() => openUnit(r.i, true, 2500)} className="flex w-full items-center gap-3 px-5 py-2.5 text-left hover:bg-raised/60">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-raised"><StatusMark band={r.band as Band} size={11} /></span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{r.name}</span>
                <span className="block truncate text-[13px] text-muted">{r.sub}</span>
              </span>
              <span className="sr-only">{STATUS[r.band].label}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
  const backHeader = (title: string, onBack: () => void) => (
    <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-line bg-surface px-2 py-2">
      <button type="button" onClick={onBack} className="grid h-9 w-9 place-items-center rounded-full hover:bg-raised" aria-label="Back">
        <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 4 6 10l6 6" /></svg>
      </button>
      <span className="font-medium">{title}</span>
    </div>
  );
  const content = cardOpen ? card
    : view === "filters" ? <>{backHeader("Filters", () => setView("explore"))}{filterPanel}</>
    : searching ? resultsList
    : idx && summary ? <ExplorePanel summary={summary} idx={idx} showcase={showcase} ready={mapReady} onQuick={quick}
        onOpen={(i, k) => (k === 0 ? strangest() : openUnit(i, true, 3500))} />
    : null;

  const searchBar = (
    <div className="float rise pointer-events-auto flex h-12 items-center gap-1 rounded-full px-1.5 focus-within:ring-2 focus-within:ring-accent/50">
      <button type="button" onClick={() => setMenu(true)} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted hover:bg-raised hover:text-ink" aria-label="Open menu">
        <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 6h14M3 10h14M3 14h14" /></svg>
      </button>
      <label htmlFor="q" className="sr-only">Search polling units, wards or LGAs</label>
      <input id="q" type="text" role="searchbox" enterKeyHint="search" value={filters.q} autoComplete="off"
        onChange={(e) => { setFilters({ ...filters, q: e.target.value }); if (sel != null) closeUnit(); setView("explore"); }}
        placeholder="Search polling units, wards, LGAs" className="min-w-0 flex-1 appearance-none border-0 bg-transparent px-1 text-[15px] outline-none placeholder:text-muted focus:outline-none focus-visible:outline-none [&::-webkit-search-cancel-button]:hidden" />
      {filters.q ? (
        <button type="button" onClick={() => setFilters({ ...filters, q: "" })} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted hover:bg-raised hover:text-ink" aria-label="Clear search">
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m5 5 10 10M15 5 5 15" /></svg>
        </button>
      ) : <Logo className="h-[22px] w-[22px] shrink-0" animate />}
      <span className="mx-1 h-6 w-px bg-line" aria-hidden="true" />
      <button type="button" onClick={() => { closeUnit(); setView(view === "filters" ? "explore" : "filters"); }}
        className={`relative grid h-9 w-9 shrink-0 place-items-center rounded-full hover:bg-raised ${view === "filters" ? "bg-raised text-ink" : "text-muted hover:text-ink"}`} aria-label="Filters" aria-pressed={view === "filters"}>
        <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 6h9M15 6h2M3 14h2M8 14h9" /><circle cx="13.5" cy="6" r="1.8" /><circle cx="6.5" cy="14" r="1.8" /></svg>
        {filtersActive && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-field" aria-hidden="true" />}
      </button>
    </div>
  );
  const chipRow = (
    <div className="pointer-events-auto flex gap-2 overflow-x-auto px-0.5 pb-1 [scrollbar-width:none]" role="toolbar" aria-label="Quick filters">
      {chips.map((c, k) => (
        <button key={c.key} type="button" onClick={c.on} aria-pressed={c.active} style={{ animationDelay: `${150 + k * 45}ms` }}
          className={`press rise flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium shadow-[0_1px_3px_rgb(0_0_0/0.18)] transition-colors ${c.active ? "bg-ink text-bg" : "bg-surface text-ink hover:bg-raised dark:border dark:border-line"}`}>
          {c.band != null && <StatusMark band={c.band} />}{c.label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="relative h-dvh overflow-hidden bg-bg">
      {idx && (
        <RadarMap apiRef={mapApi} points={points} links={links} reducedMotion={reduced} pad={pad()}
          selected={sel != null && idx.lat[sel] != null ? [idx.lon[sel]!, idx.lat[sel]!] : null}
          onSelect={(i) => openUnit(i, false)} onReady={() => setMapReady(true)} />
      )}
      {!idx && (
        <div className="absolute inset-0 grid place-items-center bg-bg">
          <div className="fade-in flex flex-col items-center text-center">
            <Logo className="h-16 w-16" loop />
            <p className="mt-4 font-display text-[22px]">Ghost Unit Radar</p>
            {error ? <p className="mt-2 text-sm text-field">Could not load data: {error}</p> : (
              <>
                <p className="mt-1 text-sm text-muted">Loading 176,623 polling units…</p>
                <div className="loading-bar mt-4 h-[3px] w-40 rounded-full bg-line" role="progressbar" aria-label="Loading" />
              </>
            )}
          </div>
        </div>
      )}

      {toast && (
        <div className="toast-in pointer-events-none absolute top-20 z-30 flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-[13px] text-bg shadow-lg"
          style={{ left: isMobile ? "50%" : `calc(50% + ${PANEL / 2}px)` }} role="status">
          <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-field opacity-75" /><span className="relative inline-flex h-2 w-2 rounded-full bg-field" /></span>
          {toast}
        </div>
      )}

      {/* Desktop: floating search + panel on the left, chips along the top */}
      {!isMobile && idx && (
        <>
          <div className="pointer-events-none absolute bottom-4 left-4 top-4 z-20 flex flex-col gap-3" style={{ width: PANEL }}>
            {presenting ? (
              <div className="float pointer-events-auto flex items-center gap-3 rounded-2xl px-4 py-3">
                <Logo /><span className="font-display text-lg">Ghost Unit Radar</span>
                <span className="ml-auto flex items-center gap-1.5 text-[13px] text-muted"><span className="h-2 w-2 bg-review" aria-hidden="true" />Synthetic registers</span>
              </div>
            ) : searchBar}
            {content && (
              <div key={cardOpen ? `u${sel}` : `${view}-${searching}`} style={{ animationDelay: "60ms" }}
                className="float rise pointer-events-auto min-h-0 overflow-y-auto overscroll-contain rounded-2xl">{content}</div>
            )}
          </div>
          {!presenting && (
            <div className="pointer-events-none absolute right-4 top-4 z-10 flex items-start gap-3" style={{ left: PANEL + 32 }}>
              <div className="min-w-0 flex-1 pt-2">{chipRow}</div>
              <div className="float rise pointer-events-auto mt-1.5 flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px]" style={{ animationDelay: "500ms" }} title="Registered-voter and result-sheet numbers are generated for this demo">
                <span className="h-2 w-2 bg-review" aria-hidden="true" />Demo · synthetic registers
              </div>
            </div>
          )}
        </>
      )}

      {/* Mobile: search + chips on top, a bottom sheet that is always there */}
      {isMobile && idx && !presenting && (
        <div className="pointer-events-none absolute inset-x-3 top-3 z-20 space-y-2">
          {searchBar}
          {chipRow}
        </div>
      )}
      {isMobile && idx && (
        <Sheet label={cardOpen ? "Unit card" : view === "filters" ? "Filters" : "Overview"} snapKey={`${sel}-${view}-${searching}`} initial={cardOpen || view === "filters" ? 0.6 : SHEET}>
          {content}
        </Sheet>
      )}

      {/* Round map buttons */}
      {idx && !presenting && (
        <div className="absolute right-4 z-10 flex flex-col gap-2" style={isMobile ? { top: 116 } : { bottom: 40 }}>
          <Fab label="Zoom in" onClick={() => mapApi.current?.zoomBy(1)}><path d="M10 4v12M4 10h12" /></Fab>
          <Fab label="Zoom out" onClick={() => mapApi.current?.zoomBy(-1)}><path d="M4 10h12" /></Fab>
          <Fab label="Show all of Nigeria" onClick={() => mapApi.current?.fitNigeria(pad())}><circle cx="10" cy="10" r="3" /><path d="M10 2v3M10 15v3M2 10h3M15 10h3" /></Fab>
          <Fab label="Show the whole world" onClick={() => mapApi.current?.fitBounds(WORLD, pad())}><circle cx="10" cy="10" r="7" /><path d="M3 10h14M10 3c2.5 2.5 2.5 11.5 0 14M10 3c-2.5 2.5-2.5 11.5 0 14" /></Fab>
        </div>
      )}

      {presenting && showcase.length > 0 && (
        <div className="absolute bottom-6 right-6 z-20 flex justify-center" style={{ left: PANEL + 40 }}>
          <div className="float flex w-full max-w-[720px] items-center gap-4 rounded-2xl px-5 py-3.5" role="group" aria-label="Presentation controls">
            <span className="tabular-nums text-sm text-muted">{step + 1} of {showcase.length}</span>
            <p className="flex-1 font-display text-[17px] leading-snug">{showcase[step]?.caption}</p>
            <div className="flex gap-1.5">
              <button type="button" className="btn-ghost !rounded-full !px-3" onClick={() => goStep(Math.max(0, step - 1))} disabled={step === 0} aria-label="Previous unit">←</button>
              <button type="button" className="btn-primary !rounded-full !px-3" onClick={() => goStep(Math.min(showcase.length - 1, step + 1))} disabled={step === showcase.length - 1} aria-label="Next unit">→</button>
              <button type="button" className="btn-ghost !rounded-full text-xs" onClick={() => setPresenting(false)}>Exit</button>
            </div>
          </div>
        </div>
      )}

      {/* Side menu */}
      {menu && (
        <div className="fixed inset-0 z-50" role="dialog" aria-label="Menu">
          <button type="button" className="fade-in absolute inset-0 bg-black/40" aria-label="Close menu" onClick={() => setMenu(false)} />
          <nav className="slide-in absolute bottom-0 left-0 top-0 flex w-[300px] max-w-[85vw] flex-col bg-surface shadow-2xl">
            <div className="flex items-center gap-2.5 border-b border-line px-5 py-4">
              <Logo className="h-7 w-7" animate /><span className="font-display text-[19px]">Ghost Unit Radar</span>
            </div>
            <p className="flex items-center gap-2 px-5 py-3 text-[13px] text-muted"><span className="h-2 w-2 bg-review" aria-hidden="true" />Demo: voter registers are synthetic</p>
            <ul className="py-1 text-[15px]">
              <MenuItem href="/findings/" label="Findings report" />
              <MenuItem href="/about.html" label="How it works" />
              <MenuItem href="/methods/" label="Methods & ethics" />
              <li>
                <button type="button" className="flex w-full items-center justify-between px-5 py-3 text-left hover:bg-raised" onClick={toggleTheme}>
                  {theme === "dark" ? "Light map" : "Dark map"} <Chevron />
                </button>
              </li>
              {!isMobile && (
                <li>
                  <button type="button" className="flex w-full items-center justify-between px-5 py-3 text-left hover:bg-raised" onClick={() => { setMenu(false); togglePresent(); }}>
                    <span>Presentation mode <kbd className="ml-1 rounded border border-line px-1 font-mono text-[11px] text-muted">P</kbd></span> <Chevron />
                  </button>
                </li>
              )}
            </ul>
            <p className="mt-auto border-t border-line px-5 py-4 text-[12px] leading-relaxed text-muted">
              Polling-unit list from INEC, retrieved 2022. No INEC system is accessed. A flag means a unit needs field verification, not that anything wrong happened.
            </p>
          </nav>
        </div>
      )}
    </div>
  );
}

function Fab({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label}
      className="float press rise grid h-10 w-10 place-items-center rounded-full text-ink hover:bg-raised" style={{ animationDelay: "300ms" }}>
      <svg viewBox="0 0 20 20" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">{children}</svg>
    </button>
  );
}

function MenuItem({ href, label }: { href: string; label: string }) {
  return (
    <li>
      <a href={href} className="flex items-center justify-between px-5 py-3 hover:bg-raised">{label} <Chevron /></a>
    </li>
  );
}
