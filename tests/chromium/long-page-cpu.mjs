// Read huge.html for SECS seconds: time to extract the text, first sound, waits.
const SECS = +(process.env.SECS || 60);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const list = async () => (await (await fetch("http://127.0.0.1:9333/json")).json());
let targets;
for (let k = 0; k < 60; k++) { try { targets = await list(); if (targets.some(t => t.type === "service_worker")) break; } catch {} await sleep(500); }
function connect(t, tag) {
  const ws = new WebSocket(t.webSocketDebuggerUrl); let id = 0; const pending = new Map();
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } else if (d.method === "Runtime.consoleAPICalled") { const x = d.params.args.map(a => a.value).join(" "); if (/Neural Voices/.test(x)) console.log(`  [${tag}] ${x}`); } };
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (e) => (await send("Runtime.evaluate", { expression: e, returnByValue: true, awaitPromise: true })).result?.result?.value;
  return new Promise((res) => (ws.onopen = async () => { await send("Runtime.enable"); res({ send, ev }); }));
}
const sw = await connect(targets.find((t) => t.type === "service_worker"), "bg");
await sw.ev(`chrome.storage.local.set({speed: ${process.env.SPEED || 1}})`);
await fetch(`http://127.0.0.1:9333/json/new?http://127.0.0.1:8799/${process.env.PAGE || "huge.html"}`, { method: "PUT" }); await sleep(3000);
const page = await connect((await list()).find((t) => t.url.includes("8799")), "page");
const t0 = Date.now();
await sw.ev(`chrome.tabs.query({active: true}).then(ts => Promise.any(ts.map(t => chrome.tabs.sendMessage(t.id, {cmd: 'readPage'}))))`);
console.log(`text extracted and split in ${Date.now() - t0} ms (the page is blocked while this runs)`);
await sleep(SECS * 1000);
console.log("page JS heap MB:", ((await page.send("Runtime.getHeapUsage")).result.usedSize / 1e6).toFixed(1));
await sw.ev(`chrome.tabs.query({}).then(ts => Promise.allSettled(ts.map(t => chrome.tabs.sendMessage(t.id, {cmd: 'stop'}))))`);
await sleep(800);
process.exit(0);
