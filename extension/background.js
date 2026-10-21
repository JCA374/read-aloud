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

chrome.commands.onCommand.addListener(async (command) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) toTab(tab.id, { cmd: command === "stop" ? "stop" : "toggle" });
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
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
