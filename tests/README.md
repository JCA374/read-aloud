# Tests

Browser tests drive the real add-on in headless Chromium (Chrome DevTools Protocol) and headless
Firefox (WebDriver BiDi). They need Linux with the Chromium and Firefox snaps, node 22+ and python3.

## Running them: `tests/run.sh`

```bash
tests/run.sh            # quick: instant checks + both smoke tests side by side (+ longer tests whose files changed). ~1.5 min
tests/run.sh all        # every functional test, Chromium and Firefox side by side
tests/run.sh release    # builds dist/, then the Firefox tests against the built package + real websites (internet)
tests/run.sh timing     # start-up, CPU and memory measurements, one at a time (15-25 min, run it in the background)
tests/run.sh chromium/voice-management    # one test by name
```

It prints one line per test (`ok`, `FAIL`, `TIME` for a time-out, or `done` for a measurement without automatic
checks) and keeps the full output in `tests/out/`. Tests that passed are remembered with a fingerprint of
the files they cover (and their own script), so `quick` skips any test, smoke tests included, whose files haven't changed since it passed. After a run, add the result
to [RESULTS.md](RESULTS.md).

- **Instant checks** (4 s): syntax of every script, the manifest, the licence files, a licence kind for every
  voice (and only free-to-use starter voices), and Mozilla's checker (`web-ext lint`),
  which must show no errors and no warnings beyond the 6 known ones.
- **Smoke tests** (`chromium/smoke.mjs`, `firefox/smoke.mjs`): one browser session each, waiting for events
  (first word, a logged restart) instead of fixed times. Each check prints `ok` or `FAIL`.
- Shared helpers: `chromium/lib.mjs` (connect, open a page, the player in its closed shadow root, `waitFor`,
  `check`) and `firefox/lib.mjs`.

The single runners still work on their own:

```bash
tests/chromium.sh tests/chromium/<test>.mjs     # KEEP=1 reuses the profile (voices already downloaded)
tests/firefox.sh  tests/firefox/<test>.mjs [dir] # FRESH=1 starts with an empty profile; IDLE_MS=n stops the idle background page after n ms
```

A kept Chromium profile is started fresh automatically when `background.js` or `manifest.json` changed.
`PROFILE=<name>` uses another profile folder. Both serve `tests/site/` on port 8799.

| Test | What it checks | Takes |
|---|---|---|
| `chromium/smoke.mjs` | Settings and popup lists; English and Swedish reading, English again (must start within 2 s); player icons, voice list, voice switch, pause, next, prev, speed, Stop; mixed page; every paragraph's language on `langs.html` | 30 s |
| `firefox/smoke.mjs` | Settings and popup lists; English and Swedish reading with the right voice; Stop; a PDF; every paragraph's language on `langs.html` | 30 s |
| `firefox/features.mjs` | Firefox versions of the Chromium-only checks: a pronunciation typed with real keys (and Enter) is used when reading; pause, resume, next, prev, speed; volume (4 × ← → 80%, mute, unmute); Escape; a render longer than Firefox's idle limit survives with the keep-alive messages and is lost without them; the engine starts again after Firefox stops the background page. Runs with `IDLE_MS=8000` | 3 min |
| `firefox/real-sites.mjs` | Real websites (Wikipedia EN and SV, MDN, a GitHub README, an old table-layout essay, Mozilla's manifesto): reading starts within 10 s, with the title or the article first (not a menu), the right voice, at least 10 sentences. Only in `release` (needs the internet; live pages change) | 1 min |
| `chromium/settings-voice-switch.mjs` | One picker per language; with no Swedish voice the page says so; detection off gives one picker; changing voice in the popup while reading restarts the sentence | 10 s |
| `chromium/voice-management.mjs` | Add a voice, download with progress, delete; download progress in the player; a `lang="de"` page; highlight styles | 30–60 s (fresh profile) |
| `chromium/settings-extras.mjs` | ⚙ in the player opens Settings; ▶ Try plays the online sample, and with it blocked a downloaded voice reads one; search and filters; ↑ reorders; storage line; reset / export / import and cleaning a bad file; skip code blocks on/off; auto-scroll on/off; upgrading from 0.4.0 (storage without the newer keys). Downloads Cori first if the profile lacks it | 35 s |
| `chromium/pronunciation.mjs` | Your pronunciations: add, replace, edit, remove, ▶ Try; the engine reads the replacement while word times keep the page's words; reading a page with an entry; per-language entries; import cleaning; `?word=` from the right-click item | 20 s |
| `chromium/pdf.mjs` | The PDF viewer: text in paragraphs, hyphen joining, pages drawn, reading with highlights, commands reach it, zoom, hand-over from Chromium's own PDF viewer. Uses `site/doc.pdf` (made by `site/make-pdf.py`) | 15 s |
| `chromium/older-revision.mjs` | Run with Cori downloaded (`KEEP=1`) and huggingface.co blocked: a voice cached under an older revision of the voice collection counts as downloaded in Settings, reads without downloading, and is moved to the current address | 10 s |
| `chromium/download-failure.mjs` | Run with `EXTRA='--host-resolver-rules=MAP huggingface.co ~NOTFOUND'`: reading stops with a clear message | 15 s |
| `chromium/long-page-cpu.mjs` | 400-paragraph page: time the page is blocked, first sound, waits. With `QUOTA=50%` for a slow computer. `SECS`, `SPEED`, `PAGE` | 1–2 min |
| `chromium/mixed-and-controls.mjs` | Mixed page read to the end, every sentence with the voice for its language; pause, resume, next, prev, speed, Escape, Stop on a 400-paragraph page; the pause after each sentence (1 s adds 1 s ± 0.3) | 45 s |
| `chromium/memory.mjs` | Memory and CPU every 30 s while reading at 2× and after Stop (engine idles after 5 min). `READN` = 30 s steps of reading, `TIMEOUT=1000` | 7–13 min |
| `chromium/warm-up.mjs` | First sound with and without the popup's warm-up (`WARM=1`), needs `KEEP=1` | 1 min |
| `firefox/memory.mjs` | Memory and CPU of the whole Firefox process tree while reading and after Stop. `READ`, `AFTER` in seconds | 4–10 min |

Engine measurements (not browser tests):

| Script | What it does |
|---|---|
| `engine/speed-pitch.py <voices dir> <out dir>` | Renders Alma and Cori at 0.75–2× the way the add-on does (length scale) and by playing faster; prints length and pitch. Needs Python with `piper-tts`, `soundfile`, `numpy`, and the two voices' `.onnx` + `.onnx.json` files |
| `engine/speed-calibration.py <voices dir>` | Measures how fast each length scale really is; used to fit `lengthFor` in `engine/piper-worker.js` |
| `engine/ort-optimisation-bench.mjs <model.onnx>` | Model set-up time and speed for each ONNX Runtime optimisation level. Needs `npm i onnxruntime-web` next to it |

Test pages: `site/long.html` (English article with menus and footer), `sv.html` (Swedish, marked
`lang="en"` on purpose), `de.html`, `mixed.html` (alternating English and Swedish paragraphs),
`huge.html` (400 generated paragraphs), `langs.html` (paragraphs in 8 languages, all marked `lang="en"`), `index.html`.

## Before a release

1. `tests/run.sh all`, then `tests/run.sh release`, then `tests/run.sh timing` (alone).
2. The owner goes through [docs/MANUAL-TEST.md](../docs/MANUAL-TEST.md) (about 20 minutes): listening, shortcuts,
   right-click, real PDFs, first use.
3. Log each in [RESULTS.md](RESULTS.md).
