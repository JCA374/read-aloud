// PDFs: the add-on's viewer (pdf.html) shows a PDF, groups its text into paragraphs (joining a word split
// by a hyphen), reads it with highlights, takes commands like a web page (popup, shortcuts), zooms, and a
// PDF opened in Chromium's own viewer moves to ours when you press Read.
import { browser, waitFor, check, finish, hl, SITE } from "./lib.mjs";

const b = await browser();
const status = () => b.sw.ev(`chrome.tabs.query({}).then(ts => Promise.any(ts.map(t => NV.sendToTab(t.id, {cmd: 'status'})))).catch(() => null)`);
const toAll = (cmd) => b.sw.ev(`chrome.tabs.query({}).then(ts => Promise.allSettled(ts.map(t => NV.sendToTab(t.id, {cmd: '${cmd}'})))).then(() => true)`);
const paras = (page) => page.ev(`[...document.querySelectorAll('[data-nv-block]')].map(p => p.textContent)`);

// 1. The viewer opens a PDF from a web address
const url = b.extUrl(`pdf.html?file=${encodeURIComponent(`${SITE}/doc.pdf`)}`);
await b.sw.ev(`chrome.tabs.create({ url: ${JSON.stringify(url)} }).then(() => true)`);
const vt = await waitFor(async () => (await (await fetch("http://127.0.0.1:9333/json/list")).json()).find((t) => t.type === "page" && t.url.startsWith(b.extUrl("pdf.html"))), 10000);
const v = await b.connect(vt, "viewer");
const ready = await waitFor(async () => (await v.ev(`document.querySelectorAll('.text span').length`)) || (await v.ev(`!document.querySelector('#notice').hidden && /Allow|Couldn/.test(document.querySelector('#notice').textContent) && document.querySelector('#notice').textContent`)), 15000);
check("viewer opens the PDF and lays out its text", typeof ready === "number" && ready > 5, String(ready));
await waitFor(() => v.ev(`!document.querySelector('#read').disabled`), 10000); // every page's text is ready
const ps = (await paras(v)) || [];
check("text grouped into paragraphs: title, two paragraphs, page 2", ps.length === 4 && /^The Lighthouse Keeper$/.test(ps[0].trim()), JSON.stringify(ps.map((p) => p.slice(0, 40))));
check("lines joined with spaces, a hyphen at a line end joins the word", /the lighthouse went dark/.test(ps[1] || "") && /village knew how to light/.test(ps[1] || ""), ps[1]);
check("title and page count shown", /Lighthouse Keeper/.test(await v.ev(`document.title`)) && /2 pages|Page 1 of 2/.test(await v.ev(`document.querySelector('#pageInfo').textContent`)), await v.ev(`document.title + ' | ' + document.querySelector('#pageInfo').textContent`));
const drawn = await waitFor(() => v.ev(`document.querySelectorAll('.page canvas').length`), 5000);
check("pages are drawn", drawn >= 1, `${drawn} canvases`);

// 2. Read it: words highlighted inside the PDF's text
await v.ev(`document.querySelector('#read').click()`);
const word = await waitFor(() => hl(v, "word"), 30000, 100);
check("Read button reads the PDF, words highlighted", !!word, JSON.stringify(word));
const words = new Set();
await waitFor(async () => { const w = await hl(v, "word"); if (w) words.add(w); return words.size >= 6; }, 15000);
check("highlight moves through the PDF text", words.size >= 6, [...words].join(" "));
const st = await status();
check("popup and shortcuts reach the viewer (status by tab message)", st?.state === "playing", JSON.stringify(st));
await toAll("toggle");
check("pause by command", (await waitFor(async () => (await status())?.state === "paused", 3000)) !== null);
await toAll("stop");
check("stop by command", (await waitFor(async () => (await status())?.state === "idle", 3000)) !== null);

// 3. Zoom keeps the same text
await v.ev(`document.querySelector('#zoomIn').click()`);
await waitFor(async () => (await v.ev(`parseFloat(document.querySelector('.page').style.width)`)) > 0, 3000);
const after = await waitFor(async () => { const p = await paras(v); return p?.length === 4 && p; }, 5000);
check("zoom: pages bigger, same paragraphs", JSON.stringify(after) === JSON.stringify(ps), JSON.stringify(after?.map((p) => p.slice(0, 20))));

// 4. A PDF in Chromium's own viewer: Read opens it in ours and starts reading
await b.open("doc.pdf", "pdf-tab");
// (the add-on sees a tab's address only after a click, so the PDF tab is found as the active one)
const sent = await b.sw.ev(`chrome.tabs.query({active: true}).then(([t]) => chrome.tabs.sendMessage(t.id, {cmd: 'readPage'})).then(() => 'content script answered', e => 'no content script: ' + e.message)`);
const moved = await waitFor(async () => (await (await fetch("http://127.0.0.1:9333/json/list")).json()).filter((t) => t.url.includes("pdf.html?file=") && t.url.includes("read=1")).length, 8000);
check("Read on Chromium's PDF viewer opens the add-on's viewer", !!moved, sent);
if (moved) {
  const t = (await (await fetch("http://127.0.0.1:9333/json/list")).json()).find((t) => t.url.includes("read=1"));
  const v2 = await b.connect(t, "viewer2");
  check("...and starts reading", !!(await waitFor(() => hl(v2, "word"), 30000, 100)));
}
await toAll("stop");
finish(b.errors);
