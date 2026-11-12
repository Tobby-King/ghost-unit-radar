# Demo video script (2 minutes)

A silent screen recording, `demo-video.webm`, is in this folder. Read the voice-over below over it, or record a fresh screen capture following the same steps.

**Setup before recording:** open https://ghost-unit-radar.vercel.app/#PU000002 in a desktop browser, light map, window about 1440 × 900. Close other tabs. Set seconds per voter back to 45 s.

Speak calmly, at about 140 words per minute. Numbers below are from the 12 Nov 2026 pipeline run.

| Time | On screen | Voice-over |
|---|---|---|
| 0:00–0:15 | Map is zoomed to Waterloo, Canada. Click the ◆ unit. The unit card opens: LGEA School Inele, Ugo I & II, Olamaboro, Kogi. Dashed line runs from Canada back to Kogi State. | "This is a primary school in Olamaboro, Kogi State. According to INEC's published polling-unit list, it is in Waterloo, Canada. Nine thousand one hundred and ninety-six kilometres from Kogi." |
| 0:15–0:30 | Scroll the unit card: reasons, "could be innocent" explanation, score 10. | "Ghost Unit Radar finds problems like this in every polling unit in Nigeria. It gives each unit a score and a plain-English reason. And for every flag, it shows the most likely innocent cause. Here, a geocoder probably matched the school name to a place abroad." |
| 0:30–0:45 | Zoom out to all of Nigeria. Click the "Outside Nigeria" chip, then "Wrong state", then "Stacked". | "Check one is location integrity, on real public data. Of 176,623 units, 1,515 sit outside Nigeria. 2,243 are in the wrong state. 43,373 are stacked on shared points, so their real location is unknown." |
| 0:45–1:00 | Click "Field check needed" chip. Open a red unit with a register-too-large reason. Point at the SYNTHETIC label. | "Check two is population plausibility. We count adults within one kilometre from satellite population data, and compare with the register. The registers here are synthetic, as the hackathon rules require, and clearly labelled." |
| 1:00–1:15 | Click "Clock audit" chip. Open a unit. Move the seconds-per-voter slider from 45 to 30, then to 120. Counts change. | "Check three is a clock audit. One BVAS device needs about 30 to 120 seconds per voter. So there is a physical limit to how many voters can be accredited in a day. You can change the assumption and watch the flags change." |
| 1:15–1:30 | Click "Add to field-verification list" on two units. Open the filter panel, where "Your field-verification list" shows the count. Click "Download as CSV". | "Observers can build a field-verification list and download it. A flag never says fraud. It says: needs field verification." |
| 1:30–1:45 | Open /findings/, scroll briefly. Then open /methods/, scroll to the score table and "Responsible use". | "The findings page summarises the results. The methods page shows every rule, every penalty, our data licences and our limits. No black-box model. No personal data. No INEC system was accessed." |
| 1:45–2:00 | Back to the map, whole of Nigeria. End card: "Ghost Unit Radar · ghost-unit-radar.vercel.app · github.com/Tobby-King/ghost-unit-radar". | "We planted 900 anomalies in the synthetic data, and the checks caught 894. Ghost Unit Radar helps INEC, observers and journalists decide where to look first before 2027. Thank you." |

**Word count of voice-over:** about 280 words, about 2 minutes at a calm pace. If it runs long, cut the findings-page line (1:30).

**Tips**

- Press **P** for presentation mode if you want the map to step through five showcase units automatically. It is a good fallback if a click misses.
- Keep the mouse still while speaking key numbers.
- Do not say "fraud", "rigging" or name any party.

