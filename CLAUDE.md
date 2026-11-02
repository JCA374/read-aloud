# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Neural Voices add-on

Browser add-on (`extension/`, Firefox + Chromium, MV3) that reads web pages aloud with Piper voices running
inside the browser (WebAssembly, `extension/engine/`). No server. See README.md.

The last release is 0.4.0 (signed by Mozilla, unlisted, on GitHub Releases). Changes since then are listed
under **Unreleased** in `CHANGELOG.md`.
The owner will keep asking for changes; listing it publicly in the store is the eventual goal, when the
owner decides (`docs/LISTING.md`).

## Commands

No build step and no npm project: `extension/` is loaded as it is. Tests need Linux with the Chromium and
Firefox snaps, node 22+ and python3.

| What | Command |
|---|---|
| Quick check (instant checks + both smoke tests + tests whose files changed) | `tests/run.sh` (run in the background) |
| One test | `tests/run.sh chromium/pronunciation` (names in `tests/run.sh` / `tests/README.md`) |
| Every functional test, before a release | `tests/run.sh all` |
| Speed and memory measurements (15–25 min, alone) | `tests/run.sh timing` |
| Mozilla's checker | `npx web-ext lint --source-dir extension` (6 known warnings; 4 on the Firefox build) |
| Build the zips (and lint the Firefox build) | `./build.sh` → `dist/` |
| Try by hand in a separate profile | `tools/try.sh` (Firefox) or `tools/try.sh chromium` |
| Sign a new version (needs `.amo-keys`) | `tools/sign.sh` |
| Mozilla API: versions / download a signed file | `python3 tools/amo.py versions\|download <id> [version]` (keys loaded) |
| Rebuild the voice catalogue | `node tools/make-catalog.mjs` (never edit `extension/catalog.js` by hand) |
| Check bundled libraries against npm | `tools/check-vendor.sh` |

A new behaviour needs a check: in a smoke test if quick, otherwise a new test using `check()`/`finish()`
from `tests/chromium/lib.mjs`, registered in `tests/run.sh` with the files it covers. Tests should type and
click like a user (setting `.value` directly once hid a bug that blocked typing).

## Architecture in brief

Details: `docs/ARCHITECTURE.md`. The parts that span several files:

- **One manifest, two background modes.** Firefox runs `background.scripts` as an event page and hosts
  the engine there (`engine/host.js` is loaded before `background.js`). Chromium runs a service worker,
  which can't start workers, so it hosts the engine in `offscreen.html`. `background.js` `engine()` hides
  the difference. `build.sh` strips the offscreen page, its permission and the service worker entry from
  the Firefox build.
- **Speech path.** `content.js` splits text into pieces (short first, then about 60 s ahead) and sends
  `{type:"tts", text, voice, speed, say?}`; the background forwards it to `host.js` (keeps the last 30) and
  then `engine/piper-worker.js` (espeak-ng phonemes → ONNX Runtime → base64 WAV with estimated word times).
  `say` is the text with your pronunciations applied (`NV.applyDictionary`): the worker speaks `say` but
  times the words of `text`, so the highlight matches the page.
- **`common.js` (`NV`) is shared** by content, background, popup, Settings and the PDF viewer: settings
  defaults (`NV.DEFAULTS` = every `chrome.storage.local` key), voice choice per language, `sendToTab`.
  Settings import goes through `cleanSettings` in `options.js`; a new setting needs a rule there.
- **The PDF viewer is an add-on page** (`pdf.html`), which `tabs.sendMessage` can't reach, so
  `NV.sendToTab` falls back to a runtime message with `toTab`. `content.js` runs inside it too, and must
  ignore the add-on's internal messages.
- **Voices** download from Hugging Face at the revision pinned in `catalog.js`, are size-checked, and live
  in the Cache API (`piper-voices`). Bundled code in `engine/vendor/` and `pdf/` is unchanged from npm.
- **Ids that must never change:** the gecko id `neural-voices@jca374.github.io` (signing and updates).

## Docs (keep them accurate when something changes)

- `README.md`: what it is, install, using it, development, docs map.
- `docs/ARCHITECTURE.md`: files, message flow, engine, storage, PDFs, browser differences.
- `docs/RELEASING.md`: version bump, `tools/sign.sh`, GitHub Release. `docs/reviewer-notes.txt`: notes
  sent to Mozilla's reviewers (update when permissions, libraries or network use change).
- `docs/LISTING.md`: checklist for a public listing. `PRIVACY.md`: privacy policy (update when the add-on
  uses the network, storage or permissions differently).
- `CHANGELOG.md`: add every user-visible change under **Unreleased**.

## Making a change

1. Edit `extension/`. Update `docs/ARCHITECTURE.md` if the structure or messages change.
2. Run the tests (`addon-tests` skill) and log them.
3. Add the change to `CHANGELOG.md` under **Unreleased**.
4. Update the project page (`status-page` skill), commit and push.
5. A new version for people to install: the `release` skill (only when the owner asks).

## The project page: About tab + Development tab

The user finds long terminal replies hard to read. Report progress on the project page, not in the terminal.

- Source: `docs/page.html`. It has two tabs:
  - **About** (default): information about the add-on for anyone who finds it: features, voices, install,
    shortcuts, privacy. Keep it accurate whenever a feature, voice or install step changes.
  - **In development** (small tab, opens with `#development`): the status for the user, described below.
- It is published in two places, which must always match:
  - private Artifact: https://claude.ai/artifact/DzigF14FjENFe38iWR56Bm (republish **to that same URL**)
  - public GitHub Pages: https://jca374.github.io/read-aloud/ (built from `docs/index.html`)
- Update the Development tab when a test run is done, and after every meaningful change
  (feature done, bug fixed, setup step finished). Report the measured results, not plans.
  1. update `docs/page.html`
  2. republish the Artifact to the URL above (never create a second page)
  3. run `docs/make-index.sh`, commit all project changes, and push to `origin main`
     (the user asked on 2026-10-21 for the code and page to be public on GitHub and kept up to date)
- Then reply in the terminal with 2–4 short lines max: what changed, plus the link
  (use `https://jca374.github.io/read-aloud/#development` for status news).
- The page is public: it must not contain personal details about the user's machine: no home-folder paths,
  no other programs or ports they use, no notes about their other work. Write paths relative to the repo.
- Development tab sections, in this order:
  1. **At a glance**: counts for working/tested, built but not tested, and left to do
  2. **Do this next**: numbered steps for the user, with copy buttons for anything to type
  3. **What works**: each item with a chip ("Tested") and *how* it was verified
  4. **Built, not tested yet**: be honest; never mark something tested that wasn't
  5. **How it becomes permanent**: which parts are done, and which need the user
  6. **How the session went**: the model/effort level used, the real slips made and what each cost,
     and a suggestion. Facts from the session only; no invented comparisons.
  7. **Handy commands**
- Update the "Updated <date>, after <what>" line every time.
- Writing: short, plain sentences, no jargon without explanation.

## Skills and tests

- `status-page`: the steps to update and publish the page (above).
- `addon-tests`: which browser tests to run, how, and logging them in `tests/RESULTS.md`.
  Check that log first: don't re-run a test when nothing it covers has changed.
- `release`: version, build, signing with the API keys (`tools/sign.sh`) and the GitHub Release.
- `web-ext`: reference for Mozilla's `web-ext` tool (lint, run, build, sign flags). Adapted from testland/qa (MIT).

Machine-specific notes (setup, testing quirks) are in `CLAUDE.local.md`, which is not committed.
