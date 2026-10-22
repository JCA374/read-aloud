// Downloads blocked: the player must stop with a clear message instead of skipping sentences.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const list = async () => (await (await fetch("http://127.0.0.1:9333/json")).json());
let targets;
for (let k = 0; k < 40; k++) { try { targets = await list(); if (targets.some(t => t.type === "service_worker")) break; } catch {} await sleep(500); }
function connect(t) {
  const ws = new WebSocket(t.webSocketDebuggerUrl); let id = 0; const pending = new Map();
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } else if (d.method === "Runtime.consoleAPICalled") console.log("  console:", d.params.args.map(a => a.value).join(" ").slice(0, 160)); };
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (e) => (await send("Runtime.evaluate", { expression: e, returnByValue: true, awaitPromise: true })).result?.result?.value;
  return new Promise((res) => (ws.onopen = async () => { await send("Runtime.enable"); res({ send, ev }); }));
}
const sw = await connect(targets.find((t) => t.type === "service_worker"));
await fetch(`http://127.0.0.1:9333/json/new?http://127.0.0.1:8799/long.html`, { method: "PUT" }); await sleep(2000);
const page = await connect((await list()).find((t) => t.url.endsWith("long.html")));
const t0 = Date.now();
await sw.ev(`chrome.tabs.query({active: true}).then(ts => Promise.any(ts.map(t => chrome.tabs.sendMessage(t.id, {cmd: 'readPage'}))))`);
await sleep(300);
const { root } = (await page.send("DOM.getDocument", { depth: -1, pierce: true })).result;
const find = (n) => (n.attributes || []).join(" ").split(/\s+/).includes("status") ? n : [...(n.children || []), ...(n.shadowRoots || [])].map(find).find(Boolean);
const o = (await page.send("DOM.resolveNode", { nodeId: find(root).nodeId })).result.object.objectId;
let last = "";
for (let k = 0; k < 60; k++) {
  await sleep(500);
  const s = (await page.send("Runtime.callFunctionOn", { objectId: o, functionDeclaration: "function(){return this.textContent}", returnByValue: true })).result.result.value;
  if (s !== last) console.log(`${((Date.now() - t0) / 1000).toFixed(1)} s: ${JSON.stringify(s)}`);
  last = s;
  if (/Couldn't/.test(s)) break;
}
console.log("still reading?", await sw.ev(`chrome.tabs.query({}).then(ts => Promise.any(ts.map(t => chrome.tabs.sendMessage(t.id, {cmd: 'status'}).then(s => s.state === 'idle' ? Promise.reject() : s.state)))).catch(() => 'no, stopped')`));
process.exit(0);
