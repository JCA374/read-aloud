// Quick check of the whole add-on in one Chromium session: settings and popup voice lists, reading English
// and Swedish, the player (icons, voice list, switching voice, controls), a mixed-language page, no errors.
// Waits for events instead of fixed times. Prints one line per check; exits 1 if any check fails.
import { browser, waitFor, sleep, check, finish, hl, player, CORI, NORTHERN, ALMA } from "./lib.mjs";

const b = await browser({ quiet: true });
await b.sw.ev(`chrome.storage.local.clear()`);

// 1. Settings page and popup list the starter voices
const opt = await b.open(b.extUrl("options.html"), "options");
const listed = await waitFor(() => opt.ev(`document.querySelectorAll('#mine .voice').length`), 5000);
check("settings page lists the voices", listed >= 6, `${listed} voices`);
const defaults = await waitFor(() => opt.ev(`document.querySelectorAll('#defaults select option').length`), 5000);
check("settings page voice pickers are filled", defaults >= 6, `${defaults} options`);
const pop = await b.open(b.extUrl("popup.html"), "popup");
const popOpts = await waitFor(() => pop.ev(`document.querySelectorAll('#voices select option').length`), 5000);
check("popup voice pickers are filled", popOpts >= 3, `${popOpts} options`);

// 2. English page: reading starts, words get highlighted
const page = await b.open("long.html");
let t0 = Date.now();
await b.readPage();
const first = await waitFor(() => hl(page, "word"), 30000, 50);
check("English page: first word highlighted", !!first, first ? `${((Date.now() - t0) / 1000).toFixed(1)} s` : "nothing within 30 s");
const words = new Set();
await waitFor(async () => { const w = await hl(page, "word"); if (w) words.add(w); return words.size >= 9; }, 15000, 100);
check("English page: highlight moves word by word", words.size >= 9, `${words.size} different words`);

// 3. The player: icons, voice list, controls
const p = await player(page);
check("player has its 7 icons", p.count("svg") === 7, `${p.count("svg")} icons`);
const opts = await p.voiceOptions();
check("player voice list is filled", opts.length >= 6, opts.join(" / "));
check("player shows Cori for English", (await p.voice()) === CORI, await p.voice());
await p.click("play");
check("pause", (await waitFor(async () => (await b.state()) === "paused", 3000)) !== null);
const held = await hl(page, "word"); await sleep(1000);
check("pause holds the word highlight", (await hl(page, "word")) === held, JSON.stringify(held));
await p.click("play");
check("resume", (await waitFor(async () => (await b.state()) === "playing", 5000)) !== null);
const pos = async () => +((await p.status()).match(/^(\d+) \//) || [])[1];
const n0 = await waitFor(pos, 5000);
await p.click("next");
const n1 = await waitFor(async () => { const n = await pos(); return n > n0 && n; }, 5000);
check("next sentence", n1 === n0 + 1, `${n0} -> ${n1}`);
await p.click("prev");
const n2 = await waitFor(async () => { const n = await pos(); return n < n1 && n; }, 5000);
check("previous sentence", n2 === n0, `${n1} -> ${n2}`);

// 4. Switch voice while reading: the sentence restarts in the new voice and the choice is saved
let since = Date.now();
await p.setVoice(NORTHERN);
const restart = await b.waitLog(/new voice .*northern_english.*restarting sentence/, since, 5000);
check("voice switch restarts the sentence", !!restart, restart ? `${((restart.at - since) / 1000).toFixed(1)} s` : "no restart logged");
check("voice switch is saved", (await b.sw.ev(`chrome.storage.local.get('voice')`)).voice === NORTHERN);
// the add-on logs "first sound" only on Stop, so watch the highlight move on in the new voice instead
since = Date.now();
const w0 = await hl(page, "word");
const moved = await waitFor(async () => (await b.state()) === "playing" && (await hl(page, "word")) !== w0, 30000);
check("new voice speaks", !!moved, moved ? `${((Date.now() - since) / 1000).toFixed(1)} s` : "highlight didn't move within 30 s");
await p.setVoice(CORI);

// 5. Speed, then Stop clears the highlight
await b.sw.ev(`chrome.storage.local.set({speed: 1.5})`);
await sleep(300);
check("speed change keeps reading", (await b.state()) !== "idle", await p.status());
await b.sw.ev(`chrome.storage.local.set({speed: 1})`);
await p.click("stop");
check("Stop", (await waitFor(async () => (await b.state()) === "idle", 3000)) !== null);
check("Stop clears the highlight", (await waitFor(async () => !(await hl(page, "sentence")), 2000)) !== null);

// 6. Swedish page (marked lang="en" on purpose): detected as Swedish, read with Alma
const sv = await b.open("sv.html");
t0 = Date.now();
await b.readPage();
const svWord = await waitFor(() => hl(sv, "word"), 30000, 50);
check("Swedish page: first word highlighted", !!svWord, svWord ? `${((Date.now() - t0) / 1000).toFixed(1)} s` : "nothing within 30 s");
check("Swedish page read with Alma", (await (await player(sv)).voice()) === ALMA);
await b.stopAll();

// 7. Mixed page: English and Swedish paragraphs get their own voice (skip ahead with Next)
const mixed = await b.open("mixed.html");
await b.readPage();
await waitFor(() => hl(mixed, "word"), 30000, 50);
const pm = await player(mixed);
const voices = new Set([await pm.voice()]);
for (let k = 0; k < 6 && voices.size < 2; k++) {
  await pm.click("next");
  await waitFor(async () => { voices.add(await pm.voice()); return voices.size >= 2; }, 3000);
}
check("mixed page switches between English and Swedish voices", voices.has(CORI) && voices.has(ALMA), [...voices].join(", "));
await b.stopAll();

finish(b.errors);
