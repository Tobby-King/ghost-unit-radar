// Data model + plausibility logic. Ported unchanged from the original web/app.js:
// bands, reasons, clock audit (hours × 3600 ÷ seconds-per-voter × devices) and CSV columns.
// Everything is read from static files in /data. Nothing here contacts any INEC system.

export type Band = 0 | 1 | 2 | 3; // 0 plausible (green) · 1 review (amber) · 2 field check (red) · 3 no location (grey)

export const STATUS: { key: string; band: Band; label: string; short: string; icon: string; varName: string }[] = [
  { key: "plausible", band: 0, label: "Plausible", short: "Plausible", icon: "●", varName: "--st-ok" },
  { key: "review", band: 1, label: "Review", short: "Review", icon: "▲", varName: "--st-review" },
  { key: "field", band: 2, label: "Field check needed", short: "Field check", icon: "◆", varName: "--st-field" },
  { key: "none", band: 3, label: "No location published", short: "No location", icon: "○", varName: "--st-none" },
];
export const BAND_FROM_NAME: Record<string, Band> = { green: 0, amber: 1, red: 2, grey: 3 };

export const FLAG_BITS: Record<string, number> = {
  OUTSIDE_NIGERIA: 1, WRONG_STATE: 2, STACKED: 4, NO_COORDINATE: 8, REGISTER_ABOVE_ADULTS: 16,
  EMPTY_CATCHMENT: 32, CLOCK_IMPOSSIBLE: 64, CLOCK_IMPLAUSIBLE: 128, FEW_ROOFTOPS: 256, NEW_BUILDINGS: 512,
};

export const LABEL: Record<string, string> = {
  OUTSIDE_NIGERIA: "Outside Nigeria", WRONG_STATE: "In a different state", STACKED: "Stacked on one point",
  NO_COORDINATE: "No location published", REGISTER_ABOVE_ADULTS: "Register above adults",
  EMPTY_CATCHMENT: "Almost nobody lives here", CLOCK_IMPOSSIBLE: "Clock: impossible",
  CLOCK_IMPLAUSIBLE: "Clock: implausible", FEW_ROOFTOPS: "Few rooftops", NEW_BUILDINGS: "New buildings",
};

export const CHECKS: { value: string; label: string; source: "Real" | "Synthetic" | "" }[] = [
  { value: "", label: "All checks", source: "" },
  { value: "OUTSIDE_NIGERIA", label: "Outside Nigeria", source: "Real" },
  { value: "WRONG_STATE", label: "In a different state", source: "Real" },
  { value: "STACKED", label: "Stacked on one point", source: "Real" },
  { value: "NO_COORDINATE", label: "No location published", source: "Real" },
  { value: "REGISTER_ABOVE_ADULTS", label: "Register above adults", source: "Synthetic" },
  { value: "EMPTY_CATCHMENT", label: "Almost nobody lives here", source: "Synthetic" },
  { value: "CLOCK", label: "Clock audit", source: "Synthetic" },
];

export interface UnitIndex {
  generated: string;
  states: string[];
  lgas: [number, string][];
  lat: (number | null)[];
  lon: (number | null)[];
  band: Band[];
  state: number[];
  lga: number[];
  flags: number[];
  score: number[];
  reg: (number | null)[];
  acc: (number | null)[];
  dev: (number | null)[];
}
export interface SearchIndex { name: string[]; ward: string[] }

export interface Summary {
  generated: string;
  params: { radius_km: number; seconds_per_voter: number; seconds_per_voter_fastest: number; polling_hours: number;
    adult_share: number; stack_min: number; border_tolerance_km: number };
  national: { units: number; with_coordinates: number; without_coordinates: number; outside_nigeria: number;
    wrong_state: number; stacked_units: number; stacked_points: number; largest_stack: { size: number; lga: string; state: string };
    red: number; amber: number; green: number; top_foreign_places: [string, number][] };
  reason_counts: Record<string, number>;
  no_coordinate_states: string[];
  states: Record<string, Record<string, number>>;
  synthetic_validation: { planted: number; detected: number; synthetic_flags_not_planted: number;
    by_type: Record<string, { planted: number; detected: number }> };
  index: { state: string; file: string; units: number; with_coordinates: number }[];
}

