// Settings logic the smoke test doesn't cover: with no Swedish voice in your list the page says so,
// detection off shows one picker, and changing the English voice from the popup while reading
// restarts the sentence in that voice.
import { browser, waitFor, check, finish, player, CORI, NORTHERN } from "./lib.mjs";

const b = await browser();
await b.sw.ev(`chrome.storage.local.clear()`);
const opt = await b.open(b.extUrl("options.html"), "options");
await waitFor(() => opt.ev(`document.querySelectorAll('#mine .voice').length >= 5`), 5000);
const pickers = () => opt.ev(`[...document.querySelectorAll('#defaults label')].map(l => l.firstChild.textContent).join(' | ')`);
check("one picker per language", /English text \| Swedish text/.test(await pickers()), await pickers());

// remove the Swedish voices one by one (each click re-renders the list)
const removeSwedish = `(() => { const r = [...document.querySelectorAll('#mine .voice')].find(r => /svenska/.test(r.querySelector('b').textContent));
  if (!r) return true; [...r.querySelectorAll('button')].find(x => x.textContent === 'Remove').click(); return false; })()`;
await waitFor(() => opt.ev(removeSwedish), 5000, 300);
const note = await waitFor(() => opt.ev(`document.querySelector('#defaults .note')?.textContent`), 3000);
check("no Swedish voice: the page says Swedish uses the English voice", /Swedish text is read with Cori/.test(note || ""), note);
check("no Swedish voice: player and popup list only the rest", (await b.sw.ev(`chrome.storage.local.get('shown')`)).shown?.every((v) => !/sv_SE/.test(v)));
await b.sw.ev(`chrome.storage.local.remove('shown')`);
await opt.send("Page.reload");
await waitFor(() => opt.ev(`document.readyState === 'complete' && document.querySelectorAll('#mine .voice').length >= 5`), 5000);

await opt.ev(`document.querySelector('#autoDetect').click()`);
const one = await waitFor(async () => { const p = await pickers(); return /^Always read with$/.test(p) && p; }, 3000);
check("detection off: one picker", !!one, await pickers());
await opt.ev(`document.querySelector('#autoDetect').click()`);
await waitFor(async () => /Swedish text/.test(await pickers()), 3000);

// change the English voice from the popup while reading
const pop = await b.open(b.extUrl("popup.html"), "popup");
await waitFor(() => pop.ev(`document.querySelectorAll('#voices select option').length >= 3`), 5000);
const page = await b.open("long.html");
await b.readPage();
const p = await player(page);
await waitFor(async () => (await b.state()) === "playing", 30000);
const since = Date.now();
await pop.ev(`(() => { const s = document.querySelector('#voices select'); s.value = ${JSON.stringify(NORTHERN)}; s.dispatchEvent(new Event('change')); })()`);
const restart = await b.waitLog(/new voice .*northern_english.*restarting sentence/, since, 5000);
check("popup voice change restarts the sentence", !!restart, restart ? `${((restart.at - since) / 1000).toFixed(1)} s` : "no restart logged");
check("player shows the new voice", (await waitFor(async () => (await p.voice()) === NORTHERN, 3000)) !== null, await p.voice());
await pop.ev(`(() => { const s = document.querySelector('#voices select'); s.value = ${JSON.stringify(CORI)}; s.dispatchEvent(new Event('change')); })()`);
await b.stopAll();
finish(b.errors);
