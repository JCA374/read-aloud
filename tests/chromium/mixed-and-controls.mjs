// Mixed-language page (voice per paragraph) and the player controls on a long page.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const list = async () => (await (await fetch("http://127.0.0.1:9333/json")).json());
let targets;
for (let k = 0; k < 60; k++) { try { targets = await list(); if (targets.some(t => t.type === "service_worker")) break; } catch {} await sleep(500); }
const errors = [];
function connect(t, tag) {
  const ws = new WebSocket(t.webSocketDebuggerUrl); let id = 0; const pending = new Map();
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } else if (d.method === "Runtime.exceptionThrown") errors.push(d.params.exceptionDetails.exception?.description); else if (d.method === "Runtime.consoleAPICalled" && d.params.type === "error") errors.push(d.params.args.map(a => a.value).join(" ")); };
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (e) => (await send("Runtime.evaluate", { expression: e, returnByValue: true, awaitPromise: true })).result?.result?.value;
  return new Promise((res) => (ws.onopen = async () => { await send("Runtime.enable"); res({ send, ev }); }));
}
async function open(page) {
  await fetch(`http://127.0.0.1:9333/json/new?http://127.0.0.1:8799/${page}`, { method: "PUT" }); await sleep(2500);
  return connect((await list()).find((t) => t.url.endsWith(page)), page);
}
async function player(page) {
  const { root } = (await page.send("DOM.getDocument", { depth: -1, pierce: true })).result;
  const find = (n, pred) => pred(n) ? n : [...(n.children || []), ...(n.shadowRoots || [])].map((c) => find(c, pred)).find(Boolean);
  const cls = (n, c) => (n.attributes || []).join(" ").split(/\s+/).includes(c);
  const obj = async (pred) => (await page.send("DOM.resolveNode", { nodeId: find(root, pred).nodeId })).result.object.objectId;
  const call = async (o, f) => (await page.send("Runtime.callFunctionOn", { objectId: o, functionDeclaration: f, returnByValue: true })).result.result.value;
  const status = await obj((n) => cls(n, "status")), voice = await obj((n) => n.nodeName === "SELECT" && cls(n, "voice"));
  const btn = {}; for (const b of ["prev", "play", "next", "stop"]) btn[b] = await obj((n) => n.nodeName === "BUTTON" && cls(n, b));
  return { status: () => call(status, "function(){return this.textContent}"), voice: () => call(voice, "function(){return this.value.slice(6)}"), click: (b) => call(btn[b], "function(){this.click()}") };
}
const hl = (p, kind) => p.ev(`(() => { const h = CSS.highlights.get('nv-classic-${kind}'); const r = h && [...h][0]; return r ? r.toString() : ''; })()`);
const sw = await connect(targets.find((t) => t.type === "service_worker"), "bg");
const start = () => sw.ev(`chrome.tabs.query({active: true}).then(ts => Promise.any(ts.map(t => chrome.tabs.sendMessage(t.id, {cmd: 'readPage'}))))`);
const state = () => sw.ev(`chrome.tabs.query({}).then(ts => Promise.any(ts.map(t => chrome.tabs.sendMessage(t.id, {cmd: 'status'}).then(s => s.state === 'idle' ? Promise.reject() : s.state)))).catch(() => 'idle')`);

// 1. Mixed page
const mixed = await open("mixed.html");
await start(); await sleep(300);
const pm = await player(mixed);
const seen = [];
for (let k = 0; k < 160; k++) {
  await sleep(250);
  const s = (await hl(mixed, "sentence")).slice(0, 30), v = await pm.voice();
  if (s && !seen.some(([a]) => a === s)) seen.push([s, v]);
  if ((await state()) === "idle" && seen.length) break;
}
console.log("mixed page, sentence -> voice:\n  " + seen.map(([s, v]) => `${JSON.stringify(s)} -> ${v}`).join("\n  "));

// 2. Controls on the long page
const huge = await open("huge.html");
await start(); await sleep(300);
const p = await player(huge);
for (let k = 0; k < 60 && !/^\d+ \//.test(await p.status()); k++) await sleep(250);
await sleep(3000);
console.log("reading:", await p.status(), "|", await state());
await p.click("play"); await sleep(300);
const w1 = await hl(huge, "word"); await sleep(2000); const w2 = await hl(huge, "word");
console.log("pause:", await state(), "| word highlight stays put:", w1 === w2, JSON.stringify(w1));
await p.click("play"); await sleep(1500);
console.log("resume:", await state(), "| word now", JSON.stringify(await hl(huge, "word")));
const before = await p.status();
await p.click("next"); await sleep(1500);
const afterNext = await p.status();
await p.click("prev"); await sleep(1500);
console.log(`next: ${before} -> ${afterNext}; prev -> ${await p.status()}`);
await sw.ev(`chrome.storage.local.set({speed: 1.5})`); await sleep(4000);
console.log("speed 1.5:", await state(), await p.status());
await sw.ev(`chrome.storage.local.set({speed: 1})`); await sleep(500);
await huge.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
await huge.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
await sleep(800);
console.log("after Escape:", await state(), "| highlights left:", JSON.stringify(await huge.ev(`[...CSS.highlights.keys()].join(',')`)));
await start(); await sleep(4000);
await p.click("stop"); await sleep(800);
console.log("after Stop button:", await state());
console.log("errors:", JSON.stringify(errors));
process.exit(0);
