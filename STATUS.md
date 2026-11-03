# Development status

Updated 3 November 2026, after adding volume to the player on the page and moving this status off the
project page into the repo.

## At a glance

| ✅ Working and tested | 🟡 Built, not tested yet | 🔵 Left to do |
|---|---|---|
| **14**: reading, controls, volume, languages, voices, Settings, PDFs, speed, memory, Mozilla's checks, build and tests, signing tools, the release, the pronunciation dictionary | **8**: a slow computer, Firefox by hand, listening by ear, word timing, shortcuts, the pause after sentences, PDFs in Firefox's own viewer, one unreliable test | **1**: a public listing in the store, when you decide ([checklist](docs/LISTING.md)) |

Since the 0.4.0 release (not released yet): the pronunciation dictionary, Settings in a new order, and
volume in the page player. See [CHANGELOG.md](CHANGELOG.md).

## Do this next: try the new version

Your installed add-on stays as it is.

1. In the project folder, run `tools/try.sh`. A separate Firefox window opens with the new version and its
   own profile.
2. Start reading a page. In the player, drag the volume slider or click the speaker to mute.
3. Select a word the voice says wrong, right-click **Fix pronunciation**, type how it should sound, press
   **▶ With fix**, then **Add**. Read the page again.
4. If it's good, say "make a release". I'll sign 0.5.0 and put it on GitHub, and you install it over 0.4.0
   (settings and voices stay).

## What works

| | What | How it was checked |
|---|---|---|
| ✅ Tested | **Volume in the page player** (not released yet). A speaker button mutes and unmutes; a slider next to the speed sets the volume. Same setting as in Settings, saved for every page. | Chromium smoke test, 4 new checks with real arrow keys: 4 × ← lowered 100% to 80% and saved it; mute set 0 and the button then says "Unmute"; unmute brought back 80%; a change made elsewhere (as from Settings) moved the slider. All 9 quick tests pass in both browsers. |
| ✅ Tested | **Pronunciation dictionary** (not released yet). Settings → *Pronunciation*: a word or phrase, how to say it, for all voices or one language's voices. *▶ Now* and *▶ With fix* to compare. Right-click a selected word → *Fix pronunciation*. Only the voice hears the change; the page and the highlight keep the original word. In export and import. | Automatic test, 17 checks, including typing with real key presses. With "NASA" → the long form, the audio went from 0.65 s to 3.33 s while the highlight words stayed "NASA". Reading the test page sent "The Keeper of sherry light" to the voice. A Swedish-only entry wasn't used by the English voice. A bad import file kept only its 2 good entries. Plus 7 quick checks of the matching rules. |
| ✅ Tested | **Reads web pages, with no server.** Selection, the whole article (menus and footers skipped), or from a clicked sentence. | Firefox 158 and Chromium, automated: English and Swedish read with words highlighted, no errors. First sound 3–4 s from cold, 0.75 s after the popup's warm-up. |
| ✅ Tested | **Controls and highlights.** Pause, next, previous, speed, Stop and Escape; five highlight styles; one tab reads at a time. | On a 400-paragraph page each control did what it says. Switching style changed the highlight at once. Starting a second tab stopped the first. |
| ✅ Tested | **Languages.** Each paragraph gets the voice for its language. | A page mixing English and Swedish switched voice every paragraph; a German page was read with Thorsten. |
| ✅ Tested | **Voices.** 170 voices in 49 languages; downloads with progress and size check; a clear message when offline; kept when the voice list updates; changes apply at once. | Download site blocked: stopped after 6.6 s with a clear message. A voice stored under an older address was kept and read without downloading. |
| ✅ Tested | **Settings page**, in the order a new user needs it (Reading first, Credits last). | Automatic test, 18 checks. All 170 online samples exist. |
| ✅ Tested | **Reads PDFs** in the add-on's own viewer. | Chromium test, 15 checks: paragraphs, hyphen joining, highlights, zoom, hand-over from Chromium's viewer. Firefox read the same PDF. Screenshots checked for the highlight. |
| ✅ Tested | **Natural speed**, 0.75× to 2× without the voice going high. | Pitch measured: Alma 176–181 Hz at every speed. 2× measured at 1.9×. |
| ✅ Tested | **Memory, and nothing left running.** | 300–550 MB more while reading, flat over 6 minutes. After Stop: CPU 0, memory freed after 5 idle minutes. |
| ✅ Tested | **Mozilla's checks and signing.** 0.4.0 signed (unlisted) on 26 October. | Mozilla's checker: 0 errors. `tools/check-vendor.sh`: all 204 library files identical to npm. The signed file matches Mozilla's checksum and holds the same code as the upload. |
| ✅ Tested | **Build and tests.** `./build.sh`, `tests/run.sh`, `tools/try.sh`. | After the clean-up the build was byte for byte the file sent to Mozilla. `tools/try.sh` checked: Firefox started with its own profile and loaded the add-on. Latest results: [tests/RESULTS.md](tests/RESULTS.md). |
| ✅ Tested | **Signing tools.** `tools/sign.sh` signs a new version with the API keys in `.amo-keys` (git ignores it); `tools/amo.py` lists versions and downloads signed files. | The keys log in. `amo.py` downloaded 0.4.0 and checked Mozilla's checksum. `sign.sh` refused 0.4.0 ("must be higher") before uploading anything. The full upload runs at the next version. |
| ✅ Tested | **GitHub Release v0.4.0**: the signed Firefox file and the Chromium zip. | The download has the same SHA-256 as Mozilla's signed file (32dd2f43…), and GitHub serves it as a Firefox add-on, so clicking it in Firefox offers to install. |

