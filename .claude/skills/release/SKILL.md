---
name: release
description: Release a new version of the Neural Voices add-on: tests, licences, version bump, changelog, build, unlisted signing on addons.mozilla.org with the owner's API keys (tools/sign.sh), a GitHub Release with the signed .xpi, and the project page. Use when the owner asks for a release, a new version, a beta for friends, signing, or a public listing.
---

# Release the add-on

The owner decides when to release, and whether to list it publicly; don't push towards a listing. The
full steps, for people: `docs/RELEASING.md`. This is the checklist.

1. **Ready?** `tests/run.sh all` passes, logged in `tests/RESULTS.md` (`addon-tests` skill). No open "Built,
   not tested" item that would embarrass a user.
2. **Licences.** If a bundled library changed: `tools/check-vendor.sh`, and update `THIRD-PARTY-NOTICES`,
   `licenses/`, `extension/engine/vendor/README.md` and the list in `tools/check-vendor.sh`. If the voice
   catalogue changed (`node tools/make-catalog.mjs`), check the licence counts it prints.
3. **Reviewer notes and privacy.** If permissions, network use or libraries changed, update
   `docs/reviewer-notes.txt` and `PRIVACY.md`.
4. **Version.** Raise `version` in `extension/manifest.json` (fixes: 0.4.1, features: 0.5.0). Never change
   `browser_specific_settings.gecko.id` (`neural-voices@jca374.github.io`).
5. **Changelog.** Rename **Unreleased** in `CHANGELOG.md` to `## <version> (<date>)`, and add a new empty
   Unreleased. Commit everything (`tools/sign.sh` refuses uncommitted changes in `extension/`).
6. **Sign.** Run `tools/sign.sh` in the background (it waits for Mozilla, up to an hour). It loads
   `.amo-keys` (never print or commit it), checks the version is new, builds, uploads the source zip with the
   reviewer notes and changelog section, and saves `dist/neural-voices-<version>-signed.xpi`.
   If it fails after uploading, don't re-run it blindly: check `python3 tools/amo.py versions <id>` (keys
   loaded) and fetch the file with `python3 tools/amo.py download <id> <version>`.
7. **GitHub Release.** `gh release create v<version>` with the signed `.xpi` and the Chromium zip; the notes
   are the changelog section. Check that the download's SHA-256 matches.
8. **Page.** About tab (features, install) and In development tab (`status-page` skill).

Public listing: follow `docs/LISTING.md` only when the owner asks.
