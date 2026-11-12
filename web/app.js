/* Ghost Unit Radar - static front end. All data comes from ./data/*.json produced by the
   pipeline. Nothing here contacts any INEC system. */
(function () {
  "use strict";
  const NATIONAL = "__NATIONAL__";
  const COLORS = { red: "#c8341f", amber: "#d99100", green: "#2f8f5b", grey: "#9aa09c" };
  const LABEL = {
    OUTSIDE_NIGERIA: "Outside Nigeria", WRONG_STATE: "In a different state", STACKED: "Stacked coordinate",
    NO_COORDINATE: "No coordinate published", REGISTER_ABOVE_ADULTS: "Register above adults",
    EMPTY_CATCHMENT: "Almost nobody lives here", CLOCK_IMPOSSIBLE: "Clock: impossible",
    CLOCK_IMPLAUSIBLE: "Clock: implausible", FEW_ROOFTOPS: "Few rooftops", NEW_BUILDINGS: "New buildings",
  };
  const $ = (id) => document.getElementById(id);
  const fmt = (n) => (n == null ? "–" : Math.round(n).toLocaleString("en-NG"));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  let summary = null, units = [], view = NATIONAL, layer = null, markers = new Map();
  const cache = new Map();

  const map = L.map("map", { preferCanvas: true, worldCopyJump: true, minZoom: 2 }).setView([9.1, 8.7], 6);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);
  const renderer = L.canvas({ padding: 0.5 });

  function hours() { return (summary && summary.params.polling_hours) || 6; }
  function spv() { return Number($("spv").value); }
  function maxAcc(u, s) { return Math.floor((hours() * 3600) / s) * u.devices; }
  function clockFlag(u) { return u.accredited != null && u.accredited > maxAcc(u, spv()); }

  function fromState(d) {
    const c = Object.fromEntries(d.cols.map((k, i) => [k, i]));
    return d.rows.map((r) => ({
      uid: r[c.uid], name: r[c.name], ward: r[c.ward], lga: r[c.lga], state: d.state, lat: r[c.lat], lon: r[c.lon],
      score: r[c.score], band: r[c.band], register: r[c.register], accredited: r[c.accredited], devices: r[c.devices],
      adults_r: r[c.adults_r], units_r: r[c.units_r], adults_share: r[c.adults_share],
      reasons: r[c.reasons].map(([code, source, text, innocent]) => ({ code, source, text, innocent })),
    }));
  }
  function fromNational(d) {
    const c = Object.fromEntries(d.cols.map((k, i) => [k, i]));
    return d.rows.map((r) => {
      const reasons = r[c.reasons].map(([code, source, text, innocent]) => ({ code, source, text, innocent }));
      const s = r[c.score];
      return { uid: r[c.uid], name: r[c.name], ward: r[c.ward], lga: r[c.lga], state: r[c.state], lat: r[c.lat],
        lon: r[c.lon], score: s, band: s >= 70 ? "green" : s >= 40 ? "amber" : "red", reasons, national: true };
    });
  }

  async function getJSON(path) {
    if (cache.has(path)) return cache.get(path);
    const res = await fetch(path);
    if (!res.ok) throw new Error(path + " " + res.status);
    const j = await res.json();
    cache.set(path, j);
    return j;
  }

  function renderStats() {
    const n = summary.national;
    const ls = n.largest_stack;
    $("stats").innerHTML = `
      <div class="stat wide"><span class="tag real">REAL DATA</span> <span>INEC polling-unit list (2022 scrape), all states</span></div>
      <div class="stat"><b>${fmt(n.outside_nigeria)}</b><span>units placed outside Nigeria</span></div>
      <div class="stat"><b>${fmt(n.wrong_state)}</b><span>units placed in a different state</span></div>
      <div class="stat"><b>${fmt(n.stacked_units)}</b><span>units stacked ≥${summary.params.stack_min} on one point</span></div>
      <div class="stat"><b>${fmt(n.without_coordinates)}</b><span>units with no coordinate (${summary.no_coordinate_states.length} states none)</span></div>
      <div class="stat wide"><span>Largest stack: <b style="display:inline;font-size:15px">${fmt(ls.size)}</b> units on one point in ${esc(ls.lga.toLowerCase())}, ${esc(ls.state.toLowerCase())}</span></div>`;
  }

  function renderStateOptions() {
    const sel = $("state");
    const noC = new Set(summary.no_coordinate_states);
    sel.innerHTML = `<option value="${NATIONAL}">Nigeria – location problems (real data)</option>` +
      summary.index.map((s) => `<option value="${esc(s.state)}">${esc(titleCase(s.state))}${noC.has(s.state) ? " – no coordinates published" : ` (${fmt(s.units)} units)`}</option>`).join("");
  }
  function titleCase(s) { return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()); }

  async function loadView(v) {
    view = v;
    $("card").hidden = true;
    if (v === NATIONAL) {
      units = fromNational(await getJSON("data/national_location_flags.json"));
      $("stateHint").textContent = `${fmt(units.length)} units whose official coordinate is outside Nigeria or in the wrong state. Zoom out to see where they land.`;
    } else {
      const entry = summary.index.find((s) => s.state === v);
      units = fromState(await getJSON("data/" + entry.file));
      $("stateHint").textContent = entry.with_coordinates === 0
        ? "INEC published no coordinates for this state, so only the list is available (no map, no plausibility check)."
        : `${fmt(entry.with_coordinates)} of ${fmt(entry.units)} units have coordinates. Registers and result sheets are SYNTHETIC.`;
    }
    draw(true);
  }

  function filtered() {
    const bands = new Set([...document.querySelectorAll("#bands input:checked")].map((i) => i.value));
    const flag = $("flag").value;
    const q = $("q").value.trim().toUpperCase();
    return units.filter((u) => {
      if (!bands.has(u.band)) return false;
      if (flag === "CLOCK") { if (!clockFlag(u)) return false; }
      else if (flag && !u.reasons.some((r) => r.code === flag)) return false;
      if (q && !(u.name + " " + u.ward + " " + u.lga).toUpperCase().includes(q)) return false;
      return true;
    });
  }

  function draw(fit) {
    if (layer) layer.remove();
    markers.clear();
    layer = L.layerGroup().addTo(map);
    const list = filtered();
    const pts = [];
    // draw green first so red sits on top
    const order = { green: 0, grey: 0, amber: 1, red: 2 };
    [...list].sort((a, b) => order[a.band] - order[b.band]).forEach((u) => {
      if (u.lat == null) return;
      const m = L.circleMarker([u.lat, u.lon], {
        renderer, radius: u.band === "red" ? 6 : u.band === "amber" ? 5 : 3.5, weight: u.band === "green" ? 0 : 1,
        color: "#ffffff", fillColor: COLORS[u.band], fillOpacity: u.band === "green" ? 0.55 : 0.9,
      }).on("click", () => openCard(u));
      m.bindTooltip(esc(u.name), { direction: "top" });
      m.addTo(layer);
      markers.set(u.uid, m);
      pts.push([u.lat, u.lon]);
    });
    if (fit && pts.length) {
      if (view === NATIONAL) map.fitBounds(L.latLngBounds(pts), { padding: [20, 20], animate: false });
      else map.fitBounds(L.latLngBounds(pts.filter(([la, lo]) => la > 3 && la < 15 && lo > 2 && lo < 15.5)), { padding: [20, 20], animate: false });
    }
    renderList(list);
    renderClock();
  }

  function renderList(list) {
    const worst = [...list].filter((u) => u.band === "red" || u.band === "amber" || u.band === "grey")
      .sort((a, b) => a.score - b.score).slice(0, 60);
    $("listTitle").textContent = worst.length ? `Least plausible units in view (${fmt(list.filter((u) => u.band === "red").length)} red)` : "No flagged units match these filters";
    $("list").innerHTML = worst.map((u) => `<li data-uid="${u.uid}"><span class="score" style="color:${COLORS[u.band]}">${u.score}</span>
      <span>${esc(u.name)}<small>${esc(titleCase(u.lga))}, ${esc(titleCase(u.state))} · ${u.reasons.map((r) => LABEL[r.code] || r.code).join(", ") || "–"}</small></span></li>`).join("");
  }

  function renderClock() {
    const sheets = units.filter((u) => u.accredited != null);
    if (!sheets.length) { $("clockHint").textContent = "Select a state with coordinates to run the clock audit on its synthetic result sheets."; return; }
    const at = sheets.filter(clockFlag).length;
    const fastest = sheets.filter((u) => u.accredited > maxAcc(u, 30)).length;
    $("clockHint").textContent = `At ${spv()} s per voter over ${hours()} h, ${fmt(at)} of ${fmt(sheets.length)} synthetic result sheets exceed what their BVAS devices could accredit (${fmt(fastest)} even at the fastest 30 s).`;
  }

  function openCard(u) {
    const card = $("card");
    const loc = u.reasons.filter((r) => r.source === "REAL");
    const syn = u.reasons.filter((r) => r.source === "SYNTHETIC" && !r.code.startsWith("CLOCK"));
    const verdict = u.band === "red" ? "Needs field verification" : u.band === "amber" ? "Worth checking" : u.band === "grey" ? "No coordinate" : "Nothing unusual found";
    const reasonHTML = (r) => `<div class="reason ${r.source === "SYNTHETIC" ? "synth" : ""}"><span class="tag ${r.source === "SYNTHETIC" ? "synth" : "real"}">${r.source}</span>
      ${esc(r.text)}<div class="innocent">Possible innocent explanation: ${esc(r.innocent)}</div></div>`;
    let body = `<button class="close" aria-label="Close">×</button>
      <h3>${esc(u.name)}</h3>
      <p class="where">${esc(titleCase(u.ward))} ward · ${esc(titleCase(u.lga))} LGA · ${esc(titleCase(u.state))} · ${u.uid}</p>
      <div class="verdict ${u.band}"><b>${u.score}</b><span>/100 plausibility<br><strong>${verdict}</strong></span></div>
      <h4>Location integrity <span class="tag real">REAL</span></h4>
      <dl><dt>Official coordinate</dt><dd>${u.lat == null ? "none published" : `${u.lat.toFixed(5)}, ${u.lon.toFixed(5)}`}</dd></dl>
      ${loc.length ? loc.map(reasonHTML).join("") : '<p class="ok">Inside the listed state, not stacked.</p>'}`;
    if (!u.national && u.lat != null) {
      const r = summary.params.radius_km;
      const max = u.devices ? maxAcc(u, spv()) : null;
      body += `<h4>Catchment within ${r} km <span class="tag real">WORLDPOP</span></h4>
        <dl><dt>Estimated adults (18+)</dt><dd>${u.adults_r == null ? "not computed" : "~" + fmt(u.adults_r)}</dd>
        <dt>Other polling units sharing it</dt><dd>${u.units_r == null ? "–" : fmt(u.units_r - 1)}</dd>
        <dt>Adults this unit plausibly serves</dt><dd>${u.adults_share == null ? "–" : "~" + fmt(u.adults_share)}</dd>
        <dt>Rooftops (Open Buildings)</dt><dd>not yet loaded</dd></dl>
        ${u.adults_r == null ? '<p class="ok">Catchment not computed: the coordinate is outside Nigeria, in another state, or a stacked centroid, so it does not show where the unit really is.</p>' : ""}
        <h4>Register &amp; result sheet <span class="tag synth">SYNTHETIC</span></h4>
        <dl><dt>Registered voters</dt><dd>${fmt(u.register)}</dd>
        <dt>Accredited voters</dt><dd>${fmt(u.accredited)}</dd>
        <dt>BVAS devices</dt><dd>${fmt(u.devices)}</dd>
        <dt>Max possible at ${spv()} s/voter</dt><dd style="color:${u.accredited > max ? COLORS.red : "inherit"}">${fmt(max)}</dd></dl>
        ${syn.map(reasonHTML).join("")}
        ${clockFlag(u) ? reasonHTML({ source: "SYNTHETIC", text: `${fmt(u.accredited)} accredited, but ${u.devices} BVAS device(s) could accredit at most ${fmt(max)} in ${hours()} h at ${spv()} s per voter.`, innocent: "Polling extended for voters queued before close, an unrecorded extra device, or a data-entry error." }) : ""}`;
    } else if (u.national) {
      body += `<p class="ok"><button type="button" class="ghost" id="openState">Open ${esc(titleCase(u.state))} state view</button></p>`;
    }
    body += `<p class="ok" style="margin-top:12px">Flags are leads for field verification, not findings of wrongdoing.</p>`;
    card.innerHTML = body;
    card.hidden = false;
    card.querySelector(".close").onclick = () => { card.hidden = true; };
    const os = card.querySelector("#openState");
    if (os) os.onclick = async () => { $("state").value = u.state; await loadView(u.state); const m = units.find((x) => x.uid === u.uid); if (m) openCard(m); };
    history.replaceState(null, "", "#" + encodeURIComponent((view === NATIONAL ? "N" : view) + "~" + u.uid));
  }

  function focusUnit(uid) {
    const u = units.find((x) => x.uid === uid);
    if (!u) return false;
    if (u.lat != null) map.setView([u.lat, u.lon], Math.max(map.getZoom(), 9), { animate: false });
    openCard(u);
    return true;
  }

  function csvCell(v) { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }
  function download() {
    const rows = filtered().filter((u) => u.band === "red" || u.band === "amber").sort((a, b) => a.score - b.score);
    const head = ["uid", "state", "lga", "ward", "name", "lat", "lon", "band", "score", "register_SYNTHETIC", "accredited_SYNTHETIC",
      "bvas_devices_SYNTHETIC", "adults_within_radius", "flags", "reasons", "innocent_explanations"];
    const lines = [head.join(",")].concat(rows.map((u) => [u.uid, u.state, u.lga, u.ward, u.name, u.lat, u.lon, u.band, u.score,
      u.register, u.accredited, u.devices, u.adults_r, u.reasons.map((r) => r.code).join("|"),
      u.reasons.map((r) => `[${r.source}] ${r.text}`).join(" | "), u.reasons.map((r) => r.innocent).join(" | ")].map(csvCell).join(",")));
    const note = "# Ghost Unit Radar field-verification list. Registers/result sheets are SYNTHETIC. Flags need field verification and are not findings of fraud.";
    const blob = new Blob([note + "\n" + lines.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `ghost-unit-radar_${view === NATIONAL ? "national-location" : view.replace(/ /g, "_")}_field-verification.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // ---- wiring ----
  $("state").addEventListener("change", (e) => loadView(e.target.value));
  $("flag").addEventListener("change", () => draw(false));
  $("q").addEventListener("input", () => draw(false));
  document.querySelectorAll("#bands input").forEach((i) => i.addEventListener("change", () => draw(false)));
  $("spv").addEventListener("input", () => {
    $("spvOut").textContent = spv();
    if ($("flag").value === "CLOCK") draw(false); else renderClock();
    if (!$("card").hidden) { const id = decodeURIComponent(location.hash.slice(1)).split("~")[1]; const u = units.find((x) => x.uid === id); if (u) openCard(u); }
  });
  $("download").addEventListener("click", download);
  $("list").addEventListener("click", (e) => { const li = e.target.closest("li"); if (li) focusUnit(li.dataset.uid); });
  $("waterloo").addEventListener("click", async () => {
    if (view !== NATIONAL) { $("state").value = NATIONAL; await loadView(NATIONAL); }
    focusUnit("PU000002");
  });

  // Read-only hook for automated end-to-end tests (no effect on the app).
  window.__gur = { map, markers, getUnits: () => units, getView: () => view };

  // Deep links: #N~PU000002 (national view) or #KANO~PU154001 (state view).
  async function handleHash() {
    const [v, id] = decodeURIComponent(location.hash.slice(1)).split("~");
    const target = v && v !== "N" && summary.index.some((s) => s.state === v) ? v : NATIONAL;
    if (target !== view || !units.length) { $("state").value = target; await loadView(target); }
    if (id) focusUnit(id);
  }
  window.addEventListener("hashchange", () => { handleHash().catch(() => {}); });

  (async function init() {
    summary = await getJSON("data/summary.json");
    renderStats();
    renderStateOptions();
    view = null;
    await handleHash();
  })().catch((err) => {
    $("stateHint").textContent = "Could not load data: " + err.message + ". Run the pipeline, then serve the web/ folder over HTTP.";
  });
})();
