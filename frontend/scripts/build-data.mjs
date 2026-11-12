// Ghost Unit Radar – front-end data build.
// Reads the pipeline output in ../web/data (unchanged) and writes compact files for the
// Next.js app into public/data. Pure Node, no dependencies. Nothing here contacts INEC.
//
//   units.json      columnar index of all 176,623 units (coords, band, flags, synthetic sheet numbers)
//   search.json     names + wards for search (loaded lazily)
//   state_centroids.json  claimed-state anchor points for the dashed "where it should be" links
//   findings.json   20 least plausible units + per-state location problems
//   showcase.json   5 units for the landing "strangest one" and presentation mode
//   field_verification.csv
//   summary.json, sensitivity.json, states/*.json  (copied as-is; used by the Unit Card)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(here, "../../web/data");
const OUT = path.resolve(here, "../public/data");
const GEO = path.resolve(here, "../public/geo");

if (!fs.existsSync(path.join(SRC, "summary.json"))) {
  if (fs.existsSync(path.join(OUT, "units.json"))) {
    console.log("[data] pipeline output not found; keeping existing public/data");
    process.exit(0);
  }
  console.error("[data] ../web/data/summary.json missing – run the pipeline first");
  process.exit(1);
}

const FLAG_BITS = {
  OUTSIDE_NIGERIA: 1, WRONG_STATE: 2, STACKED: 4, NO_COORDINATE: 8, REGISTER_ABOVE_ADULTS: 16,
  EMPTY_CATCHMENT: 32, CLOCK_IMPOSSIBLE: 64, CLOCK_IMPLAUSIBLE: 128, FEW_ROOFTOPS: 256, NEW_BUILDINGS: 512,
};
const BAND = { green: 0, amber: 1, red: 2, grey: 3 };
const readJSON = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const write = (name, obj) => fs.writeFileSync(path.join(OUT, name), JSON.stringify(obj));

fs.mkdirSync(path.join(OUT, "states"), { recursive: true });
const summary = readJSON(path.join(SRC, "summary.json"));
for (const f of ["summary.json", "sensitivity.json"]) {
  if (fs.existsSync(path.join(SRC, f))) fs.copyFileSync(path.join(SRC, f), path.join(OUT, f));
}

// geoBoundaries names -> INEC state names
const centroids = {};
for (const f of readJSON(path.join(GEO, "state_centroids.geojson")).features) {
  const k = f.properties.key === "ABUJA FEDERAL CAPITAL TERRITORY" ? "FEDERAL CAPITAL TERRITORY" : f.properties.key;
  centroids[k] = f.geometry.coordinates;
}

const N = summary.national.units;
const states = summary.index.map((s) => s.state);
const lgas = [];
const lgaIdx = new Map();
const cols = {
  lat: new Array(N).fill(null), lon: new Array(N).fill(null), band: new Array(N).fill(3),
  state: new Array(N).fill(0), lga: new Array(N).fill(0), flags: new Array(N).fill(0),
  score: new Array(N).fill(0), reg: new Array(N).fill(null), acc: new Array(N).fill(null), dev: new Array(N).fill(null),
};
const search = { name: new Array(N).fill(""), ward: new Array(N).fill("") };
const all = []; // full rows for findings/csv/showcase

summary.index.forEach((entry, si) => {
  const src = path.join(SRC, entry.file);
  fs.copyFileSync(src, path.join(OUT, entry.file));
  const d = readJSON(src);
  const c = Object.fromEntries(d.cols.map((k, i) => [k, i]));
  for (const r of d.rows) {
    const i = Number(r[c.uid].slice(2)) - 1;
    const lgaKey = `${entry.state}|${r[c.lga]}`;
    if (!lgaIdx.has(lgaKey)) { lgaIdx.set(lgaKey, lgas.length); lgas.push([si, r[c.lga]]); }
    const lat = r[c.lat], lon = r[c.lon];
    cols.lat[i] = lat == null ? null : Math.round(lat * 1e5) / 1e5;
    cols.lon[i] = lon == null ? null : Math.round(lon * 1e5) / 1e5;
    cols.band[i] = BAND[r[c.band]] ?? 3;
    cols.state[i] = si;
    cols.lga[i] = lgaIdx.get(lgaKey);
    cols.flags[i] = r[c.reasons].reduce((m, x) => m | (FLAG_BITS[x[0]] || 0), 0);
    cols.score[i] = r[c.score];
    cols.reg[i] = r[c.register];
    cols.acc[i] = r[c.accredited];
    cols.dev[i] = r[c.devices];
    search.name[i] = r[c.name];
    search.ward[i] = r[c.ward];
    all.push({
      i, uid: r[c.uid], name: r[c.name], ward: r[c.ward], lga: r[c.lga], state: entry.state, lat, lon,
      score: r[c.score], band: r[c.band], register: r[c.register], accredited: r[c.accredited], devices: r[c.devices],
      adults_r: r[c.adults_r], reasons: r[c.reasons],
    });
  }
});

