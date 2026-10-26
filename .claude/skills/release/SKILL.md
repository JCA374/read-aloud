---
name: release
description: Package and sign the Neural Voices add-on (step 4 of the brief): version bump, licence and notices check, build, lint, unlisted signing on addons.mozilla.org, and sharing the signed file. Use when the owner asks for a release, a beta for friends, or signing.
---

# Release the add-on

The owner decides when to release; don't push towards a public listing. Signing and listing on
addons.mozilla.org (AMO) are free.

1. **Ready?** The tests for everything changed since the last release are logged as passing in
   `tests/RESULTS.md` (the `addon-tests` skill). No open "Built, not tested" item that would embarrass a user.
2. **Licences.** `LICENSE` (GPL-3.0, because espeak-ng is GPL-3.0), `THIRD-PARTY-NOTICES` and `licenses/`
   are at the top of the repo; `build.sh` puts them in the zip, and `tests/run.sh` checks they exist and that
   every voice has a licence kind and every starter voice is free to use. If a vendored file changes, update
   the versions, commits and texts in `THIRD-PARTY-NOTICES`, `licenses/` and `extension/engine/vendor/README.md`,
   and the list in `tools/check-vendor.sh`. Run `tools/check-vendor.sh` before each upload: every bundled library
   file must match its npm package (Mozilla asks that minified code be verifiable). Manual upload steps and the
   notes for reviewers: `docs/upload-manually.md`.
   If the voice catalogue changes (`node tools/make-catalog.mjs`), check the licence counts it prints, then `tests/run.sh` (starter voices must stay free to use).
3. **Version.** Raise `version` in `extension/manifest.json` (every upload needs a higher one). Never change
   `browser_specific_settings.gecko.id` (`neural-voices@jca374.github.io`): signing and updates depend on it.
4. **Build and lint.** `./build.sh` → `dist/neural-voices-<version>-firefox.zip` (upload this one), `-chromium.zip`
   and `dist/firefox/` (no tests, docs or dev files; it runs `web-ext lint` on the Firefox build). Fix errors (flags and output format: the `web-ext` skill); explain warnings in the submission notes
   (WebAssembly needs `'wasm-unsafe-eval'`; voice models download from huggingface.co).
5. **Sign unlisted.** Either the owner uploads the zip at addons.mozilla.org/developers → *Submit a New
   Add-on* → *On your own*, or with their API keys: `npx web-ext sign --channel=unlisted --source-dir dist/firefox`.
   AMO may ask for source code: point to the public repo. Signing can take up to a day.
6. **Share.** Put the signed `.xpi` in `dist/`. Friends open it in Firefox and confirm. On Android: save the
   file and install it from Firefox's add-on settings.
7. Log the release (version, date, what's in it) on the project page (the `status-page` skill).
