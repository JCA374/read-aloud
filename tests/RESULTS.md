# Test results

The newest run of each test, so tests aren't repeated when nothing they cover has changed.
**Re-run a test only when one of its "re-run when" files changed after the commit it was run on**
(`git diff --stat <commit> -- <files>`). Add a line for every new run, newest first in each section.
Machine: 8-core Linux desktop, Chromium 155 snap, Firefox 158 snap. Timings are from that machine.

## Test runner (`tests/run.sh`)

Re-run when: `tests/` changes. `run.sh` also remembers each passed test with a fingerprint of the files it
covers (`tests/out/.passed/`), so `quick` adds a longer test by itself when its files changed.

| Date | Commit | Run | Result |
|---|---|---|---|
| 2026-10-26 | PDF viewer (0.4.0) | `run.sh all` (9 tests) and `./build.sh` | Pass, 112 checks. Build 15 MB (235 files, 169 of them pdf.js character maps); lint 0 errors, 6 warnings (2 new, inside pdf.js) |
| 2026-10-26 | d314799 + Settings update | `run.sh all` (9 tests) after the Settings update | Pass after test fixes: firefox/smoke 14 checks, chromium/smoke 24 (icon count now 8), voice-management 13, download-failure 3, older-revision 5, settings-extras 18, settings-voice-switch 7, mixed-and-controls 12. `./build.sh`: lint 0 errors, same 4 warnings |
| 2026-10-25 | 36a4dbd + build split | `./build.sh` (Firefox and Chromium builds), then firefox/smoke on `dist/firefox`, chromium/smoke on the unpacked Chromium zip | Both pass (12 and 24 checks), no errors. Firefox build: no `offscreen` permission or service worker entry, lint 0 errors and 4 warnings (were 6; the 2 manifest warnings are gone). Two builds give identical zips |
| 2026-10-25 | clean-up (after f8298dc) | `run.sh all` after the clean-up (licences, engine, 5 starter voices) | Pass, 7 tests, 70 checks, about 2 min. New instant checks: licence files exist, all 170 voices have a licence kind, starter voices free to use (a test with Lisa added flagged her). Build script checked: two builds give the same zip (same SHA-1) |
| 2026-10-25 | 0dec750 + changes | `run.sh all` after removing 2 duplicate tests | Pass, 7 tests, 70 checks, 135 s (was 170 s). `chromium/read-en-sv` and `firefox/read-en-sv` removed: the smoke tests check the same; the one unique check (reading again starts within 2 s: 0.2 s) moved into the Chromium smoke test |
| 2026-10-25 | 0dec750 + changes | `run.sh` with nothing changed | All 4 tests skipped (they passed and nothing they cover changed), only the instant checks ran: 4 s |
| 2026-10-25 | 03ce74e + test changes | `run.sh all` (both browsers side by side) | Pass, all 9 tests, 91 checks, 170 s. The same tests one after another took 514 s before |
| 2026-10-25 | 03ce74e + test changes | `run.sh` (quick) | Pass: instant checks 6 s, Firefox smoke 12 checks, Chromium smoke 23 checks, voice-management 12 checks; 92 s in all |
| 2026-10-25 | 03ce74e + test changes | runner self-checks | Player broken on purpose (`build()` throws): both smoke tests failed with "first word highlighted: nothing within 30 s". A test that never ends: stopped at its 20 s limit, the run carried on. `background.js` changed: fresh Chromium profile; unchanged: profile reused. No browser left running |

## Reading (English, Swedish, start-up)

Re-run when: `extension/content.js`, `background.js`, `engine/`, `offscreen.*`, `manifest.json`

| Date | Commit | Test | Result |
|---|---|---|---|
| 2026-10-25 | clean-up (after f8298dc) | chromium/smoke, firefox/smoke | Pass, 24 and 12 checks. Chromium loads 3 voices (Cori, Alma, then a switch), so the new 2-voice limit unloaded one mid-test: no errors |
| 2026-10-25 | clean-up (after f8298dc) | chromium/warm-up (KEEP, cold only) | First sound 3.37 s cold (before: 3.4–3.8 s) |
| 2026-10-25 | 03ce74e | chromium/read-en-sv, firefox/read-en-sv (new checks) | Pass. Chromium first word 5.9 s EN, 3.7 s SV, 0.1 s already rendered. Firefox 12.5 s EN when run beside Chromium, about 4–7 s alone. No errors |
| 2026-10-25 | cc41b32 | firefox/read-en-sv | Pass. First word 4.4 s EN, 5.1 s SV. No errors |
| 2026-10-25 | cc41b32 | chromium/read-en-sv (KEEP) | Pass. First word 5.0 s EN, 6.9 s SV, 0.3 s cached. No errors |
| 2026-10-22 | 17b2a5c | chromium/read-en-sv (fresh) | Pass. First word 8.2 s EN (includes downloading Cori), 6.6 s SV (download), 0.3 s cached. No errors |
| 2026-10-22 | 17b2a5c | firefox/read-en-sv | Pass. Popup lists 6 voices; first sound 3.8 s EN, 3.0 s SV. No errors |
| 2026-10-22 | 1ca18cf | chromium/read-en-sv (KEEP) | Pass. First word 3.6 s (EN, engine start), 7.4 s (SV, second voice loads), 0.3 s (text already rendered). No errors |
| 2026-10-22 | 1ca18cf | firefox/read-en-sv | Pass. Settings page and popup list 6 voices. First sound 3.6 s (EN), 5.2 s (SV). No errors |
| 2026-10-22 | 1ca18cf | chromium/warm-up (KEEP, ×2 each) | Pass. First sound 3.4–3.8 s cold, 0.74–0.76 s after warm-up (warm-up itself 2.6 s) |

