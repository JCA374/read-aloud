// Shared helpers for the Firefox tests (WebDriver BiDi on port 9334, test pages on 8799).
// The runner gives the add-on a fixed internal address, so its pages are at EXT/<page>.
export { sleep, waitFor, check, finish } from "../chromium/lib.mjs";
import { sleep, waitFor } from "../chromium/lib.mjs";
export const SITE = "http://127.0.0.1:8799";
export const EXT = "moz-extension://11111111-2222-3333-4444-555555555555";

// Start a session, install the add-on from extPath, and return helpers.
// `logs` has every console line; `errors` the warnings and errors (minus known Firefox noise).
export async function browser(extPath, { quiet = false } = {}) {
  let ws = null;
  for (let k = 0; k < 60 && !ws; k++) {
    try { const w = new WebSocket("ws://127.0.0.1:9334/session"); await new Promise((res, rej) => { w.onopen = res; w.onerror = rej; }); ws = w; } catch { await sleep(250); }
  }
  if (!ws) { console.log("FAIL Firefox never opened its test connection"); process.exit(1); }
  let id = 0; const pending = new Map(); const logs = [];
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); }
    if (d.method === "log.entryAdded") {
      const x = { level: d.params.level, text: d.params.text, at: Date.now() };
      logs.push(x);
      if (!quiet && /Neural Voices/.test(x.text)) console.log(`  ${x.level}: ${x.text}`);
    }
  };
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  await send("session.new", { capabilities: {} });
  await send("session.subscribe", { events: ["log.entryAdded"] });
  const installed = await send("webExtension.install", { extensionData: { type: "path", path: extPath } });
  if (installed.error) { console.log("FAIL installing the add-on:", installed.error, installed.message); process.exit(1); }

  // evaluate in a browsing context; returns the plain value (strings, numbers, booleans)
  const ev = async (ctx, e) => (await send("script.evaluate", { expression: e, target: { context: ctx }, awaitPromise: true, resultOwnership: "none" })).result?.result?.value;
  const ext = (await send("browsingContext.getTree", {})).result.contexts[0].context; // a tab used for the add-on's own pages
  const goto = (ctx, url) => send("browsingContext.navigate", { context: ctx, url, wait: "complete" });

  return {
    send, ev, ext, logs, goto,
    errors: () => logs.filter((l) => /warn|error/.test(l.level) && !/No external component configuration found/.test(l.text)).map((l) => `${l.level}: ${l.text}`),
    // open a test page in a new tab; resolves when the add-on answers in it
    async open(page) {
      const tab = (await send("browsingContext.create", { type: "tab" })).result.context;
      await goto(tab, `${SITE}/${page}`);
      await waitFor(() => ev(ext, `chrome.tabs.query({}).then(ts => Promise.any(ts.filter(t => t.url.endsWith(${JSON.stringify(page)})).map(t => chrome.tabs.sendMessage(t.id, {cmd: 'status'})))).then(() => true, () => false)`), 10000);
      return tab;
    },
    close: (tab) => send("browsingContext.close", { context: tab }),
    // start reading in the tab showing `page` (not just any tab: one that is closing may still answer)
    readPage: (page) => ev(ext, `chrome.tabs.query({}).then(ts => Promise.any(ts.filter(t => t.url.endsWith(${JSON.stringify(page)})).map(t => chrome.tabs.sendMessage(t.id, {cmd: 'readPage'})))).then(() => true)`),
    stopAll: () => ev(ext, `chrome.tabs.query({}).then(ts => Promise.allSettled(ts.map(t => chrome.tabs.sendMessage(t.id, {cmd: 'stop'})))).then(() => true)`),
    // status of the tab that is reading, as JSON text ("idle" when none is)
    status: async () => JSON.parse(await ev(ext, `chrome.tabs.query({}).then(ts => Promise.any(ts.map(t => chrome.tabs.sendMessage(t.id, {cmd: 'status'}).then(s => s.state === 'idle' ? Promise.reject() : s)))).catch(() => ({state: 'idle'})).then(s => JSON.stringify(s))`)),
    word: (tab) => ev(tab, `(() => { const h = CSS.highlights.get('nv-classic-word'); const r = h && [...h][0]; return r ? r.toString() : ''; })()`),
  };
}
