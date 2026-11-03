# Releasing a new version

A release means: Mozilla signs the Firefox build (unlisted, so it's not in the store), and the signed file
goes on a GitHub Release, where people download it. Signing is free and usually takes a few minutes.

## Once: API keys

1. Log in at <https://addons.mozilla.org/developers/addon/api/key/> and click **Generate new credentials**.
2. Put them in `.amo-keys` at the top of the repo. Git ignores this file, so it's never committed.

   ```
   export WEB_EXT_API_KEY="user:12345678:123"   # "JWT issuer"
   export WEB_EXT_API_SECRET="…"                # "JWT secret"
   ```

To check the keys: `set -a; . ./.amo-keys; set +a; python3 tools/amo.py versions neural-voices@jca374.github.io`

## Each release

1. **Tests.** `tests/run.sh all`, then `tests/run.sh release` (tests the built Firefox package and real
   websites), and `tests/run.sh timing` if the engine or audio code changed. Then the owner's test by hand,
   [MANUAL-TEST.md](MANUAL-TEST.md). Everything must pass and be logged in `tests/RESULTS.md`.
2. **Bundled libraries.** If anything in `extension/engine/vendor/` or `extension/pdf/` changed, run
   `tools/check-vendor.sh` and update `THIRD-PARTY-NOTICES`, `licenses/` and
   `extension/engine/vendor/README.md`.
3. **Version.** Raise `version` in `extension/manifest.json`: `0.4.1` for fixes, `0.5.0` for new features.
   Never change the add-on id (`neural-voices@jca374.github.io`): signing and updates depend on it.
4. **Changelog.** Rename **Unreleased** in `CHANGELOG.md` to `## <version> (<date>)` and start a new, empty
   **Unreleased** above it. Commit.
5. **Sign.** `tools/sign.sh`. It checks the keys and that the version is new, runs `./build.sh`, makes the
   source zip, uploads both with the reviewer notes (`docs/reviewer-notes.txt`) and the changelog section,
   waits for Mozilla, and saves `dist/neural-voices-<version>-signed.xpi`.
6. **GitHub Release.**

   ```
   gh release create v<version> dist/neural-voices-<version>-signed.xpi dist/neural-voices-<version>-chromium.zip \
     --title "Neural Voices <version>" --notes "<the changelog section>"
   ```

7. **Project page.** Update the About tab if features changed, and the In development tab (the
   `status-page` skill).

People who installed an earlier `.xpi` install the new one over it. Their settings and voices are kept.
Firefox doesn't update unlisted add-ons by itself, unless the manifest has an `update_url`; there isn't
one. Once the add-on is listed in the store, Firefox updates it automatically (see `LISTING.md`).

## If the script can't be used: upload by hand

1. `./build.sh` and `git archive -o dist/neural-voices-<version>-source.zip HEAD`.
2. <https://addons.mozilla.org/developers/> → **My Add-ons → Neural Voices → Upload New Version**.
3. Pick `dist/neural-voices-<version>-firefox.zip`, with only Firefox ticked (not Android, untested).
   The automatic check shows 0 errors and 6 warnings, which are expected (explained in the reviewer notes).
4. Source code: **Yes**, and upload the source zip.
5. Release notes: the changelog section. Notes to reviewer: paste `docs/reviewer-notes.txt`.
6. When signed: **Manage Status & Versions** → the version → download the `.xpi` into `dist/`, or run
   `python3 tools/amo.py download neural-voices@jca374.github.io <version>` with the keys loaded.

## Installing the signed file

- **Firefox:** open the `.xpi` (drag it into a Firefox window), or `about:addons` → ⚙ →
  **Install Add-on From File…**. A copy loaded as a temporary add-on in `about:debugging` should be removed first.
- **Chrome, Edge, Brave:** unzip the Chromium zip, then `chrome://extensions` → **Developer mode** →
  **Load unpacked**.
