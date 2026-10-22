// Chromium: voice list settings, popup pickers, and switching voice mid-reading.
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
const sw = await connect(targets.find((t) => t.type === "service_worker"), "bg");
await sw.ev(`chrome.storage.local.clear()`);
const C = "piper:en_GB-cori-medium", N = "piper:en_GB-northern_english_male-medium", ALMA = "piper:sv_SE-alma-medium";

// 1. Settings page: untick Alba, Lisa, NST by clicking their boxes
const opt = await open(`chrome-extension://${extId}/options.html`, "options");
await sleep(500);
for (const name of ["Alba", "Lisa", "NST"]) await opt.ev(`[...document.querySelectorAll('#list label')].find(l => l.textContent.includes(${JSON.stringify(name)})).querySelector('input').click()`);
await sleep(300);
console.log("stored:", JSON.stringify(await sw.ev(`chrome.storage.local.get(null)`)));
console.log("defaults section:", await opt.ev(`[...document.querySelectorAll('#defaults label, #defaults p')].map(l => l.firstChild.textContent + ' -> ' + [...l.querySelectorAll('option')].map(o => o.textContent).join('/')).join(' | ')`));
// untick Alma too: Swedish has no voice -> note
await opt.ev(`[...document.querySelectorAll('#list label')].find(l => l.textContent.includes('Alma')).querySelector('input').click()`);
await sleep(300);
console.log("no Swedish voice:", await opt.ev(`document.querySelector('#defaults').textContent`));
await opt.ev(`[...document.querySelectorAll('#list label')].find(l => l.textContent.includes('Alma')).querySelector('input').click()`);
// detection off -> one picker
await opt.ev(`document.querySelector('#autoDetect').click()`); await sleep(300);
console.log("detection off:", await opt.ev(`document.querySelector('#defaults').textContent.slice(0, 120)`));
await opt.ev(`document.querySelector('#autoDetect').click()`); await sleep(300);

// 2. Popup
const pop = await open(`chrome-extension://${extId}/popup.html`, "popup");
await sleep(800);
console.log("popup:", await pop.ev(`[...document.querySelectorAll('#voices label')].map(l => l.firstChild.textContent + ': ' + [...l.querySelectorAll('option')].map(o => o.textContent).join('/') + ' [' + l.querySelector('select').value.slice(6) + ']').join(' | ')`));

// 3. Read, then switch voice in the player
const page = await open("http://127.0.0.1:8799/long.html", "page");
const word = () => page.ev(`(() => { const h = CSS.highlights.get('nv-classic-word'); const r = h && [...h][0]; return r ? r.toString() : ''; })()`);
const sentence = () => page.ev(`(() => { const h = CSS.highlights.get('nv-classic-sentence'); const r = h && [...h][0]; return r ? r.toString().slice(0, 40) : ''; })()`);
await sw.ev(`chrome.tabs.query({active: true}).then(ts => Promise.any(ts.map(t => chrome.tabs.sendMessage(t.id, {cmd: 'readPage'}))))`);
for (let k = 0; k < 60 && !(await word()); k++) await sleep(250);
await sleep(4000);
console.log("before switch: sentence", JSON.stringify(await sentence()), "word", JSON.stringify(await word()));
// the player's voice <select> is in a closed shadow root: reach it through the DOM domain
const { root } = (await page.send("DOM.getDocument", { depth: -1, pierce: true })).result;
const find = (n) => n.nodeName === "SELECT" && (n.attributes || []).join(" ").includes("voice") ? n : [...(n.children || []), ...(n.shadowRoots || [])].map(find).find(Boolean);
const sel = find(root);
const obj = (await page.send("DOM.resolveNode", { nodeId: sel.nodeId })).result.object;
console.log("player list:", JSON.stringify((await page.send("Runtime.callFunctionOn", { objectId: obj.objectId, functionDeclaration: "function(){return [...this.options].map(o=>o.textContent).join('/') + ' [' + this.value.slice(6) + ']'}", returnByValue: true })).result.result.value));
const t0 = Date.now();
await page.send("Runtime.callFunctionOn", { objectId: obj.objectId, functionDeclaration: `function(){ this.value = ${JSON.stringify(N)}; this.dispatchEvent(new Event('change')); }` });
let w0 = await word(), restarted = null;
for (let k = 0; k < 40; k++) { await sleep(100); const w = await word(); if (w && w !== w0) { restarted = (Date.now() - t0) / 1000; break; } }
console.log(`after switch: sentence ${JSON.stringify(await sentence())}, new word highlight after ${restarted} s`);
console.log("saved English voice:", (await sw.ev(`chrome.storage.local.get('voice')`)).voice);
await sleep(3000);
// 4. Change English voice from "the popup" (storage) back to Cori while reading
await pop.ev(`(() => { const s = document.querySelector('#voices select'); s.value = ${JSON.stringify(C)}; s.dispatchEvent(new Event('change')); })()`);
await sleep(2500);
await sw.ev(`chrome.tabs.query({}).then(ts => Promise.allSettled(ts.map(t => chrome.tabs.sendMessage(t.id, {cmd: 'stop'}))))`);
console.log("errors:", JSON.stringify(errors));
process.exit(0);