write("units.json", { generated: summary.generated, states, lgas, ...cols });
write("search.json", search);

// Claimed-state centroids: the map draws dashed links from out-of-country coordinates to these.
fs.writeFileSync(path.join(OUT, "state_centroids.json"), JSON.stringify(centroids));

// Least plausible: lowest score, then most reasons, then uid.
const ranked = all.filter((u) => u.band === "red" || u.band === "amber")
  .sort((a, b) => a.score - b.score || b.reasons.length - a.reasons.length || a.i - b.i);
const slim = (u) => ({ uid: u.uid, name: u.name, ward: u.ward, lga: u.lga, state: u.state, score: u.score, band: u.band,
  reasons: u.reasons.map((x) => [x[0], x[1], x[2]]) });
const byState = summary.index.map((s) => {
  const st = summary.states[s.state] || {};
  return { state: s.state, units: s.units, with_coordinates: s.with_coordinates,
    outside: st.OUTSIDE_NIGERIA || 0, wrong_state: st.WRONG_STATE || 0, stacked: st.STACKED || 0,
    no_coordinate: st.NO_COORDINATE || 0, red: st.red || 0, amber: st.amber || 0 };
});
write("findings.json", { top: ranked.slice(0, 20).map(slim), byState });

// Showcase: five units that each tell a different story.
const has = (u, code) => u.reasons.some((x) => x[0] === code);
const pickBy = (list, key) => list.reduce((best, u) => (best == null || key(u) > key(best) ? u : best), null);
const waterloo = all.find((u) => u.uid === "PU000002") || pickBy(all.filter((u) => has(u, "OUTSIDE_NIGERIA")), (u) => -u.score);
const ls = summary.national.largest_stack;
const stackSize = (u) => { const r = u.reasons.find((x) => x[0] === "STACKED"); return r ? parseInt(r[2], 10) || 0 : 0; };
const stack = pickBy(all.filter((u) => (u.band === "red" || u.band === "amber") && stackSize(u) > 0 && !has(u, "OUTSIDE_NIGERIA")), (u) => stackSize(u) * 100 - u.score);
const wrong = pickBy(all.filter((u) => has(u, "WRONG_STATE") && !has(u, "OUTSIDE_NIGERIA") && u.lat != null),
  (u) => { const c = centroids[u.state]; return c ? Math.hypot(u.lon - c[0], u.lat - c[1]) : 0; });
const clock = pickBy(all.filter((u) => has(u, "CLOCK_IMPOSSIBLE") && u.lat != null && u.devices), (u) => u.accredited / u.devices);
const reg = pickBy(all.filter((u) => has(u, "REGISTER_ABOVE_ADULTS") && u.lat != null), (u) => (u.adults_r ? u.register / u.adults_r : 0));
const caption = {
  outside: "Official coordinates put this Kogi State polling unit in Canada.",
  stack: `${stack ? stackSize(stack) : ls.size} polling units share this one exact coordinate – a centre point, not a GPS fix.`,
  wrong: "Listed in one state; the published coordinate falls in another.",
  clock: "The synthetic result sheet claims more voters than one BVAS device could accredit.",
  register: "The synthetic register is far larger than the adults who live nearby.",
};
const showcase = [["outside", waterloo], ["stack", stack], ["wrong", wrong], ["clock", clock], ["register", reg]]
  .filter(([, u]) => u).map(([kind, u]) => ({ kind, uid: u.uid, state: u.state, caption: caption[kind] }));
write("showcase.json", showcase);

// Field-verification CSV (red + amber, least plausible first) – same columns as the original app.
const cell = (v) => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const head = ["uid", "state", "lga", "ward", "name", "lat", "lon", "band", "score", "register_SYNTHETIC", "accredited_SYNTHETIC",
  "bvas_devices_SYNTHETIC", "adults_within_radius", "flags", "reasons", "innocent_explanations"];
const lines = ranked.map((u) => [u.uid, u.state, u.lga, u.ward, u.name, u.lat, u.lon, u.band, u.score, u.register, u.accredited,
  u.devices, u.adults_r, u.reasons.map((x) => x[0]).join("|"), u.reasons.map((x) => `[${x[1]}] ${x[2]}`).join(" | "),
  u.reasons.map((x) => x[3]).join(" | ")].map(cell).join(","));
fs.writeFileSync(path.join(OUT, "field_verification.csv"),
  "# Ghost Unit Radar field-verification list. Registers/result sheets are SYNTHETIC. Flags need field verification and are not findings of fraud.\n"
  + [head.join(","), ...lines].join("\n"));

const size = (f) => (fs.statSync(path.join(OUT, f)).size / 1e6).toFixed(2) + " MB";
console.log(`[data] ${all.length} units, ${showcase.length} showcase; units.json ${size("units.json")}, search.json ${size("search.json")}`);
console.log("[data] showcase:", showcase.map((s) => `${s.kind}=${s.uid}`).join(" "));
