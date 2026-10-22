// Chromium, fresh profile: settings page (add, download, delete), download progress in the player,
// a German page, highlight styles.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const list = async () => (await (await fetch("http://127.0.0.1:9333/json")).json());
let targets;
for (let k = 0; k < 40; k++) { try { targets = await list(); if (targets.some(t => t.type === "service_worker")) break; } catch {} await sleep(500); }
const extId = new URL(targets.find(t => t.type === "service_worker").url).host;
const errors = [];
function connect(t, tag) {
  const ws = new WebSocket(t.webSocketDebuggerUrl); let id = 0; const pending = new Map();
  ws.onmessage = (m) => { const d = JSON.parse(m.data);
    if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); return; }
    if (d.method === "Runtime.consoleAPICalled") { const x = d.params.args.map(a => a.value ?? a.description).join(" "); if (/Neural Voices/.test(x)) console.log(`  [${tag}] ${x}`); if (d.params.type === "error") errors.push(x); }
    if (d.method === "Runtime.exceptionThrown") errors.push(`${tag}: ${d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text}`);
  };
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (e) => (await send("Runtime.evaluate", { expression: e, returnByValue: true, awaitPromise: true })).result?.result?.value;
  return new Promise((res) => (ws.onopen = async () => { await send("Runtime.enable"); res({ send, ev }); }));
}
async function open(url, tag) {
  await fetch(`http://127.0.0.1:9333/json/new?${url}`, { method: "PUT" });
  await sleep(2000);
  return connect((await list()).find((t) => t.type === "page" && t.url === url), tag);
}
// Read the player's status line and voice (closed shadow root) through the DOM domain.
async function player(page) {
  const { root } = (await page.send("DOM.getDocument", { depth: -1, pierce: true })).result;
  const find = (n, pred) => pred(n) ? n : [...(n.children || []), ...(n.shadowRoots || [])].map((c) => find(c, pred)).find(Boolean);
  const cls = (n, c) => (n.attributes || []).join(" ").split(/\s+/).includes(c);
  const status = find(root, (n) => cls(n, "status")), voice = find(root, (n) => n.nodeName === "SELECT" && cls(n, "voice"));
  const obj = async (n) => (await page.send("DOM.resolveNode", { nodeId: n.nodeId })).result.object.objectId;
  const [s, v] = [await obj(status), await obj(voice)];
  const call = async (o, f) => (await page.send("Runtime.callFunctionOn", { objectId: o, functionDeclaration: f, returnByValue: true })).result.result.value;
  return { status: () => call(s, "function(){return this.textContent}"), voice: () => call(v, "function(){return this.value}") };
}
const sw = await connect(targets.find((t) => t.type === "service_worker"), "bg");
const T = "piper:de_DE-thorsten-medium";

// 1. Settings page
const opt = await open(`chrome-extension://${extId}/options.html`, "options");
await sleep(800);
console.log("your voices:", await opt.ev(`[...document.querySelectorAll('#mine .voice b')].map(b => b.textContent).join(', ')`));
console.log("languages to add from:", await opt.ev(`document.querySelector('#addLang').options.length`));
await opt.ev(`(() => { const s = document.querySelector('#addLang'); s.value = 'de'; s.dispatchEvent(new Event('change')); })()`);
console.log("German voices to add:", await opt.ev(`[...document.querySelectorAll('#add .voice')].map(r => r.querySelector('b').textContent + ' [' + r.querySelector('.licence')?.textContent + ']').slice(0, 3).join(' | ')`));
await opt.ev(`[...document.querySelectorAll('#add .voice')].find(r => r.querySelector('b').textContent.startsWith('Thorsten (Germany)')).querySelector('button').click()`);
await sleep(300);
console.log("stored list now:", JSON.stringify((await sw.ev(`chrome.storage.local.get('shown')`)).shown.map(x => x.slice(6))));
await opt.ev(`[...document.querySelectorAll('#mine .voice')].find(r => r.querySelector('b').textContent.startsWith('Thorsten')).querySelector('button').click()`);
const seen = [];
for (let k = 0; k < 120; k++) {
  await sleep(250);
  const st = await opt.ev(`[...document.querySelectorAll('#mine .voice')].find(r => r.querySelector('b').textContent.startsWith('Thorsten')).querySelector('.side').textContent`);
  if (!seen.includes(st)) seen.push(st);
  if (st.includes("Downloaded")) break;
}
console.log("Thorsten while downloading:", seen.slice(0, 4).join(" | "), "...", seen.at(-1), `(${seen.length} different states)`);
console.log("defaults section:", await opt.ev(`[...document.querySelectorAll('#defaults label')].map(l => l.firstChild.textContent).join(', ')`));
await opt.ev(`[...document.querySelectorAll('#mine .voice')].find(r => r.querySelector('b').textContent.startsWith('Thorsten')).querySelector('button').click()`); // Delete download
await sleep(800);
console.log("after delete:", await opt.ev(`[...document.querySelectorAll('#mine .voice')].find(r => r.querySelector('b').textContent.startsWith('Thorsten')).querySelector('.side').textContent`));

// 2. Read English on a fresh profile: the player shows download progress
const page = await open("http://127.0.0.1:8799/long.html", "en");
await sw.ev(`chrome.tabs.query({active: true}).then(ts => Promise.any(ts.map(t => chrome.tabs.sendMessage(t.id, {cmd: 'readPage'}))))`);
await sleep(300);
const p = await player(page);
const statuses = [];
for (let k = 0; k < 60; k++) { await sleep(200); const s = await p.status(); if (!statuses.includes(s)) statuses.push(s); if (/^\d+ \//.test(s)) break; }
console.log("player status while starting:", statuses.slice(0, 5).join(" | "), "...", statuses.at(-1));
// highlight styles
const names = () => page.ev(`[...CSS.highlights.keys()].join(',')`);
console.log("highlights (classic):", await names());
await sw.ev(`chrome.storage.local.set({highlight: 'blue'})`); await sleep(500);
console.log("highlights (blue):", await names());
await sw.ev(`chrome.storage.local.set({highlight: 'off'})`); await sleep(500);
console.log("highlights (off):", JSON.stringify(await names()));
await sw.ev(`chrome.storage.local.set({highlight: 'classic', volume: 0.5})`); await sleep(500);
await sw.ev(`chrome.tabs.query({}).then(ts => Promise.allSettled(ts.map(t => chrome.tabs.sendMessage(t.id, {cmd: 'stop'}))))`);

// 3. German page (lang="de"): read with Thorsten (downloads again, since it was deleted)
const de = await open("http://127.0.0.1:8799/de.html", "de");
await sw.ev(`chrome.tabs.query({active: true}).then(ts => Promise.any(ts.map(t => chrome.tabs.sendMessage(t.id, {cmd: 'readPage'}))))`);
await sleep(300);
const pd = await player(de);
let word = "";
for (let k = 0; k < 80 && !word; k++) { await sleep(250); word = await de.ev(`(() => { const h = CSS.highlights.get('nv-classic-word'); const r = h && [...h][0]; return r ? r.toString() : ''; })()`); }
console.log("German page: voice", await pd.voice(), "| first word highlighted:", JSON.stringify(word));
await sw.ev(`chrome.tabs.query({}).then(ts => Promise.allSettled(ts.map(t => chrome.tabs.sendMessage(t.id, {cmd: 'stop'}))))`);
console.log("errors:", JSON.stringify(errors));
process.exit(0);
