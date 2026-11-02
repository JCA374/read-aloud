# Neural Voices add-on

Browser add-on (`extension/`, Firefox + Chromium, MV3) that reads web pages aloud with Piper voices running
inside the browser (WebAssembly, `extension/engine/`). No server. See README.md.

Version 0.4.0 is signed by Mozilla (unlisted) and on GitHub Releases; `extension/` is that version.
The owner will keep asking for changes; listing it publicly in the store is the eventual goal, when the
owner decides (`docs/LISTING.md`).

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
