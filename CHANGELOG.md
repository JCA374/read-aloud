# Changelog

What changed in each version of Neural Voices. Add changes under **Unreleased** as they're made; at a
release, that section gets the new version number (`tools/sign.sh` sends it to Mozilla as the release notes).

## Unreleased

- Pages in Firefox's add-on store can be read: Firefox doesn't let add-ons run there, so the popup (or
  Alt+Shift+R) opens the add-on's store text in Neural Voices' own reader tab and reads it.

## 0.5.2 (2026-11-08)

- The Settings and PDF tabs show the add-on's icon.
- The store description shows properly (it showed HTML tags as text).

## 0.5.1 (2026-11-07)

- The add-on's background no longer stops when the browser has no right-click menus or keyboard shortcuts.
- Made for computers only: Firefox on Android is not supported (it can't be tested there). Firefox needs
  version 142 or newer (from August 2025).

## 0.5.0 (2026-11-03), the first version listed on addons.mozilla.org

- **Pronunciation dictionary.** In Settings → *Pronunciation*, write how a word should sound, spelled the way
  the voice would read it (for example *Nguyen* → *win*). For all voices or only one language's voices.
  *▶ Now* and *▶ With fix* let you compare before saving. Whole words and phrases, any case. Only the voice
  hears the change: the page and the word highlight keep the original words.
- Right-click selected text → *Fix pronunciation of "…"* opens Settings with the word filled in.
- The dictionary is included in *Export* / *Import* settings.
- Settings are in the order a new user needs them: Reading first, then your voices, language, adding voices,
  pronunciation, storage, and credits last.
- Volume in the player on the page: a slider next to the speed, and a speaker button to mute and unmute.
  The Settings volume slider now goes down to 0.
- **Recognises any language.** Every paragraph's language now comes from its words, in any language, using
  the browser's built-in language detector (offline). Before, only English and Swedish were recognised, and
  other languages depended on what the web page said it was written in (often wrong). The player and popup
  also show the right voice for the page before reading starts.
- Fixed (Firefox): a long sentence on a slow computer could be skipped, because Firefox closed the add-on's
  background page after 30 s while the voice was still rendering. The page now keeps it awake while waiting.
- Desktop Firefox only for now: Firefox for Android is no longer marked as supported, since it hasn't been
  tested there.

## 0.4.0 (2026-10-26), signed by Mozilla (unlisted)

- Reads PDFs: the add-on's own viewer (built on pdf.js 6.4) draws the pages and lays the text over them,
  so reading, highlighting, the player, popup and shortcuts work as on a web page.
- Ways into a PDF: *Read page* on a PDF in Chromium switches to the viewer by itself; *Read this PDF* in
  the popup in Firefox; right-click a PDF link → *Read PDF aloud*; or open or drop a file from your computer.
- Zoom in the viewer. Password-protected and scanned PDFs (no text) get a clear message.
- The word highlight in PDFs colours only the background, so there's no second copy of the word.

## 0.3.0 (2026-10-26)

- Bigger Settings page, opened with ⚙ on the player: *▶ Try* for every voice (plays Piper's sample, no
  download), search and filters, voice order, storage use with *Delete all downloads*, and *Reset*,
  *Export* and *Import* for settings.
- New reading options: follow the reading by scrolling, skip code blocks, a pause after each sentence.
- Voice licences shown as plain text, with a link to each model card.
- At most two voices kept in memory. Voices you already downloaded are kept when the voice list moves to a
  newer version of Piper's collection.
- Licence files (GPL-3.0, third-party notices) and a repeatable build, with separate Firefox and Chromium zips.
- Passes Mozilla's add-on checker with no errors (the player and lists are built without `innerHTML`).

## 0.2.0 (2026-10-22)

- Reads with Piper running inside the browser. No server is needed any more.
- Your voice list, a default voice for each language, and voice changes that apply at once.
- Voice catalogue: 170 voices in 49 languages, with downloads (progress, size check, retries) and delete.
- Volume and highlight styles.
- Language for each paragraph (English and Swedish detected from the words), Escape stops, the voice
  warms up when the popup opens, 2× really means 2×, and nothing is left running after Stop.

## 0.1.0 (2026-10-22)

- First version of Neural Voices: Piper as WebAssembly inside the add-on.
- Before this, "Read Aloud" used a local Python server with Piper and Kokoro voices. That code is in the
  git history before the merge of the `neural-voices` branch.