export interface Reason { code: string; source: "REAL" | "SYNTHETIC"; text: string; innocent: string }
export interface UnitDetail {
  i: number; uid: string; name: string; ward: string; lga: string; state: string; lat: number | null; lon: number | null;
  score: number; band: Band; register: number | null; accredited: number | null; devices: number | null;
  adults_r: number | null; units_r: number | null; adults_share: number | null; reasons: Reason[];
}
export interface Showcase { kind: string; uid: string; state: string; caption: string }
export interface FindingRow { uid: string; name: string; ward: string; lga: string; state: string; score: number; band: string; reasons: [string, string, string][] }
export interface StateFinding { state: string; units: number; with_coordinates: number; outside: number; wrong_state: number;
  stacked: number; no_coordinate: number; red: number; amber: number }
export interface Findings { top: FindingRow[]; byState: StateFinding[] }

// ---------- fetching ----------
const cache = new Map<string, Promise<unknown>>();
export function getJSON<T>(path: string): Promise<T> {
  if (!cache.has(path)) {
    const p = fetch(path).then((r) => {
      if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
      return r.json();
    });
    p.catch(() => cache.delete(path));
    cache.set(path, p);
  }
  return cache.get(path) as Promise<T>;
}

export const uidToIndex = (uid: string) => Number(uid.replace(/\D/g, "")) - 1;
export const indexToUid = (i: number) => "PU" + String(i + 1).padStart(6, "0");
export const stateFile = (state: string) => `/data/states/${state.replace(/ /g, "_")}.json`;

type StateFile = { state: string; cols: string[]; rows: unknown[][] };
export async function loadUnit(uid: string, state: string): Promise<UnitDetail | null> {
  const d = await getJSON<StateFile>(stateFile(state));
  const c = Object.fromEntries(d.cols.map((k, i) => [k, i])) as Record<string, number>;
  const r = d.rows.find((row) => row[c.uid] === uid);
  if (!r) return null;
  return {
    i: uidToIndex(uid), uid, name: r[c.name] as string, ward: r[c.ward] as string, lga: r[c.lga] as string, state: d.state,
    lat: r[c.lat] as number | null, lon: r[c.lon] as number | null, score: r[c.score] as number,
    band: BAND_FROM_NAME[r[c.band] as string] ?? 3, register: r[c.register] as number | null,
    accredited: r[c.accredited] as number | null, devices: r[c.devices] as number | null,
    adults_r: r[c.adults_r] as number | null, units_r: r[c.units_r] as number | null, adults_share: r[c.adults_share] as number | null,
    reasons: (r[c.reasons] as string[][]).map(([code, source, text, innocent]) => ({ code, source: source as Reason["source"], text, innocent })),
  };
}

// ---------- clock audit (same formula as the original app) ----------
export const maxAccredited = (hours: number, spv: number, devices: number) => Math.floor((hours * 3600) / spv) * devices;
export const clockFlag = (acc: number | null, dev: number | null, hours: number, spv: number) =>
  acc != null && dev != null && acc > maxAccredited(hours, spv, dev);

