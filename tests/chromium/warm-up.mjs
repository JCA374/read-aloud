// First sound with and without warming up the voice first (what opening the popup does).
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const list = async () => (await (await fetch("http://127.0.0.1:9333/json")).json());
let targets;
for (let k = 0; k < 60; k++) { try { targets = await list(); if (targets.some(t => t.type === "service_worker")) break; } catch {} await sleep(500); }
const extId = new URL(targets.find(t => t.type === "service_worker").url).host;
function connect(t, tag) {
  const ws = new WebSocket(t.webSocketDebuggerUrl); let id = 0; const pending = new Map();
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } else if (d.method === "Runtime.consoleAPICalled") { const x = d.params.args.map(a => a.value).join(" "); if (/first sound/.test(x)) console.log(`  ${tag}: ${x}`); } };
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (e) => (await send("Runtime.evaluate", { expression: e, returnByValue: true, awaitPromise: true })).result?.result?.value;
  return new Promise((res) => (ws.onopen = async () => { await send("Runtime.enable"); res({ send, ev }); }));
}
const sw = await connect(targets.find((t) => t.type === "service_worker"), "bg");
const WARM = process.env.WARM === "1";
await fetch(`http://127.0.0.1:9333/json/new?chrome-extension://${extId}/options.html`, { method: "PUT" }); await sleep(1500);
const opt = await connect((await list()).find((t) => t.url.includes("options.html")), "options");
if (WARM) { const t = Date.now(); console.log("warm:", JSON.stringify(await opt.ev(`chrome.runtime.sendMessage({type: 'warm', voice: 'piper:en_GB-cori-medium'})`)), `${Date.now() - t} ms`); }
await fetch(`http://127.0.0.1:9333/json/new?http://127.0.0.1:8799/long.html`, { method: "PUT" }); await sleep(2000);
await connect((await list()).find((t) => t.url.endsWith("long.html")), WARM ? "after warm-up" : "cold start");
await sw.ev(`chrome.tabs.query({active: true}).then(ts => Promise.any(ts.map(t => chrome.tabs.sendMessage(t.id, {cmd: 'readPage'}))))`);
await sleep(9000);
await sw.ev(`chrome.tabs.query({}).then(ts => Promise.allSettled(ts.map(t => chrome.tabs.sendMessage(t.id, {cmd: 'stop'}))))`);
await sleep(800);
process.exit(0);
