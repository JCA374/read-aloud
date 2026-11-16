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
  const open = () => chrome.offscreen.hasDocument();
  if (!(await open())) {
    await chrome.offscreen.createDocument({ url: "offscreen.html", reasons: ["WORKERS"], justification: "Runs the speech engine." }).catch(async (e) => {
      // Two requests at once: the other one created it. Anything else is worth seeing.
      if (!(await open())) console.warn("[Neural Voices] couldn't open the engine page:", e);
    });
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

// Firefox for Android has no right-click menus and no keyboard shortcuts (chrome.contextMenus and
// chrome.commands are missing): without these checks the script would stop here, and nothing else in
// it (speech, downloads) would answer.
chrome.runtime.onInstalled.addListener(() => {
  if (!chrome.contextMenus) return;
  chrome.contextMenus.create({ id: "read-selection", title: "Read aloud", contexts: ["selection"] });
  chrome.contextMenus.create({ id: "read-from-here", title: "Read aloud from here", contexts: ["page", "link", "image"] });
  chrome.contextMenus.create({ id: "fix-pronunciation", title: "Fix pronunciation of “%s”", contexts: ["selection"] });
  chrome.contextMenus.create({ id: "read-pdf", title: "Read PDF aloud", contexts: ["link"], targetUrlPatterns: ["*://*/*.pdf", "*://*/*.pdf?*", "*://*/*.PDF"] });
});

function toTab(tabId, msg, frameId) {
  return NV.sendToTab(tabId, msg, frameId).catch(() => {});
}

// A page can hold other pages in frames (an editor, or an artifact on claude.ai), each with its own copy of
// content.js. A command for "the page" goes to the frame that's reading. When none is, "stop" goes to every
// frame, and the others to the frame with selected text, else the one with the most text: every frame is
// asked (a "bid": {text, selection, frames}) and answers the background with a runtime message.
const bids = new Map(); // token -> [{frameId, text, selection}]
async function bestFrame(tabId) {
  const top = await NV.sendToTab(tabId, { cmd: "bid" }, 0).catch(() => null);
  if (!top) return undefined; // no content script in the page: let the command fail as before
  if (!top.frames || top.selection) return 0;
  const token = `${Date.now()}-${Math.random()}`;
  const got = [{ frameId: 0, ...top }];
  bids.set(token, got);
  await NV.sendToTab(tabId, { cmd: "bid", token }).catch(() => {});
  await new Promise((r) => setTimeout(r, 150));
  bids.delete(token);
  got.sort((a, b) => b.selection - a.selection || b.text - a.text);
  return got[0].frameId;
}

async function toFrame(tabId, msg) {
  const r = await reading();
  if (r?.tab === tabId) {
    try {
      return await NV.sendToTab(tabId, msg, r.frame);
    } catch {
      await chrome.storage.session.remove("reading"); // that frame is gone
    }
  }
  if (msg.cmd === "stop") return NV.sendToTab(tabId, msg);
  return NV.sendToTab(tabId, msg, await bestFrame(tabId));
}

// Show a PDF in the add-on's viewer (pdf.html), in the same tab or a new one next to it.
function openPdf(url, tab, { read = true, newTab = false } = {}) {
  const viewer = NV.pdfViewerUrl(url, read);
  if (newTab || !tab?.id) return chrome.tabs.create({ url: viewer, index: tab ? tab.index + 1 : undefined, openerTabId: tab?.id });
  return chrome.tabs.update(tab.id, { url: viewer }).catch((e) => console.warn("[Neural Voices] couldn't open the PDF viewer:", e));
}

chrome.contextMenus?.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "read-pdf") return openPdf(info.linkUrl, tab, { newTab: true });
  if (info.menuItemId === "fix-pronunciation") {
    const word = (info.selectionText || "").trim().replace(/\s+/g, " ").slice(0, 100);
    return chrome.tabs.create({ url: chrome.runtime.getURL(`options.html?word=${encodeURIComponent(word)}#pronunciation`), index: tab ? tab.index + 1 : undefined });
  }
  if (!tab?.id) return;
  // Firefox's own PDF viewer runs no content scripts: "Read aloud from here" there opens the PDF in ours.
  if (NV.looksLikePdf(tab.url) && info.menuItemId === "read-from-here") return NV.sendToTab(tab.id, { cmd: "status" }, info.frameId).catch(() => openPdf(tab.url, tab));
  toTab(tab.id, { cmd: info.menuItemId === "read-selection" ? "readSelection" : "readFromHere" }, info.frameId); // the frame that was right-clicked
});

// Only one tab (one frame) reads at a time. It's kept in session storage, because the background script
// can be unloaded between events.
async function reading() {
  return (await chrome.storage.session.get("reading")).reading ?? null;
}

async function onReading(tabId, frameId, state) {
  const r = await reading();
  const same = r?.tab === tabId && r.frame === frameId;
  if (state === "idle") {
    if (same) await chrome.storage.session.remove("reading");
    return;
  }
  if (same) return;
  await chrome.storage.session.set({ reading: { tab: tabId, frame: frameId } });
  if (r) toTab(r.tab, { cmd: "stop" }, r.frame); // another tab or frame started: stop the old one
  toTab(tabId, { cmd: "clickMode", on: false }); // the page's other frames leave click-to-read
}

chrome.tabs.onRemoved.addListener(async (tabId) => {
  if ((await reading())?.tab === tabId) await chrome.storage.session.remove("reading");
});

// Shortcuts act on the tab that's reading, even from another tab; otherwise on the tab you're in.
chrome.commands?.onCommand.addListener(async (command) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const msg = { cmd: command === "stop" ? "stop" : "toggle" };
  const r = await reading();
  if (r && r.tab !== tab?.id) {
    if (await NV.sendToTab(r.tab, msg, r.frame).then(() => true, () => false)) return;
    await chrome.storage.session.remove("reading"); // that page is gone
  }
  if (!tab?.id) return;
  // A PDF in Firefox's own viewer can't be reached: Read opens it in the add-on's viewer.
  toFrame(tab.id, msg).catch(() => command === "read" && NV.looksLikePdf(tab.url) && openPdf(tab.url, tab));
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "reading" && sender.tab?.id != null) {
    onReading(sender.tab.id, sender.frameId ?? 0, msg.state);
    return;
  }
  if (msg.type === "bid") {
    bids.get(msg.token)?.push({ frameId: sender.frameId ?? 0, text: msg.text, selection: msg.selection });
    return;
  }
  if (msg.type === "command") {
    // From the popup: a command for the page in tab msg.tabId, routed to the right frame. null: no content script.
    toFrame(msg.tabId, { cmd: msg.cmd }).then(sendResponse, () => sendResponse(null));
    return true;
  }
  if (msg.type === "clickMode" && sender.tab?.id != null) {
    toTab(sender.tab.id, { cmd: "clickMode", on: msg.on }); // click-to-read is switched in every frame of the page
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
  if (msg.type === "keepAlive") return; // a content script waiting for speech: keeps Firefox's background page running
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
