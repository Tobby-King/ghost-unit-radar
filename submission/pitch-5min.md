# Grand Finale pitch — 5 minutes

**Event:** AI4Elections Hackathon 2026 Grand Finale, 16 December 2026, Lagos (in person).
**Speakers:** Oluwatobi Olatunji (lead, demo) and Jhmeet [CHECK: who presents which part].
**Set-up:** laptop with the live site open at https://ghost-unit-radar.vercel.app/#PU000002. Backup: press **P** for presentation mode, which steps through five showcase units. Second backup: the recorded demo video.

Numbers are from the 12 Nov 2026 pipeline run (`web/data/summary.json`). [CHECK: re-run the pipeline and update numbers if anything changes before the finale.]

---

## 0:00–0:40 — The problem

- Open on the map, zoomed to Waterloo, Canada. Click the unit.
- "This is LGEA School Inele, Ugo I and II. A polling unit in Olamaboro, Kogi State. INEC's public list puts it in Waterloo, Canada. 9,196 kilometres away."
- "It is not alone. 1,515 polling units in the public list sit outside Nigeria."
- "Bad locations matter. If we don't know where a unit is, we can't check whether its register fits the people living there, or whether its result is physically possible."

## 0:40–2:10 — Live demo

1. **Unit card (20 s).** Score 10 out of 100. Plain-English reason. The innocent explanation: a geocoder matched the school name to a place abroad.
2. **Quick filters (25 s).** Outside Nigeria. Wrong state: 2,243. Stacked: 43,373 units on 2,053 points; the largest stack is 283 units on one point in Olamaboro, Kogi.
3. **Clock audit (20 s).** Open a flagged synthetic result sheet. Move the seconds-per-voter slider from 45 to 30 to 120. "We let the user change the assumption, because the honest answer depends on it."
4. **Field-verification list (15 s).** Add two units. Download the CSV. "This is what an observer group takes into the field."
5. **Methods page (10 s).** Show the penalty table. "Every point of every score is written down."

## 2:10–3:00 — Method

- Three checks:
  1. **Location integrity** — real public data. Coordinate vs state boundaries, stacks, out-of-country points.
  2. **Population plausibility** — adults within 1 km from WorldPop satellite-derived data vs the register.
  3. **Clock audit** — BVAS physical limit: hours × 3,600 ÷ seconds per voter × devices.
- Score = 100 minus documented penalties. 70+ Plausible, 40–69 Review, under 40 Field check needed.
- No black-box model. "A flag can send people into a community. Everyone must be able to see why."
- Runs on all 176,623 units in about 25 seconds. Static website, free open data.

## 3:00–3:40 — Real findings vs synthetic

Say clearly which is which.

| Real public data | Synthetic (hackathon rules) |
|---|---|
| 176,623 units; 119,297 with coordinates | All registers and result sheets |
| 1,515 outside Nigeria | 900 planted anomalies; 894 flagged (99.3%) |
| 2,243 in the wrong state | 1,129 flags on unplanted units: the expected false alarms |
| 43,373 stacked on 2,053 points | Sensitivity tested at 0.5/1/2 km and 30–120 s per voter |
| 7 states publish no coordinates | |

- "The location findings are real today. The register and clock checks are ready for real data, under INEC's authority."

## 3:40–4:10 — Responsible use

- No INEC system accessed. Static public files only.
- No personal data. Polling-unit level only.
- Non-partisan. No party, candidate or result data.
- "Needs field verification", never "fraud". Every flag shows its innocent explanation.
- Winning does not mean permission to deploy. Real use belongs with INEC.

## 4:10–4:40 — How INEC and observers use it before February 2027

- **Now – January:** INEC's GIS team fixes the 1,515 out-of-country and 2,243 wrong-state coordinates. We hand over the CSV.
- **January:** add Google Open Buildings rooftop counts (script ready) and LGA and water-body checks. Re-run on INEC's current list.
- **January – February:** one accredited observer group pilots the field-verification list in two states and reports how many flags had innocent causes. [CHECK: name a target partner if one is approached]
- **Election day:** observers and journalists use the map to find units and check claims with evidence.

## 4:40–5:00 — Team and ask

- **Team:** Oluwatobi Olatunji (lead developer, data pipeline); Jhmeet (co-developer).
- **Ask:**
  1. A data-sharing conversation with INEC: the current polling-unit coordinates and unit-level register counts, under INEC's authority.
  2. Introductions to one accredited observer group for a field pilot.
  3. Development Hub support and cloud credits to run the rooftop-count upgrade nationally.
- Close: "Ghost Unit Radar helps everyone look in the right place first. Thank you."

---

**Likely questions**

- *Is this accusing INEC?* No. Most location flags show where the published map needs cleaning. We built it to help INEC fix data.
- *How many flags are false alarms?* On synthetic data, 1,129 flags fell on unplanted units. Real-world false alarms are expected; that is why every flag goes to field verification, not to a headline.
- *Why not machine learning?* Explainability. Every flag must be checkable and challengeable.
- *What about the 7 states with no coordinates?* They show as "No location published". That is itself a finding for INEC.
- *Why 1 km?* Sensitivity tests: 0.5 km gives 5,066 unplanted flags; 2 km misses 33 planted anomalies. 1 km balances both.
