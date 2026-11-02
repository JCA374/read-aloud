# Listing it publicly (when the owner decides)

Today Neural Voices is **unlisted**: Mozilla signs it, but it isn't in the add-on store. Listing it puts it
on addons.mozilla.org, where anyone can find it, and Firefox then updates it automatically. Listing is free.
This is the checklist for that day.

## Before submitting

- [ ] **Ready for strangers.** No open item under "Built, not tested" on the project page that would
      embarrass a user. In particular: tried by hand in Firefox, and tried on a slower computer.
- [ ] **Version.** A new version number (see `RELEASING.md`). The first listed version can't reuse an
      unlisted number.
- [ ] **Name and summary.** Name: *Neural Voices*. Summary (at most 250 characters), for example the
      manifest's description: "Reads web pages and PDFs aloud with natural Piper voices that run inside
      your browser. Your text never leaves your computer."
- [ ] **Description.** The About tab of the project page, shortened: what it does, voices, privacy.
- [ ] **Screenshots.** 3–5 at 1280×800: reading with the highlight, the player, Settings, a PDF.
      (`docs/media/settings.png` is one.)
- [ ] **Icon.** `extension/icons/icon128.png` (already in the add-on).
- [ ] **Categories.** "Accessibility" and "Language Support".
- [ ] **Support.** Website <https://jca374.github.io/read-aloud/>; support site
      <https://github.com/JCA374/read-aloud/issues>.
- [ ] **Privacy policy.** Paste `PRIVACY.md`. The store asks for one because the add-on reads page content.
- [ ] **Licence.** GPL-3.0 (choose "GNU General Public License v3.0").
- [ ] **Source code.** Uploaded with every version (`tools/sign.sh` does this).

## Submitting

- With the script: change `--channel=unlisted` to `--channel=listed` in `tools/sign.sh` for that run. The
  first listed version also needs the listing text: add `name`, `summary`, `description`, `categories`,
  `homepage`, `support_url` and `license` to the metadata JSON it builds (see the `web-ext` skill).
- Or by hand: <https://addons.mozilla.org/developers/> → **My Add-ons → Neural Voices** → change the
  distribution to "On this site", then fill in the listing.

## What to expect

- **Human review.** Listed add-ons are reviewed by a person, which can take days or weeks. This add-on has
  minified libraries (ONNX Runtime, piper-wasm, pdf.js) and needs `'wasm-unsafe-eval'` to run WebAssembly.
  The reviewer notes (`docs/reviewer-notes.txt`) explain both, and `tools/check-vendor.sh` lets the
  reviewer check that the libraries are unchanged from npm.
- **Voice licences.** Some voices in the catalogue are non-commercial or have no stated licence. That's
  fine for a free add-on that downloads them on request and shows each licence, but a reviewer may ask.
  The five starter voices are all free to use.
- **Updates.** After listing, every new version goes through review before users get it.
- **No `update_url`.** A listed add-on must not have one in its manifest (it doesn't today).

## Chrome Web Store (optional)

A developer account costs a one-time fee. Upload `dist/neural-voices-<version>-chromium.zip`. It needs
the same texts, screenshots and privacy policy, plus a reason for each permission (from `PRIVACY.md`).
