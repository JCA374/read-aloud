// Quick check of the add-on in Firefox, in one session: settings and popup voice lists, reading English and
// Swedish (right voice, words highlighted), Stop, no errors. The player's buttons are covered by the
// Chromium smoke test (same content script). Exits 1 if any check fails.
import { browser, EXT, waitFor, check, finish } from "./lib.mjs";

const b = await browser(process.argv[2], { quiet: true });
// 1. Settings page and popup, starting from default settings
await b.goto(b.ext, `${EXT}/options.html`);
await b.ev(b.ext, `chrome.storage.local.clear().then(() => true)`);
await b.goto(b.ext, `${EXT}/options.html`);
const listed = await waitFor(() => b.ev(b.ext, `document.querySelectorAll('#mine .voice').length`), 5000);
check("settings page lists the voices", listed >= 5, `${listed} voices`);
const pickers = await waitFor(() => b.ev(b.ext, `document.querySelectorAll('#defaults select option').length`), 5000);
check("settings page voice pickers are filled", pickers >= 5, `${pickers} options`);
await b.ev(b.ext, `document.querySelector('#mine .voice .try').click()`);
const sample = await waitFor(() => b.ev(b.ext, `audio.currentTime > 0.2 && audio.src.includes('rhasspy.github.io')`), 15000, 200);
check("settings page: Try plays the online sample", !!sample, await b.ev(b.ext, `audio.src + ' ' + audio.currentTime + ' ' + (document.querySelector('#mine .error')?.textContent || '')`));
await b.ev(b.ext, `stopSample(), true`);
const keys = await waitFor(() => b.ev(b.ext, `document.querySelector('#shortcuts').textContent`), 5000);
check("settings page: shortcuts listed, with how to change them in Firefox", /Alt\+Shift\+R/.test(keys || "") && /Manage Extension Shortcuts/.test(keys || ""), keys);
await b.goto(b.ext, `${EXT}/popup.html`);
const popOpts = await waitFor(() => b.ev(b.ext, `document.querySelectorAll('#voices select option').length`), 5000);
check("popup voice pickers are filled", popOpts >= 3, `${popOpts} options`);

// 2. English, then Swedish (marked lang="en" on purpose)
for (const [page, voice] of [["long.html", "en_GB-cori"], ["sv.html", "sv_SE-alma"]]) {
  const tab = await b.open(page);
  const t0 = Date.now();
  await b.readPage(page);
  const first = await waitFor(() => b.word(tab), 30000, 50);
  check(`${page}: first word highlighted`, !!first, first ? `${((Date.now() - t0) / 1000).toFixed(1)} s` : "nothing within 30 s");
  const words = new Set();
  await waitFor(async () => { const w = await b.word(tab); if (w) words.add(w); return words.size >= 9; }, 15000);
  check(`${page}: highlight moves word by word`, words.size >= 9, `${words.size} different words`);
  const s = await b.status();
  check(`${page}: read with ${voice}`, (s.voice || "").includes(voice), s.voice);
  await b.stopAll();
  check(`${page}: Stop`, (await waitFor(async () => (await b.status()).state === "idle", 3000)) !== null);
  await b.close(tab);
}

finish(b.errors());
