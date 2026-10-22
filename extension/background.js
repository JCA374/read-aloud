// Neural Voices background: renders speech and routes menu/shortcut commands to the tab.
//
// Two engines, same answer shape ({audio: base64 WAV, words, duration} or {error}):
//   Piper   runs in the add-on itself (WebAssembly worker, engine/). The default; needs nothing else.
//   Kokoro  optional: only when the local Python server (server/tts_server.py) is running.
const SERVER = "http://127.0.0.1:5123";

// Firefox loads these before this file (manifest); Chromium's service worker imports them here.
if (typeof NV === "undefined") importScripts("catalog.js", "common.js");

// The voices the add-on offers, without the download details.
const PIPER_VOICES = NV_CATALOG.voices.map(({ id, label, lang, langName }) => ({ id, label, lang, langName, engine: "piper" }));

// Firefox: this is a background page, so the worker runs here (engine/host.js is loaded before
// this file). Chromium: a service worker can't start workers, so an offscreen page hosts it.
// type is "tts", "download" or "unload".
async function engine(type, msg) {
  if (typeof piperHost !== "undefined") return piperHost[type](type === "tts" ? msg : msg.voice);
  if (!(await chrome.offscreen.hasDocument())) {
    await chrome.offscreen
      .createDocument({ url: "offscreen.html", reasons: ["WORKERS"], justification: "Runs the speech engine." })
      .catch(() => {}); // two requests at once: the other one created it
  }
  return chrome.runtime.sendMessage({ ...msg, type, target: "offscreen" });
}

// Download progress goes to the tabs waiting for speech (and, by runtime message, to the settings page).
const waitingTabs = new Map(); // tab id -> number of requests in progress
function relayProgress(p) {
  for (const tabId of waitingTabs.keys()) toTab(tabId, { ...p, cmd: "voiceProgress" });
}
if (typeof piperHost !== "undefined") {
  piperHost.onProgress = (p) => {
    relayProgress(p);
    chrome.runtime.sendMessage({ ...p, type: "voiceProgress" }).catch(() => {});
  };
}

function piperTts(msg, tabId) {
  if (tabId != null) waitingTabs.set(tabId, (waitingTabs.get(tabId) || 0) + 1);
  return engine("tts", msg).finally(() => {
    if (tabId == null) return;
    const n = waitingTabs.get(tabId) - 1;
    n > 0 ? waitingTabs.set(tabId, n) : waitingTabs.delete(tabId);
  });
}

async function serverTts(req) {
  try {
    const r = await fetch(`${SERVER}/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: req.text, voice: req.voice, speed: req.speed }),
    });
    return r.ok ? await r.json() : { error: (await r.json().catch(() => ({}))).error || `HTTP ${r.status}` };
  } catch {
    return { error: "offline" };
  }
}

// Kokoro voices are listed only while the local server answers. Only asked when Kokoro is turned on in
// settings, because asking starts the server (systemd socket activation).
async function serverVoices() {
  try {
    const r = await fetch(`${SERVER}/health`, { signal: AbortSignal.timeout(1500) });
    return (await r.json()).voices.filter((v) => v.engine === "kokoro").map((v) => ({ ...v, langName: "English" }));
  } catch {
    return [];
  }
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: "read-selection", title: "Read aloud", contexts: ["selection"] });
  chrome.contextMenus.create({ id: "read-from-here", title: "Read aloud from here", contexts: ["page", "link", "image"] });
});

function toTab(tabId, msg) {
  chrome.tabs.sendMessage(tabId, msg).catch(() => {});
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab?.id) return;
  toTab(tab.id, { cmd: info.menuItemId === "read-selection" ? "readSelection" : "readFromHere" });
});

// Only one tab reads at a time. The tab that's reading is kept in session storage,
// because the background script can be unloaded between events.
async function readingTab() {
  return (await chrome.storage.session.get("readingTab")).readingTab ?? null;
}

async function onReading(tabId, state) {
  const current = await readingTab();
  if (state === "idle") {
    if (current === tabId) await chrome.storage.session.remove("readingTab");
    return;
  }
  if (current === tabId) return;
  await chrome.storage.session.set({ readingTab: tabId });
  if (current !== null) toTab(current, { cmd: "stop" }); // another tab started: stop the old one
}

chrome.tabs.onRemoved.addListener(async (tabId) => {
  if ((await readingTab()) === tabId) await chrome.storage.session.remove("readingTab");
});

// Shortcuts act on the tab that's reading, even from another tab; otherwise on the tab you're in.
chrome.commands.onCommand.addListener(async (command) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const target = (await readingTab()) ?? tab?.id;
  if (target) toTab(target, { cmd: command === "stop" ? "stop" : "toggle" });
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "reading" && sender.tab?.id != null) {
    onReading(sender.tab.id, msg.state);
    return;
  }
  if (msg.type === "voiceProgress") {
    relayProgress(msg); // Chromium: from the offscreen page
    return;
  }
  if (msg.type === "tts") {
    (msg.voice.startsWith("piper:") ? piperTts(msg, sender.tab?.id) : serverTts(msg))
      .catch((e) => ({ error: String(e?.message || e) }))
      .then(sendResponse);
    return true;
  }
  if (msg.type === "voices") {
    (msg.kokoro ? serverVoices() : Promise.resolve([])).then((kokoro) => sendResponse([...PIPER_VOICES, ...kokoro]));
    return true;
  }
  if ((msg.type === "download" || msg.type === "unload") && !msg.target) {
    engine(msg.type, msg).catch((e) => ({ error: String(e?.message || e) })).then(sendResponse);
    return true;
  }
});
