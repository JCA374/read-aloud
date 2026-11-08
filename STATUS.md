# Development status

Updated 8 November 2026, after adding the icon to the Settings and PDF tabs. **0.5.1 is live in Firefox's add-on store** ([Neural Voices on addons.mozilla.org](https://addons.mozilla.org/firefox/addon/a9f96c5f57e94f0c8762/)).

## At a glance

| ✅ Working and tested | 🟡 Built, not tested yet | 🔵 Left to do |
|---|---|---|
| **20**: the icon, reading, controls, volume, languages, voices, Settings, PDFs, speed, memory, Mozilla's checks, build and tests, signing tools, the releases, the pronunciation dictionary, everything in Firefox, real websites, the pause after sentences, upgrading from 0.4.0, the Firefox fix for long sentences | **6**: a slow computer, Firefox by hand, listening by ear, word timing, shortcuts, PDFs in Firefox's own viewer (all but the first are in your [checklist](docs/MANUAL-TEST.md)) | **1**: decide which name the project shows publicly |

## What's deployed

| Where | What | State |
|---|---|---|
| Firefox add-on store | **0.5.1**, listed, Firefox on computers (142 or newer) | ✅ Public. Signed and approved by Mozilla within 15 minutes on 7 November. [Store page](https://addons.mozilla.org/firefox/addon/a9f96c5f57e94f0c8762/). 0.5.0 (approved 3–7 November) users update by themselves. |
| Signed file | `dist/neural-voices-0.5.1-signed.xpi` | ✅ Matches Mozilla's checksum (087b8e0e…); marked for desktop Firefox only. |
| GitHub Releases | [v0.5.1](https://github.com/JCA374/read-aloud/releases/tag/v0.5.1): the signed Firefox file and the Chromium zip | ✅ The download has the same checksum, and GitHub serves it as a Firefox add-on. Notes cover 0.5.0 and 0.5.1. |
| Project page | <https://jca374.github.io/read-aloud/> | ✅ Install from the store; Chromium zip from the latest GitHub release. |

## Do this next: decide which name the project shows

0.5.0 is public. Two things show who made it:

1. **The author name on the store page: "Jonas".** It was changed to "JCA374" on 3 November but is "Jonas"
   again now, probably reset when you logged in. Change it under *Edit My Profile → Display Name* on
   addons.mozilla.org if you want something else. Location, job and bio are empty.
2. **"JCA374"** (close to your email prefix) in the GitHub account, the project page address and the add-on's
   permanent id (`neural-voices@jca374.github.io`, which can never change for this add-on). Your email itself
   is shown nowhere. Your full name is on the 72 past commits on GitHub; new commits say JCA374.

Options: keep it as it is; or a new GitHub account with a neutral name (the repo moves there, history
rewritten). The add-on id would still contain "jca374" unless the add-on is published again as a new
add-on, which now means its users have to reinstall. Tell me what you prefer; until then I change nothing.

## What works

| | What | How it was checked |
|---|---|---|
| ✅ Tested | **The icon** (next version: Settings and PDF tabs now show it too). A speaker with two sound waves on an orange square, drawn for this project by `tools/make-icons.py`, so it's free to use (GPL-3.0). | The script redraws the 4 committed icon files identical, pixel for pixel. A new check in the Chromium test: both tabs have the icon and it loads; it fails when the icon is removed. |
| ✅ Tested | **Everything in Firefox**, the store we're listing in. Until now some features were only tested in Chromium. | New Firefox test, 18 checks: a pronunciation typed with real key presses and used when reading; pause, resume, next, previous, speed; volume with arrow keys, mute, unmute; Escape; the engine starting again after Firefox closes the idle background page. Also run against the built package that goes to Mozilla, not just the source folder. |
| ✅ Tested | **Fixed: long sentences on a slow computer in Firefox** (new in 0.5.0). Firefox closes the add-on's background after 30 s without activity, even in the middle of making speech, and that sentence was lost. The page now sends a small "still waiting" message every 5 s. | With Firefox's limit set to 8 s: a 33 s render finished with the messages; without them it was lost at 8 s. A check in the Firefox test keeps watching this. |
| ✅ Tested | **Real websites.** | Firefox, 6 live sites: Wikipedia in English and Swedish, MDN, a GitHub page, an essay in an old table layout, Mozilla's manifesto. Each started reading within 4 s, at the title or the article (not a menu), with the right voice. |
| ✅ Tested | **Pause after each sentence.** | Measured: with 1 s pause set, the time between two sentences grew by 1.01 s. |
| ✅ Tested | **Upgrading from 0.4.0.** Settings, voices and preferences stay. | Settings saved the way 0.4.0 saves them (no dictionary yet): Settings opened, reading worked, speed, volume, highlight and the voice list were kept. |
| ✅ Tested | **Volume in the page player** (new in 0.5.0). A speaker button mutes and unmutes; a slider next to the speed sets the volume. Same setting as in Settings, saved for every page. | Chromium and Firefox, with real arrow keys: 4 × ← lowered 100% to 80% and saved it; mute set 0 and the button then says "Unmute"; unmute brought back 80%; a change made elsewhere (as from Settings) moved the slider. Firefox found that quick key presses could lose a step; fixed. |
| ✅ Tested | **Pronunciation dictionary** (new in 0.5.0). Settings → *Pronunciation*: a word or phrase, how to say it, for all voices or one language's voices. *▶ Now* and *▶ With fix* to compare. Right-click a selected word → *Fix pronunciation*. Only the voice hears the change; the page and the highlight keep the original word. In export and import. | Automatic test, 17 checks, including typing with real key presses. With "NASA" → the long form, the audio went from 0.65 s to 3.33 s while the highlight words stayed "NASA". Reading the test page sent "The Keeper of sherry light" to the voice. A Swedish-only entry wasn't used by the English voice. A bad import file kept only its 2 good entries. Plus 7 quick checks of the matching rules. |
| ✅ Tested | **Reads web pages, with no server.** Selection, the whole article (menus and footers skipped), or from a clicked sentence. | Firefox 158 and Chromium, automated: English and Swedish read with words highlighted, no errors. First sound 3–4 s from cold, 0.75 s after the popup's warm-up. |
| ✅ Tested | **Controls and highlights.** Pause, next, previous, speed, Stop and Escape; five highlight styles; one tab reads at a time. | On a 400-paragraph page each control did what it says. Switching style changed the highlight at once. Starting a second tab stopped the first. |
| ✅ Tested | **Languages.** Each paragraph gets the voice for its language, recognised from its words in any language by the browser's built-in detector (offline). Before, only English and Swedish were recognised from the words (new in 0.5.0). | A page marked as English with paragraphs in 8 languages: both browsers recognised German, French, Norwegian, Finnish, Spanish, Polish, Swedish and English. A page mixing English and Swedish switched voice every paragraph; a German page was read with Thorsten. 400 paragraphs checked in about 0.2 s. |
| ✅ Tested | **Voices.** 170 voices in 49 languages; downloads with progress and size check; a clear message when offline; kept when the voice list updates; changes apply at once. | Download site blocked: stopped after 6.6 s with a clear message. A voice stored under an older address was kept and read without downloading. |
| ✅ Tested | **Settings page**, in the order a new user needs it (Reading first, Credits last). | Automatic test, 18 checks. All 170 online samples exist. |
| ✅ Tested | **Reads PDFs** in the add-on's own viewer. | Chromium test, 15 checks: paragraphs, hyphen joining, highlights, zoom, hand-over from Chromium's viewer. Firefox read the same PDF. Screenshots checked for the highlight. |
| ✅ Tested | **Natural speed**, 0.75× to 2× without the voice going high. | Pitch measured: Alma 176–181 Hz at every speed. 2× measured at 1.9×. |
| ✅ Tested | **Memory, and nothing left running.** | Measured again on 3 November: 290–575 MB more while reading, flat over 6 minutes. After Stop: CPU 0, memory freed (Firefox at once, Chromium after 5 idle minutes). First sound 3.3 s from cold. |
| ✅ Tested | **Mozilla's checks and signing.** 0.4.0 signed (unlisted) on 26 October. | Mozilla's checker: 0 errors. `tools/check-vendor.sh`: all 204 library files identical to npm. The signed file matches Mozilla's checksum and holds the same code as the upload. |
| ✅ Tested | **Build and tests.** `./build.sh`, `tests/run.sh` (now with a `release` group: builds, then tests the built Firefox package and real websites), `tools/try.sh`. | 3 November: `tests/run.sh all` 12 of 12 pass, `release` 4 of 4, timing and memory as before, Mozilla's checker 0 errors, all 204 library files identical to npm. Latest results: [tests/RESULTS.md](tests/RESULTS.md). |
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
| 🟡 Not tested | **Keyboard shortcuts** | Test browsers can't press add-on shortcuts. They use the same code as the popup buttons, which are tested. |

## How it becomes permanent

| Step | State |
|---|---|
| Signed by Mozilla | ✅ 0.4.0 unlisted; 0.5.0 and 0.5.1 listed. New versions: `tools/sign.sh --listed`. |
| On GitHub Releases | ✅ v0.4.0 and v0.5.1. |
| Listed in the store | ✅ 0.5.0 public since about 7 November: [store page](https://addons.mozilla.org/firefox/addon/a9f96c5f57e94f0c8762/). Firefox desktop only. New versions go through Mozilla's review before users get them. |

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

**3 November (later):** Claude Opus 5.5. Planned a release test plan (approved; you chose Firefox only and
no Android for now), then built it: a Firefox test for everything that was only tested in Chromium, a
real-websites test, a test of the built package, checks for the sentence pause and upgrading from 0.4.0, and
the timing-sensitive Settings check made steady (5 passes in a row). The new Firefox test found two real
bugs, both fixed: lost volume steps, and long sentences lost when Firefox closed the background.

Slips:
- **A probe looked at the wrong tab** and showed no player, which looked like a bug. Cause: the add-on's tab
  wasn't on an add-on page yet. About 2 minutes.
- **The first long-page check passed even with the fix removed**, so it proved nothing. Replaced with a
  direct check that fails without the fix. About 5 minutes.
- **The real-websites check first failed 3 sites** because it didn't allow the article's title inside a page
  header. A test mistake, not the add-on.
- **The sentence-pause check hung once**: it looked for the player before reading had started. One timed-out
  run (3 minutes).

**3 November (evening):** any language is now recognised from the words. Slip: an inline edit script
stopped on an apostrophe; it changed nothing, and was redone as a file (under a minute).

**3 November (late):** you said *Fix pronunciation* didn't scroll to the Pronunciation section. I couldn't make it fail in the test browsers; the scroll now waits until everything above it is drawn, and a test checks it.

**3 November (night):** you said everything was ready; I prepared and submitted the listing (you confirmed
before it was sent). Slips:
- **Removing the Android block from the manifest made Mozilla's checker warn**: put back; Android is left out
  in the upload instead. Caught by the tests before anything was sent.
- **The first submission was refused**: the reviewer notes were 3,422 characters, over Mozilla's 3,000 limit
  (my two new lines pushed it over). Only the store texts had been saved. Shortened; `tools/sign.sh` now
  checks the length first. About 3 minutes.
- **Screenshot upload hit Mozilla's rate limit** after the first image; the rest went up a minute apart, and
  `amo.py previews` now waits between uploads.

**7 November:** your phone showed an error in Settings (`fix1.jpg`). Cause found: the add-on's background
stopped at the right-click menu and shortcut set-up, which Firefox for Android doesn't have. Since you can't
test on a phone, the add-on is now for computers only: the manifest no longer mentions Android, and the store
already offers it for desktop Firefox only. The small fix that stops the background from failing when menus
or shortcuts are missing is kept (it costs nothing), with its quick check. Slip: I tried to download Google's
`adb` tool myself; that was blocked, and you decided against phone testing anyway.

**7 November (later):** release 0.5.1 after all test groups passed. One timing run looked 5× slower (first
sound 16.4 s): the test profile had been started fresh, so the voice downloaded again. A second run gave the
usual 3.2 s. Signing and approval took under 15 minutes.

**Suggestion:** for each change, say whether it should go out as a new version, so every change lands in
the changelog and the release notes write themselves.

## Handy commands

| What | Command |
|---|---|
| Try the development version in a separate Firefox | `tools/try.sh` (Chromium: `tools/try.sh chromium`) |
| Check a change (about 1.5 min; seconds if nothing changed) | `tests/run.sh` |
| Every test, before a release | `tests/run.sh all`, then `tests/run.sh release` |
| Test by hand before a release | [docs/MANUAL-TEST.md](docs/MANUAL-TEST.md) |
| Build the Firefox and Chromium files (and check them) | `./build.sh` |
| Sign a new version with Mozilla | `tools/sign.sh` |
| Versions on Mozilla (keys loaded) | `python3 tools/amo.py versions neural-voices@jca374.github.io` |
| Check the bundled libraries against npm | `tools/check-vendor.sh` |
| Update the voice catalogue | `node tools/make-catalog.mjs` |
