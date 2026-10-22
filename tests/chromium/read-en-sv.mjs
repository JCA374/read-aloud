// Chromium: read long.html (English) then sv.html (Swedish) with the in-browser engine; report first sound, waits, errors.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const list = async () => (await (await fetch("http://127.0.0.1:9333/json")).json());
let targets;
for (let k = 0; k < 40; k++) { try { targets = await list(); if (targets.some(t => t.type === "service_worker")) break; } catch {} await sleep(500); }
function connect(t, tag, errors) {
  const ws = new WebSocket(t.webSocketDebuggerUrl); let id = 0; const pending = new Map();
  ws.onmessage = (m) => { const d = JSON.parse(m.data);
    if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); return; }
    if (d.method === "Runtime.consoleAPICalled") { const x = d.params.args.map(a => a.value ?? a.description).join(" "); if (/Neural Voices|rror/.test(x)) console.log(`  [${tag}] ${x}`); if (d.params.type === "error") errors.push(x); }
    if (d.method === "Runtime.exceptionThrown") errors.push(`${tag}: ${d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text}`);
  };
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (e) => (await send("Runtime.evaluate", { expression: e, returnByValue: true, awaitPromise: true })).result?.result?.value;
  return new Promise((res) => (ws.onopen = async () => { await send("Runtime.enable"); res({ send, ev }); }));
}
const errors = [];
const sw = await connect(targets.find((t) => t.type === "service_worker"), "bg", errors);

for (const page of ["long.html", "sv.html", "long.html"]) {
  await fetch(`http://127.0.0.1:9333/json/new?http://127.0.0.1:8799/${page}`, { method: "PUT" });
  await sleep(2500);
  const t = (await list()).find((t) => t.type === "page" && t.url.endsWith(page));
  const p = await connect(t, page, errors);
  const t0 = Date.now();
  await sw.ev(`chrome.tabs.query({}).then(ts => Promise.any(ts.filter(t => t.active || true).map(t => chrome.tabs.sendMessage(t.id, {cmd: 'status'}).then(s => t.id)))).then(()=>1)`);
  // start reading through the content script's own message handler
  await sw.ev(`chrome.tabs.query({active: true}).then(ts => Promise.any(ts.map(t => chrome.tabs.sendMessage(t.id, {cmd: 'readPage'}))))`);
  let firstWord = null; const seen = new Set();
  for (let k = 0; k < 120; k++) {
    await sleep(250);
    const w = await p.ev(`(() => { const h = CSS.highlights.get('nv-classic-word'); if (!h) return null; const r = [...h][0]; return r ? r.toString() : null; })()`);
    if (w && firstWord === null) firstWord = (Date.now() - t0) / 1000;
    if (w) seen.add(w);
  }
  console.log(`${page}: first highlighted word after ${firstWord} s; ${seen.size} different words highlighted in 30 s`);
  await sw.ev(`chrome.tabs.query({}).then(ts => Promise.allSettled(ts.map(t => chrome.tabs.sendMessage(t.id, {cmd: 'stop'}))))`);
  await sleep(800);
}
console.log("errors:", JSON.stringify(errors));
process.exit(0);
