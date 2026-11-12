# Ghost Unit Radar — application answers

Ready to paste into the AI4Elections Hackathon 2026 form. Each answer has a full version and a short version (≤50 words) for forms with tight limits.

All numbers come from `web/data/summary.json` and `web/data/sensitivity.json` (pipeline run of 12 Nov 2026).
Items marked **[CHECK]** need a human to confirm before submitting.

---

## Project name

Ghost Unit Radar

## One-line description (≤25 words)

A map that checks every Nigerian polling unit's published location and physical plausibility, and lists the ones that need field verification first.

*(22 words)*

## Track(s)

1. Electoral data analysis (main track)
2. Election observation and citizen accountability

---

## Problem (≤150 words)

INEC publishes a list of 176,623 polling units. Observers, journalists and voters use it to find where people vote. But nobody checks whether the list makes physical sense.

We checked the public list against official state boundaries. 1,515 polling units have coordinates outside Nigeria. One Kogi school is placed in Waterloo, Canada, 9,196 km away. 2,243 units sit in a different state from the one listed. 43,373 units are stacked on 2,053 shared points, so their real locations are unknown. Seven states publish no coordinates at all.

Bad location data hides real problems. If a unit's location is wrong, nobody can check whether its register size fits the number of people who live there, or whether its result sheet is physically possible. Field teams have limited time and money. They need a clear, fair list of where to look first.

*(147 words)*

**Short version (≤50 words):** INEC's public list has 176,623 polling units. 1,515 have coordinates outside Nigeria, 2,243 sit in the wrong state, and 43,373 are stacked on shared points. Without good locations, nobody can check if registers and results are physically plausible. Field teams need a fair list of where to look first.

---

## Solution (≤200 words)

Ghost Unit Radar is a data-quality triage tool. It scores every polling unit from 0 to 100 for physical plausibility and explains each score in plain English.

It runs three checks:

1. **Location integrity (real public data).** Is the coordinate inside Nigeria, in the right state, and not stacked on top of other units?
2. **Population plausibility.** How many adults live within 1 km, according to satellite-derived WorldPop data? Does the register size fit? Registers in this demo are synthetic.
3. **Clock audit.** Could one BVAS device physically accredit the number of voters on the result sheet in polling hours? Result sheets in this demo are synthetic.

Each unit gets a status: Plausible, Review, Field check needed, or No location published. Every flag shows a plain-English reason and the most likely innocent explanation.

The live map lets users search for a unit, filter by problem type, open a unit card, change the assumed seconds per voter (30–120 s), build a field-verification list and download it as CSV. A findings page and a methods and ethics page explain the results.

It never says "fraud". It says "needs field verification".

*(186 words)*

**Short version (≤50 words):** A triage map that scores all 176,623 polling units for physical plausibility using three checks: location integrity (real data), population plausibility and a BVAS clock audit (synthetic registers and sheets). Every flag has a plain-English reason and an innocent explanation. Output: a downloadable field-verification list.

---

## How it works / technical approach (≤200 words)

The system has two parts: a Python pipeline and a static website.

**Pipeline (Python, about 25 seconds for all states).** It reads the public polling-unit list, geoBoundaries state boundaries and the WorldPop 2020 1 km population grid. It then:

- tests each coordinate against state boundaries (3 km border tolerance), finds stacks of 10 or more units on one exact point, and names out-of-country points with an offline gazetteer;
- estimates adults within 1 km (population × adult share 0.50), shared among units in the same circle, and compares this with a synthetic register;
- computes the clock limit: polling hours × 3,600 ÷ seconds per voter × BVAS devices, and compares it with synthetic result sheets.

The score starts at 100. Each reason subtracts a documented penalty. 70 or above is Plausible, 40–69 is Review, below 40 is Field check needed.

**Website.** A Next.js, TypeScript, Tailwind and MapLibre app, built as a static export and hosted on Vercel. There is no server, database or login.

**Testing.** 44 automated tests cover scoring, geometry, the clock audit and the headline numbers. We planted 900 synthetic anomalies; 894 were flagged.

*(195 words)*

**Short version (≤50 words):** A Python pipeline checks every coordinate against state boundaries, estimates adults within 1 km from WorldPop, and computes a BVAS clock limit. A 0–100 score is 100 minus named penalties. Results feed a static Next.js + MapLibre site on Vercel. No server, no database, no login. 894/900 planted anomalies flagged.

---

## Data sources and licences

