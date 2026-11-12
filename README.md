# Ghost Unit Radar

**Live demo: https://ghost-unit-radar.vercel.app** · [Waterloo unit](https://ghost-unit-radar.vercel.app/#PU000002) · [Findings](https://ghost-unit-radar.vercel.app/findings/) · [Methods & Ethics](https://ghost-unit-radar.vercel.app/methods/)

**Checks every Nigerian polling unit against what satellites can see.** Entry for the AI4Elections Hackathon 2026
(tracks: Electoral data analysis · Election observation and citizen accountability).

Ghost Unit Radar is a data-quality **triage** tool for INEC, accredited observers and journalists. It gives each polling unit
a 0–100 plausibility score, plain-language reasons, and the most likely *innocent* explanation for every flag.
It never says "fraud". It says **"needs field verification"**.

> **Registers and result sheets in this project are SYNTHETIC.** Location findings use real public data.
> No INEC live system (IReV, CVR portal, etc.) is accessed. Only static public files are used.

Submission documents (application answers, demo script, pitch, checklist) are in [`submission/`](submission/).

## In plain language

**A spell-checker for Nigeria's list of polling units.** It reads INEC's public list, compares each polling unit with satellite
data, and highlights the ones that don't add up (a Kogi school placed in Canada, 1,700 voters where about 190 adults live,
a machine "accrediting" more people than is physically possible), so INEC, observers or journalists know **where to check in person first**.
Each unit gets one of four statuses: ● Plausible, ▲ Review, ◆ Field check needed, or ○ No location published. It never says "fraud".

## Architecture

```
 1. INPUTS (static public files)      2. ENGINE (Python, ~25 s)          3. RESULTS (plain files)      4. WEBSITE (static, Vercel)
 ─────────────────────────────        ─────────────────────────          ───────────────────────       ──────────────────────────
 INEC polling-unit list (MIT)   ──►   check 1: location integrity  ──►   web/data/states/*.json  ──►   Next.js + MapLibre static site
 State boundaries (geoBoundaries)     check 2: population plausibility   web/data/summary.json         (frontend/), built from web/data
 WorldPop satellite population        check 3: BVAS clock audit          data/out/units.csv            by frontend/scripts/build-data.mjs
 SYNTHETIC registers + sheets         score 0-100 + reasons              field_verification.csv        map · findings · methods
        ▲                                     ▲
        └── optional: Google Earth Engine rooftop counts (Open Buildings 2016-2023)
```

