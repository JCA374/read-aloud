# Testing by hand before a release

The automatic tests (`tests/run.sh all` and `tests/run.sh release`) check almost everything. These are the
things only a person can judge. It takes about 20 minutes. Do it in Firefox, in the window `tools/try.sh`
opens (your installed add-on isn't touched).

Tick each box. If something is wrong, write down what you did and what happened, and tell Claude.

## 1. First use, like a new user (5 min)

Start with an empty profile, so nothing is downloaded yet:

```bash
TRY_PROFILE=~/snap/firefox/common/nv-first-use tools/try.sh
```

- [ ] Click the add-on's icon in the toolbar. The popup opens and shows the voices.
- [ ] On the Wikipedia page that opens, click **Read page**. The player shows the download progress, then
      reading starts within about half a minute.
- [ ] Words are highlighted as they are read, and the highlight keeps up with the voice.
- [ ] Settings (⚙ in the player) opens and makes sense without reading any instructions.

Close the window. Delete the folder afterwards if you like: `rm -rf ~/snap/firefox/common/nv-first-use`.

## 2. Listening (5 min)

Use `tools/try.sh` (your usual test profile).

- [ ] Read a page with 3 different voices (switch in the player's voice list). Each sounds natural, with no
      clicks, cut-off words or long silences.
- [ ] Speed 1.5× still sounds clear and not high-pitched. 0.75× sounds natural.
- [ ] The volume slider in the player changes the loudness. The speaker button mutes and unmutes.
- [ ] A Swedish page (for example <https://sv.wikipedia.org/wiki/Fyr>) is read with a Swedish voice.
- [ ] Add a voice for another language in Settings (for example German). A page in that language (for
      example <https://de.wikipedia.org/wiki/Leuchtturm>) is read with it.
- [ ] Settings → Reading → *Pause after each sentence*: set 1 s and hear the longer pause.

## 3. Keyboard and right-click (5 min)

- [ ] **Alt+Shift+R** starts reading; pressing it again pauses, and again resumes.
- [ ] **Alt+Shift+X** stops.
- [ ] **Escape** stops while reading.
- [ ] Select a few words, right-click → **Read aloud**: only those words are read.
- [ ] Right-click in the middle of the page → **Read aloud from here**: it starts there.
- [ ] Select a word, right-click → **Fix pronunciation of "…"**: Settings opens with the word filled in.
      Type how it should sound, press **▶ With fix**, then **Add**. Read the page: the voice uses your fix.
- [ ] Select text: the small speaker button appears next to it, and clicking it reads the selection.

## 4. PDFs (5 min)

- [ ] Open a real PDF of several pages in Firefox (for example a manual or a paper). In Firefox's own PDF
      viewer, press **Alt+Shift+R** or click the add-on's icon → *Read this PDF*. It opens in the add-on's
      viewer and starts reading.
- [ ] The first time for a website, Firefox asks to allow the add-on on that site. After **Allow**, the PDF
      loads.
- [ ] Paragraphs are read in the right order, also in a PDF with two columns.
- [ ] Right-click a link to a PDF → **Read PDF aloud** works.

## 5. Firefox for Android (optional, 10 min)

Only needed before the store offers the add-on for Android. One-time set-up:

1. On the phone: *Settings → About phone → Software information*, tap **Build number** 7 times. Then
   *Settings → Developer options* → turn on **USB debugging**.
2. In Firefox on the phone: *Settings → Remote debugging via USB* → on.
3. On the computer: `sudo apt install adb`. Connect the phone by USB and allow the prompt on the phone.
   `adb devices` should list it.

Then `tools/try.sh android` installs the development version in Firefox on the phone.

- [ ] Settings opens (⋮ menu → Add-ons → Neural Voices → Settings) and **Download** on a voice works.
- [ ] *Read page* from the add-on's menu reads a Wikipedia page, with the highlight.
- [ ] The player fits the screen and its buttons can be tapped.
- [ ] Selecting text shows the speaker button, and it reads the selection.

## 6. Done

- [ ] Nothing above felt broken or confusing.

When all boxes are ticked, tell Claude "manual test passed" (or what failed). Claude records it in
`tests/RESULTS.md` and `STATUS.md`.
