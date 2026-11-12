# Ghost Unit Radar

**Live demo: https://ghost-unit-radar.vercel.app** · [Waterloo unit](https://ghost-unit-radar.vercel.app/#N~PU000002) · [Methods & Ethics](https://ghost-unit-radar.vercel.app/methods.html)

**Checks every Nigerian polling unit against what satellites can see.** Entry for the AI4Elections Hackathon 2026
(tracks: Electoral data analysis · Election observation and citizen accountability).

Ghost Unit Radar is a data-quality **triage** tool for INEC, accredited observers and journalists. It gives each polling unit
a 0–100 plausibility score, plain-language reasons, and the most likely *innocent* explanation for every flag.
It never says "fraud". It says **"needs field verification"**.

> **Registers and result sheets in this project are SYNTHETIC.** Location findings use real public data.
> No INEC live system (IReV, CVR portal, etc.) is accessed. Only static public files are used.

## Findings from real public data (all 176,623 published units)

| Finding | Units |
|---|---:|
| Coordinate **outside Nigeria** (largest cluster: Waterloo/Kitchener, Canada) | **1,515** |
| Coordinate in a **different state** from the one listed | **2,243** |
| **Stacked**: ≥10 units on one exact point (2,053 points; largest has 283 units, Olamaboro LGA, Kogi) | **43,373** |
| **No coordinate** published (all of FCT, Plateau, Rivers, Sokoto, Taraba, Yobe, Zamfara) | **57,326** |

Example: *LGEA School Inele, Ugo I & II* (Olamaboro, Kogi) is published at 43.4691, −80.5757, which is Waterloo, Canada.

## The three checks

1. **Location integrity (real data):** point-in-polygon against geoBoundaries state boundaries (3 km border tolerance),
   duplicate-coordinate stacks, and a lat/lon swap test. Out-of-country points are named with an offline gazetteer.
2. **Population plausibility:** WorldPop 2020 1 km population, converted to adults (18+, share 0.50) within 1 km and divided by the
   polling units sharing that circle. This is compared with the **synthetic** register. "Almost nobody lives here" fires when there are fewer than 250 adults
   within 1 km and a register more than twice that. Optional upgrade: `earth_engine/catchment_export.js` adds WorldPop 100 m age-structured adults and
   **Google Open Buildings 2.5D Temporal** rooftop counts for 2016 and 2023 ("38 rooftops", "no buildings before…").
3. **Clock audit (synthetic result sheets):** `max = hours × 3600 ÷ seconds-per-voter × BVAS devices`.
   "Impossible" means above the max even at 30 s per voter. "Implausible" means above the max at the typical 45 s. A slider on the map covers 30–120 s.

The score is 100 minus documented penalties (see the Methods page). Green ≥70, amber 40–69, red <40.

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
web/                   static site (Leaflet): map, detail cards, filters, CSV download, Methods & Ethics
scripts/download_data.sh
```

## Run it (about 5 minutes)

```bash
./scripts/download_data.sh                      # ~18 MB of static public files
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python -m pytest -q pipeline/tests    # 44 passed (after the pipeline has run)
.venv/bin/python pipeline/run_pipeline.py       # all states, ~25 s
.venv/bin/python pipeline/sensitivity.py        # optional, ~1 min
cd web && python3 -m http.server 8000           # open http://localhost:8000
```

Browser end-to-end tests (78 checks: every control, card, filter, download, deep link, mobile, themes),
using your installed Chrome:

```bash
cd tests/e2e && npm install && node e2e.mjs http://localhost:8000 /tmp   # or the live URL
```

Options: `--radius 2`, `--spv 60`, `--hours 6`, `--demo-state LAGOS`, `--ee data/raw/ee_catchments.csv`.

Outputs: `data/out/units.csv` (every unit, every number and reason), `data/out/field_verification.csv`
(red and amber, worst first, with innocent explanations), `data/out/units_KANO.geojson`, and `data/out/planted_ground_truth.csv`.

## Deploy

The site in `web/` is fully static, so any static host works. With Vercel: `vercel --prod` from the repo root (`vercel.json` serves `web/`).
For GitHub Pages, publish the `web/` folder.

## Responsible use

- Triage only. Flags are leads for field checks, never findings of wrongdoing. Every flag carries an innocent explanation.
- No personal data. Polling-unit level only. No voter records are used or generated.
- Synthetic registers and result sheets, labelled everywhere they appear.
- Non-partisan. No party, candidate or result data.
- Explainable. A sum of named penalties, with no black-box model.
- Hackathon rules: no access to INEC live systems. Winning does not imply permission to deploy against real data.
  That should happen under INEC's authority.

## Data and licences

| Data | Licence |
|---|---|
| [mykeels/inec-polling-units](https://github.com/mykeels/inec-polling-units) (scraped from INEC's public site, 2022) | MIT |
| [geoBoundaries](https://www.geoboundaries.org/) gbOpen NGA ADM1 | CC BY 4.0 |
| [WorldPop](https://www.worldpop.org/) Global 1 km population 2020 (Nigeria) | CC BY 4.0 |
| [Google Open Buildings 2.5D Temporal](https://research.google/blog/open-buildings-25d-temporal-dataset-tracks-building-changes-across-the-global-south/) (optional, via Earth Engine) | CC BY 4.0 / ODbL |
| OpenStreetMap tiles | ODbL |

Code: MIT (see `LICENSE`).

## Limitations

2022 snapshot. Coordinates are mostly geocoded, not surveyed. The 1 km population grid is coarse and dated 2020. The adult share is a national constant.
The catchment is a fixed radius. State boundaries are simplified (hence the 3 km tolerance). LGA and water-body checks are not yet implemented.
