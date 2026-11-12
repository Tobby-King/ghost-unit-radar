# Demo video and voice-over

`demo-video.mp4` is the finished video. It is 2:35 long, 1920 × 1080, H.264 with AAC audio, recorded from the live site. It already has a voice-over and an English caption track. Upload this one.

Other files:

- `demo-video-captions.srt`: the same captions as a separate file, for YouTube or Google Drive.
- `demo-video-no-voice.mp4`: the same video with no sound. Use it if you want to record the voice-over yourself (see below).

The voice-over is generated with Kokoro, an open-source text-to-speech model (Apache 2.0), using the voice “Heart”. A real human voice is still the best option. To record your own, play `demo-video-no-voice.mp4` and read the lines below. Each line starts at the time shown, and each fits its scene at a calm pace.

| Starts | On screen | Voice-over |
|---|---|---|
| 0:00 | Opening view: the headline and the four figures | Nigeria has 176,623 polling units. Ghost Unit Radar checks every published location, so field teams know where to look first. |
| 0:12 | “Show the school in Canada”: the map flies from Nigeria to Waterloo | This is a primary school in Olamaboro, Kogi State. According to INEC's published list, it sits in Waterloo, Canada — 9,196 kilometres from Kogi. |
| 0:25 | The unit card scrolls through its reasons, the innocent explanation and the figures | Every unit gets a plausibility score and a plain-English reason. For every flag, we show the most likely innocent cause. Here, a geocoder probably matched the school's name to a place abroad. |
| 0:39 | Chips: Outside Nigeria, then Wrong state, then Stacked | Check one is location integrity, on real public data. 1,515 units sit outside Nigeria. 2,243 are placed in the wrong state. And 43,373 are stacked on shared points, so their real location is unknown. |
| 0:59 | Register too large: a unit whose synthetic register is 18× the adults nearby | Check two is population plausibility. We count adults within one kilometre from satellite population data, and compare that with the register. The registers here are synthetic, as the hackathon rules require, and clearly labelled. |
| 1:16 | Clock audit: a unit with its accreditation pace | Check three is a clock audit. A BVAS device needs about thirty to a hundred and twenty seconds per voter, so there is a physical limit on how many voters can be accredited in one day. |
| 1:28 | Added to the field-verification list; seconds-per-voter slider moved 30 → 120; the list and CSV download | Change that assumption, and the flags update instantly. Observers can build a field-verification list and download it as a spreadsheet. A flag never says fraud. It says: needs field verification. |
| 1:44 | Findings page, by state | The findings page summarises the results, state by state. |
| 1:51 | Methods page scrolls past rules, licences and limits | The methods page shows every rule, our data licences and our limits. No black-box model. No personal data. No INEC system was accessed. |
| 2:02 | Presentation mode (P) steps through showcase units | Presentation mode steps through the strangest units, for a briefing room or a newsroom. |
| 2:18 | End card: name, links, team | We planted 900 anomalies in the synthetic data, and the checks caught 894. Ghost Unit Radar helps INEC, observers and journalists decide where to look first, before 2027. Thank you. |

Pronunciation: INEC is “eye-neck”; BVAS is “bee-vass”.

Never say “fraud”, “rigging” or name any party. A flag means *needs field verification*.
