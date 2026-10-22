// Firefox: memory and CPU while reading the long page, then after stopping.
import { execSync } from "node:child_process";
const READ = +(process.env.READ || 180), AFTER = +(process.env.AFTER || 390);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws;
for (let k = 0; k < 60; k++) { try { ws = new WebSocket("ws://127.0.0.1:9334/session"); await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; }); break; } catch { await sleep(500); } }
let id = 0; const pending = new Map();
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } };
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await send("session.new", { capabilities: {} });
await send("webExtension.install", { extensionData: { type: "path", path: process.argv[2] } });
const ev = async (ctx, e) => (await send("script.evaluate", { expression: e, target: { context: ctx }, awaitPromise: true, resultOwnership: "none" })).result?.result?.value;
const ext = (await send("browsingContext.getTree", {})).result.contexts[0].context;
await send("browsingContext.navigate", { context: ext, url: "moz-extension://11111111-2222-3333-4444-555555555555/popup.html", wait: "complete" });
await ev(ext, `chrome.storage.local.set({speed: 2})`);
const tab = (await send("browsingContext.create", { type: "tab" })).result.context;
await send("browsingContext.navigate", { context: tab, url: "http://127.0.0.1:8799/huge.html", wait: "complete" });
await sleep(1500);
function procs() {
  // every process under the first nv-profile process (the snap launcher adds layers)
  const rows = execSync("ps -e -o pid=,ppid=,rss=,times=,args=").toString().trim().split("\n").map((l) => { const [pid, ppid, rss, t, ...a] = l.trim().split(/\s+/); return { pid: +pid, ppid: +ppid, rss: +rss, t: +t, args: a.join(" ") }; });
  const roots = rows.filter((r) => r.args.includes("nv-profile") && !r.args.startsWith("bash") && !r.args.includes("pgrep"));
  const ids = new Set(roots.map((r) => r.pid));
  for (let grew = true; grew; ) { grew = false; for (const r of rows) if (ids.has(r.ppid) && !ids.has(r.pid)) { ids.add(r.pid); grew = true; } }
  let rss = 0, cpu = 0, n = 0;
  for (const r of rows) if (ids.has(r.pid)) { rss += r.rss; cpu += r.t; n++; }
  return { mb: Math.round(rss / 1024), cpu, n };
}
const t0 = Date.now(); let last = procs();
const sample = async (label) => { const st = await ev(ext, `chrome.tabs.query({}).then(ts => Promise.any(ts.map(t => chrome.tabs.sendMessage(t.id, {cmd: 'status'}).then(s => s.state)))).catch(e => 'no reply: ' + e)`); const now = procs(); label += " [" + st + "]"; console.log(`${String(Math.round((Date.now() - t0) / 1000)).padStart(4)} s ${label.padEnd(8)} Firefox ${now.mb} MB in ${now.n} processes, CPU ${now.cpu - last.cpu} s since last`); last = now; };
await sample("before");
if (READ) console.log("start:", JSON.stringify(await send("script.evaluate", { expression: `chrome.tabs.query({}).then(ts => Promise.any(ts.map(t => chrome.tabs.sendMessage(t.id, {cmd: 'readPage'})))).then(r => JSON.stringify(r))`, target: { context: ext }, awaitPromise: true })).slice(0, 300));
for (let k = 0; k < READ / 30; k++) { await sleep(30000); await sample("reading"); }
await ev(ext, `chrome.tabs.query({}).then(ts => Promise.allSettled(ts.map(t => chrome.tabs.sendMessage(t.id, {cmd: 'stop'}))))`);
for (let k = 0; k < AFTER / 30; k++) { await sleep(30000); await sample("stopped"); }
await ev(ext, `chrome.storage.local.set({speed: 1})`);
process.exit(0);
