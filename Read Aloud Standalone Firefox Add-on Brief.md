# Brief for Claude Code: Neural Voices, a Standalone Firefox Add-on

## Goal

Turn the existing extension (repo: JCA374/read-aloud, previously called Read Aloud) into Neural Voices, a fully standalone, publicly distributable Firefox add-on, with no local Python server required. Piper TTS runs in WebAssembly inside the extension. The current server-based Kokoro mode may stay later as an optional advanced mode.

**Name:** the add-on is called **Neural Voices**. Use this name everywhere: manifest name, store listing, settings page, README and notices. Do not use "Read Aloud" anywhere in the add-on's name or text, because that is the name of a different, well-known add-on and would cause confusion. The name is a working name and may change before any public release; check that it is not already taken on addons.mozilla.org and GitHub before publishing.

## Starting point

- Existing Manifest V3 extension in `extension/` (Firefox and Chromium).
- Content script splits text into sentences, requests audio in growing chunks (about 45, 100, 200 characters), buffers about 60 seconds ahead, and highlights words with the CSS Custom Highlight API.
- Local server `server/tts_server.py` currently serves Piper and Kokoro on 127.0.0.1:5123.
- Swedish is auto-detected and read with a chosen Swedish voice (Alma, Lisa, NST).

## Stage 0: Proof of concept (do this first)

1. **Top priority, do this first:** confirm that Firefox accepts the WebAssembly engine inside the add-on. Add `'wasm-unsafe-eval'` to `content_security_policy.extension_pages` in `manifest.json`, load the add-on as a temporary add-on in Firefox, and check that the WebAssembly module starts without CSP errors or extra permission prompts. All WASM and engine code must ship inside the add-on, with no remote code. Only voice model files (data) may be downloaded. If Firefox rejects it, stop and report before doing anything else.
2. Add a minimal extension page or background worker that loads a Piper WebAssembly runtime (candidates: piper-tts-web, or Sherpa-ONNX WASM build).
3. Load the Swedish voice `sv_SE-alma-medium` (ONNX plus JSON config).
4. Speak one Swedish sentence, for example "Hej, hur mår du idag?", and play it through the Web Audio API.
5. Report: time to first audio, memory use, and whether it works in both Firefox and Chromium.

**Stop here and confirm it works before continuing.** If Swedish fails in the browser runtime, report the exact error and consider alternatives before building further.

## Stage 1: Replace the server with an in-browser engine

