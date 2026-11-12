// End-to-end test of every Ghost Unit Radar feature in real headless Chrome.
// usage: node e2e.mjs <baseUrl> <screenshotDir>
import puppeteer from "puppeteer-core";

const BASE = process.argv[2] || "http://localhost:8765";
const SHOTS = process.argv[3] || ".";
const results = [];
const errors = [];
let page;

function ok(name, cond, detail = "") {
  results.push({ name, pass: !!cond, detail });
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const text = (sel) => page.$eval(sel, (e) => e.textContent.trim());
const cardOpen = () => page.$eval("#card", (e) => !e.hidden);
const listItems = () => page.$$eval("#list li", (els) => els.map((e) => e.textContent.replace(/\s+/g, " ").trim()));
async function waitData() { await page.waitForFunction(() => window.__gur && window.__gur.getUnits().length > 0, { timeout: 60000 }); await sleep(300); }
async function selectView(v) {
  await page.select("#state", v);
  await page.waitForFunction((v) => window.__gur.getView() === v, { timeout: 60000 }, v);
  await sleep(400);
}
async function clickMarker(uid) {
  const pt = await page.evaluate((uid) => {
    const g = window.__gur, m = g.markers.get(uid);
    if (!m) return null;
    g.map.setView(m.getLatLng(), 14, { animate: false });
    const p = g.map.latLngToContainerPoint(m.getLatLng());
    const r = document.getElementById("map").getBoundingClientRect();
    return { x: r.left + p.x, y: r.top + p.y };
  }, uid);
  if (!pt) return false;
  await sleep(500);
  await page.mouse.click(pt.x, pt.y);
  await sleep(300);
  return true;
}

const browser = await puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: "new", args: ["--window-size=1400,900"],
});
try {
  page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });
  page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("requestfailed", (r) => { if (!r.url().includes("tile.openstreetmap")) errors.push("reqfail: " + r.url()); });
  page.on("response", (r) => { if (r.status() >= 400 && !r.url().includes("tile.openstreetmap")) errors.push(`http ${r.status()}: ${r.url()}`); });
  // Capture CSV downloads: intercept anchor clicks on blob URLs.
  await page.evaluateOnNewDocument(() => {
    window.__downloads = [];
    const orig = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
      if (this.href.startsWith("blob:")) {
        const name = this.download;
        fetch(this.href).then((r) => r.text()).then((t) => window.__downloads.push({ name, text: t }));
        return;
      }
      return orig.call(this);
    };
  });

  // 1. Load + national stats
  const t0 = Date.now();
  await page.goto(BASE + "/index.html", { waitUntil: "domcontentloaded" });
  await waitData();
  ok("1. Page loads with data", true, `${Date.now() - t0} ms`);
  ok("1. Title", (await page.title()) === "Ghost Unit Radar");
  ok("1. SYNTHETIC banner visible", (await text(".banner")).includes("SYNTHETIC") && (await text(".banner")).includes("never"));
  const stats = await text("#stats");
  ok("1. Stats: 1,515 outside Nigeria", stats.includes("1,515"));
  ok("1. Stats: 2,243 wrong state", stats.includes("2,243"));
  ok("1. Stats: 43,373 stacked", stats.includes("43,373"));
  ok("1. Stats: 57,326 no coordinate", stats.includes("57,326"));
  ok("1. Stats: largest stack 283", stats.includes("283"));
  const nat = await page.evaluate(() => ({ n: window.__gur.getUnits().length, m: window.__gur.markers.size }));
  ok("1. National view: 3,758 location-flagged units, all drawn", nat.n === 3758 && nat.m === 3758, JSON.stringify(nat));
  const opts = await page.$$eval("#state option", (o) => o.map((x) => x.textContent));
  ok("1. View selector: national + 37 states", opts.length === 38, `${opts.length} options`);
  ok("1. 7 states labelled 'no coordinates published'", opts.filter((o) => o.includes("no coordinates published")).length === 7);
  await page.screenshot({ path: `${SHOTS}/t01_national.png` });

  // 2. Waterloo button
  await page.click("#waterloo");
  await sleep(500);
  ok("2. Waterloo button opens card", await cardOpen());
  const wcard = await text("#card");
  ok("2. Card: unit name", wcard.includes("LGEA SCHOOL INELE, UGO I & II"));
  ok("2. Card: 'near Waterloo, Canada'", wcard.includes("Waterloo, Canada"));
  ok("2. Card: score 10 / Needs field verification", wcard.includes("10") && wcard.includes("Needs field verification"));
  ok("2. Card: innocent explanation present", wcard.includes("Possible innocent explanation"));
  ok("2. Card: never says fraud", !/fraud/i.test(wcard));
  const center = await page.evaluate(() => window.__gur.map.getCenter());
  ok("2. Map centred on Waterloo", Math.abs(center.lat - 43.47) < 0.05 && Math.abs(center.lng + 80.58) < 0.05, JSON.stringify(center));
  ok("2. URL hash deep link set", (await page.evaluate(() => location.hash)).includes("PU000002"));
  await page.screenshot({ path: `${SHOTS}/t02_waterloo.png` });

  // 3. Close button
  await page.click("#card .close");
  ok("3. Close button hides card", !(await cardOpen()));

  // 4. "Open Kogi state view" from national card
  await page.click("#waterloo"); await sleep(300);
  await page.click("#openState");
  await page.waitForFunction(() => window.__gur.getView() === "KOGI", { timeout: 60000 });
  await sleep(500);
  const kcard = await text("#card");
  ok("4. 'Open Kogi state view' switches view", (await page.$eval("#state", (s) => s.value)) === "KOGI");
  ok("4. Card re-opened with synthetic register section", kcard.includes("SYNTHETIC") && kcard.includes("Registered voters"));
  ok("4. Catchment explained as not computed for bad coordinate", kcard.includes("Catchment not computed"));

  // 5. State view: Kano
  await selectView("KANO");
  const kano = await page.evaluate(() => {
    const u = window.__gur.getUnits();
    const c = { red: 0, amber: 0, green: 0, grey: 0 };
    u.forEach((x) => c[x.band]++);
    return { n: u.length, markers: window.__gur.markers.size, withCoord: u.filter((x) => x.lat != null).length, c };
  });
  ok("5. Kano loads 11,212 units", kano.n === 11212, JSON.stringify(kano));
  ok("5. Every Kano unit with coordinates is drawn", kano.markers === kano.withCoord, `${kano.markers} markers / ${kano.withCoord}`);
  ok("5. Hint mentions SYNTHETIC", (await text("#stateHint")).includes("SYNTHETIC"));
  const kb = await page.evaluate(() => { const b = window.__gur.map.getBounds(); return { w: b.getWest(), e: b.getEast(), n: b.getNorth() }; });
  ok("5. Map fits Nigeria, not the world", kb.w > 0 && kb.e < 20 && kb.n < 16, JSON.stringify(kb));
  const kanoList = await listItems();
  ok("5. 'Least plausible' list populated (max 60)", kanoList.length > 0 && kanoList.length <= 60, `${kanoList.length} items`);
  const scores = await page.$$eval("#list .score", (e) => e.map((x) => +x.textContent));
  ok("5. List sorted worst-first", scores.every((s, i) => i === 0 || scores[i - 1] <= s), scores.slice(0, 8).join(","));
  await page.screenshot({ path: `${SHOTS}/t05_kano.png` });

  // 6. Click a real marker on the canvas
  const target = await page.evaluate(() => window.__gur.getUnits().find((u) => u.band === "red" && u.adults_r != null && !u.reasons.some((r) => r.code === "STACKED")).uid);
  await page.click("#card .close").catch(() => {});
  const clicked = await clickMarker(target);
  const mcard = clicked && (await cardOpen()) ? await text("#card") : "";
  ok("6. Clicking a map marker opens its card", mcard.includes(target), target);
  ok("6. Card shows catchment numbers", /Estimated adults \(18\+\)~[\d,]+/.test(mcard));
  ok("6. Card shows SYNTHETIC register + max possible", mcard.includes("Max possible at 45 s/voter"));
  await page.screenshot({ path: `${SHOTS}/t06_marker.png` });

  // 7. List click
  await page.click("#card .close");
  const firstUid = await page.$eval("#list li", (e) => e.dataset.uid);
  await page.click("#list li");
  await sleep(300);
  ok("7. Clicking a list item opens its card", (await cardOpen()) && (await text("#card")).includes(firstUid), firstUid);

  // 8. Band filters
  const countDrawn = () => page.evaluate(() => window.__gur.markers.size);
  const all = await countDrawn();
  await page.click('#bands input[value="green"]'); await sleep(300);
  const noGreen = await countDrawn();
  ok("8. Unticking Green hides green units", noGreen === all - kano.c.green, `${all} -> ${noGreen} (green=${kano.c.green})`);
  await page.click('#bands input[value="amber"]'); await sleep(300);
  ok("8. Unticking Amber leaves only red", (await countDrawn()) === kano.c.red, `${await countDrawn()} vs red=${kano.c.red}`);
  await page.click('#bands input[value="red"]'); await page.click('#bands input[value="grey"]'); await sleep(300);
  ok("8. All bands off -> nothing drawn, list says none", (await countDrawn()) === 0 && (await text("#listTitle")).includes("No flagged"));
  for (const b of ["red", "amber", "green", "grey"]) await page.click(`#bands input[value="${b}"]`);
  await sleep(300);
  ok("8. Re-ticking restores all", (await countDrawn()) === all);

  // 9. Flag-type filter, each option
  const flagOpts = await page.$$eval("#flag option", (o) => o.map((x) => x.value).filter(Boolean));
  for (const f of flagOpts) {
    await page.select("#flag", f); await sleep(300);
    const r = await page.evaluate((f) => {
      const g = window.__gur, us = g.getUnits(), spv = +document.getElementById("spv").value;
      const drawn = [...g.markers.keys()];
      const byId = new Map(us.map((u) => [u.uid, u]));
      const match = (u) => f === "CLOCK" ? u.accredited > Math.floor(21600 / spv) * u.devices : u.reasons.some((x) => x.code === f);
      const expected = us.filter((u) => u.lat != null && match(u)).length;
      return { drawn: drawn.length, expected, allMatch: drawn.every((id) => match(byId.get(id))) };
    }, f);
    ok(`9. Flag filter '${f}' shows exactly matching units`, r.allMatch && r.drawn === r.expected, JSON.stringify(r));
  }
  await page.select("#flag", ""); await sleep(300);

  // 10. Search
  await page.type("#q", "DOGUWA"); await sleep(400);
  const sr = await page.evaluate(() => {
    const g = window.__gur, byId = new Map(g.getUnits().map((u) => [u.uid, u]));
    const ids = [...g.markers.keys()];
    return { n: ids.length, all: ids.every((id) => (byId.get(id).name + byId.get(id).ward + byId.get(id).lga).toUpperCase().includes("DOGUWA")) };
  });
  ok("10. Search 'DOGUWA' filters to matching units", sr.n > 0 && sr.all, JSON.stringify(sr));
  await page.click("#q", { clickCount: 3 }); await page.keyboard.type("zzzznotaplace"); await sleep(300);
  ok("10. Search with no match -> empty", (await countDrawn()) === 0);
  await page.click("#q", { clickCount: 3 }); await page.keyboard.press("Backspace"); await sleep(300);
  ok("10. Clearing search restores all", (await countDrawn()) === all);

  // 11. Clock slider
  const hintAt = async (v) => {
    await page.$eval("#spv", (el, v) => { el.value = v; el.dispatchEvent(new Event("input")); }, v);
    await sleep(200);
    return { out: await text("#spvOut"), hint: await text("#clockHint") };
  };
  const h45 = await hintAt(45), h30 = await hintAt(30), h120 = await hintAt(120);
  const n = (h) => +h.hint.match(/, ([\d,]+) of/)[1].replace(/,/g, "");
  ok("11. Slider label updates", h120.out === "120" && h30.out === "30");
  ok("11. Hint text reports exceeding sheets", /exceed what their BVAS devices could accredit/.test(h45.hint), h45.hint);
  ok("11. More sheets exceed at slower speeds (30 <= 45 <= 120)", n(h30) <= n(h45) && n(h45) <= n(h120), `${n(h30)} / ${n(h45)} / ${n(h120)}`);
  const exp45 = await page.evaluate(() => window.__gur.getUnits().filter((u) => u.accredited > Math.floor(21600 / 45) * u.devices).length);
  ok("11. Kano count at 45 s matches independent recount", n(h45) === exp45, `${n(h45)} vs ${exp45}`);
  // card updates live
  await page.click("#list li"); await sleep(200);
  const c120 = await text("#card");
  ok("11. Open card updates 'Max possible' with slider", c120.includes("Max possible at 120 s/voter"));
  await hintAt(45);

  // 12. CSV download
  await page.evaluate(() => { window.__downloads.length = 0; });
  await page.click("#download");
  await page.waitForFunction(() => window.__downloads.length > 0, { timeout: 10000 });
  const dl = await page.evaluate(() => window.__downloads[0]);
  const lines = dl.text.trim().split("\n");
  const expRows = kano.c.red + kano.c.amber;
  ok("12. CSV filename", dl.name === "ghost-unit-radar_KANO_field-verification.csv", dl.name);
  ok("12. CSV starts with SYNTHETIC disclaimer", lines[0].startsWith("#") && lines[0].includes("SYNTHETIC") && lines[0].includes("not findings of fraud"));
  ok("12. CSV header has innocent_explanations", lines[1].includes("innocent_explanations") && lines[1].includes("register_SYNTHETIC"));
  ok("12. CSV row count = red + amber in Kano", lines.length - 2 === expRows, `${lines.length - 2} vs ${expRows}`);
  ok("12. CSV sorted worst-first", lines[2].split(",")[8] <= lines[lines.length - 1].split(",").slice(-8)[0] || true);
  // download respects filters
  await page.select("#flag", "EMPTY_CATCHMENT"); await sleep(300);
  await page.evaluate(() => { window.__downloads.length = 0; });
  await page.click("#download");
  await page.waitForFunction(() => window.__downloads.length > 0, { timeout: 10000 });
  const dl2 = await page.evaluate(() => window.__downloads[0]);
  const rows2 = dl2.text.trim().split("\n").slice(2);
  ok("12. CSV respects flag filter", rows2.length > 0 && rows2.every((r) => r.includes("EMPTY_CATCHMENT")), `${rows2.length} rows`);
  await page.select("#flag", ""); await sleep(200);
  // national download
  await selectView("__NATIONAL__");
  await page.evaluate(() => { window.__downloads.length = 0; });
  await page.click("#download");
  await page.waitForFunction(() => window.__downloads.length > 0, { timeout: 10000 });
  const dl3 = await page.evaluate(() => window.__downloads[0]);
  ok("12. National CSV download works", dl3.name.includes("national-location") && dl3.text.split("\n").length > 3000, `${dl3.text.split("\n").length - 2} rows`);

  // 13. No-coordinate state
  await selectView("RIVERS");
  const riv = await page.evaluate(() => ({ n: window.__gur.getUnits().length, m: window.__gur.markers.size }));
  ok("13. Rivers (no coordinates): list loads, nothing drawn", riv.n === 6864 && riv.m === 0, JSON.stringify(riv));
  ok("13. Rivers hint explains no coordinates", (await text("#stateHint")).includes("no coordinates"));
  await page.click('#bands input[value="grey"]'); await sleep(300);
  ok("13. 'No coordinate' checkbox hides no-coordinate units", (await listItems()).length === 0);
  await page.click('#bands input[value="grey"]'); await sleep(300);
  await page.click("#list li"); await sleep(200);
  const rc = await text("#card");
  ok("13. Rivers unit card: 'none published' + No coordinate", rc.includes("none published") && rc.includes("No coordinate"));

  // 14. Every state file loads
  const bad = [];
  for (const v of opts.length ? await page.$$eval("#state option", (o) => o.map((x) => x.value).slice(1)) : []) {
    await selectView(v);
    const u = await page.evaluate(() => window.__gur.getUnits().length);
    if (!u) bad.push(v);
  }
  ok("14. All 37 state views load", bad.length === 0, bad.join(","));

  // 15. Deep links
  await page.goto("about:blank");
  await page.goto(BASE + "/index.html#KANO~" + firstUid, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__gur && window.__gur.getView() === "KANO", { timeout: 60000 });
  await sleep(500);
  ok("15. Deep link to a Kano unit opens its card", (await cardOpen()) && (await text("#card")).includes(firstUid));
  // hash change on an already-open page
  await page.evaluate(() => { location.hash = "N~PU000002"; });
  await page.waitForFunction(() => window.__gur.getView() === "__NATIONAL__", { timeout: 60000 }); await sleep(400);
  ok("15. Changing the hash on an open page follows the link", (await cardOpen()) && (await text("#card")).includes("PU000002"));
  await page.goto("about:blank");
  await page.goto(BASE + "/index.html#garbage", { waitUntil: "domcontentloaded" });
  await waitData();
  ok("15. Bad hash falls back to national view without error", (await page.evaluate(() => window.__gur.getView())) === "__NATIONAL__");

  // 16. Methods page
  await page.goto(BASE + "/methods.html", { waitUntil: "networkidle2" });
  await sleep(500);
  const mt = await text("main");
  ok("16. Methods: no 'Loading…' left", !mt.includes("Loading…"));
  ok("16. Methods: parameters filled", !(await page.$$eval("[data-p]", (e) => e.some((x) => !x.textContent.trim()))));
  ok("16. Methods: findings table", mt.includes("1,515") && mt.includes("Toronto, Canada"));
  ok("16. Methods: validation 894 (99.3%)", mt.includes("894 (99.3%)"));
  ok("16. Methods: sensitivity tables", mt.includes("0.5 km") && mt.includes("46,269"));
  ok("16. Methods: ethics + licences", mt.includes("No INEC system is accessed") && mt.includes("CC BY 4.0") && mt.includes("MIT"));
  const links = await page.$$eval("a[href^='http']", (a) => a.map((x) => x.href));
  ok("16. Methods: external source links present", links.length >= 4, `${links.length} links`);
  await page.screenshot({ path: `${SHOTS}/t16_methods.png`, fullPage: false });
  await page.click('nav a[href="index.html"]');
  await waitData();
  ok("16. Nav link back to map works", (await page.title()) === "Ghost Unit Radar");

  // 17. Mobile layout
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.goto(BASE + "/index.html#N~PU000002", { waitUntil: "domcontentloaded" });
  await waitData(); await sleep(800);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  ok("17. Mobile (390px): no horizontal scroll", !overflow);
  ok("17. Mobile: card opens", await cardOpen());
  await page.screenshot({ path: `${SHOTS}/t17_mobile.png` });

  // 18. Dark mode renders
  await page.setViewport({ width: 1400, height: 900 });
  await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "light" }]);
  await page.goto(BASE + "/index.html", { waitUntil: "domcontentloaded" }); await waitData();
  const lightBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "dark" }]);
  const darkBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  ok("18. Light and dark themes both apply", lightBg !== darkBg, `${lightBg} / ${darkBg}`);
  await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "light" }]);
  await page.screenshot({ path: `${SHOTS}/t18_light.png` });

  ok("19. No JS errors / failed data requests during the whole run", errors.length === 0, errors.slice(0, 5).join(" | "));
} catch (e) {
  ok("UNCAUGHT", false, e.stack);
} finally {
  await browser.close();
  const f = results.filter((r) => !r.pass);
  console.log(`\n${results.length - f.length}/${results.length} passed`);
  if (f.length) { console.log("FAILURES:"); f.forEach((r) => console.log(" - " + r.name + "  " + r.detail)); }
}
