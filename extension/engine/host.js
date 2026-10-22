// Runs the Piper worker and keeps recent results. Loaded by Firefox's background page,
// and by offscreen.html in Chromium (a service worker can't start workers).
// The worker is stopped after a few idle minutes to free its memory, and restarted on the next request.

const piperHost = (() => {
  const IDLE_MS = 5 * 60 * 1000;
  const CACHE_SIZE = 30; // recent sentences, so jumping back or replaying is instant (~10 MB at most)
  const cache = new Map(); // key -> Promise<result>
  const pending = new Map(); // request id -> resolve
  let worker = null;
  let idleTimer = null;
  let nextId = 0;

  function start() {
    worker = new Worker(chrome.runtime.getURL("engine/piper-worker.js"));
    worker.onmessage = ({ data }) => {
      if (data.type === "progress") return host.onProgress(data);
      pending.get(data.id)?.(data);
      pending.delete(data.id);
    };
    worker.onerror = (e) => {
      for (const resolve of pending.values()) resolve({ error: e.message || "Voice engine crashed" });
      pending.clear();
      stop();
    };
  }

  function stop() {
    worker?.terminate();
    worker = null;
  }

  // Nothing to do for a while: free the engine, the voices and the kept audio.
  function idle() {
    stop();
    cache.clear();
    host.onIdle();
  }

  function call(msg) {
    if (!worker) start();
    clearTimeout(idleTimer);
    const id = nextId++;
    return new Promise((resolve) => {
      pending.set(id, resolve);
      worker.postMessage({ id, ...msg });
    }).finally(() => {
      if (!pending.size) idleTimer = setTimeout(idle, IDLE_MS);
    });
  }

  function tts(req) {
    const key = `${req.voice}|${Math.round(req.speed * 100)}|${req.text}`;
    if (cache.has(key)) {
      const p = cache.get(key);
      cache.delete(key); // move to the newest end
      cache.set(key, p);
      return p;
    }
    const p = call({ type: "tts", voice: req.voice, text: req.text, speed: req.speed }).then((res) => {
      if (res.error) cache.delete(key); // don't keep failures
      return res;
    });
    cache.set(key, p);
    while (cache.size > CACHE_SIZE) cache.delete(cache.keys().next().value);
    return p;
  }

  // Download a voice without speaking (settings page), or free one that was deleted.
  const download = (voice) => call({ type: "download", voice });
  const unload = (voice) => (worker ? call({ type: "unload", voice }) : Promise.resolve({ ok: true }));
  const warm = (voice) => call({ type: "warm", voice });

  const host = { tts, download, unload, warm, onProgress: () => {}, onIdle: () => {} };
  return host;
})();
