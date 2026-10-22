// Neural Voices background: renders speech and routes menu/shortcut commands to the tab.
//
// Two engines, same answer shape ({audio: base64 WAV, words, duration} or {error}):
//   Piper   runs in the add-on itself (WebAssembly worker, engine/). The default; needs nothing else.
//   Kokoro  optional: only when the local Python server (server/tts_server.py) is running.
const SERVER = "http://127.0.0.1:5123";

const PIPER_VOICES = [
  ["piper:en_GB-cori-medium", "Cori (UK, female)"],
  ["piper:en_GB-alba-medium", "Alba (Scottish, female)"],
  ["piper:en_GB-northern_english_male-medium", "Northern English (UK, male)"],
  ["piper:sv_SE-alma-medium", "Alma (svenska, kvinna)"],
  ["piper:sv_SE-lisa-medium", "Lisa (svenska, kvinna)"],
  ["piper:sv_SE-nst-medium", "NST (svenska, man)"],
].map(([id, label]) => ({ id, label, engine: "piper", lang: id.slice(6, 8) }));

// Firefox: this is a background page, so the worker runs here (engine/host.js is loaded before
// this file). Chromium: a service worker can't start workers, so an offscreen page hosts it.
async function piperTts(req) {
  if (typeof piperHost !== "undefined") return piperHost.tts(req);
  if (!(await chrome.offscreen.hasDocument())) {
    await chrome.offscreen
      .createDocument({ url: "offscreen.html", reasons: ["WORKERS"], justification: "Runs the speech engine." })
      .catch(() => {}); // two requests at once: the other one created it
  }
  return chrome.runtime.sendMessage({ ...req, target: "offscreen" });
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

// Kokoro voices are listed only while the local server answers.
async function serverVoices() {
  try {
    const r = await fetch(`${SERVER}/health`, { signal: AbortSignal.timeout(1500) });
    return (await r.json()).voices.filter((v) => v.engine === "kokoro");
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
  if (msg.type === "tts") {
    (msg.voice.startsWith("piper:") ? piperTts(msg) : serverTts(msg))
      .catch((e) => ({ error: String(e?.message || e) }))
      .then(sendResponse);
    return true;
  }
  if (msg.type === "health") {
    serverVoices().then((kokoro) => sendResponse({ ok: true, voices: [...PIPER_VOICES, ...kokoro] }));
    return true;
  }
});
