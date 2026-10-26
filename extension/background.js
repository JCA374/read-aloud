// Neural Voices background: renders speech and routes menu/shortcut commands to the tab.
// Speech comes from Piper running in the add-on itself (WebAssembly worker, engine/), as
// {audio: base64 WAV, words, duration} or {error, fatal}.

// Firefox loads these before this file (manifest); Chromium's service worker imports them here.
if (typeof NV === "undefined") importScripts("catalog.js", "common.js");

// The voices the add-on offers, without the download details.
const PIPER_VOICES = NV_CATALOG.voices.map(({ id, label, lang, langName }) => ({ id, label, lang, langName, engine: "piper" }));

// Firefox: this is a background page, so the worker runs here (engine/host.js is loaded before
// this file). Chromium: a service worker can't start workers, so an offscreen page hosts it.
// type is "tts", "download", "unload" or "warm".
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

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: "read-selection", title: "Read aloud", contexts: ["selection"] });
  chrome.contextMenus.create({ id: "read-from-here", title: "Read aloud from here", contexts: ["page", "link", "image"] });
  chrome.contextMenus.create({ id: "read-pdf", title: "Read PDF aloud", contexts: ["link"], targetUrlPatterns: ["*://*/*.pdf", "*://*/*.pdf?*", "*://*/*.PDF"] });
});

function toTab(tabId, msg) {
  return NV.sendToTab(tabId, msg).catch(() => {});
}

// Show a PDF in the add-on's viewer (pdf.html), in the same tab or a new one next to it.
function openPdf(url, tab, { read = true, newTab = false } = {}) {
  const viewer = NV.pdfViewerUrl(url, read);
  if (newTab || !tab?.id) return chrome.tabs.create({ url: viewer, index: tab ? tab.index + 1 : undefined, openerTabId: tab?.id });
  return chrome.tabs.update(tab.id, { url: viewer }).catch((e) => console.warn("[Neural Voices] couldn't open the PDF viewer:", e));
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "read-pdf") return openPdf(info.linkUrl, tab, { newTab: true });
  if (!tab?.id) return;
  // Firefox's own PDF viewer runs no content scripts: "Read aloud from here" there opens the PDF in ours.
  if (NV.looksLikePdf(tab.url) && info.menuItemId === "read-from-here") return NV.sendToTab(tab.id, { cmd: "status" }).catch(() => openPdf(tab.url, tab));
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
  if (!target) return;
  const msg = { cmd: command === "stop" ? "stop" : "toggle" };
  // A PDF in Firefox's own viewer can't be reached: Read opens it in the add-on's viewer.
  NV.sendToTab(target, msg).catch(() => command === "read" && target === tab?.id && NV.looksLikePdf(tab.url) && openPdf(tab.url, tab));
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "reading" && sender.tab?.id != null) {
    onReading(sender.tab.id, msg.state);
    return;
  }
  if (msg.type === "engineIdle") {
    console.debug("[Neural Voices] engine idle: closing the engine page");
    chrome.offscreen.closeDocument().catch((e) => console.warn("[Neural Voices] couldn't close the engine page:", e)); // Chromium
    return;
  }
  if (msg.type === "voiceProgress") {
    relayProgress(msg); // Chromium: from the offscreen page
    return;
  }
  if (msg.type === "tts") {
    piperTts(msg, sender.tab?.id)
      .catch((e) => ({ error: String(e?.message || e) }))
      .then(sendResponse);
    return true;
  }
  if (msg.type === "openOptions") {
    chrome.runtime.openOptionsPage();
    return;
  }
  if (msg.type === "openPdf") {
    openPdf(msg.url, sender.tab, { read: msg.read });
    return;
  }
  if (msg.type === "voices") {
    sendResponse(PIPER_VOICES);
    return;
  }
  if (["download", "unload", "warm"].includes(msg.type) && !msg.target) {
    engine(msg.type, msg).catch((e) => ({ error: String(e?.message || e) })).then(sendResponse);
    return true;
  }
});
