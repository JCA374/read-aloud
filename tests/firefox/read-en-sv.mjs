const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws;
for (let k = 0; k < 60; k++) { try { ws = new WebSocket("ws://127.0.0.1:9334/session"); await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; }); break; } catch { await sleep(500); } }
let id = 0; const pending = new Map(); const logs = [];
ws.onmessage = (m) => { const d = JSON.parse(m.data);
  if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); }
  if (d.method === "log.entryAdded") { const x = `${d.params.level}: ${d.params.text}`; logs.push(x); if (/Neural Voices/.test(x)) console.log("  " + x); }
};
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await send("session.new", { capabilities: {} });
await send("session.subscribe", { events: ["log.entryAdded"] });
console.log("install", JSON.stringify((await send("webExtension.install", { extensionData: { type: "path", path: process.argv[2] } })).result));
const ev = async (ctx, e) => (await send("script.evaluate", { expression: e, target: { context: ctx }, awaitPromise: true, resultOwnership: "none" })).result?.result;
const ext = (await send("browsingContext.getTree", {})).result.contexts[0].context;
await send("browsingContext.navigate", { context: ext, url: "moz-extension://11111111-2222-3333-4444-555555555555/popup.html", wait: "complete" });
await send("browsingContext.navigate", { context: ext, url: "moz-extension://11111111-2222-3333-4444-555555555555/options.html", wait: "complete" });
console.log("settings page:", JSON.stringify((await ev(ext, `new Promise(r => setTimeout(() => r([...document.querySelectorAll('#mine .voice')].map(r => r.querySelector('b').textContent + ': ' + r.querySelector('.side').textContent).join(' | ') + ' || ' + document.querySelector('#defaults').textContent.slice(0, 120)), 800))`))?.value));
await send("browsingContext.navigate", { context: ext, url: "moz-extension://11111111-2222-3333-4444-555555555555/popup.html", wait: "complete" });
console.log("popup voices:", JSON.stringify(await ev(ext, `new Promise(r => setTimeout(() => r([...document.querySelectorAll('option')].map(o => o.textContent).join(', ')), 1500))`)));
for (const page of ["long.html", "sv.html"]) {
  const tab = (await send("browsingContext.create", { type: "tab" })).result.context;
  await send("browsingContext.navigate", { context: tab, url: `http://127.0.0.1:8799/${page}`, wait: "complete" });
  await sleep(1500);
  const t0 = Date.now();
  await ev(ext, `chrome.tabs.query({}).then(ts => Promise.any(ts.map(t => chrome.tabs.sendMessage(t.id, {cmd: 'readPage'}))))`);
  let first = null; const seen = new Set();
  for (let k = 0; k < 100; k++) {
    await sleep(250);
    const r = await ev(tab, `(() => { const h = CSS.highlights.get('nv-classic-word'); const r = h && [...h][0]; return r ? r.toString() : ''; })()`);
    const w = r?.value;
    if (w && first === null) first = (Date.now() - t0) / 1000;
    if (w) seen.add(w);
  }
  console.log(`${page}: first highlighted word after ${first} s; ${seen.size} words highlighted in 25 s`);
  console.log("  status:", JSON.stringify(await ev(ext, `chrome.tabs.query({}).then(ts => Promise.any(ts.map(t => chrome.tabs.sendMessage(t.id, {cmd: 'status'}).then(s => s.state === 'idle' ? Promise.reject() : s)))).catch(() => 'all idle')`)));
  await ev(ext, `chrome.tabs.query({}).then(ts => Promise.allSettled(ts.map(t => chrome.tabs.sendMessage(t.id, {cmd: 'stop'}))))`);
  await sleep(800);
  await send("browsingContext.close", { context: tab });
}
console.log("errors/warnings:", JSON.stringify(logs.filter(l => !/^info|^debug/.test(l)).slice(0, 15)));
process.exit(0);