| Data | What we use it for | Licence |
|---|---|---|
| mykeels/inec-polling-units (scraped from INEC's public website, 2022) | 176,623 polling units: names, wards, LGAs, coordinates | MIT |
| geoBoundaries gbOpen NGA ADM1 | State boundaries | CC BY 4.0 |
| WorldPop Global 1 km population 2020 (Nigeria) | Adults living around each unit | CC BY 4.0 |
| Synthetic registers and result sheets (generated by our code) | Population plausibility and clock audit | Ours, MIT |
| OpenFreeMap basemap (OpenMapTiles schema, © OpenStreetMap contributors) | Map background | Data ODbL |
| Google Open Buildings 2.5D Temporal (planned; Earth Engine script written, not yet run) | Rooftop counts 2016–2023 | CC BY 4.0 / ODbL |

Our code is open source under the MIT licence.

**Short version (≤50 words):** Public INEC polling-unit list (MIT dataset, 2022), geoBoundaries state boundaries (CC BY 4.0), WorldPop 1 km population 2020 (CC BY 4.0), OpenFreeMap/OpenStreetMap basemap (ODbL), and our own synthetic registers and result sheets. Google Open Buildings is planned. Code is MIT.

---

## How AI / data science is used

Ghost Unit Radar uses **geospatial analysis and rule-based, explainable scoring**. It does not use a black-box machine-learning model. This is a deliberate responsible-AI choice.

- **Satellite-derived data.** WorldPop population estimates are themselves produced by machine-learning models from satellite imagery and census data. We use them to estimate how many adults live around each unit.
- **Geospatial analysis.** Point-in-polygon tests against state boundaries, detection of stacked coordinates, distance calculations, and an offline gazetteer to name where out-of-country points fall.
- **Statistical plausibility tests.** Register size compared with estimated adults; result-sheet totals compared with a physical limit.
- **Explainable scoring.** Every score is 100 minus named penalties. A user can see exactly why a unit was flagged and what innocent cause is most likely.
- **Validation.** We planted 900 known anomalies in the synthetic data. The pipeline flagged 894 (99.3%). We also ran a sensitivity analysis at 0.5, 1 and 2 km and at 30 to 120 seconds per voter.

Why no black box: a flag can send a field team to a community. Election officials, observers and the public must be able to see, check and challenge every reason. A rule-based score can be audited line by line.

**Short version (≤50 words):** Geospatial analysis of satellite-derived population data plus rule-based, explainable scoring. No black-box model, by design: every flag must be checkable and challengeable by officials, observers and the public. Validated on 900 planted synthetic anomalies (894 flagged) with sensitivity tests on radius and seconds per voter.

---

## Responsible AI, privacy and security (≤150 words)

- **No INEC system accessed.** No IReV, BVAS or voter-registration queries. Only static public files.
- **No personal data.** The tool works at polling-unit level. No voter names or numbers are used or generated.
- **Synthetic data, clearly labelled.** Registers and result sheets are generated and marked SYNTHETIC wherever they appear.
- **Careful language.** A flag means "needs field verification", never "fraud". Every flag shows its most likely innocent cause.
- **Explainable.** Every score is a sum of documented penalties. No hidden model.
- **Small attack surface.** The site is static files only: no server, no database, no login, no user uploads, no tracking of users. The field-verification list stays in the user's browser.
- **Open and correctable.** The code is public. Anyone can report a data problem through the GitHub issue tracker.

*(137 words)*

**Short version (≤50 words):** No INEC systems accessed, no personal data, synthetic registers clearly labelled. Flags say "needs field verification", never "fraud", and show innocent explanations. Scores are explainable penalties. The site is static files only: no server, database, login or user tracking. Code is open for scrutiny.

---

## Synthetic data statement

All registered-voter numbers and result-sheet numbers in Ghost Unit Radar are **synthetic**. Our code generates them from realistic distributions based on the estimated adult population around each unit. We then plant known anomalies (inflated registers, empty catchments, impossible clock totals) to test the checks. They are labelled SYNTHETIC on the map, the unit cards, the findings page, the methods page and in the CSV downloads.

Location findings use **real public data**: the polling-unit list as published on INEC's public website (2022 snapshot, via an MIT-licensed dataset). We accessed no INEC live system. With real registers, the same code would produce real scores. That should only happen under INEC's authority.

**Short version (≤50 words):** Every register and result-sheet number is synthetic, generated by our code, with planted anomalies for testing, and labelled SYNTHETIC everywhere. Location findings use the real public polling-unit list (2022). No INEC live system was accessed. Real-data use should only happen under INEC's authority.

---

## Non-partisanship

Ghost Unit Radar uses no party, candidate or election-result data. No party colours appear in the interface. Every polling unit in every state is scored by the same published rules. The output is a list of data-quality questions for field checking, not claims about who won or lost. It is built to help INEC clean its data and to help observers and journalists check it fairly.

**Short version (≤50 words):** No party, candidate or result data. No party colours. Every unit in every state is scored by the same published rules. The output is data-quality questions for field checks, not claims about any party or outcome.

---

## Scalability and feasibility (≤150 words)

It already runs nationally. The pipeline scores all 176,623 published polling units in about 25 seconds on a laptop. The website is static files, so it can serve many users at almost no cost and works on mobile.

It uses only free, open data and open-source tools. It needs no paid services.

To use it for real, INEC or an accredited observer group would replace the synthetic registers with real unit-level register counts, and update coordinates. Thresholds are in one configuration file, so they can be tuned. The same checks can run before every election and after every coordinate update.

Next upgrades are practical: rooftop counts from Google Open Buildings (script written), a 100 m population grid, and LGA and water-body checks. The seven states with no published coordinates need INEC's location data.

*(141 words)*

**Short version (≤50 words):** Already runs for all 176,623 units in about 25 seconds on a laptop. Static website, free open data, no paid services. Real use needs only real unit-level register counts and updated coordinates, under INEC's authority. Thresholds sit in one config file.

---

## Impact / who uses it

- **INEC (polling-unit and GIS teams):** a ranked list of published coordinates to fix before February 2027, starting with 1,515 outside Nigeria and 2,243 in the wrong state.
- **Accredited observer groups:** a fair, documented way to choose which polling units to visit first, with a downloadable field-verification list.
- **Journalists and fact-checkers:** a way to check claims about polling units using evidence, with plain-English reasons and innocent explanations to avoid false accusations.
- **Voters:** more accurate polling-unit locations mean fewer people sent to the wrong place on election day.

**Short version (≤50 words):** INEC gets a ranked list of coordinates to fix. Accredited observers get a fair, documented list of where to verify first. Journalists get evidence with innocent explanations built in. Voters get more accurate polling-unit locations.

---

## What's next before February 2027

1. **Rooftop counts.** Run the ready Earth Engine script to add Google Open Buildings 2016–2023 rooftop counts per unit ("1,400 voters, 38 rooftops").
2. **Finer population.** Move from the 1 km grid to WorldPop 100 m age-structured adults.
3. **More location checks.** Add LGA-level and water-body checks.
4. **Fresh data.** Re-run on INEC's current polling-unit list, and on states that now publish coordinates.
5. **Pilot with partners.** Share findings with INEC and one accredited observer group; run a small field check of the top flagged units to measure how many have innocent causes.
6. **Languages.** Add Hausa, Igbo and Yoruba text to the unit card. [CHECK: keep or drop this item]

**Short version (≤50 words):** Add Google Open Buildings rooftop counts (script ready), a 100 m population grid, LGA and water-body checks. Re-run on INEC's current list. Pilot with INEC and one observer group, field-checking the top flagged units to measure the false-alarm rate.

---

## Team

| Name | Role |
|---|---|
| Oluwatobi Olatunji | Lead developer and data pipeline |
| Jhmeet [CHECK: full name] | [CHECK: role] |

Team size: 2 (within the limit of 4). [CHECK: both members are Nigerian, aged 18+, and the project has not won an award elsewhere]

**Short version (≤50 words):** Oluwatobi Olatunji (lead developer, data pipeline) and Jhmeet [CHECK: full name] ([CHECK: role]). Team of two.

---

## Links

- **Live demo:** https://ghost-unit-radar.vercel.app
- **Demo unit (Kogi school placed in Waterloo, Canada):** https://ghost-unit-radar.vercel.app/#PU000002
- **Findings and CSV download:** https://ghost-unit-radar.vercel.app/findings/
- **Methods and ethics:** https://ghost-unit-radar.vercel.app/methods/
- **How it works (plain language):** https://ghost-unit-radar.vercel.app/about.html
- **Source code (MIT):** https://github.com/Tobby-King/ghost-unit-radar
- **Demo video:** [CHECK: add link once uploaded]
