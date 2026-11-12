# Ghost Unit Radar — submission pack

AI4Elections Hackathon 2026 (Nigeria). Tracks: Electoral data analysis · Election observation and citizen accountability.
Team: Oluwatobi Olatunji and Jhmeet [CHECK: full name].

## Links

- **Live app:** https://ghost-unit-radar.vercel.app
- **Source code (MIT):** https://github.com/Tobby-King/ghost-unit-radar
- **Demo unit** (a Kogi school published in Waterloo, Canada): https://ghost-unit-radar.vercel.app/#PU000002

## What is in this folder

| File | What it is |
|---|---|
| `README.md` | This index. |
| `application-answers.md` | Ready-to-paste answers for the application form, each with a ≤50-word short version. |
| `demo-video-script.md` | Voice-over text with start times, for re-recording in your own voice. |
| `demo-video.mp4` | 2½-minute demo of the live app with a Kokoro AI voice-over and captions (1920×1080, H.264). **Upload this one.** |
| `demo-video-captions.srt` | Captions as a separate file, for YouTube or Drive. |
| `demo-video-no-voice.mp4` | The same video with no sound, if you'd rather record your own voice (local copy only, not in git). |
| `screenshots/` | Nine screenshots from the live site: map overview, Waterloo unit card, world view of out-of-country units, a clock-audit unit, the Findings report, Methods & Ethics, presentation mode, and two phone views. |
| `logo/` | The logo: the mark, app icon, favicon and horizontal lockups, as SVG and PNG, for light and dark backgrounds. |
| `pitch-5min.md` | 5-minute Grand Finale pitch outline (16 Dec 2026, Lagos), with likely questions. |
| `checklist.md` | What is done and what is still to do before 11:59 pm WAT on 12 Nov 2026. |

## The logo

A map pin whose centre is empty (the "ghost") and whose red point has drifted away along a dashed trail. It shows what the tool finds: polling units whose published point is not where the unit is. Ink `#181816`, signal red `#E2574C`, wordmark in Source Serif 4 Semibold.

## How a judge can see it in 2 minutes

1. Open https://ghost-unit-radar.vercel.app/#PU000002. The map opens on a primary school in Olamaboro, Kogi State, whose official coordinate is in Waterloo, Canada, 9,196 km away. Read its unit card: the reason, the score, and the innocent explanation.
2. Zoom out and tap the **Outside Nigeria**, **Wrong state** and **Stacked** chips. These are real findings from INEC's public list: 1,515, 2,243 and 43,373 units.
3. Tap **Clock audit**, open a unit, and move the seconds-per-voter slider between 30 and 120 s. The flags change with the assumption. (Result sheets are synthetic and labelled.)
4. Add a unit to the field-verification list and download the CSV. Or press **P** for presentation mode, which steps through five showcase units.
5. Open https://ghost-unit-radar.vercel.app/methods/ to see every rule, penalty, data licence and limitation, and https://ghost-unit-radar.vercel.app/findings/ for the summary report and CSV.

All register and result-sheet numbers are synthetic. No INEC live system was accessed.
