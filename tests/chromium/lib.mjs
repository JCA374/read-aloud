// Shared helpers for the Chromium tests (Chrome DevTools Protocol on port 9333, test pages on 8799).
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const SITE = "http://127.0.0.1:8799";
export const CORI = "piper:en_GB-cori-medium", NORTHERN = "piper:en_GB-northern_english_male-medium", ALMA = "piper:sv_SE-alma-medium";
const list = async () => (await (await fetch("http://127.0.0.1:9333/json")).json());

// Poll fn every `every` ms until it returns something truthy; give up after `timeout` ms (returns null).
export async function waitFor(fn, timeout = 10000, every = 100) {
  const end = Date.now() + timeout;
  do {
    try { const v = await fn(); if (v) return v; } catch {}
    await sleep(every);
  } while (Date.now() < end);
  return null;
}

// Pass/fail bookkeeping: check() prints one line per check, finish() exits 1 if any failed.
const failed = [];
export function check(name, ok, detail = "") {
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail === "" ? "" : `: ${detail}`}`);
  if (!ok) failed.push(name);
  return ok;
}
export function finish(errors) {
  if (errors) check("no errors in the console", errors.length === 0, errors.length ? JSON.stringify(errors.slice(0, 5)) : "");
  console.log(failed.length ? `RESULT: FAIL (${failed.join("; ")})` : "RESULT: pass");
  process.exit(failed.length ? 1 : 0);
}

// The browser with the add-on loaded. `logs` collects every "[Neural Voices]" console line.
export async function browser({ quiet = false } = {}) {
  const targets = await waitFor(async () => { const t = await list(); return t.some((x) => x.type === "service_worker") && t; }, 20000, 250);
  if (!targets) { console.log("FAIL the add-on's service worker never started"); process.exit(1); }
  const errors = [], logs = [];
  const swTarget = targets.find((t) => t.type === "service_worker");
  const extId = new URL(swTarget.url).host;

  function connect(t, tag) {
    const ws = new WebSocket(t.webSocketDebuggerUrl); let id = 0; const pending = new Map();
    ws.onmessage = (m) => {
      const d = JSON.parse(m.data);
      if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); return; }
      if (d.method === "Runtime.consoleAPICalled") {
        const x = d.params.args.map((a) => a.value ?? a.description).join(" ");
        if (/Neural Voices/.test(x)) { logs.push({ tag, text: x, at: Date.now() }); if (!quiet) console.log(`  [${tag}] ${x}`); }
        if (d.params.type === "error") errors.push(`${tag}: ${x}`);
      }
      if (d.method === "Runtime.exceptionThrown") errors.push(`${tag}: ${d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text}`);
    };
    const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
    const ev = async (e) => (await send("Runtime.evaluate", { expression: e, returnByValue: true, awaitPromise: true })).result?.result?.value;
    return new Promise((res) => (ws.onopen = async () => { await send("Runtime.enable"); res({ send, ev, tag }); }));
  }

  const sw = await connect(swTarget, "bg");
  const toTabs = (msg, how = "any") => `chrome.tabs.query({}).then(ts => Promise.${how}(ts.map(t => chrome.tabs.sendMessage(t.id, ${msg}))))`;

  // Open a page in a new tab and wait until it has loaded (and, for test pages, until the add-on runs in it).
  async function open(url, tag = url.split("/").pop()) {
    if (!/^[a-z-]+:/.test(url)) url = `${SITE}/${url}`;
    await fetch(`http://127.0.0.1:9333/json/new?${url}`, { method: "PUT" });
    const t = await waitFor(async () => (await list()).find((x) => x.type === "page" && x.url === url), 10000);
    const page = await connect(t, tag);
    await waitFor(() => page.ev(`document.readyState === "complete"`), 10000);
    if (url.startsWith(SITE)) await waitFor(() => sw.ev(`chrome.tabs.query({active: true}).then(ts => chrome.tabs.sendMessage(ts[0].id, {cmd: 'status'})).then(() => true, () => false)`), 10000);
    return page;
  }

  return {
    sw, extId, errors, logs, open, connect, targets,
    extUrl: (p) => `chrome-extension://${extId}/${p}`,
    readPage: () => sw.ev(`chrome.tabs.query({active: true}).then(ts => Promise.any(ts.map(t => chrome.tabs.sendMessage(t.id, {cmd: 'readPage'}))))`),
    stopAll: () => sw.ev(toTabs("{cmd: 'stop'}", "allSettled")),
    // the state of the tab that is reading ('idle' when none is)
    state: () => sw.ev(`chrome.tabs.query({}).then(ts => Promise.any(ts.map(t => chrome.tabs.sendMessage(t.id, {cmd: 'status'})
      .then(s => s.state === 'idle' ? Promise.reject() : s.state)))).catch(() => 'idle')`),
    // wait for a "[Neural Voices]" log line matching re, logged after `since` (ms timestamp)
    waitLog: (re, since = 0, timeout = 10000) => waitFor(() => logs.find((l) => l.at >= since && re.test(l.text)), timeout),
  };
}

// The text of the add-on's highlight on a page: kind = "word" or "sentence".
export const hl = (page, kind) => page.ev(`(() => { const h = CSS.highlights.get('nv-classic-${kind}'); const r = h && [...h][0]; return r ? r.toString() : ''; })()`);

// The player in its closed shadow root, reached through the DOM domain.
export async function player(page) {
  const { root } = (await page.send("DOM.getDocument", { depth: -1, pierce: true })).result;
  const all = []; const walk = (n) => { all.push(n); [...(n.children || []), ...(n.shadowRoots || [])].forEach(walk); }; walk(root);
  const cls = (n, c) => (n.attributes || []).join(" ").split(/\s+/).includes(c);
  const obj = async (pred) => { const n = all.find(pred); return n && (await page.send("DOM.resolveNode", { nodeId: n.nodeId })).result.object.objectId; };
  const call = async (o, f) => (await page.send("Runtime.callFunctionOn", { objectId: o, functionDeclaration: f, returnByValue: true })).result.result.value;
  const status = await obj((n) => cls(n, "status")), voice = await obj((n) => n.nodeName === "SELECT" && cls(n, "voice"));
  const btn = {};
  for (const b of ["prev", "play", "next", "stop", "settings"]) btn[b] = await obj((n) => n.nodeName === "BUTTON" && cls(n, b));
  return {
    count: (name) => all.filter((n) => n.nodeName === name).length,
    status: () => call(status, "function(){return this.textContent}"),
    voice: () => call(voice, "function(){return this.value}"),
    voiceOptions: () => call(voice, "function(){return [...this.options].map(o => o.textContent)}"),
    setVoice: (id) => call(voice, `function(){ this.value = ${JSON.stringify(id)}; this.dispatchEvent(new Event('change')); }`),
    click: (b) => call(btn[b], "function(){this.click()}"),
  };
}
