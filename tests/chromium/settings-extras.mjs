// Settings page extras: the ⚙ button in the player, ▶ Try (online sample, and the voice itself as fallback),
// search and filters, voice order, storage, reset / export / import, and the reading options
// (skip code blocks, auto-scroll). Downloads Cori first if the profile doesn't have it.
import { browser, waitFor, check, finish, player, sleep, CORI } from "./lib.mjs";

const b = await browser();
await b.sw.ev(`chrome.storage.local.clear()`);
const list = async () => (await (await fetch("http://127.0.0.1:9333/json/list")).json()).filter((t) => t.type === "page");

// 1. The ⚙ button in the player opens Settings
const page = await b.open("code.html", "code");
await b.readPage();
const p = await waitFor(() => player(page), 5000);
await p.click("settings");
const optTarget = await waitFor(async () => (await list()).find((t) => t.url === b.extUrl("options.html")), 5000);
check("⚙ in the player opens Settings", !!optTarget);
await b.stopAll();
const opt = await b.connect(optTarget, "options");
await waitFor(() => opt.ev(`document.querySelectorAll('#mine .voice').length`), 5000);
const had = await opt.ev(`downloaded.has(${JSON.stringify(CORI)})`);
if (!had) await opt.ev(`download(${JSON.stringify(CORI)})`);
check("Cori is downloaded", await opt.ev(`downloaded.has(${JSON.stringify(CORI)})`), had ? "already" : "downloaded now");

// 2. ▶ Try: the online sample plays; with the sample unreachable, a downloaded voice reads here instead
const cori = `[...document.querySelectorAll('#mine .voice')].find(r => /Cori/.test(r.textContent))`;
await opt.ev(`${cori}.querySelector('.try').click()`);
const played = await waitFor(() => opt.ev(`audio.currentTime > 0.2 && audio.src.includes('rhasspy.github.io') && audio.src`), 15000, 200);
check("Try plays the online sample", !!played, played || (await opt.ev(`audio.src + ' ' + audio.currentTime`)));
check("the button turns into Stop while it plays", /Stop/.test(await opt.ev(`${cori}.querySelector('.try').textContent`)));
await opt.ev(`${cori}.querySelector('.try').click()`);
check("Stop stops it", await opt.ev(`audio.paused`));
await opt.ev(`(() => { const real = audio.play; audio.play = function () { audio.play = real; return Promise.reject(new Error('blocked in test')); }; })()`);
await opt.ev(`${cori}.querySelector('.try').click()`);
const local = await waitFor(() => opt.ev(`audio.src.startsWith('blob:') && audio.currentTime > 0.2`), 30000, 200);
check("no online sample: the downloaded voice reads one here", !!local, await opt.ev(`audio.src.slice(0, 30)`));
await opt.ev(`stopSample(); render()`);

// 3. Search and filters
await opt.ev(`(() => { const s = document.querySelector('#search'); s.value = 'thor'; s.dispatchEvent(new Event('input')); })()`);
const found = await opt.ev(`[...document.querySelectorAll('#add .voice b')].map(b => b.textContent).join(', ')`);
check("search 'thor' finds Thorsten in all languages", /Thorsten/.test(found) && (await opt.ev(`document.querySelector('#addLang').value`)) === "all", found);
await opt.ev(`(() => { const s = document.querySelector('#search'); s.value = ''; s.dispatchEvent(new Event('input')); })()`);
check("no licence filter", !(await opt.ev(`document.querySelector('#freeOnly')`)));
await opt.ev(`(() => { const s = document.querySelector('#addLang'); s.value = 'all'; s.dispatchEvent(new Event('change')); })()`);
const capped = await opt.ev(`[document.querySelectorAll('#add .voice').length, document.querySelector('#addCount').textContent, document.querySelector('#showAll').hidden]`);
await opt.ev(`document.querySelector('#showAll').click()`);
const all = await opt.ev(`document.querySelectorAll('#add .voice').length`);
check("all languages: 50 shown, then Show all", capped[0] === 50 && !capped[2] && all > 150, `${capped} -> ${all}`);
await opt.ev(`document.querySelector('#downloadedOnly').click()`);
const dl = await opt.ev(`[...document.querySelectorAll('#add .voice')].every(r => /Downloaded/.test(r.textContent))`);
check("only downloaded: every row is downloaded", dl);
await opt.ev(`document.querySelector('#downloadedOnly').click()`);

