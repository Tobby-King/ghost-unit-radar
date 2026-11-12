# Application form: paste sheet

Form: https://ai4elections.risenetworks.org/application (5 steps). It closes **Thursday 12 November 2026, 11:59 pm WAT**.

Fields are listed in the order the form shows them. Copy each block into the field with the same name.

**✏️ = only you know this. Type it yourself.**

---

## Step 1: Personal information

| Field | Value |
|---|---|
| First Name | Oluwatobi |
| Last Name | Olatunji |
| Email Address | oluwatobiolatunji43@gmail.com |
| Phone Number | ✏️ your number, e.g. +234 … |
| Country of Residence | Nigeria |
| State of Residence | ✏️ |
| City | ✏️ |
| What best describes your application? | **Team** |

## Step 2: Your background

**Tell us about your experience**

> I build data and mapping software. For the #AI4Elections Hackathon I built Ghost Unit Radar, a working tool that checks every one of Nigeria's 176,623 published polling units for physical plausibility. It runs a Python geospatial pipeline and a Next.js and MapLibre web app, live at ghost-unit-radar.vercel.app. My teammate Jhmeet is co-developer.

| Field | Value |
|---|---|
| Primary Area of Expertise | Software development and geospatial data analysis |
| Years of Experience | ✏️ |
| Current Role / Occupation | ✏️ e.g. Software developer |
| Organisation / Institution | ✏️ (or "Independent") |
| Highest level of Education | ✏️ |
| Academic / Professional Field | ✏️ |

## Step 3: Skills and interest

**Skills**

> Python, Geospatial analysis, Data analysis, TypeScript, Next.js, React, MapLibre GL, Tailwind CSS, Data visualisation, Automated testing, Responsible AI, Open data

**Tell us about your relevant experience**

> We built Ghost Unit Radar end to end for this hackathon, and it is live today.
> - A Python pipeline scores all 176,623 polling units on INEC's public 2022 list in about 25 seconds. It checks coordinates against geoBoundaries state boundaries, estimates adults within 1 km from WorldPop satellite-derived population data, and runs a BVAS clock audit on synthetic result sheets.
> - 44 automated tests cover the pipeline. We planted 900 synthetic anomalies, and it flagged 894 of them.
> - A public web map lets anyone search a unit, see why it was flagged and its most likely innocent cause, and download a field-verification list as CSV.

**Which challenge track interests you most?**

> Electoral data analysis and election integrity (also election observation and citizen accountability)

**Why are you interested in this challenge area?**

> Nigeria's polling-unit list is public, but nobody checks whether it makes physical sense. We found 1,515 units with coordinates outside Nigeria. One Kogi State school is placed in Waterloo, Canada, 9,196 km away. Another 2,243 units sit in the wrong state, and 43,373 are stacked on shared points. Wrong locations send voters to the wrong place. They also hide real problems, because nobody can check whether a unit's register fits the people living there. We want to give INEC, accredited observers and journalists a fair, explainable list of where to verify first, before the 2027 elections.

## Step 4: Your idea

**Do you have a solution idea?** **Yes, I have an idea**

**What problem are you trying to solve?**

> INEC publishes a list of 176,623 polling units, and observers, journalists and voters use it to find where people vote. But nobody checks whether the list makes physical sense. Checked against official state boundaries:
> - 1,515 units have coordinates outside Nigeria. One Kogi school is placed in Waterloo, Canada, 9,196 km away.
> - 2,243 units sit in a different state from the one listed.
> - 43,373 units are stacked on 2,053 shared points, so their real locations are unknown.
> - Seven states publish no coordinates at all.
>
> Bad location data hides real problems. If a location is wrong, nobody can check whether the register fits the number of people who live there, or whether the result sheet is physically possible. Field teams have limited time and money. They need a clear, fair list of where to look first.

**Who is affected by this problem?**

