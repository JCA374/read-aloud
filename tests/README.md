# Tests

Browser tests drive the real add-on in headless Chromium (Chrome DevTools Protocol) and headless
Firefox (WebDriver BiDi). They need Linux with the Chromium and Firefox snaps, node 22+ and python3.
**Before running anything, check [RESULTS.md](RESULTS.md):** if nothing a test covers has changed since
its last run, don't run it again. After a run, add the result there.

```bash
tests/chromium.sh tests/chromium/<test>.mjs     # KEEP=1 reuses the profile (voices already downloaded)
tests/firefox.sh  tests/firefox/<test>.mjs      # FRESH=1 starts with an empty profile
```

Both serve `tests/site/` on port 8799.

| Test | What it checks | Takes |
|---|---|---|
| `chromium/read-en-sv.mjs` | Reads an English and a Swedish page; first highlighted word, words highlighted, console errors | 2 min |
| `chromium/settings-voice-switch.mjs` | Settings voice list, popup pickers, switching voice while reading restarts the sentence | 1 min |
| `chromium/voice-management.mjs` | Add a voice, download with progress, delete; download progress in the player; a `lang="de"` page; highlight styles | 2 min (fresh profile) |
| `chromium/download-failure.mjs` | Run with `EXTRA='--host-resolver-rules=MAP huggingface.co ~NOTFOUND'`: reading stops with a clear message | 1 min |
| `chromium/long-page-cpu.mjs` | 400-paragraph page: time the page is blocked, first sound, waits. With `QUOTA=50%` for a slow computer. `SECS`, `SPEED`, `PAGE` | 1–2 min |
| `chromium/mixed-and-controls.mjs` | English/Swedish paragraphs get their own voice; pause, resume, next, prev, speed, Escape, Stop | 2 min |
| `chromium/memory.mjs` | Memory and CPU every 30 s while reading at 2× and after Stop (engine idles after 5 min). `READN` = 30 s steps of reading, `TIMEOUT=1000` | 7–13 min |
| `chromium/warm-up.mjs` | First sound with and without the popup's warm-up (`WARM=1`), needs `KEEP=1` | 1 min |
| `firefox/read-en-sv.mjs` | Settings page and popup render; reads an English and a Swedish page | 2 min |
| `firefox/memory.mjs` | Memory and CPU of the whole Firefox process tree while reading and after Stop. `READ`, `AFTER` in seconds | 4–10 min |

Engine measurements (not browser tests):

| Script | What it does |
|---|---|
| `engine/speed-pitch.py <voices dir> <out dir>` | Renders Alma and Cori at 0.75–2× the way the add-on does (length scale) and by playing faster; prints length and pitch. Needs Python with `piper-tts`, `soundfile`, `numpy`, and the two voices' `.onnx` + `.onnx.json` files |
| `engine/speed-calibration.py <voices dir>` | Measures how fast each length scale really is; used to fit `lengthFor` in `engine/piper-worker.js` |
| `engine/ort-optimisation-bench.mjs <model.onnx>` | Model set-up time and speed for each ONNX Runtime optimisation level. Needs `npm i onnxruntime-web` next to it |

Test pages: `site/long.html` (English article with menus and footer), `sv.html` (Swedish, marked
`lang="en"` on purpose), `de.html`, `mixed.html` (alternating English and Swedish paragraphs),
`huge.html` (400 generated paragraphs), `index.html`.