// 4. Voice order
const before = (await b.sw.ev(`chrome.storage.local.get('shown')`)).shown || (await opt.ev(`NV.DEFAULTS.shown`));
await opt.ev(`document.querySelectorAll('#mine .voice')[1].querySelector('.up').click()`);
const after = await waitFor(async () => (await b.sw.ev(`chrome.storage.local.get('shown')`)).shown, 3000);
check("↑ moves a voice up in your list", after && after[0] === before[1] && after[1] === before[0], JSON.stringify(after?.slice(0, 2)));

// 5. Storage, export, reset, import
const storage = await waitFor(() => opt.ev(`document.querySelector('#storage').textContent`), 3000);
check("storage shows the downloaded voices and their size", /Downloaded voices: \d+, \d+ MB/.test(storage || ""), storage);
await opt.ev(`save({ speed: 1.25, highlight: 'blue', pause: 0.5 })`);
const exported = await opt.ev(`JSON.stringify(cleanSettings(settings))`);
await opt.ev(`window.confirm = () => true; document.querySelector('#reset').click()`);
const reset = await waitFor(async () => { const s = await b.sw.ev(`chrome.storage.local.get(['speed', 'highlight'])`); return s.speed === 1 && s.highlight === "classic" && s; }, 3000);
check("Reset settings puts the defaults back", !!reset);
await opt.ev(`importSettings(new File([${JSON.stringify(JSON.stringify({ app: "Neural Voices", settings: JSON.parse(exported) }))}], 'x.json'))`);
const imported = await waitFor(async () => { const s = await b.sw.ev(`chrome.storage.local.get(['speed', 'highlight', 'pause', 'shown'])`); return s.speed === 1.25 && s.highlight === "blue" && s.pause === 0.5 && s; }, 3000);
check("Import gives back the exported settings", !!imported && JSON.stringify(imported.shown) === JSON.stringify(after), JSON.stringify(imported));
const cleaned = await opt.ev(`JSON.stringify(cleanSettings({ speed: 'fast', voice: 'piper:nope', shown: ['piper:nope', ${JSON.stringify(CORI)}], extra: 1, highlight: 'pink' }))`);
check("Import drops unknown voices, keys and wrong types", cleaned === JSON.stringify({ shown: [CORI] }), cleaned);
await b.sw.ev(`chrome.storage.local.set({ pause: 0, highlight: 'classic', speed: 1 })`);

// 6. Reading options: skip code blocks; pause; auto-scroll
const total = async () => { await b.readPage(); const x = await player(page); const s = await waitFor(async () => { const t = await x.status(); return /^\d+ \/ \d+/.test(t) && t; }, 30000, 100); await b.stopAll(); return parseInt(s?.split("/ ")[1]); };
await page.send("Page.bringToFront"); // the ⚙ button left Settings in front, and "read page" reads the tab in front
await sleep(300);
const skipped = await total();
await b.sw.ev(`chrome.storage.local.set({ skipCode: false })`);
await sleep(200);
const withCode = await total();
check("code block skipped by default, read when the setting is off", skipped > 0 && withCode > skipped, `${skipped} pieces vs ${withCode}`);
await b.sw.ev(`chrome.storage.local.set({ skipCode: true })`);

const long = await b.open("long.html", "long");
const scrolled = async (autoScroll) => { // read, skip ahead 14 pieces, and see whether the page moved
  await b.sw.ev(`chrome.storage.local.set({ autoScroll: ${autoScroll} })`);
  await long.ev(`scrollTo(0, 0)`);
  await b.readPage();
  const lp = await waitFor(() => player(long), 5000);
  await waitFor(async () => /^\d+ \//.test(await lp.status()), 30000, 100);
  for (let i = 0; i < 14; i++) { await lp.click("next"); await sleep(200); }
  const at = await waitFor(async () => { const t = await lp.status(); return /^\d+ \//.test(t) && t; }, 15000, 100);
  await sleep(1500);
  const y = await long.ev(`scrollY`);
  await b.stopAll();
  return [y, at];
};
const [yOn, atOn] = await scrolled(true);
const [yOff, atOff] = await scrolled(false);
check("auto-scroll: the page follows when on, stays put when off", yOn > 0 && yOff === 0 && parseInt(atOff) > 10, `on: scrollY ${yOn} at ${atOn}; off: scrollY ${yOff} at ${atOff}`);
await b.sw.ev(`chrome.storage.local.clear()`);
finish(b.errors);
