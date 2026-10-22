// Memory over a long read, then after stopping: does it come back down, and does CPU go to zero?
import { execSync } from "node:child_process";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const list = async () => (await (await fetch("http://127.0.0.1:9333/json")).json());
let targets;
for (let k = 0; k < 60; k++) { try { targets = await list(); if (targets.some(t => t.type === "service_worker")) break; } catch {} await sleep(500); }
function connect(t) {
  const ws = new WebSocket(t.webSocketDebuggerUrl); let id = 0; const pending = new Map();
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } };
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (e) => (await send("Runtime.evaluate", { expression: e, returnByValue: true, awaitPromise: true })).result?.result?.value;
  return new Promise((res) => (ws.onopen = () => res({ send, ev })));
}
// Browser processes: total memory (RSS) and CPU seconds used so far.
function procs() {
  const out = execSync(`for p in $(pgrep -f nv-test-profile); do [ "$(ps -o comm= -p $p)" != bash ] && ps -o rss=,times= -p $p; done; true`, { shell: "/bin/bash" }).toString();
  let rss = 0, cpu = 0;
  for (const line of out.trim().split("\n")) { const [r, t] = line.trim().split(/\s+/).map(Number); rss += r; cpu += t; }
  return { mb: Math.round(rss / 1024), cpu };
}
const sw = await connect(targets.find((t) => t.type === "service_worker"));
await sw.ev(`chrome.storage.local.set({speed: 2})`);
await fetch(`http://127.0.0.1:9333/json/new?http://127.0.0.1:8799/huge.html`, { method: "PUT" }); await sleep(2500);
const page = await connect((await list()).find((t) => t.url.endsWith("huge.html")));
const t0 = Date.now();
const stamp = () => `${String(Math.round((Date.now() - t0) / 1000)).padStart(4)} s`;
let last = procs();
const sample = async (label) => {
  const now = procs();
  const off = (await list()).find((t) => t.url.includes("offscreen.html"));
  let offHeap = "-";
  if (off) { const o = await connect(off); offHeap = ((await o.send("Runtime.getHeapUsage")).result.usedSize / 1e6).toFixed(1); }
  const pageHeap = ((await page.send("Runtime.getHeapUsage")).result.usedSize / 1e6).toFixed(1);
  console.log(`${stamp()} ${label.padEnd(9)} browser ${now.mb} MB, CPU ${(now.cpu - last.cpu)} s in the last stretch | page heap ${pageHeap} MB, engine page heap ${offHeap} MB, engine page open: ${!!off}`);
  last = now;
};
await sample("before");
await sw.ev(`chrome.tabs.query({active: true}).then(ts => Promise.any(ts.map(t => chrome.tabs.sendMessage(t.id, {cmd: 'readPage'}))))`);
for (let k = 0; k < +(process.env.READN || 12); k++) { await sleep(30000); await sample("reading"); }
const st = await page.ev(`0`);
await sw.ev(`chrome.tabs.query({}).then(ts => Promise.allSettled(ts.map(t => chrome.tabs.sendMessage(t.id, {cmd: 'stop'}))))`);
for (let k = 0; k < 13; k++) { await sleep(30000); await sample("stopped"); }
process.exit(0);
