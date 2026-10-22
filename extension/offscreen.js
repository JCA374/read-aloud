// Chromium only: runs engine requests forwarded by the background service worker,
// and passes download progress back to it.
piperHost.onProgress = (p) => chrome.runtime.sendMessage({ ...p, type: "voiceProgress" }).catch(() => {});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.target !== "offscreen") return;
  const run = { tts: piperHost.tts, download: piperHost.download, unload: piperHost.unload }[msg.type];
  if (!run) return;
  run(msg.type === "tts" ? msg : msg.voice).then(sendResponse);
  return true;
});
