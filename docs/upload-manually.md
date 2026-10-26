# Upload Neural Voices to addons.mozilla.org by hand (unlisted)

This gets the add-on signed by Mozilla, so it stays installed in normal Firefox and can be shared.
"Unlisted" means it doesn't appear in the add-on store; only people you give the file to can install it.
It's free.

## Before you start

1. Build the upload file in the project folder:

   ```
   ./build.sh
   ```

   It makes `dist/neural-voices-0.4.0-firefox.zip` (the file to upload) and prints
   "web-ext lint (Firefox build): 0 errors, 6 warnings". The 6 warnings are expected (see the notes
   for reviewers below).

2. Make the source code file, in case Mozilla asks for it (the add-on includes minified libraries):

   ```
   git archive -o dist/neural-voices-0.4.0-source.zip HEAD
   ```

## Upload

1. Go to <https://addons.mozilla.org/developers/> and log in with a Mozilla account (create one if
   needed). The first time, accept the Firefox Add-on Distribution Agreement.
2. Click **Submit a New Add-on**.
3. Under "How to Distribute this Version", choose **On your own** and click **Continue**.
4. Click **Select a file…** and pick `dist/neural-voices-0.4.0-firefox.zip`.
   - Platforms: leave both **Firefox** and **Firefox for Android** ticked.
   - Wait for the automatic check. It shows 0 errors and some warnings; that's fine. Click **Continue**.
5. **Source code:** "Do you need to submit source code?" Choose **Yes** and upload
   `dist/neural-voices-0.4.0-source.zip`. (Everything is also public at
   <https://github.com/JCA374/read-aloud>.) Before uploading, you can run `tools/check-vendor.sh`:
   it checks that every bundled library file is identical to its official npm package.
6. **Version details:**
   - Release notes (optional): `Reads web pages and PDFs aloud with Piper voices that run in the browser.`
   - Notes to reviewer: paste the text in the next section.
7. Click **Submit Version**.

Signing for unlisted add-ons is automatic and usually takes a few minutes, at most a day. You get an
email when it's done.

## Notes to reviewer (copy and paste)

```
Neural Voices reads web pages and PDFs aloud. Speech is made inside the browser with Piper voices
running as WebAssembly; there is no server and no data collection.

- 'wasm-unsafe-eval' in the CSP is needed to run WebAssembly (ONNX Runtime Web, espeak-ng via
  piper-wasm, and pdf.js image decoders).
- Minified code: only third-party libraries, included unchanged from npm: onnxruntime-web 1.30.0,
  @diffusionstudio/piper-wasm 1.0.0, pdfjs-dist 6.4.299 (in engine/vendor/ and pdf/). To verify, run
  tools/check-vendor.sh in the source package: it downloads the three packages with npm and compares
  all 204 files byte for byte. Everything else is unminified source written for the add-on.
  Versions, sources and licences: THIRD-PARTY-NOTICES and extension/engine/vendor/README.md.
- No remote code: the downloaded voice models are ONNX data files (neural network weights), run by the
  bundled ONNX Runtime; no JavaScript or WebAssembly is downloaded. pdf.js runs with scripting off
  (no PDF JavaScript) and isEvalSupported: false.
- Lint warnings: UNSUPPORTED_API (chrome.offscreen in background.js) is the Chromium-only path and
  doesn't run in Firefox. UNSAFE_VAR_ASSIGNMENT is inside the minified libraries (ort.wasm.min.js,
  pdf.min.mjs, pdf.worker.min.mjs), not in the add-on's own code.
- Network use: voice models are downloaded from huggingface.co/rhasspy/piper-voices (pinned revision,
  size-checked) the first time a voice is used; short voice samples from rhasspy.github.io when the user
  presses "Try" in Settings; and a PDF the user asks to read, from its own site (optional host
  permission, asked per site).
- Permissions: content script on all pages (reads the page's text and shows the player there);
  storage (settings); contextMenus ("Read aloud" menu items); activeTab (the popup checks whether the
  current tab is a PDF); optional host permissions, asked per site only when the user opens a PDF from
  that site in the viewer. The Firefox build has no "offscreen" permission (Chromium only).
- Data: declared "none" (data_collection_permissions). Page text is turned into speech inside the
  browser and never sent anywhere. Settings stay in browser storage; Export saves a local file only.
- Privacy: https://jca374.github.io/read-aloud/ (section "Privacy").
- Source: https://github.com/JCA374/read-aloud (GPL-3.0). Build: ./build.sh (makes
  dist/neural-voices-<version>-firefox.zip from extension/, adding LICENSE and notices; no
  transpiling or bundling).

How to test:
1. Open any article (e.g. a Wikipedia page). Click the toolbar button, then "Read page". The first
   time, the English voice downloads (about 63 MB, a few seconds), then reading starts with the
   current sentence and word highlighted. Alt+Shift+R pauses, Alt+Shift+X stops.
2. Select some text: a speaker button appears next to it; click it to hear the selection.
3. Open a PDF on the web (e.g. https://arxiv.org/pdf/1706.03762), click the toolbar button, then
   "Read this PDF". It opens in the add-on's own viewer (pdf.html) and is read aloud. The first time
   for a site, the viewer may ask for permission to fetch files from it.
4. Settings (the gear on the player, or the add-on's preferences): voices per language, ▶ Try
   samples, download and delete voices, reading options.
No account or credentials are needed.
```

## Get the signed file and install it

1. In the Developer Hub, open **My Add-ons → Neural Voices → Manage Status & Versions**.
2. Click version **0.4.0** and download the signed `.xpi` file. Save it in `dist/`.
3. In Firefox: remove the temporary copy first (`about:debugging` → **Remove** under Neural Voices).
   Then open `about:addons`, click the ⚙ menu, choose **Install Add-on From File…**, and pick the `.xpi`.
   Your voices may need to download once more, because Firefox treats it as a new install.
4. Firefox for Android: copy the `.xpi` to the phone. In Firefox, open **Settings → About Firefox** and tap
   the Firefox logo five times to turn on the debug menu. Back in **Settings**, choose
   **Install add-on from file** and pick the `.xpi`.
5. To share it: send the `.xpi` file. Friends install it the same way.

## Updates later

1. Raise `version` in `extension/manifest.json` (for example `0.4.0` → `0.4.1`). Each upload needs a
   higher number. Never change the `id` (`neural-voices@jca374.github.io`).
2. Run `./build.sh` (and make a new source zip as above).
3. In the Developer Hub: **My Add-ons → Neural Voices → Upload New Version**, then the same steps as above.
4. Install the new signed `.xpi` over the old one; settings stay.

Firefox won't fetch updates of an unlisted add-on by itself unless the add-on points to an update file
(an `update_url` in the manifest). Without one, you install each new version by hand as in step 4.
