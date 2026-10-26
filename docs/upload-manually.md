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
   <https://github.com/JCA374/read-aloud>.)
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
- Third-party libraries are included unchanged from npm: onnxruntime-web 1.30.0,
  @diffusionstudio/piper-wasm 1.0.0, pdfjs-dist 6.4.299. Versions, sources and licences are in
  THIRD-PARTY-NOTICES and extension/engine/vendor/README.md.
- Lint warnings: UNSUPPORTED_API (chrome.offscreen in background.js) is the Chromium-only path and
  doesn't run in Firefox. UNSAFE_VAR_ASSIGNMENT is inside the minified libraries (ort.wasm.min.js,
  pdf.min.mjs, pdf.worker.min.mjs), not in the add-on's own code.
- Network use: voice models are downloaded from huggingface.co/rhasspy/piper-voices (pinned revision,
  size-checked) the first time a voice is used; short voice samples from rhasspy.github.io when the user
  presses "Try" in Settings; and a PDF the user asks to read, from its own site (optional host
  permission, asked per site).
- Source: https://github.com/JCA374/read-aloud (GPL-3.0). Build: ./build.sh
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
