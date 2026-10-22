# Neural Voices

A browser add-on that reads web pages aloud with natural-sounding Piper voices. The voices run
**inside the browser** (WebAssembly), so there's nothing else to install, it's free, and the text you
read never leaves your computer. English and Swedish; Swedish text is detected automatically.

| Voices | Size | Speed |
|---|---|---|
| UK: Cori, Alba, Northern English. Swedish: Alma, Lisa, NST | ~63 MB each, downloaded once on first use | ~3× faster than real time on one CPU core |

Word highlighting is estimated (Piper doesn't report word times). A voice downloads from
huggingface.co/rhasspy/piper-voices the first time it's used and is kept in the browser's cache.
That download is the add-on's only network request.

```
extension/          the add-on (Firefox + Chromium, Manifest V3)
extension/engine/   Piper in a Web Worker: ONNX Runtime Web + espeak-ng (piper_phonemize), see engine/vendor/README.md
server/             optional: local Python server for the Kokoro voices (see below)
```

## Load the add-on

**Firefox:** `about:debugging#/runtime/this-firefox` → *Load Temporary Add-on…* → pick
`extension/manifest.json`. Firefox removes temporary add-ons when it restarts; to keep it, sign it
for free as an unlisted add-on on addons.mozilla.org (`./build.sh` makes `dist/neural-voices.zip`).

**Chromium:** `chrome://extensions` → *Developer mode* → *Load unpacked* → the `extension` folder.

Pages that were already open need a reload before the add-on works on them.

## Using it

| Do this | Get this |
|---|---|
| Select text → click the orange speaker | reads the selection |
| Toolbar icon → *Read page* | reads the article, skipping menus, sidebars and footers |
| Toolbar icon → *Click-to-read*, then click any sentence | reads from that sentence on (Esc to leave) |
| Right-click → *Read aloud from here* | reads from that spot on |
| `Alt+Shift+R` | read selection or page / pause / resume |
| `Alt+Shift+X` | stop |

Picking another voice in the player or the popup while it reads restarts the current sentence in
that voice.

**Settings** (popup → *Settings*, or the add-on's options): tick the voices you want in your list,
turn language detection on or off, and pick the default voice for each language from your list
(or, with detection off, the one voice to always use). Kokoro voices from the optional local
server are off by default, because asking for them starts that server.

Only one tab reads at a time. The floating player has previous/next sentence, speed (0.75–2×) and
voice controls. The current sentence is highlighted, the current word more strongly.

## How it works

The content script splits the text into sentences. Where reading starts, it cuts the text into
growing pieces (about 45, 80, 140, then 220 characters), so the first sound comes quickly and each
piece renders while the one before it plays. After that it keeps about 60 seconds of audio ready
ahead. The background script hands each piece to the Piper worker (Firefox: started from the
background page; Chromium: from an offscreen page, since service workers can't start workers).
espeak-ng turns the text into phonemes, ONNX Runtime runs the voice, and the result comes back as
a WAV with estimated word times. Speed is set in the model (Piper's length scale), so the pitch
stays natural. The last 100 sentences are kept, so jumping back is instant. The engine is
stopped after 5 idle minutes to free its memory.

## Optional: Kokoro voices via a local server

Kokoro (Heart, Emma, Isabella, George, Fable, Lewis; English only, ~1.2 GB RAM) runs in a local
Python server, not in the browser. When `./start-server.sh` is running on `127.0.0.1:5123`, its
voices appear in the voice lists. `systemd/` has user units that start it on demand. The server
has no CORS headers, so web pages can't call it; only the add-on can.