> - Voters, who can be sent to the wrong place on election day.
> - INEC's polling-unit and GIS teams, who maintain the list.
> - Accredited observer groups and journalists, who need to know which units to verify.
> - Communities where a unit's published location or register size does not match reality.

**Describe your proposed solution**

> Ghost Unit Radar is a working data-quality triage tool, live at https://ghost-unit-radar.vercel.app. It scores every polling unit from 0 to 100 for physical plausibility, using three checks:
> 1. Location integrity (real public data): is the coordinate inside Nigeria, in the right state, and not stacked on other units?
> 2. Population plausibility: how many adults live within 1 km, from WorldPop satellite-derived data? Does the register size fit? (The registers are synthetic, as the rules require.)
> 3. Clock audit: could the unit's BVAS devices physically accredit the number of voters on the result sheet in polling hours? (The result sheets are synthetic.)
>
> Each unit gets a status: Plausible, Review, Field check needed, or No location published. Every flag shows a plain-English reason and the most likely innocent explanation.
>
> On the map, users can search for a unit, filter by problem, change the assumed seconds per voter, build a field-verification list and download it as CSV. It never says "fraud". It says "needs field verification".

**How would AI or technology contribute to the solution?**

> - Geospatial analysis: point-in-polygon tests against state boundaries, stacked-coordinate detection, distances, and an offline gazetteer that names where out-of-country points fall.
> - Satellite-derived data: WorldPop population estimates, themselves produced by machine-learning models from satellite imagery, tell us how many adults live around each unit.
> - Statistical plausibility tests: register size against adults nearby, and result-sheet totals against a physical limit.
> - Explainable scoring: every score is 100 minus named penalties. We chose not to use a black-box model, because a flag can send a field team to a community, so officials and the public must be able to check and challenge every reason.
>
> Validation: we planted 900 synthetic anomalies, and the checks flagged 894 (99.3%).

**Who would benefit from the solution?**

> - INEC: a ranked list of published coordinates to fix before February 2027, starting with 1,515 outside Nigeria and 2,243 in the wrong state.
> - Accredited observers: a fair, documented way to choose which units to visit first, with a downloadable field-verification list.
> - Journalists and fact-checkers: evidence with innocent explanations built in, so they can avoid false accusations.
> - Voters: more accurate polling-unit locations.

**What makes your approach different or useful?**

> - It works today, nationally. It scores all 176,623 units in about 25 seconds, and the site is public: https://ghost-unit-radar.vercel.app
> - It is explainable. Every flag has a plain-English reason and its most likely innocent cause. There is no black box.
> - It is careful. A flag means "needs field verification", never "fraud". It uses no party, candidate or result data. Registers are synthetic and labelled. No INEC system was accessed.
> - It is cheap to run, with free open data and a static website: no server, no database, no login, no user tracking.
> - It is open source (MIT): https://github.com/Tobby-King/ghost-unit-radar
> - Demo video: https://github.com/Tobby-King/ghost-unit-radar/raw/main/submission/demo-video.mp4

**Idea stage:** **Working prototype**

**Do you have a prototype?** **Yes**

**Prototype / project link**

> https://ghost-unit-radar.vercel.app

## Step 5: Accessibility and declarations

| Field | Value |
|---|---|
| Accessibility requirements | No (unless you need any) |
| Responsible participation requirements | ☑ tick |
| Information is accurate | ☑ tick |
| Privacy consent | ☑ tick |
| Opt in to the Community of Practice | ☑ optional, recommended |
| Applicant Declaration | ☑ tick |

Then click **Submit**. Take a screenshot of the confirmation page and keep any confirmation email.

---

### Team (in case they ask later)

- Oluwatobi Olatunji: lead developer and data pipeline.
- Jhmeet: co-developer. ✏️ Add Jhmeet's full name if the organisers ask for it.

Both members are Nigerian and aged 18+, and the project has not won an award elsewhere (confirmed by Oluwatobi, 12 Nov 2026).
