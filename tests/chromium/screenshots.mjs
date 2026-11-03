// Store screenshots (1280×800) into docs/media/: reading a Wikipedia page with the highlight and the
// player, Settings, the pronunciation section, a PDF. Not a test; needs the internet and Cori downloaded.
//   KEEP=1 tests/chromium.sh tests/chromium/screenshots.mjs
import { browser, waitFor, sleep, hl, player, SITE } from "./lib.mjs";
import fs from "fs";

const out = new URL("../../docs/media/", import.meta.url).pathname;
const b = await browser();
await b.sw.ev(`chrome.storage.local.clear()`);
const shoot = async (page, name) => {
  await page.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
  await sleep(400);
  const { data } = (await page.send("Page.captureScreenshot", { format: "png" })).result;
  fs.writeFileSync(out + name, Buffer.from(data, "base64"));
  console.log("saved docs/media/" + name);
};

// 1. Reading a real page: sentence shaded, word marked, the player at the bottom
const wiki = await b.open("https://en.wikipedia.org/wiki/Lighthouse", "wiki");
await wiki.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
await wiki.send("Page.bringToFront");
await waitFor(() => b.sw.ev(`chrome.tabs.query({active: true}).then(ts => chrome.tabs.sendMessage(ts[0].id, {cmd: 'status'})).then(() => true, () => false)`), 15000);
// read the article's first paragraph (selected), so the shot shows body text being read
await wiki.ev(`(() => { const p = [...document.querySelectorAll('#mw-content-text p')].find(p => p.textContent.length > 200);
  p.scrollIntoView({ block: 'center' }); const r = document.createRange(); r.selectNodeContents(p); getSelection().removeAllRanges(); getSelection().addRange(r); })()`);
await b.sw.ev(`chrome.tabs.query({active: true}).then(ts => chrome.tabs.sendMessage(ts[0].id, {cmd: 'readSelection'}))`);
if (!(await waitFor(() => hl(wiki, "word"), 30000, 50))) throw new Error("reading didn't start on Wikipedia");
await sleep(2500);
await (await player(wiki)).click("play"); // pause, so the highlight holds still
await sleep(300);
await shoot(wiki, "store-1-reading.png");
await b.stopAll();

// 2. Settings: your voices and one voice per language
const opt = await b.open(b.extUrl("options.html"), "options");
await waitFor(() => opt.ev(`document.querySelectorAll('#mine .voice').length >= 5`), 8000);
await opt.ev(`[...document.querySelectorAll('h2')].find(h => /Your voices/.test(h.textContent)).scrollIntoView({ block: 'start' }); scrollBy(0, -40)`);
await shoot(opt, "store-2-voices.png");

// 3. Your pronunciations, with an example being added
await opt.ev(`chrome.storage.local.set({ dictionary: [{ word: 'Nguyen', say: 'win', lang: '' }, { word: 'Göteborg', say: 'jöteborj', lang: 'sv' }] })`);
await sleep(300);
await opt.ev(`$('dictWord').value = 'Skerry'; $('dictSay').value = 'sherry'; $('pronunciation').scrollIntoView({ block: 'start' }); scrollBy(0, -16)`);
await shoot(opt, "store-3-pronunciation.png");
await opt.ev(`chrome.storage.local.remove('dictionary')`);

// 4. A PDF in the add-on's viewer, being read
await b.sw.ev(`chrome.tabs.create({ url: ${JSON.stringify(b.extUrl(`pdf.html?file=${encodeURIComponent(`${SITE}/doc.pdf`)}`))} }).then(() => true)`);
const pdf = await b.connect(await waitFor(async () => (await (await fetch("http://127.0.0.1:9333/json/list")).json()).find((t) => t.type === "page" && t.url.startsWith(b.extUrl("pdf.html"))), 10000), "pdf");
await pdf.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
await waitFor(() => pdf.ev(`!document.querySelector('#read').disabled`), 15000);
await pdf.ev(`document.querySelector('#read').click()`);
await waitFor(() => hl(pdf, "word"), 30000, 50);
await sleep(3000);
await (await player(pdf)).click("play");
await sleep(300);
await shoot(pdf, "store-4-pdf.png");
await b.stopAll();
process.exit(0);
