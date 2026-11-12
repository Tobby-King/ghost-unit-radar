"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fmt, getJSON, type Summary } from "@/lib/data";
import { SourceTag, TopBar } from "./ui";

type Sens = {
  radius: { radius_km: number; red: number; amber: number; planted_detected: number; planted: number; synthetic_flags_not_planted: number }[];
  seconds_per_voter: { seconds_per_voter: number; sheets_exceeding: number; planted_clock_detected: number; sheets: number }[];
};

const REPO = "https://github.com/Tobby-King/ghost-unit-radar";

export default function MethodsView() {
  const [s, setS] = useState<Summary | null>(null);
  const [sens, setSens] = useState<Sens | null>(null);
  useEffect(() => {
    getJSON<Summary>("/data/summary.json").then(setS).catch(() => {});
    getJSON<Sens>("/data/sensitivity.json").then(setSens).catch(() => {});
  }, []);
  const p = s?.params;
  const n = s?.national;
  const v = s?.synthetic_validation;

  return (
    <div className="min-h-dvh">
      <TopBar active="/methods/" />
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-10 md:px-8 lg:grid-cols-[200px_1fr]">
        <nav aria-label="On this page" className="hidden lg:block">
          <ol className="sticky top-8 space-y-2 text-sm text-muted">
            {[["what", "What this is"], ["checks", "The three checks"], ["score", "Score"], ["validation", "Validation"],
              ["sources", "Data sources"], ["ethics", "Responsible use"], ["limits", "Limitations"], ["contact", "Contact"]].map(([id, t]) => (
              <li key={id}><a href={`#${id}`} className="hover:text-ink">{t}</a></li>
            ))}
          </ol>
        </nav>

        <article className="max-w-prose text-[16px] leading-[1.7] [&_h2]:mt-14 [&_h2]:scroll-mt-6 [&_h2]:text-2xl [&_h3]:mt-8 [&_h3]:text-lg [&_p]:mt-4">
          <p className="label">Methods &amp; Ethics</p>
          <h1 className="text-3xl leading-tight md:text-4xl">How Ghost Unit Radar decides a polling unit needs a field check</h1>

          <div className="mt-6 grid gap-3 rounded-panel border border-line bg-surface p-5 text-sm sm:grid-cols-3" role="note">
            <Notice title="Synthetic registers" tone="text-review">
              Every registered-voter and result-sheet number is generated for this demo and labelled <b>SYNTHETIC</b> wherever it appears.
            </Notice>
            <Notice title="No INEC systems accessed" tone="text-accent-ink">
              No IReV, BVAS or voter-registration queries. Only static public files are used.
            </Notice>
            <Notice title="Non-partisan by design" tone="text-ok">
              No party, candidate or result data. Every unit is scored by the same rules.
            </Notice>
          </div>

          <h2 id="what">What this is</h2>
          <p>
            A data-quality triage tool that helps INEC, accredited observers and journalists decide where to send field checks.
            It asks a simple question of every polling unit: <em>is this physically plausible?</em> It uses where the unit is and how
            many people live around it.
          </p>
          <p>
            It does not detect fraud. Most flags will have innocent causes, and every flag shows the most likely one. A flag means
            <b> needs field verification</b>, never “fraud”.
          </p>

          <h2 id="checks">The three checks</h2>

          <h3 className="flex flex-wrap items-center gap-2">1. Location integrity <SourceTag source="REAL" /></h3>
          <Figure caption="A published coordinate is compared with Nigeria’s state boundaries.">
            <LocationDiagram />
          </Figure>
          <p>
            Every published coordinate is tested against Nigeria’s state boundaries. A coordinate is flagged if it is <b>outside
            Nigeria</b>, in a <b>different state</b> from the one INEC lists (points within {p?.border_tolerance_km ?? 3} km of a border
            are allowed, because the boundaries are simplified), or <b>stacked</b>: {p?.stack_min ?? 10} or more units sharing one exact
            point. A stack shows that a ward or LGA centre point was used instead of a GPS fix.
          </p>

          <h3 className="flex flex-wrap items-center gap-2">2. Population plausibility <SourceTag source="REAL" /> <SourceTag source="SYNTHETIC" /></h3>
          <Figure caption={`Adults living within ${p?.radius_km ?? 1} km, shared among the units in the same circle, compared with the register.`}>
            <PopulationDiagram />
          </Figure>
          <p>
            For each unit with a usable coordinate we estimate the adults living within {p?.radius_km ?? 1} km. We take WorldPop’s
            satellite-derived 2020 population density, multiply by the circle’s area, then by an adult (18+) share of {p?.adult_share ?? 0.5}.
            Nigeria’s population is very young: about 43% are under 15 and 6–7% are 15–17 (UN WPP).
          </p>
          <p>
            We divide that by the number of polling units in the same circle to get the adults this unit plausibly serves, then compare
            it with the synthetic register. A register above 1.2× is <b>Review</b>; above 2×, or with almost no residents, it is
            <b> Field check needed</b>. Units with an unreliable coordinate (outside Nigeria, wrong state, stacked) are not scored on
            population, because their catchment would be meaningless.
          </p>

          <h3 className="flex flex-wrap items-center gap-2">3. Clock audit <SourceTag source="SYNTHETIC" /></h3>
          <Figure caption="How many voters one BVAS device can physically accredit in a polling day.">
            <ClockDiagram hours={p?.polling_hours ?? 6} spv={p?.seconds_per_voter ?? 45} />
          </Figure>
          <p>
            One BVAS device takes roughly 30–120 seconds per voter. The most voters a unit can accredit is
          </p>
          <p className="rounded-chip border border-line bg-surface px-4 py-3 font-mono text-sm">
            polling hours × 3,600 ÷ seconds per voter × devices
          </p>
          <p>
            A sheet is <b>impossible</b> if it exceeds this at the fastest {p?.seconds_per_voter_fastest ?? 30} s, and <b>implausible</b> if it
            exceeds it at the typical speed (default {p?.seconds_per_voter ?? 45} s, adjustable on the map from 30 to 120 s).
          </p>

          <h2 id="score">Score</h2>
          <p>
            Each unit starts at 100 and each reason subtracts a documented penalty. There is no hidden model.
            70 or above is <Status i="●" c="text-ok">Plausible</Status>, 40–69 is <Status i="▲" c="text-review">Review</Status>, below 40 is
            <Status i="◆" c="text-field"> Field check needed</Status>. Units without a coordinate are <Status i="○" c="text-none">No location published</Status>.
          </p>
          <Table head={["Reason", "Data", "Penalty", "Typical innocent explanation"]} rows={[
            ["Outside Nigeria", "Real", "70", "Geocoder matched the school or village name to a place abroad; lat/lon swapped"],
            ["In a different state", "Real", "45", "Same-named place in another state; typo in the coordinate"],
            ["Stacked ≥10 / ≥50", "Real", "20 / 30", "Centre point used instead of a GPS fix"],
            ["Register above adults 1.2× / 2× / 3×", "Synthetic", "25 / 45 / 65", "Register not cleaned after people moved; new estate missing from 2020 population data"],
            ["Almost nobody lives here", "Synthetic", "65", "Scattered rural catchment wider than the radius; wrong coordinate"],
            ["Clock impossible / implausible", "Synthetic", "50 / 20", "Extended hours for voters queued at close; unrecorded device; data-entry error"],
          ]} />

          <h3>Findings on real data</h3>
          <Table head={["Measure", "Units"]} rows={n ? [
            ["Polling units in the published list", fmt(n.units)],
            ["With a coordinate", fmt(n.with_coordinates)],
            [`Without a coordinate (all units in ${s!.no_coordinate_states.length} states)`, fmt(n.without_coordinates)],
            ["Coordinate outside Nigeria", fmt(n.outside_nigeria)],
            ["Coordinate in a different state", fmt(n.wrong_state)],
            [`Stacked ≥${p!.stack_min} on one point (${fmt(n.stacked_points)} points)`, fmt(n.stacked_units)],
            [`Largest stack (${n.largest_stack.lga.toLowerCase()}, ${n.largest_stack.state.toLowerCase()})`, fmt(n.largest_stack.size)],
          ] : []} numeric />

          <h2 id="validation">Validation on synthetic anomalies</h2>
          <p>
            We planted {v ? fmt(v.planted) : "…"} anomalies of known type (30 per state with coordinates) in the synthetic registers and
            result sheets, then checked how many the pipeline flagged.
          </p>
          <Table head={["Planted type", "Planted", "Flagged"]} numeric rows={v ? [
            ...Object.entries(v.by_type).map(([t, x]) => [t.replace(/_/g, " ").toLowerCase(), fmt(x.planted), `${fmt(x.detected)} (${((100 * x.detected) / x.planted).toFixed(1)}%)`]),
            ["All", fmt(v.planted), `${fmt(v.detected)} (${((100 * v.detected) / v.planted).toFixed(1)}%)`],
            ["Flags on units that were not planted", "–", fmt(v.synthetic_flags_not_planted)],
          ] : []} />
          <p>
            Some flags were not planted. They come from the synthetic generator and the coarse 1 km population grid, mostly in sparse
            rural areas. Real-world false alarms of the same kind are expected, which is why every flag goes to field verification.
          </p>
          <h3>Sensitivity</h3>
          <p>
            A smaller radius produces many more false alarms in sparse areas; a larger one dilutes real anomalies. We use 1 km. The clock
            result depends heavily on the assumed speed, which is why a sheet is only called “impossible” at the fastest 30 s.
          </p>
          {sens && (
            <>
              <Table head={["Radius", "◆ Field check", "▲ Review", "Planted caught", "Unplanted flags"]} numeric rows={sens.radius.map((r) =>
                [`${r.radius_km} km`, fmt(r.red), fmt(r.amber), `${fmt(r.planted_detected)} / ${fmt(r.planted)}`, fmt(r.synthetic_flags_not_planted)])} />
              <Table head={["Seconds per voter", "Max per device (6 h)", "Sheets exceeding", "Planted clock caught"]} numeric rows={sens.seconds_per_voter.map((r) =>
                [`${r.seconds_per_voter} s`, fmt(Math.floor(21600 / r.seconds_per_voter)), fmt(r.sheets_exceeding), fmt(r.planted_clock_detected)])} />
            </>
          )}

          <h2 id="sources">Data sources and licences</h2>
          <Table head={["Data", "Use", "Licence"]} rows={[
            [<a key="a" className="text-accent-ink hover:underline" href="https://github.com/mykeels/inec-polling-units" target="_blank" rel="noopener">mykeels/inec-polling-units</a>, "176,623 units scraped from INEC’s public site (2022): names, wards, LGAs, coordinates", "MIT"],
            [<a key="b" className="text-accent-ink hover:underline" href="https://www.geoboundaries.org" target="_blank" rel="noopener">geoBoundaries gbOpen NGA ADM1</a>, "State boundaries (simplified)", "CC BY 4.0"],
            [<a key="c" className="text-accent-ink hover:underline" href="https://www.worldpop.org" target="_blank" rel="noopener">WorldPop 1 km population 2020</a>, "Population density", "CC BY 4.0"],
            ["Google Open Buildings 2.5D Temporal (optional, via Earth Engine)", "Rooftops per year 2016–2023 (pending)", "CC BY 4.0 / ODbL"],
            [<a key="d" className="text-accent-ink hover:underline" href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a>, "Basemap tiles (OpenMapTiles schema, © OpenStreetMap contributors)", "Free, no key · data ODbL"],
            ["IBM Plex Sans / Mono, Space Grotesk", "Typefaces (Google Fonts)", "SIL Open Font License"],
          ]} />

          <h2 id="ethics">Responsible use and ethics</h2>
          <ul className="mt-4 space-y-3">
            <Li t="No INEC system is accessed.">No IReV or voter-registration queries are made. Only static public files are used.</Li>
            <Li t="No personal data.">The tool works at polling-unit level. No voter names or numbers are used or generated.</Li>
            <Li t="Synthetic registers.">Every registered-voter and result-sheet number is generated and labelled. With real INEC data the same code would produce real scores; that should only happen under INEC’s authority.</Li>
            <Li t="Non-partisan by design.">No party, candidate or result data is used, and no party colours appear in the interface. Scores are the same for every unit regardless of politics.</Li>
            <Li t="“Needs verification”, never “fraud”.">Flags are leads, and each comes with its most likely innocent cause. The 2022 coordinates are mostly geocoded, not surveyed, so location flags mainly show where INEC’s published map needs cleaning.</Li>
            <Li t="Explainable.">Every score is a sum of named, documented penalties.</Li>
          </ul>

          <h2 id="limits">Limitations</h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 marker:text-muted">
            <li>The polling-unit list is a 2022 snapshot. INEC may have corrected coordinates since then.</li>
            <li>The 1 km population grid smooths dense neighbourhoods and misses very new settlements. The Earth Engine script upgrades this to WorldPop 100 m age-structured data plus Open Buildings counts.</li>
            <li>The adult share is a national constant. Regional age structures differ.</li>
            <li>A fixed radius is a simple catchment. Real units serve irregular areas, and rural units often draw voters from further away.</li>
            <li>State boundaries are simplified; units near borders get a {p?.border_tolerance_km ?? 3} km tolerance.</li>
            <li>LGA-level and water-body checks are not yet included.</li>
          </ul>

          <h2 id="contact">Contact</h2>
          <p>
            Built by Oluwatobi Olatunji for the AI4Elections Hackathon 2026. Code, pipeline and issue tracker:{" "}
            <a className="text-accent-ink hover:underline" href={REPO} target="_blank" rel="noopener">github.com/Tobby-King/ghost-unit-radar</a>.
            To report a correction or a data problem, please{" "}
            <a className="text-accent-ink hover:underline" href={`${REPO}/issues`} target="_blank" rel="noopener">open an issue</a>.
          </p>
          <p className="mb-16 text-sm text-muted">
            <Link href="/" className="text-accent-ink hover:underline">← Back to the map</Link>
          </p>
        </article>
      </div>
    </div>
  );
}

