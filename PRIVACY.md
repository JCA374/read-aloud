# Privacy policy: Neural Voices

Neural Voices reads web pages and PDFs aloud. The speech is made **inside your browser**. There is no
Neural Voices server, no account and no analytics.

## What stays on your computer

- **The text you listen to.** It is turned into speech inside the browser and is never sent anywhere. Its
  language is recognised by the browser's built-in language detector, which also runs on your computer.
- **Your settings** (voices, speed, highlight style, and so on), kept in the browser's add-on storage.
  *Export* saves them to a file on your computer, and only when you ask.
- **Downloaded voices**, kept in the browser's cache for the add-on. Delete them in Settings
  (*Delete all downloads*), or by removing the add-on.

## When the add-on goes online

1. **Downloading a voice**, the first time you use it: from Piper's voice collection on Hugging Face
   (`huggingface.co/rhasspy/piper-voices`), at a fixed version. Only the voice files are requested; no
   text or personal data is sent.
2. **▶ Try in Settings**: plays a short sample of a voice from `rhasspy.github.io/piper-samples`.
3. **Opening a PDF** you ask it to read: the PDF is fetched from the site it's on. The add-on asks for
   permission for each site the first time.

These sites see an ordinary download request from your browser (your IP address and the browser's usual
headers), as with any web page. Neural Voices adds nothing to these requests and doesn't track you.

## Permissions

- **Access to the pages you visit**: to read their text and show the player. The text stays in the browser.
- **Storage**: to keep your settings.
- **Context menus**: the *Read aloud* items when you right-click.
- **Active tab**: lets the popup see whether the current tab is a PDF.
- **Optional access to a site**: asked for only when you open a PDF from that site in the viewer.
- **Offscreen** (Chrome, Edge and Brave only): runs the speech engine in a hidden page, because those
  browsers can't start it from the background.

## Contact

Questions or problems: open an issue at <https://github.com/JCA374/read-aloud/issues>.

Last updated: 2 November 2026.
