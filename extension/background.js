// Relays TTS requests to the local Kokoro server and routes menu/shortcut commands to the tab.
const SERVER = "http://127.0.0.1:5123";

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
    fetch(`${SERVER}/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: msg.text, voice: msg.voice, speed: msg.speed }),
    })
      .then(async (r) => (r.ok ? r.json() : { error: (await r.json().catch(() => ({}))).error || `HTTP ${r.status}` }))
      .then(sendResponse)
      .catch(() => sendResponse({ error: "offline" }));
    return true;
  }
  if (msg.type === "health") {
    fetch(`${SERVER}/health`)
      .then((r) => r.json())
      .then(sendResponse)
      .catch(() => sendResponse({ ok: false }));
    return true;
  }
});
