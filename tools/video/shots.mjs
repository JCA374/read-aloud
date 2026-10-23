// Screenshots of the real add-on for the video (pages at 760x520, twice the resolution, so the text stays readable on a slide):
//   tests/chromium.sh tools/video/shots.mjs   -> tools/video/shots/{reading,mixed,settings}.png
import { writeFileSync } from "node:fs";
const here = new URL(".", import.meta.url).pathname;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const list = async () => (await (await fetch("http://127.0.0.1:9333/json")).json());
let targets;
for (let k = 0; k < 60; k++) { try { targets = await list(); if (targets.some((t) => t.type === "service_worker")) break; } catch {} await sleep(500); }
const extId = new URL(targets.find((t) => t.type === "service_worker").url).host;
function connect(t) {
  const ws = new WebSocket(t.webSocketDebuggerUrl); let id = 0; const pending = new Map();
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } };
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (e) => (await send("Runtime.evaluate", { expression: e, returnByValue: true, awaitPromise: true })).result?.result?.value;
  return new Promise((res) => (ws.onopen = () => res({ send, ev })));
}
async function open(url) {
  await fetch(`http://127.0.0.1:9333/json/new?${url}`, { method: "PUT" }); await sleep(2000);
  const p = await connect((await list()).find((t) => t.url === url));
  await p.send("Emulation.setDeviceMetricsOverride", { width: 760, height: 520, deviceScaleFactor: 2, mobile: false });
  return p;
}
const shot = async (p, name) => writeFileSync(`${here}shots/${name}.png`, Buffer.from((await p.send("Page.captureScreenshot", { format: "png" })).result.data, "base64"));
const sw = await connect(targets.find((t) => t.type === "service_worker"));
await sw.ev(`chrome.storage.local.clear()`);
const read = () => sw.ev(`chrome.tabs.query({active: true}).then(ts => Promise.any(ts.map(t => chrome.tabs.sendMessage(t.id, {cmd: 'readPage'}))))`);
const stop = () => sw.ev(`chrome.tabs.query({}).then(ts => Promise.allSettled(ts.map(t => chrome.tabs.sendMessage(t.id, {cmd: 'stop'}))))`);
const sentence = (p) => p.ev(`(() => { const h = CSS.highlights.get('nv-classic-sentence'); const r = h && [...h][0]; return r ? r.toString() : ''; })()`);
const word = (p) => p.ev(`(() => { const h = CSS.highlights.get('nv-classic-word'); const r = h && [...h][0]; return r ? r.toString() : ''; })()`);

// 1. An article being read, a few sentences in, with a word marked
const article = await open("http://127.0.0.1:8799/long.html");
await read();
for (let k = 0; k < 120 && !/forty-one/.test(await sentence(article)); k++) await sleep(250);
for (let k = 0; k < 200 && (await word(article)).length < 4; k++) await sleep(100);
await shot(article, "reading"); await stop();
console.log("reading:", JSON.stringify(await sentence(article)).slice(0, 60));

// 2. The mixed page, reading a Swedish paragraph
const mixed = await open("http://127.0.0.1:8799/mixed.html");
await read();
for (let k = 0; k < 160 && !/Varje kväll/.test(await sentence(mixed)); k++) await sleep(250);
for (let k = 0; k < 200 && (await word(mixed)).length < 4; k++) await sleep(100);
await shot(mixed, "mixed"); await stop();
console.log("mixed:", JSON.stringify(await sentence(mixed)).slice(0, 60));

// 3. Settings: your voices and the default per language
const opt = await open(`chrome-extension://${extId}/options.html`);
await sleep(1000);
await shot(opt, "settings");
await opt.ev(`document.querySelector('#autoDetect').closest('section').scrollIntoView()`); await sleep(300);
await shot(opt, "settings-language");
process.exit(0);
