# Neural Voices

**Project page: https://jca374.github.io/read-aloud/** (about the add-on, install steps and development status)

A browser add-on that reads web pages aloud with natural-sounding Piper voices. The voices run
**inside the browser** (WebAssembly), so there's nothing else to install, it's free, and the text you
read never leaves your computer. It starts with English and Swedish voices (Swedish text is detected
automatically), and 170 voices in 49 languages can be added.

| Voices | Size | Speed |
|---|---|---|
| Starts with UK: Cori, Alba, Northern English and Swedish: Alma, NST. 170 voices in 49 languages can be added in Settings | ~20–110 MB each (most ~63 MB), downloaded once on first use | ~3× faster than real time on one CPU core |

Word highlighting is estimated (Piper doesn't report word times). A voice downloads from
huggingface.co/rhasspy/piper-voices the first time it's used and is kept in the browser's cache.
That download is the add-on's only network request.

```
extension/          the add-on (Firefox + Chromium, Manifest V3)
extension/engine/   Piper in a Web Worker: ONNX Runtime Web + espeak-ng (piper_phonemize), see engine/vendor/README.md
tests/              browser tests and their results log (tests/README.md, tests/RESULTS.md)
tools/              make-catalog.mjs: builds extension/catalog.js from the Piper voice collection
tools/video/        the intro video on the project page: slides, narration by the add-on's own voices, make-video.sh
```

## Load the add-on

**Firefox:** `about:debugging#/runtime/this-firefox` → *Load Temporary Add-on…* → pick
`extension/manifest.json`. Firefox removes temporary add-ons when it restarts; to keep it, sign it
for free as an unlisted add-on on addons.mozilla.org (see *Build* below).

**Chromium:** `chrome://extensions` → *Developer mode* → *Load unpacked* → the `extension` folder.

Pages that were already open need a reload before the add-on works on them.

## Build

`./build.sh` makes `dist/neural-voices-<version>-firefox.zip` (for addons.mozilla.org) and
`-chromium.zip`: the `extension/` folder plus `LICENSE`, `THIRD-PARTY-NOTICES` and `licenses/`, with fixed
file order and dates (the same source gives the same zips). The Firefox build leaves out the parts only
Chromium uses (the offscreen page, its permission and the service worker entry), so Firefox shows no
manifest warnings; it is also unpacked in `dist/firefox/`. Mozilla's checker (`web-ext lint`) runs on it.
Loading `extension/` directly in Firefox works too, with a harmless warning about the `offscreen` permission.

## Using it

| Do this | Get this |
|---|---|
| Select text → click the orange speaker | reads the selection |
| Toolbar icon → *Read page* | reads the article, skipping menus, sidebars and footers |
| Toolbar icon → *Click-to-read*, then click any sentence | reads from that sentence on (Esc to leave) |
| Right-click → *Read aloud from here* | reads from that spot on |
| `Alt+Shift+R` | read selection or page / pause / resume |
| `Alt+Shift+X` or `Esc` | stop |

Picking another voice in the player or the popup while it reads restarts the current sentence in
that voice.

**Settings** (popup → *Settings*, or the add-on's options):
- *Your voices*: the voices in the player and popup. Download a voice ahead of time, delete a
  download to free disk space, or remove it from the list. Each shows its size and licence; voices that
  are non-commercial, share-alike or have no stated licence are tagged.
- *Add voices*: browse the catalogue by language and add voices to your list.
- *Language*: detection on or off, and the default voice for each language in your list (or, with
  detection off, the one voice to always use). English and Swedish are recognised from the words,
  paragraph by paragraph, so a page that mixes them switches voice; other languages come from the
  page's `lang` attribute.
- *Playback*: speed, volume, and the highlight style (yellow/orange, blue, green, underline, off).

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
stays natural; the model shortens pauses less than sounds, so the length scale follows a measured
curve (`lengthFor` in `engine/piper-worker.js`) to make 2× really about 2×. The last 30 rendered sentences are kept, so jumping back is instant. At most two voices stay
loaded (enough for a page mixing two languages), and the engine is stopped after 5 idle minutes to free its memory. Opening the popup loads your voice early (only if
it's already downloaded), because starting a voice takes a few seconds: most of it is ONNX Runtime
setting up the model.

## Where voices come from

Voices download straight from [rhasspy/piper-voices](https://huggingface.co/rhasspy/piper-voices) on
Hugging Face, the official Piper voice collection, **pinned to one revision** (a fixed commit), so the
files can't change under the add-on. `extension/catalog.js` lists each voice with that revision, the
expected size of every file and the licence from its model card. A download is checked against that
size, tried up to 3 times, and a voice that fails to load is deleted so it downloads again.
No mirror is used: it would cost hosting and add a party to trust, for no gain at this size.
To update the voice list: `node tools/make-catalog.mjs` (uses the newest revision). Voices that the
bundled espeak-ng can't handle (Chinese, Japanese, Thai, Hebrew, Lithuanian, one Ukrainian) are left out.

Voices are data with their own licences. They aren't bundled; each one's licence is shown in Settings
with a link to its model card. `tools/make-catalog.mjs` reduces the model cards' many spellings to a short
name and a kind: of the 170 voices, 113 are free to use (CC0, public domain, CC BY, MIT, Apache), 13 are
share-alike (CC BY-SA, GPL, AGPL), 23 non-commercial (CC BY-NC, research-only data) and 32 have no stated
licence. The starter voices are all free to use (checked by `tests/run.sh`). A voice already downloaded
at an older revision is kept (if its size matches) when the catalogue moves to a new one.

## Licence

Neural Voices is GPL-3.0 (`LICENSE`), because the bundled espeak-ng is GPL-3.0 or later. Every bundled
part, its exact version and source, and its licence are listed in `THIRD-PARTY-NOTICES`; full texts are
in `licenses/`.

## History

The first version used a local Python server (Piper and Kokoro voices on `127.0.0.1`). Neural
Voices replaced it: everything now runs inside the browser. The server code is in the git history
before the merge of the `neural-voices` branch.
