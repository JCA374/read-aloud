# Listing it publicly (when the owner decides)

Today Neural Voices is **unlisted**: Mozilla signs it, but it isn't in the add-on store. Listing it puts it
on addons.mozilla.org, where anyone can find it, and Firefox then updates it automatically. Listing is free.
This is the checklist for that day.

## How it's done (0.5.0 was the first listed version)

The texts live in `docs/listing/listing.json` (name, summary, description, category, homepage, support
link, licence). The screenshots are `docs/media/store-*.png`, made by
`KEEP=1 tests/chromium.sh tests/chromium/screenshots.mjs` (needs the internet). The description is plain text: the store shows HTML tags as
text, so use line breaks, "•" bullets and CAPITAL headings. Change only the texts: `python3 tools/amo.py listing <id>`.

1. Tests: `tests/run.sh all`, `tests/run.sh release`, and the owner's [MANUAL-TEST.md](MANUAL-TEST.md).
2. `tools/sign.sh --listed --dry-run` shows what will be sent. Then `tools/sign.sh --listed` sends the texts
   (`amo.py listing`), then uploads the version with its licence (`GPL-3.0-only`), source code, reviewer
   notes and release notes, for desktop Firefox only.
3. Screenshots: `python3 tools/amo.py previews <id> docs/media/store-*.png` (keys loaded).
   Store icon: `python3 tools/amo.py icon <id>` (the store doesn't take it from the add-on; it showed a grey
   default until 8 November).
4. **By hand on the developer page** (the API can't set it): *Edit Product Page* → **Privacy Policy**: paste
   `PRIVACY.md`.
5. Wait for the review: `python3 tools/amo.py status <id>`. When approved, download the signed file
   (`amo.py download`), make the GitHub Release, and point the install instructions at the store page.

Category: *Language Support* (Firefox has no accessibility category for extensions). Computers only: the add-on
isn't made for Firefox for Android, and `tools/sign.sh` uploads with `compatibility: ["firefox"]`.

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
