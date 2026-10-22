# Test results

The newest run of each test, so tests aren't repeated when nothing they cover has changed.
**Re-run a test only when one of its "re-run when" files changed after the commit it was run on**
(`git diff --stat <commit> -- <files>`). Add a line for every new run, newest first in each section.
Machine: 8-core Linux desktop, Chromium 155 snap, Firefox 158 snap. Timings are from that machine.

## Reading (English, Swedish, start-up)

Re-run when: `extension/content.js`, `background.js`, `engine/`, `offscreen.*`, `manifest.json`

| Date | Commit | Test | Result |
|---|---|---|---|
| 2026-10-22 | (Kokoro removed) | chromium/read-en-sv (fresh) | Pass. First word 8.2 s EN (includes downloading Cori), 6.6 s SV (download), 0.3 s cached. No errors |
| 2026-10-22 | (Kokoro removed) | firefox/read-en-sv | Pass. Popup lists 6 voices; first sound 3.8 s EN, 3.0 s SV. No errors |
| 2026-10-22 | 1ca18cf | chromium/read-en-sv (KEEP) | Pass. First word 3.6 s (EN, engine start), 7.4 s (SV, second voice loads), 0.3 s (text already rendered). No errors |
| 2026-10-22 | 1ca18cf | firefox/read-en-sv | Pass. Settings page and popup list 6 voices. First sound 3.6 s (EN), 5.2 s (SV). No errors |
| 2026-10-22 | 1ca18cf | chromium/warm-up (KEEP, ×2 each) | Pass. First sound 3.4–3.8 s cold, 0.74–0.76 s after warm-up (warm-up itself 2.6 s) |

## Voices, settings and downloads

Re-run when: `extension/options.*`, `popup.*`, `common.js`, `catalog.js`, `engine/`, `background.js`

| Date | Commit | Test | Result |
|---|---|---|---|
| 2026-10-22 | (Kokoro removed) | chromium/settings-voice-switch (KEEP) | Pass. Lists filtered; switch restarts the sentence (6.3 s here because Northern English had to download first). No errors |
| 2026-10-22 | cc0f896 | chromium/voice-management (fresh) | Pass. Add Thorsten (de), download with progress (8 states to "✓ Downloaded"), delete. Player: "Downloading Cori… 0→82%". `lang="de"` page read with Thorsten. Highlight classic/blue/off switch live |
| 2026-10-22 | cc0f896 | chromium/download-failure | Pass. Stops after 6.6 s (3 tries) with "Couldn't download the voice Cori… Check your internet connection" |
| 2026-10-22 | 7c8f1af | chromium/settings-voice-switch (KEEP) | Pass. Lists filtered to ticked voices; voice switch while reading restarts the sentence: 3.4 s to new voice (cached), ~1.5 s back to a loaded one |

## Long pages, mixed languages, controls

Re-run when: `extension/content.js`

| Date | Commit | Test | Result |
|---|---|---|---|
| 2026-10-22 | 1ca18cf | chromium/mixed-and-controls (KEEP) | Pass. Mixed page: EN paragraphs Cori, SV paragraphs Alma, switching per paragraph. Pause holds audio and highlight; next/prev ±1; speed 1.5 live; Escape and Stop stop and clear highlights |
| 2026-10-22 | 1ca18cf | chromium/long-page-cpu, QUOTA 100% / 50% / 30% | 100%: page blocked 0.13–0.17 s, first sound 5.8 s, 1 wait 0.5 s. 50%: blocked 0.9 s, first sound 35–39 s (model set-up 29 s), speech renders slower than real time. 30%: blocked 3 s, no sound within 60 s. The quota limits the whole browser, so it's harsher than a real slow laptop |

## Memory and leftovers

Re-run when: `extension/engine/`, `offscreen.*`, `background.js`, the audio parts of `content.js`

| Date | Commit | Test | Result |
|---|---|---|---|
| 2026-10-22 | 1ca18cf (fresh profile) | engine page close | Pass. Background log "engine idle: closing the engine page" and the offscreen page closes |
| 2026-10-22 | 1ca18cf | firefox/memory, READ 60 AFTER 150 | Pass. +280 MB while reading; back to start within 30 s of Stop; CPU 0 within 60 s |
| 2026-10-22 | before 1ca18cf | firefox/memory, READ 180 AFTER 390 | Found a leftover: ~8% of a core after Stop for 6+ min (audio context kept running). Fixed in 1ca18cf. Memory: +330 MB reading, flat, back to start after 2 min |
| 2026-10-22 | 1ca18cf (KEEP, old service worker) | chromium/memory, READN 2 | CPU 0 after Stop; 210 MB freed at 5 min. Engine page didn't close only because the reused profile ran the old background script |
| 2026-10-22 | before 1ca18cf | chromium/memory, 6 min at 2× | Memory flat while reading (+400–570 MB); kept audio grew to 25 MB and wasn't freed (fixed in 1ca18cf: capped at 30 sentences, freed when idle) |
| 2026-10-22 | — | firefox/memory, READ 0 AFTER 120 | Baseline: idle Firefox with the add-on, never read: CPU 0 |

## Engine measurements

Re-run when: `lengthFor` in `engine/piper-worker.js`, or the ONNX Runtime version

| Date | Script | Result |
|---|---|---|
| 2026-10-22 | engine/speed-pitch.py (with `lengthFor` curve) | Pitch steady: Alma 176–181 Hz, Cori 204–210 Hz at 0.75–2×. Playing faster instead: 133–356 Hz. 2× takes the same time as playing 2× faster |
| 2026-10-22 | engine/speed-calibration.py | Plain 1/speed gives 0.82× / 1.30× / 1.59× at 0.75 / 1.5 / 2. Curve k = 1.4 (≤1) and 1.4 + 0.4·(speed−1) gives 0.75× / 1.25× / 1.54× / 1.71–1.75× / 1.87–1.93× |
| 2026-10-22 | engine/ort-optimisation-bench.mjs (Alma, node) | Set-up 2.1–2.5 s for all levels (all, extended, basic, disabled); speed the same (0.40 real-time factor). Not worth changing |