## Voices, settings and downloads

Re-run when: `extension/options.*`, `popup.*`, `common.js`, `catalog.js`, `engine/`, `background.js`

| Date | Commit | Test | Result |
|---|---|---|---|
| 2026-10-26 | PDF highlight fix | chromium/pdf, firefox/smoke | Pass (15, 16). New check: the word highlight's text colour is transparent in the viewer (failed with the old CSS: white). Screenshots: doc.pdf and a real two-column paper (arXiv 1706.03762, not committed): highlight on the printed words, no ghost copy |
| 2026-10-26 | PDF viewer (0.4.0) | chromium/pdf (new) | Pass, 14 checks: doc.pdf from the test server, 4 paragraphs, "light-"+"house" joined, 2 pages drawn, read with moving word highlight, status/pause/stop via `NV.sendToTab`, zoom keeps the text, Chromium's own PDF viewer hands over on Read and reading starts. Fixed on the way: the viewer answered the engine's internal runtime messages (now only `cmd` messages) |
| 2026-10-26 | PDF viewer (0.4.0) | firefox/smoke | Pass, 16 checks: the viewer read doc.pdf (4 paragraphs, words highlighted) |
| 2026-10-26 | Settings update + tags removed | chromium/voice-management, chromium/settings-extras, then quick run | Pass (13, 18; smoke 24 and 14, older-revision 5). No `.tag` anywhere; Thorsten shows "Licence: CC0"; voices with no named licence show only the model card link; the licence filter is gone |
| 2026-10-26 | d314799 + Settings update | chromium/settings-extras (new) | Pass, 18 checks: Try played rhasspy.github.io sample; fallback read locally (blob audio); "thor" → 4 Thorsten voices; licence filter hid Lisa; all languages 50 → 165; ↑ swapped Alba/Cori; storage "1, 64 MB"; reset + import restored speed 1.25, blue, pause 0.5, order; bad file cleaned to `{shown:[Cori]}`; code.html 5 pieces skipped vs 7; scroll 287 px on, 0 off. First runs failed on test mistakes only (fresh profile without Cori, wrong tab in front, status read during "Rendering…") |
| 2026-10-26 | d314799 + Settings update | firefox/smoke | Pass, 14 checks: Try plays the online sample; shortcuts list shows Alt+Shift+R and the Firefox "Manage Extension Shortcuts" hint |
| 2026-10-26 | — | online samples, curl | All 170 catalogue voices have `speaker_0.mp3` on rhasspy.github.io/piper-samples (HTTP 200) |
| 2026-10-25 | clean-up (after f8298dc) | chromium/older-revision (new, KEEP, huggingface.co blocked) | Pass, 5 checks. Cori's files moved to a made-up older revision: Settings shows "✓ Downloaded", reading starts with downloads blocked, files end up under the current revision and the old copies are gone |
| 2026-10-25 | clean-up (after f8298dc) | chromium/voice-management (fresh) | Pass, 13 checks. New: German list shows "Licence unclear" on Eva K, Karlsson, Ramona, "Non-commercial" on Pavoque, no tag on Thorsten (CC0). Screenshot looked right |
| 2026-10-25 | clean-up (after f8298dc) | chromium/settings-voice-switch, download-failure (KEEP / fresh) | Pass, 7 and 3 checks |
| 2026-10-25 | 03ce74e | chromium/settings-voice-switch (new checks) | Pass, 7 checks. No-Swedish note, detection off gives one picker, popup voice change restarts the sentence (logged at once). The earlier "null" was the old test's fixed wait, not the add-on |
| 2026-10-25 | 03ce74e | chromium/voice-management | Pass, 12 checks (add Thorsten with licence, download, delete, player progress, German page, highlight styles) |
| 2026-10-25 | cc41b32 | chromium/settings-voice-switch (KEEP, ×2) | Lists filtered to the 6 ticked voices; switch restarts the sentence (logged), no errors. The test's 4 s word-highlight check gave "null" both times, and also on the code before this commit, so it is test timing, not this change |
| 2026-10-22 | 17b2a5c | chromium/settings-voice-switch (KEEP) | Pass. Lists filtered; switch restarts the sentence (6.3 s here because Northern English had to download first). No errors |
| 2026-10-22 | cc0f896 | chromium/voice-management (fresh) | Pass. Add Thorsten (de), download with progress (8 states to "✓ Downloaded"), delete. Player: "Downloading Cori… 0→82%". `lang="de"` page read with Thorsten. Highlight classic/blue/off switch live |
| 2026-10-22 | cc0f896 | chromium/download-failure | Pass. Stops after 6.6 s (3 tries) with "Couldn't download the voice Cori… Check your internet connection" |
| 2026-10-22 | 7c8f1af | chromium/settings-voice-switch (KEEP) | Pass. Lists filtered to ticked voices; voice switch while reading restarts the sentence: 3.4 s to new voice (cached), ~1.5 s back to a loaded one |

