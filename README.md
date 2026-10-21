# Read Aloud (Kokoro)

A NaturalReader-style "read this page to me" browser extension. The voices run on
this computer, so it's free and nothing you read leaves the machine. There are two engines,
and you pick one by choosing a voice:

| Engine | Voices | RAM | Speed on a 4-core laptop CPU |
|---|---|---|---|
| **Piper** (default) | 9 voices: lessac, amy, ryan, cori, … | ~200 MB | ~10× faster than real time, even when the CPU is busy |
| **Kokoro** | 12 voices: heart, emma, george, … (most natural) | ~1.2 GB | ~1.7× faster than real time when the CPU is idle, slow when it's busy |

An engine loads the first time one of its voices is used, so Kokoro's RAM is only taken if you
pick a Kokoro voice. Piper voices download on first use (~60 MB each, to
`~/.local/share/read-aloud/piper/`). Word highlighting is exact with Kokoro and estimated with Piper.

```
extension/   the browser extension (Firefox + Chromium, Manifest V3)
server/      tts_server.py: Kokoro + Piper behind http://127.0.0.1:5123 (localhost only)
start-server.sh
```

## Permanent setup (Linux, systemd)

- **Server:** copy `systemd/read-aloud-tts.{socket,service}` to `~/.config/systemd/user/` (fix the path in
  `ExecStart`), then run `systemctl --user enable --now read-aloud-tts.socket`. systemd starts the server the first time the extension needs it. It exits after 30 idle minutes
  to free the ~1 GB of RAM. Turn this off with `systemctl --user disable --now read-aloud-tts.socket`.
- **Icon:** *Read Aloud* in the app menu and on the desktop (`read-aloud.sh`). It loads the voices
  ahead of time, and the first time it sees a signed `dist/*.xpi` it opens that file in Firefox to install it.
- **Firefox signing:** `./build.sh` → upload `dist/read-aloud-kokoro.zip` at
  addons.mozilla.org/developers as *On your own* (unlisted) → save the signed `.xpi` to `dist/`.

## 1. Start the voice server (manual alternative)

```bash
./start-server.sh
```

It prints `Listening on …` right away and loads a voice engine when one is first needed.
Leave it running in a terminal.
It runs with `./.venv` (torch CPU, kokoro, piper-tts, soundfile, en_core_web_sm). If that is missing, `start-server.sh` prints the commands to create it.

## 2. Load the extension

**Chromium:** go to `chrome://extensions` → turn on *Developer mode* → *Load unpacked* →
pick the `extension` folder. It stays installed.

**Firefox:** go to `about:debugging#/runtime/this-firefox` → *Load Temporary Add-on…* →
pick `extension/manifest.json`. Firefox removes temporary add-ons when it
restarts. To keep it, sign it for free as an "unlisted" add-on on addons.mozilla.org, or use
Firefox Developer Edition with `xpinstall.signatures.required = false`.

Pages that were already open need a reload before the extension works on them.

## Using it

| Do this | Get this |
|---|---|
| Select text → click the orange speaker | reads the selection |
| Toolbar icon → *Read page* | reads the article, skipping menus, sidebars and footers |
| Toolbar icon → *Click-to-read*, then click any sentence | reads from that sentence on (Esc to leave) |
| Right-click → *Read aloud from here* | reads from that spot on |
| `Alt+Shift+R` | read selection or page / pause / resume |
| `Alt+Shift+X` | stop |

The floating player has previous/next sentence, speed (0.75–2×) and voice controls,
plus a grip on the left for dragging it. The current sentence is highlighted, the current word more
strongly, and the page scrolls along unless you scroll yourself.

## How it works

The content script splits the text into sentences and sends them to the server one
at a time, rendering up to 3 sentences ahead. Kokoro returns a WAV plus a time for each word,
which drives the word highlighting (CSS Custom Highlight API, so the page's HTML is never
modified). The server keeps the last 300 sentences in memory, so jumping back is instant.

If Kokoro falls behind on a busy CPU, you'll see the spinner between sentences. Switch to a Piper voice.
