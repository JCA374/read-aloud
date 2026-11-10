# Neural Voices

A browser add-on that reads web pages and PDFs aloud with natural-sounding [Piper](https://github.com/rhasspy/piper)
voices. The voices run **inside the browser** (WebAssembly): no server, no account, and the text you
read never leaves your computer. Firefox (desktop), Chrome, Edge and Brave.

**Project page:** <https://jca374.github.io/read-aloud/>

- Reads the main article (skipping menus and footers), a selection, or from any sentence you click.
- Highlights the sentence and the word being spoken, and scrolls along.
- Reads PDFs in its own viewer, from the web or from your computer.
- The language is detected paragraph by paragraph, in any language, and each gets its own voice. 170 voices
  in 49 languages can be added.
- Natural pitch at every speed from 0.75× to 2×. Works offline once a voice is downloaded.

## Install

**Firefox:** install it from the add-on store: [Neural Voices on addons.mozilla.org](https://addons.mozilla.org/firefox/addon/a9f96c5f57e94f0c8762/). It
updates itself.

**Chrome, Edge, Brave:** download `neural-voices-<version>-chromium.zip` from the same release and unzip it.
Then open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked** and pick the folder.

Pages that were already open need a reload. The first time a voice is used, it downloads once (most are
about 63 MB).

## Using it

| Do this | Get this |
|---|---|
| Select text → click the orange speaker | reads the selection |
| Toolbar icon → *Read page* | reads the article |
| Toolbar icon → *Click-to-read*, then click a sentence | reads from there (Esc to leave) |
| Right-click → *Read aloud from here* / *Read PDF aloud* on a PDF link | reads from that spot / opens the PDF |
| Select a word → right-click → *Fix pronunciation* | tell the voice how to say it |
| `Alt+Shift+R` | read, pause or resume |
| `Alt+Shift+X` or `Esc` | stop |

The player has previous/next sentence, speed, voice and ⚙ Settings. In Settings: your voice list
(▶ Try a voice before downloading it), a default voice for each language, speed, volume, the highlight
style, scrolling, skip code blocks, a pause after each sentence, **your own pronunciations** for words a
voice says wrong, storage use, and export/import.

## Privacy

Text is turned into speech in your browser and never sent anywhere. The add-on only goes online to download
a voice the first time it's used, to play a short sample when you press ▶ Try, and to fetch a PDF you ask
it to read. See [PRIVACY.md](PRIVACY.md).

## Development

```
extension/        the add-on itself, loaded as it is (no build step)
tests/            browser tests (tests/run.sh) and their results log
tools/            voice catalogue, icon, library check, signing;
                  claude-speak/ reads Claude Code's replies aloud (see its README)
docs/             project page and documentation
```

- **Run from source.** Firefox: `about:debugging#/runtime/this-firefox` → *Load Temporary Add-on…* →
  `extension/manifest.json`. Chromium: *Load unpacked* → `extension/`.
- **Test.** `tests/run.sh` (about 1.5 min; skips tests whose files didn't change). See [tests/README.md](tests/README.md).
- **Try it by hand.** `tools/try.sh` opens a separate Firefox (`tools/try.sh chromium` for Chromium) with the
  development version and its own profile, so the installed add-on isn't touched.
- **Build.** `./build.sh` → `dist/neural-voices-<version>-firefox.zip` and `-chromium.zip`, and runs
  Mozilla's checker.
- **Release.** `tools/sign.sh` signs a new version with Mozilla. See [docs/RELEASING.md](docs/RELEASING.md).

| Document | What's in it |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | How it works: files, message flow, engine, voices, PDFs, storage |
| [docs/RELEASING.md](docs/RELEASING.md) | Version, sign, GitHub Release, install the signed file |
| [docs/LISTING.md](docs/LISTING.md) | Checklist for a public listing on addons.mozilla.org |
| [CHANGELOG.md](CHANGELOG.md) | What changed in each version |
| [STATUS.md](STATUS.md) | Development status: what works, what's tested, what's next |
| [PRIVACY.md](PRIVACY.md) | Privacy policy |
| [tests/README.md](tests/README.md) | The tests and how to run them |

## Licence

GPL-3.0 ([LICENSE](LICENSE)), because the bundled espeak-ng is GPL-3.0 or later. Every bundled part, its
version, source and licence: [THIRD-PARTY-NOTICES](THIRD-PARTY-NOTICES), with full texts in `licenses/`.
Voices are downloaded, not bundled. Each has its own licence, shown in Settings.

Built on Piper, ONNX Runtime Web, espeak-ng, piper-wasm and pdf.js.
