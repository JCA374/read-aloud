# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Neural Voices add-on

Browser add-on (`extension/`, Firefox + Chromium, MV3) that reads web pages aloud with Piper voices running
inside the browser (WebAssembly, `extension/engine/`). No server. See README.md.

The last release is 0.5.1, listed on addons.mozilla.org (Firefox on computers only; 0.5.0 was the first listed version, 0.4.0 unlisted). Releases are also on GitHub. Changes since then are listed
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
| Mozilla's checker | `npx web-ext lint --source-dir extension` (6 known warnings, also on the Firefox build: 3 for Chromium-only APIs in `background.js`, 3 in the bundled libraries) |
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
4. Update `STATUS.md`, and the info page if what users see changed (`status-page` skill); commit and push.
5. A new version for people to install: the `release` skill (only when the owner asks).

## Project page and status

The user finds long terminal replies hard to read. Report progress in `STATUS.md`, not in the terminal.

- **`STATUS.md`** (repo root, shown by GitHub): the development status for the owner. Update it when a
  test run is done and after every meaningful change (feature done, bug fixed, setup step finished).
  Report measured results, not plans. Sections, in this order:
  1. **At a glance**: counts for working/tested, built but not tested, and left to do
  2. **Do this next**: numbered steps for the owner, with commands in code
  3. **What works**: each item marked tested, with *how* it was verified
  4. **Built, not tested yet**: be honest; never mark something tested that wasn't
  5. **How it becomes permanent**: which parts are done, and which need the owner
  6. **How the sessions went**: model used, the real slips and what each cost, and a suggestion. Facts
     from the session only; no invented comparisons.
  7. **Handy commands**
  Update the "Updated <date>, after <what>" line every time.
- **`docs/page.html`**: the public info page for new users (what the add-on does, how it works, install,
  using it, privacy, questions). It is also the homepage for a future store listing. No development status
  on it. Keep it accurate whenever a feature, voice or install step changes; mark unreleased features as
  "Next version" until they're released. It's published in two places, which must match:
  - private Artifact: https://claude.ai/artifact/DzigF14FjENFe38iWR56Bm (republish **to that same URL**)
  - public GitHub Pages: https://jca374.github.io/read-aloud/ (run `docs/make-index.sh` to build `docs/index.html`)
- Then commit all project changes and push to `origin main` (the owner asked on 2026-10-21 for the code to
  be public on GitHub and kept up to date), and reply in the terminal with 2–4 short lines max: what
  changed, plus the link `https://github.com/JCA374/read-aloud/blob/main/STATUS.md`.
- Both are public: no personal details about the owner's machine (no home-folder paths, no other programs
  or ports they use, no notes about their other work). Write paths relative to the repo.
- Writing: short, plain sentences, no jargon without explanation.

## Skills and tests

- `status-page`: the steps to update `STATUS.md` and, when the add-on changed, the info page (above).
- `addon-tests`: which browser tests to run, how, and logging them in `tests/RESULTS.md`.
  Check that log first: don't re-run a test when nothing it covers has changed.
- `release`: version, build, signing with the API keys (`tools/sign.sh`) and the GitHub Release.
- `web-ext`: reference for Mozilla's `web-ext` tool (lint, run, build, sign flags). Adapted from testland/qa (MIT).

Machine-specific notes (setup, testing quirks) are in `CLAUDE.local.md`, which is not committed.