// ---------- formatting ----------
export const fmt = (n: number | null | undefined) => (n == null || Number.isNaN(n) ? "–" : Math.round(n).toLocaleString("en-NG"));
// Keeps roman numerals (UGO I & II) and common school/agency acronyms (LGEA, UBE…) in capitals.
const KEEP_UPPER = /^(?:[IVX]+|LGEA|LEA|UBE|UPE|CMS|RCM|CAC|ECWA|NKST|PHC|FGC|GSS|GDSS|JSS|SSS|CPS|NUD|LGA|LG|MCH|NYSC|CKC|UMCA|ECWA|AUD|SDA|ACM|CMML|CSS|PS)$/;
export const titleCase = (s: string) =>
  s.toLowerCase().replace(/[a-z0-9']+/g, (w, at: number, all: string) => {
    if (KEEP_UPPER.test(w.toUpperCase()) && !(w === "i" && /\w'$/.test(all.slice(0, at)))) return w.toUpperCase();
    return at > 0 && all[at - 1] === "'" ? w : w.charAt(0).toUpperCase() + w.slice(1);
  });
export const stateName = (s: string) => (s === "FEDERAL CAPITAL TERRITORY" ? "Federal Capital Territory" : `${titleCase(s)} State`);

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371, t = Math.PI / 180;
  const a = Math.sin(((lat2 - lat1) * t) / 2) ** 2 + Math.cos(lat1 * t) * Math.cos(lat2 * t) * Math.sin(((lon2 - lon1) * t) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Rewrites pipeline reason text into a plain-English sentence for the Unit Card. */
export function plainReason(r: Reason, u: UnitDetail, centroids: Record<string, [number, number]>): string {
  const c = centroids[u.state];
  const dist = c && u.lat != null && u.lon != null ? haversineKm(u.lat, u.lon, c[1], c[0]) : null;
  if (r.code === "OUTSIDE_NIGERIA") {
    const m = /near (.+?)\.?$/.exec(r.text);
    const place = m ? m[1] : "a place outside Nigeria";
    const where = /^\d/.test(place) ? place : `in ${place}`;
    return `Official coordinates are ${where}${dist != null ? ` — ${fmt(dist)} km from ${stateName(u.state)}` : ""}.`;
  }
  if (r.code === "WRONG_STATE" && dist != null) return `${r.text.replace(/\.$/, "")} — ${fmt(dist)} km from the centre of ${stateName(u.state)}.`;
  if (r.code === "STACKED") return `${r.text} This looks like a ward or LGA centre point, not a GPS fix.`;
  return r.text;
}

export function clockSentence(acc: number, dev: number, hours: number, spv: number, fastest: number) {
  const secs = (hours * 3600 * dev) / acc;
  const verdict = secs < fastest ? "physically unlikely" : secs < spv ? `faster than the typical ${spv} s` : "within a normal pace";
  return {
    text: `Accredited ${fmt(acc)} voters with ${dev} BVAS device${dev === 1 ? "" : "s"} in ${hours} hours = ${secs < 10 ? secs.toFixed(1) : fmt(secs)} seconds per voter`,
    verdict, secs, flagged: secs < spv,
  };
}

export function unitDetailsText(u: UnitDetail, spv: number, hours: number) {
  return [
    `${u.name} (${u.uid})`,
    `${titleCase(u.ward)} ward · ${titleCase(u.lga)} LGA · ${stateName(u.state)}`,
    `Status: ${STATUS[u.band].label} · plausibility ${u.score}/100`,
    `Official coordinate: ${u.lat == null ? "none published" : `${u.lat.toFixed(5)}, ${u.lon!.toFixed(5)}`}`,
    ...u.reasons.map((r) => `- [${r.source}] ${r.text} (Possible innocent explanation: ${r.innocent})`),
    u.devices ? `Clock audit at ${spv} s/voter over ${hours} h: max ${fmt(maxAccredited(hours, spv, u.devices))} vs ${fmt(u.accredited)} accredited (SYNTHETIC)` : "",
    "A flag means this unit needs field verification. It is not evidence of wrongdoing. Registers and result sheets are SYNTHETIC.",
  ].filter(Boolean).join("\n");
}

export const NIGERIA_BOUNDS: [[number, number], [number, number]] = [[2.6, 4.2], [14.7, 13.9]];
export const inNigeriaBox = (lat: number, lon: number) => lat > 4 && lat < 14.1 && lon > 2.6 && lon < 14.8;