## Built, not tested yet

| | What | Why not |
|---|---|---|
| 🟡 Not tested | **A really slow computer** | Not tried on real slow hardware. A simulation with half a CPU core took 39 s to the first sound and then rendered a bit slower than it speaks. With one full core it's fine. |
| 🟡 Not tested | **Clicking through Firefox by hand** | Firefox was tested by scripts, not by a person. |
| 🟡 Not tested | **Listening by ear** | Speed and pitch were measured; nobody has judged the voices or the volume by ear. |
| 🟡 Not tested | **Word timing** | Piper doesn't say when each word starts, so the highlight is estimated and may run a little ahead or behind. |
| 🟡 Not tested | **PDFs in Firefox's own viewer and from real websites** | *Read this PDF* from Firefox's viewer, the right-click menu, the "allow this site" prompt, long or two-column PDFs. |
| 🟡 Not tested | **Pause after each sentence** | Saved and used, but no test measures the silence. |
| 🟡 Not tested | **Keyboard shortcuts** | Test browsers can't press add-on shortcuts. They use the same code as the popup buttons, which are tested. |
| 🟡 Unreliable test | **One Settings check is timing-sensitive** | The auto-scroll check failed twice on 2 November and passed on 3 November with no change to that code. The scrolling itself was right every time (287 px on, 0 off); the test's wait for the player's "N / M" text sometimes runs out. |

## How it becomes permanent

| Step | State |
|---|---|
| Signed by Mozilla | ✅ 0.4.0, unlisted. New versions: `tools/sign.sh`. |
| On GitHub Releases | ✅ Anyone with the link can install it. |
| Listed in the store | 🔵 When you decide. Found by anyone, updates itself, needs a human review. [Checklist](docs/LISTING.md). |

In Chromium, "Load unpacked" is already permanent.

## How the sessions went

**2–3 November:** Claude Opus 5.5. Planned the clean-up first (plan approved), then built it: API keys
checked, signed file downloaded and verified, old video tools and speed samples removed, new documents, a
signing script and the GitHub release. Then, at your request: the pronunciation dictionary, `tools/try.sh`,
the new info page, Settings in a new order, volume in the player, and this file.

Slips:
- **A page publish was refused** because the live version hadn't been read first. One extra round; nothing lost.
- **A page update went out before its edit had run.** The edit script stopped on an apostrophe, but the
  publish and commit ran anyway. Caught right after and redone.
- **You couldn't type in "Say it as".** The Enter-key shortcut cancelled every other key. The test filled the
  boxes directly instead of typing, so it missed this. Fixed in minutes; the test now types real keys and
  fails on the broken version.
- **The new test opened Settings with a "#" in the address**, which the test browser drops. One failed run,
  about a minute. Not a fault in the add-on.
- **Two wrong details in the first draft of `docs/ARCHITECTURE.md`** (word timing, pdf.js settings). Caught
  by checking the code before committing.

**Suggestion:** for each change, say whether it should go out as a new version, so every change lands in
the changelog and the release notes write themselves.

## Handy commands

| What | Command |
|---|---|
| Try the development version in a separate Firefox | `tools/try.sh` (Chromium: `tools/try.sh chromium`) |
| Check a change (about 1.5 min; seconds if nothing changed) | `tests/run.sh` |
| Every test, before a release | `tests/run.sh all` |
| Build the Firefox and Chromium files (and check them) | `./build.sh` |
| Sign a new version with Mozilla | `tools/sign.sh` |
| Versions on Mozilla (keys loaded) | `python3 tools/amo.py versions neural-voices@jca374.github.io` |
| Check the bundled libraries against npm | `tools/check-vendor.sh` |
| Update the voice catalogue | `node tools/make-catalog.mjs` |
