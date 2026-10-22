// Chromium only: answers TTS requests forwarded by the background service worker.
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.target !== "offscreen" || msg.type !== "tts") return;
  piperHost.tts(msg).then(sendResponse);
  return true;
});
