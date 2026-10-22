const log = (s) => (document.getElementById("log").textContent += s + "\n");
const worker = new Worker(chrome.runtime.getURL("engine/piper-worker.js"));
const pending = {};
let nextId = 0;
let ctx;

worker.onmessage = ({ data }) => pending[data.id]?.(data);
worker.onerror = (e) => log("Worker error: " + e.message);

function speak(voice, text) {
  const id = nextId++;
  worker.postMessage({ id, voice, text, speed: 1 });
  return new Promise((resolve) => (pending[id] = resolve));
}

async function run(voice, text) {
  ctx ??= new AudioContext();
  const t = performance.now();
  const r = await speak(voice, text);
  const total = performance.now() - t;
  if (r.error) return log(`${voice}: ERROR ${r.error}`), { voice, error: r.error };
  const buf = ctx.createBuffer(1, r.samples.length, r.sampleRate);
  buf.copyToChannel(r.samples, 0);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.connect(ctx.destination);
  src.start();
  const audio = r.samples.length / r.sampleRate;
  const tm = r.timing;
  const out = {
    voice, firstAudioMs: Math.round(total), audioS: +audio.toFixed(2),
    downloadMs: Math.round(tm.downloadMs), fromCache: tm.fromCache, sizeMB: tm.sizeMB && +tm.sizeMB.toFixed(1),
    loadMs: Math.round(tm.loadMs), phonemizeMs: Math.round(tm.phonemizeMs), inferMs: Math.round(tm.inferMs),
    realTimeFactor: +(tm.inferMs / 1000 / audio).toFixed(3),
  };
  log(JSON.stringify(out));
  return out;
}

for (const b of document.querySelectorAll("button[data-voice]")) {
  b.onclick = () => run(b.dataset.voice, b.dataset.text);
}
window.runTest = run; // for automated tests