## Long pages, mixed languages, controls

Re-run when: `extension/content.js`

| Date | Commit | Test | Result |
|---|---|---|---|
| 2026-10-25 | clean-up (after f8298dc) | chromium/mixed-and-controls (KEEP) | Pass, 12 checks |
| 2026-10-25 | clean-up (after f8298dc) | chromium/long-page-cpu (KEEP, full CPU) | Page blocked 132 ms, first sound 3.2 s, no waits |
| 2026-10-25 | 03ce74e | chromium/mixed-and-controls (new checks) | Pass, 12 checks. Mixed page: all 9 sentences with the right voice. Pause holds the word, next/prev ±1, speed 1.5, Escape stops and clears, Stop |
| 2026-10-25 | cc41b32 | one-off screenshot of the player | Player built without HTML strings looks as before: 7 icons, pause shown while playing, voice list in 2 language groups |
| 2026-10-25 | cc41b32 | chromium/mixed-and-controls (KEEP) | Pass. Pause holds the word highlight; next/prev ±1; speed 1.5; Escape and Stop clear. No errors |
| 2026-10-22 | 1ca18cf | chromium/mixed-and-controls (KEEP) | Pass. Mixed page: EN paragraphs Cori, SV paragraphs Alma, switching per paragraph. Pause holds audio and highlight; next/prev ±1; speed 1.5 live; Escape and Stop stop and clear highlights |
| 2026-10-22 | 1ca18cf | chromium/long-page-cpu, QUOTA 100% / 50% / 30% | 100%: page blocked 0.13–0.17 s, first sound 5.8 s, 1 wait 0.5 s. 50%: blocked 0.9 s, first sound 35–39 s (model set-up 29 s), speech renders slower than real time. 30%: blocked 3 s, no sound within 60 s. The quota limits the whole browser, so it's harsher than a real slow laptop |

## Memory and leftovers

Re-run when: `extension/engine/`, `offscreen.*`, `background.js`, the audio parts of `content.js`

| Date | Commit | Test | Result |
|---|---|---|---|
| 2026-10-25 | clean-up (after f8298dc) | chromium/memory, READN 12 | +390–575 MB while reading at 2×, flat; CPU 0 after Stop; engine page closed at 5 min idle, 240 MB freed |
| 2026-10-25 | clean-up (after f8298dc) | firefox/memory, READ 180 AFTER 390 | +300–320 MB while reading; back near the start 30 s after Stop; CPU 0–3 s per 30 s after |
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
| 2026-10-26 | Kokoro-82M v1.0 ONNX (onnx-community, rev 1939ad2a8e), af_heart, onnxruntime-web 1.30.0 in node, 120 phoneme tokens (7.8 s of audio), 2nd run | q8 92 MB: 1 thread 39.5 s (0.20×), 4 threads 31.3 s (0.25×). fp32 325 MB: 1 thread 44.9 s (0.17×), 4 threads 16.0 s (0.48×). 30–200 tokens at q8/1 thread: 0.19–0.24×. Load 2.7 s. Too slow on CPU; WebGPU not measured. Licence: Apache-2.0 (model, voices, kokoro-js) |
| 2026-10-22 | engine/speed-pitch.py (with `lengthFor` curve) | Pitch steady: Alma 176–181 Hz, Cori 204–210 Hz at 0.75–2×. Playing faster instead: 133–356 Hz. 2× takes the same time as playing 2× faster |
| 2026-10-22 | engine/speed-calibration.py | Plain 1/speed gives 0.82× / 1.30× / 1.59× at 0.75 / 1.5 / 2. Curve k = 1.4 (≤1) and 1.4 + 0.4·(speed−1) gives 0.75× / 1.25× / 1.54× / 1.71–1.75× / 1.87–1.93× |
| 2026-10-22 | engine/ort-optimisation-bench.mjs (Alma, node) | Set-up 2.1–2.5 s for all levels (all, extended, basic, disabled); speed the same (0.40 real-time factor). Not worth changing |