- Add a TTS engine abstraction with the same interface the content script already uses, so the server engine and the WASM engine are interchangeable.
- Run inference in a Web Worker or offscreen document so pages never freeze.
- Add `'wasm-unsafe-eval'` to `content_security_policy.extension_pages` in the manifest (script-src `'self' 'wasm-unsafe-eval'`).
- Keep the existing chunking, 60-second look-ahead buffer, sentence cache, and highlighting. Highlighting stays estimated for Piper.
- Keep Swedish auto-detection.
- Rename everything visible to the new name, Neural Voices: manifest name and description, icons, popup and settings text, README. The repository itself can keep its name for now.
- Declare in the manifest that the add-on collects no data (Firefox's data collection permissions setting, set to none), and set the minimum Firefox version that supports it.
- Leave the owner's current server-based version working. Do the new work on a separate branch so the existing setup is never broken while the new engine is built.

## Stage 2: Voice management

- Download voice models on first use, with a visible progress indicator.
- Cache models in IndexedDB or the Cache API so they download once.
- Verify downloads (checksum or size check) and handle failures and retries.
- Let the user pick, download, and delete voices from a simple settings page.

  Since other people will use this add-on, build a proper settings page, not just a voice picker: add and remove voices, choose a default voice per language, and adjust speed, volume and highlight style. Show each voice's size and licence credit, and remember the user's choices between sessions. In particular, reopen with the last voice and the last speed the user used, so they never have to set them again. Let users hide or remove voices so the voice list in the popup shows only their own two or three favourites, not hundreds of options. The full catalogue stays available in settings for adding more later. Keep it simple and sensible by default, so it works without opening settings.
- Decide the model source: Hugging Face (rhasspy/piper-voices) directly, or self-hosted mirror. Document the choice.

## Stage 3: Quality and performance

- Test on a modest laptop CPU. Target: faster than real time.
- Check memory growth over long pages and long sessions.
- Make sure Escape, stop, pause, skip and speed controls all still work.
- Handle very long pages and pages in mixed languages.

  Speed changes must keep the voice natural. Changing speed should not raise or lower the pitch. Prefer adjusting the speech rate in the model itself (Piper's length scale) over simply playing the audio faster, and compare both by ear at slow, normal and fast settings. Another popular add-on that offers Piper voices is reported to have this pitch problem, so getting it right is a visible advantage.

  No leftover tabs or heavy background use. The engine must run inside the add-on itself, with no pinned background tabs and no separate companion add-on. Check that nothing stays open or keeps using memory and CPU after reading stops, after closing the browser, and after a browser restart. Free the engine when idle and reload it quickly when needed.

## Rollout plan: private first, public later

The owner will build this for personal use first and decide on a public release only after using it for a few weeks. Do not push toward public release; the owner decides when.

1. **Personal use.** Complete Stage 0 and Stage 1, then use it daily. The goal is a reader that works the way the owner likes, including Swedish.
2. **Friends.** If it feels fast and clean, share it privately with a few people (see below).
3. **Public release.** Only if it stays clean and fast in real use, do the licence audit and Stage 4, then submit it as a public listing.

**Cost.** Nothing. Signing and publishing add-ons on Mozilla's add-ons site (AMO) is free, and there is no developer fee for Firefox. A Chrome release would need a small one-off fee, but that is optional and not part of this plan.

**Sharing privately.** Mozilla calls this self-distribution, or an unlisted add-on. Create a free AMO developer account, submit the add-on and choose the option that it will not be listed publicly. Mozilla runs automatic checks and returns a signed file, which can be sent to friends and installed by opening it in Firefox. Signing is required because regular Firefox refuses unsigned add-ons. An unlisted add-on cannot be found or installed from the public store. The same add-on can later be submitted again as a public listing.

**Licence note.** Even private sharing is distribution, so the GPL-3.0 and attribution rules in the Licensing section apply from the first copy given to a friend. Include the LICENSE and THIRD-PARTY-NOTICES files in the add-on from the start.

### Beta testing with friends

The owner collects feedback separately. This part covers only how to build, share and install the beta. Do not build any feedback or reporting feature into the add-on.

1. **Give the add-on a fixed ID** in `manifest.json` (`browser_specific_settings.gecko.id`). Signing and automatic updates both need it, and it must never change between versions.
2. **Sign each beta as unlisted** on addons.mozilla.org, either through the developer hub or with the `web-ext sign` command. Signing can take up to 24 hours. Raise the version number for every new beta.
3. **Share the signed `.xpi` file** by email, a chat message, a download link or a GitHub release. If it is hosted on a web server, the server must send the file with the content type `application/x-xpinstall`.
4. **Install on desktop Firefox (Windows, Mac, Linux):** open the `.xpi` file in Firefox, or open the download link, then confirm the install prompt.
5. **Install on Firefox for Android:** save the `.xpi` file on the phone, then install it from the file in Firefox's add-on settings. Downloading it directly from a link does not install it on Android. Test this early, since mobile support needs its own check (screen size, memory, voice download size).
6. **Updates:** for a handful of friends, sending a new file each time is fine. For hands-off updates, add an `update_url` to the manifest that points to a small update file, and Firefox will install any higher version it finds there.
7. **Keep beta and public builds separate:** use a different update URL for the beta channel if a public listing is ever added.
8. **Cover the different setups** in a short test checklist: Windows, Mac and Linux desktops, Android if wanted, an older and a newer Firefox version, and a slow computer. Also test with the old Read Aloud add-on and the owner's previous version installed at the same time, to make sure shortcuts, right-click menus and background activity do not clash. Record the minimum Firefox version in the manifest (`strict_min_version`).

## Stage 4: Packaging and store release

- Update `build.sh` to produce a clean zip with no dev files.
- Write a privacy policy stating clearly that text never leaves the device and the only network request is the one-time voice model download.
- Minimise permissions and write a justification for each one.
- Add a LICENSE file, plus a THIRD-PARTY-NOTICES file crediting Piper, espeak-ng, ONNX Runtime and each voice model with its licence.
- Prepare store listing text, screenshots and an icon.
- Submit to addons.mozilla.org. Expect review to take days. Be ready to explain the WebAssembly and model download.
- Optionally publish to the Chrome Web Store from the same codebase.

## Licensing and compliance checklist

This is a must-do before any public release. The owner is a hobbyist publishing for free: no payment to anyone is expected, but each component's licence conditions must be met. This is engineering due diligence, not legal advice; flag anything unclear for the owner to check with a qualified person.

- **No fees.** All components below are free and open source. Obligations are attribution and, for GPL code, source availability.
- **espeak-ng is GPL-3.0 (copyleft).** Piper uses it for phonemising. If the add-on distributes espeak-ng (compiled into the WASM or bundled next to it), the combined work must be offered under GPL-3.0 or a compatible licence, with source available. Distribution triggers this; running it privately does not.
- **Default plan: license the whole add-on GPL-3.0** and keep the source public (the repo is already public). Add a LICENSE file with the GPL-3.0 text and link the source repository in the store listing.
- **Piper:** the original rhasspy/piper repository has been archived and development moved. Confirm which repository or fork the chosen WASM build comes from, and record its exact licence and version.
- **WASM build:** inspect how the chosen library (for example piper-tts-web or a Sherpa-ONNX build) packages espeak-ng and its data files. Record the licence of every file that ships in the add-on.
- **ONNX Runtime:** MIT. Keep its copyright notice.
- **Voices are data with their own licences.** Alma (sv\_SE-alma-medium) is CC BY 4.0: credit the author, link the licence, and state any changes. NST is trained on a CC BY dataset: confirm the exact terms from the model card. Check every English voice offered in the same way.
- **Do not bundle voices** unless their licence clearly allows redistribution. Downloading from the official source at first use avoids this but still requires attribution inside the add-on.
- **Kokoro (Apache 2.0)** only matters if added later. Record its licence and its voice licences then.
- **Trademarks:** do not use Mozilla, Firefox, NaturalReader or other brand names in a way that suggests endorsement. The README already says "NaturalReader-style"; consider rewording it for the store listing.

### Licence audit task (do before Stage 4)

1. List every third-party file that will ship in the add-on: JavaScript, WASM modules, espeak-ng data, fonts, icons.
2. For each, record: name, version, source URL, licence, and what the licence requires.
3. List every voice model offered, with its source URL, licence, author and required credit line.
4. Decide the add-on's own licence (default GPL-3.0) and confirm it is compatible with everything in the list.
5. Report any component whose licence is unclear or incompatible, and stop for the owner's decision.

### THIRD-PARTY-NOTICES file

Generate a `THIRD-PARTY-NOTICES` file in the repo and ship it inside the add-on. For each component include its name, author, licence name, link to the licence text, and link to its source. Show the same credits on the add-on's settings or About page so users can see them. Update the file whenever a dependency or voice changes.

## Optional extras

These are nice to have, not required. Add one only if it is small and simple and does not complicate the core design. If an item looks big or risky, skip it and tell the owner instead of building it.

- **Keyboard shortcut and right-click menu:** start reading the selected text without opening the popup.
- **Playback controls:** play, pause and skip sentence, plus clicking a sentence on the page to start reading from there.
- **First-run welcome:** a short message explaining that the first voice downloads once (about 60 MB for Alma) and that this only happens the first time.
- **Fallback to built-in browser voices:** use the browser's own speech synthesis while the first voice is downloading or if the download fails, so the add-on always works. This one is the highest value of the group.

## Security checklist

- Request the minimum host permissions. Avoid `<all_urls>` if a narrower approach works.
- Never inject page-supplied text as HTML. Use text nodes only.
- If the optional local server mode is kept: bind to 127.0.0.1 only, validate the `Origin` header or require a token, and reject requests from ordinary web pages.
- Pin and verify downloaded model files. Do not load code from remote sources; all JavaScript and WASM must ship inside the add-on (Mozilla requires this).
- Keep dependencies updated and list them.
- No analytics or telemetry.

## Definition of done

- Installs from the Firefox store with one click and speaks English and Swedish with no other software.
- Works offline after the first voice download.
- No console errors, no page freezes, memory stays stable on long articles.
- Licences and attributions are complete and the privacy policy is published.

## Instructions to Claude Code

Work one stage at a time. After each stage, summarise what changed, what you tested, and what is still uncertain. Do not start the next stage until the current one is confirmed working. Ask before making architectural changes.