function Notice({ title, tone, children }: { title: string; tone: string; children: React.ReactNode }) {
  return (
    <div>
      <p className={`font-medium ${tone}`}>{title}</p>
      <p className="!mt-1 leading-relaxed text-muted">{children}</p>
    </div>
  );
}
function Status({ i, c, children }: { i: string; c: string; children: React.ReactNode }) {
  return <span className="whitespace-nowrap"><span aria-hidden="true" className={`${c} text-xs`}>{i}</span> <b>{children}</b></span>;
}
function Li({ t, children }: { t: string; children: React.ReactNode }) {
  return <li className="border-l-2 border-accent/50 pl-4"><b>{t}</b> <span className="text-muted">{children}</span></li>;
}
function Table({ head, rows, numeric }: { head: string[]; rows: React.ReactNode[][]; numeric?: boolean }) {
  return (
    <div className="mt-5 overflow-x-auto rounded-panel border border-line">
      <table className="w-full text-sm">
        <thead className="bg-surface text-left text-[11px] uppercase tracking-[0.08em] text-muted">
          <tr>{head.map((h, k) => <th key={h} scope="col" className={`px-3 py-2.5 font-medium ${numeric && k > 0 ? "text-right" : ""}`}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.length === 0 ? <tr><td className="px-3 py-3 text-muted" colSpan={head.length}>Loading…</td></tr> : rows.map((r, k) => (
            <tr key={k} className="border-t border-line align-top">
              {r.map((c, j) => <td key={j} className={`px-3 py-2.5 leading-snug ${numeric && j > 0 ? "text-right font-mono" : ""}`}>{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function Figure({ caption, children }: { caption: string; children: React.ReactNode }) {
  return (
    <figure className="mt-4 rounded-panel border border-line bg-surface p-4">
      {children}
      <figcaption className="mt-2 text-xs text-muted">{caption}</figcaption>
    </figure>
  );
}

/* ---------- diagrams (inline SVG, theme-aware via CSS variables) ---------- */
const ink = "rgb(var(--ink))", muted = "rgb(var(--muted))", line = "rgb(var(--line))", accent = "rgb(var(--accent))";
const ok = "rgb(var(--st-ok))", review = "rgb(var(--st-review))", field = "rgb(var(--st-field))";
const T = { fontFamily: "IBM Plex Sans, sans-serif", fontSize: 11 } as const;

function LocationDiagram() {
  return (
    <svg viewBox="0 0 560 170" className="w-full" role="img" aria-label="Diagram: a unit inside its state is plausible, one in another state needs review, one abroad needs a field check, and many units on one point are stacked.">
      <path d="M150 20 L290 14 L330 60 L318 140 L210 158 L130 130 L112 70 Z" fill="rgb(var(--raised))" stroke={accent} strokeWidth="1.6" />
      <path d="M225 17 L238 86 L215 156" fill="none" stroke={accent} strokeOpacity=".5" strokeDasharray="3 3" />
      <text x="150" y="44" style={T} fill={muted}>Listed state</text>
      <text x="252" y="44" style={T} fill={muted}>Other state</text>
      <circle cx="175" cy="96" r="6" fill={ok} /><text x="186" y="100" style={T} fill={ink}>● inside</text>
      <path d="M272 100 l7 -12 l7 12 z" fill={review} /><text x="290" y="100" style={T} fill={ink}>wrong state</text>
      <g transform="translate(176 132)">
        {[0, 1, 2, 3].map((k) => <circle key={k} cx={k * 2} cy={-k * 2} r="5" fill="rgb(var(--surface))" stroke={review} />)}
        <text x="14" y="4" style={T} fill={ink}>stacked ×15</text>
      </g>
      <path d="M318 70 C 400 30, 450 30, 500 52" fill="none" stroke={field} strokeDasharray="3 4" />
      <path d="M500 42 l8 10 l-8 10 l-8 -10 z" fill={field} />
      <text x="430" y="86" style={T} fill={ink}>outside Nigeria</text>
      <text x="430" y="101" style={T} fill={muted}>“Waterloo, Canada”</text>
    </svg>
  );
}

function PopulationDiagram() {
  const people = Array.from({ length: 34 }, (_, k) => [70 + ((k * 37) % 120) - 60, 85 + ((k * 53) % 110) - 55]);
  return (
    <svg viewBox="0 0 560 170" className="w-full" role="img" aria-label="Diagram: a 1 km circle around the unit counts adults, divided among the units inside the circle, compared with the register.">
      <circle cx="100" cy="85" r="68" fill="none" stroke={accent} strokeDasharray="4 4" />
      {people.map(([x, y], k) => <circle key={k} cx={x + 30} cy={y} r="2" fill={muted} />)}
      <circle cx="100" cy="85" r="6" fill={accent} />
      <path d="M128 60 l6 -10 l6 10 z" fill={muted} /><path d="M70 120 l6 -10 l6 10 z" fill={muted} />
      <line x1="100" y1="85" x2="168" y2="85" stroke={accent} /><text x="120" y="80" style={T} fill={ink}>1 km</text>
      <g style={T}>
        <text x="210" y="50" fill={ink}>adults within 1 km ÷ units in the circle</text>
        <text x="210" y="70" fill={muted}>= adults this unit plausibly serves</text>
        <text x="210" y="104" fill={ink}>register ÷ adults served</text>
        <text x="210" y="124" fill={muted}><tspan fill={ok}>●</tspan> ≤1.2×   <tspan fill={review}>▲</tspan> &gt;1.2×   <tspan fill={field}>◆</tspan> &gt;2×</text>
      </g>
    </svg>
  );
}

function ClockDiagram({ hours, spv }: { hours: number; spv: number }) {
  const max = Math.floor((hours * 3600) / spv);
  const end = (2 * Math.PI * hours) / 12;
  return (
    <svg viewBox="0 0 560 170" className="w-full" role="img" aria-label={`Diagram: ${hours} hours at ${spv} seconds per voter allows at most ${max} voters per BVAS device.`}>
      <circle cx="90" cy="85" r="62" fill="none" stroke={line} strokeWidth="2" />
      <path d={`M90 85 L90 23 A62 62 0 0 1 ${90 + 62 * Math.sin(end)} ${85 - 62 * Math.cos(end)} Z`} fill={accent} fillOpacity=".18" stroke={accent} />
      <text x="90" y="90" textAnchor="middle" style={{ ...T, fontSize: 13 }} fill={ink}>{hours} h</text>
      <g style={{ ...T, fontSize: 12 }}>
        <text x="190" y="52" fill={ink} style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 12 }}>{hours} h × 3,600 ÷ {spv} s × 1 device</text>
        <text x="190" y="76" fill={ink} style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 12 }}>= {max.toLocaleString("en-NG")} voters at most</text>
        <text x="190" y="112" fill={muted}>A sheet claiming more than this is implausible;</text>
        <text x="190" y="130" fill={muted}>more than the 30 s limit ({Math.floor((hours * 3600) / 30).toLocaleString("en-NG")}) is impossible.</text>
      </g>
    </svg>
  );
}