No server, no database, no login, no personal data, and no connection to INEC's live systems. The website is read-only files.
A plain-language version with a diagram is at [/about.html](https://ghost-unit-radar.vercel.app/about.html).

## The web app

- **Map** (`/`): floating search; quick-filter chips (Field check needed, Review, Outside Nigeria, Wrong state, Stacked, Clock audit,
  Register too large); light and dark map.
- **Unit card**: score, plain-English reasons, and a "could be innocent" explanation for every flag. Out-of-country units get a
  dashed line to the state they claim.
- **Clock audit**: adjustable seconds per voter (30–120 s).
- **Field-verification list**: add units, download as CSV. Kept in your browser only.
- **Presentation mode**: press **P** to step through five showcase units.
- **Mobile**: bottom-sheet layout.
- **Findings** (`/findings/`): summary report and CSV download. **Methods & Ethics** (`/methods/`): every rule, penalty, licence and limitation.

## Findings from real public data (all 176,623 published units)

| Finding | Units |
|---|---:|
| Coordinate **outside Nigeria** (largest clusters: Toronto, Waterloo and Kitchener, Canada) | **1,515** |
| Coordinate in a **different state** from the one listed | **2,243** |
| **Stacked**: ≥10 units on one exact point (2,053 points; largest has 283 units, Olamaboro LGA, Kogi) | **43,373** |
| **No coordinate** published (all of FCT, Plateau, Rivers, Sokoto, Taraba, Yobe, Zamfara) | **57,326** |

119,297 units have a coordinate. Overall, 2,828 units are ◆ Field check needed and 2,319 are ▲ Review (location flags are real;
population and clock flags use synthetic registers and sheets).

Example: *LGEA School Inele, Ugo I & II* (Olamaboro, Kogi) is published at 43.4691, −80.5757, which is Waterloo, Canada,
9,196 km from Kogi State. [See it on the map](https://ghost-unit-radar.vercel.app/#PU000002).

## The three checks

1. **Location integrity (real data):** point-in-polygon against geoBoundaries state boundaries (3 km border tolerance),
   duplicate-coordinate stacks, and a lat/lon swap test. Out-of-country points are named with an offline gazetteer.
2. **Population plausibility:** WorldPop 2020 1 km population, converted to adults (18+, share 0.50) within 1 km and divided by the
   polling units sharing that circle. This is compared with the **synthetic** register. "Almost nobody lives here" fires when there are fewer than 250 adults
   within 1 km and a register more than twice that. Optional upgrade: `earth_engine/catchment_export.js` adds WorldPop 100 m age-structured adults and
   **Google Open Buildings 2.5D Temporal** rooftop counts for 2016 and 2023 ("38 rooftops", "no buildings before…"). This script is written but has not been run yet.
3. **Clock audit (synthetic result sheets):** `max = hours × 3600 ÷ seconds-per-voter × BVAS devices`.
   "Impossible" means above the max even at 30 s per voter. "Implausible" means above the max at the typical 45 s. A slider on the map covers 30–120 s.

The score is 100 minus documented penalties (see the [Methods page](https://ghost-unit-radar.vercel.app/methods/)).
● Plausible ≥70, ▲ Review 40–69, ◆ Field check needed <40.

**Validation on synthetic data:** 900 anomalies were planted (30 per state). 894 were flagged (99.3%): 240/240 empty catchments,
354/360 inflated registers and 300/300 impossible clocks. Another 1,129 synthetic flags fell on units that were not planted (about 1.6% of scored
units), mostly sparse rural catchments. These are the innocent false alarms that field verification is for. See `pipeline/sensitivity.py`
for results at 0.5 / 1 / 2 km and 30 / 45 / 60 / 90 / 120 s.

## Repository

```
pipeline/
  gur/config.py        every threshold, in one place
  gur/geo.py           pure-Python point-in-polygon, distances, grid index
  gur/location.py      check 1: location integrity
  gur/population.py    WorldPop raster catchments (+ Earth Engine CSV loader)
  gur/scoring.py       check 2 + score/band
  gur/clock.py         check 3: BVAS clock audit
  gur/synthetic.py     synthetic registers & result sheets, planted anomalies
  gur/gazetteer.py     offline place names for out-of-country points
  run_pipeline.py      end-to-end run -> data/out/*.csv, *.geojson, web/data/*.json
  sensitivity.py       radius and seconds-per-voter sensitivity
  make_ee_points.py    points for the Earth Engine export
  tests/test_scoring.py   30 unit tests (scoring, geometry, clock, generator)
  tests/test_outputs.py   14 integration tests (recompute headline numbers independently)
earth_engine/catchment_export.js   WorldPop 100 m adults + Open Buildings Temporal counts
frontend/              the deployed web app: Next.js + TypeScript + Tailwind + MapLibre, static export
  scripts/build-data.mjs   turns web/data (pipeline output) into compact files in frontend/public/data
  scripts/copy-legacy.mjs  copies the plain-language about.html into the build
web/                   pipeline output (web/data) and the earlier static site (about.html is still served)
submission/            hackathon application answers, demo script, pitch, checklist
scripts/download_data.sh
```

## Run the pipeline (about 5 minutes)

```bash
./scripts/download_data.sh                      # ~18 MB of static public files
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python -m pytest -q pipeline/tests    # 44 passed (after the pipeline has run)
.venv/bin/python pipeline/run_pipeline.py       # all states, ~25 s
.venv/bin/python pipeline/sensitivity.py        # optional, ~1 min
```

Options: `--radius 2`, `--spv 60`, `--hours 6`, `--demo-state LAGOS`, `--ee data/raw/ee_catchments.csv`.

Outputs: `data/out/units.csv` (every unit, every number and reason), `data/out/field_verification.csv`
(red and amber, worst first, with innocent explanations), `data/out/units_KANO.geojson`, and `data/out/planted_ground_truth.csv`.

## Run the web app

Needs Node.js 20+.

```bash
cd frontend
npm ci
npm run dev          # http://localhost:3000 (runs build-data.mjs first)
npm run build        # static site in frontend/out
```

`npm run build` reads the pipeline output in `web/data`, so re-run the pipeline first if you changed a threshold.
To preview the static build: `npx serve frontend/out` (or any static file server).

Browser end-to-end tests (85 checks) are in `tests/e2e` and use your installed Chrome. They were written for the earlier
static site in `web/` (`cd web && python3 -m http.server 8000`, then `cd tests/e2e && npm install && node e2e.mjs http://localhost:8000 /tmp`)
and have not yet been ported to the Next.js app.

## Deploy

The app is a static export, so any static host works. On Vercel, `vercel.json` installs and builds `frontend/` and serves
`frontend/out`; run `vercel --prod` from the repo root or push to the connected branch. For GitHub Pages or similar, publish `frontend/out`.

## Responsible use

- Triage only. Flags are leads for field checks, never findings of wrongdoing. Every flag carries an innocent explanation.
- No personal data. Polling-unit level only. No voter records are used or generated.
- Synthetic registers and result sheets, labelled everywhere they appear.
- Non-partisan. No party, candidate or result data, and no party colours.
- Explainable. A sum of named penalties, with no black-box model.
- Hackathon rules: no access to INEC live systems. Winning does not imply permission to deploy against real data.
  That should happen under INEC's authority.

## Data and licences

| Data | Licence |
|---|---|
| [mykeels/inec-polling-units](https://github.com/mykeels/inec-polling-units) (scraped from INEC's public site, 2022) | MIT |
| [geoBoundaries](https://www.geoboundaries.org/) gbOpen NGA ADM1 | CC BY 4.0 |
| [WorldPop](https://www.worldpop.org/) Global 1 km population 2020 (Nigeria) | CC BY 4.0 |
| [Google Open Buildings 2.5D Temporal](https://research.google/blog/open-buildings-25d-temporal-dataset-tracks-building-changes-across-the-global-south/) (optional, via Earth Engine; not yet run) | CC BY 4.0 / ODbL |
| Basemap: [OpenFreeMap](https://openfreemap.org) (OpenMapTiles schema, © OpenStreetMap contributors) | ODbL |
| IBM Plex Sans / Mono, Space Grotesk (Google Fonts) | SIL Open Font License |

Code: MIT (see `LICENSE`).

## Limitations

2022 snapshot. Coordinates are mostly geocoded, not surveyed. The 1 km population grid is coarse and dated 2020. The adult share is a national constant.
The catchment is a fixed radius. State boundaries are simplified (hence the 3 km tolerance). LGA and water-body checks are not yet implemented.
Rooftop counts (Google Open Buildings) are not yet included.

## Team

Oluwatobi Olatunji (lead developer, data pipeline) and Jhmeet [CHECK: full name and role].
To report a correction or data problem, please [open an issue](https://github.com/Tobby-King/ghost-unit-radar/issues).
