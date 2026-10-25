// Piper text-to-speech in WebAssembly, run in a Web Worker so pages never freeze.
// espeak-ng (in piper_phonemize) turns text into phoneme ids; ONNX Runtime runs the voice model.
// All code ships in vendor/; only the voice model files are downloaded (and cached).
//
// Requests:  {id, type: "tts", voice: "piper:sv_SE-alma-medium", text, speed}
//              -> {id, audio: <base64 WAV>, words: [[text, start, end], ...], duration, timing}
//            {id, type: "download", voice} -> {id, ok: true}   (download only, e.g. from settings)
//            {id, type: "unload", voice}   -> {id, ok: true}   (free its memory, e.g. after deleting it)
//            {id, type: "warm", voice}     -> {id, ok}         (load it now if it's downloaded, e.g. popup opened)
// Failures:  {id, error, fatal}  (fatal: the voice itself failed, so there's no point trying the next sentence)
// Progress:  {type: "progress", voice, loaded, total} while a voice downloads

const STARTED = performance.now();
importScripts("vendor/piper_phonemize.js", "vendor/ort.wasm.min.js", "../catalog.js");
const SCRIPTS_MS = performance.now() - STARTED;
let firstTiming = { scriptsMs: Math.round(SCRIPTS_MS) }; // startup costs, reported with the first sentence

const VENDOR = new URL("vendor/", self.location).href;
const CACHE = "piper-voices";
const REPO = "https://huggingface.co/rhasspy/piper-voices/resolve/";
const CATALOG = Object.fromEntries(NV_CATALOG.voices.map((v) => [v.id, v]));

ort.env.wasm.wasmPaths = VENDOR;
ort.env.wasm.numThreads = 1; // threads need cross-origin isolation

const voices = new Map(); // voice id -> Promise<{session, config}>, most recently used last
let speaking = null; // the voice rendering a sentence right now: never unloaded mid-sentence
const KEEP_VOICES = 2; // enough for a page that mixes two languages; each loaded voice holds ~60-100 MB
const downloads = {}; // voice id -> Promise (download in progress)

class VoiceError extends Error {}

function entry(id) {
  const v = CATALOG[id];
  if (!v) throw new VoiceError(`Unknown voice: ${id}`);
  return v;
}

// Download one file with progress, checking its size; 3 tries. Kept in the Cache API.
async function download(id, file, onBytes) {
  const url = `${NV_CATALOG.base}/${file.path}`;
  const cache = await caches.open(CACHE);
  if (await cache.match(url)) return;
  if (await reuseOlder(cache, file)) return;
  let lastError;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, 2000 * attempt));
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const bytes = new Uint8Array(file.size);
      let got = 0;
      const reader = res.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (got + value.length > file.size) throw new Error("file is larger than expected");
        bytes.set(value, got);
        got += value.length;
        onBytes(got);
      }
      if (got !== file.size) throw new Error(`incomplete download (${got} of ${file.size} bytes)`);
      await cache.put(url, new Response(bytes, { headers: { "Content-Type": "application/octet-stream" } }));
      return;
    } catch (e) {
      lastError = e;
      onBytes(0);
    }
  }
  throw new VoiceError(`Couldn't download the voice ${entry(id).label} (${lastError.message}). Check your internet connection and try again.`);
}

// The same file downloaded at an older revision of the voice collection (or before voices were pinned):
// keep it under the new address if its size still matches, instead of downloading it again.
async function reuseOlder(cache, file) {
  const old = (await cache.keys()).find((r) => r.url.startsWith(REPO) && r.url.endsWith(`/${file.path}`));
  if (!old) return false;
  const res = await cache.match(old);
  await cache.delete(old);
  const blob = await res.blob();
  if (blob.size !== file.size) return false;
  await cache.put(`${NV_CATALOG.base}/${file.path}`, new Response(blob, { headers: { "Content-Type": "application/octet-stream" } }));
  return true;
}

function ensureDownloaded(id) {
  downloads[id] ??= (async () => {
    const v = entry(id);
    const total = v.onnx.size + v.config.size;
    let model = 0, config = 0, last = 0;
    const report = () => {
      const now = Date.now();
      if (now - last < 250 && model + config < total) return;
      last = now;
      self.postMessage({ type: "progress", voice: id, loaded: model + config, total });
    };
    await download(id, v.config, (n) => ((config = n), report()));
    await download(id, v.onnx, (n) => ((model = n), report()));
  })().finally(() => delete downloads[id]);
  return downloads[id];
}

async function readCached(file) {
  const res = await (await caches.open(CACHE)).match(`${NV_CATALOG.base}/${file.path}`);
  if (!res) throw new VoiceError("The voice file is missing. Try again to download it.");
  return res;
}

function loadVoice(id) {
  if (voices.has(id)) {
    const p = voices.get(id);
    voices.delete(id); // move to the most recent end
    voices.set(id, p);
    return p;
  }
  const p = (async () => {
    let t = performance.now();
    await ensureDownloaded(id);
    const v = entry(id);
    const [model, config] = await Promise.all([readCached(v.onnx), readCached(v.config)]);
    const bytes = await model.arrayBuffer();
    if (firstTiming) firstTiming.downloadOrReadMs = Math.round(performance.now() - t);
    t = performance.now();
    try {
      const session = await ort.InferenceSession.create(bytes, { executionProviders: ["wasm"] });
      if (firstTiming) firstTiming.sessionMs = Math.round(performance.now() - t);
      return { session, config: await config.json() };
    } catch (e) {
      // A damaged file: remove it so the next try downloads it again.
      const cache = await caches.open(CACHE);
      await cache.delete(`${NV_CATALOG.base}/${v.onnx.path}`);
      throw new VoiceError(`The voice ${v.label} couldn't be loaded, so it will be downloaded again next time.`);
    }
  })();
  voices.set(id, p);
  p.catch(() => voices.get(id) === p && voices.delete(id));
  for (const old of [...voices.keys()].slice(0, -KEEP_VOICES)) if (old !== speaking) unloadVoice(old);
  return p;
}

async function unloadVoice(id) {
  const p = voices.get(id);
  voices.delete(id);
  (await p?.catch(() => null))?.session.release?.();
}

// One espeak-ng module is reused for every sentence; a fresh one is made if it fails.
let phonemizer = null;
let lastIds = null;

function newPhonemizer() {
  return createPiperPhonemize({
    print: (line) => (lastIds = JSON.parse(line).phoneme_ids),
    printErr: () => {},
    locateFile: (file) => VENDOR + file,
  });
}

async function phonemize(text, espeakVoice) {
  for (let attempt = 0; attempt < 2; attempt++) {
    phonemizer ??= newPhonemizer();
    const mod = await phonemizer;
    lastIds = null;
    try {
      mod.callMain(["-l", espeakVoice, "--input", JSON.stringify([{ text }]), "--espeak_data", "/espeak-ng-data"]);
    } catch {}
    if (lastIds) return lastIds;
    phonemizer = null;
  }
  throw new Error("Could not phonemize the text");
}

// Speed is set inside the voice (Piper's length scale), so the pitch stays natural. The model doesn't
// shorten its pauses as much as its sounds, so a plain 1/speed gives only 1.6× at "2×": this curve was
// measured to give 0.75×, 1.25×, 1.5×, 1.75× and about 1.9× (Alma and Cori).
function lengthFor(speed) {
  const k = speed <= 1 ? 1.4 : 1.4 + 0.4 * (speed - 1);
  return 1 / speed ** k;
}

function takeFirstTiming() {
  const t = firstTiming;
  firstTiming = null;
  return t ? { first: t } : {};
}

// Piper gives no word timings: spread the words over the audio by length, with pauses at punctuation.
function estimateWords(text, duration) {
  const lead = 0.08, tail = 0.2;
  const matches = [...text.matchAll(/[\p{L}\p{N}_][\p{L}\p{N}_'’-]*/gu)];
  const spans = matches.map((m, k) => {
    const gap = text.slice(m.index + m[0].length, k + 1 < matches.length ? matches[k + 1].index : text.length);
    const pause = /[.!?;:]/.test(gap) ? 6 : /[,—–()]/.test(gap) ? 3 : 0;
    return [m[0], m[0].length + 1, pause];
  });
  const total = spans.reduce((s, [, w, p]) => s + w + p, 0);
  if (!total) return [];
  const unit = Math.max(duration - lead - tail, 0.1) / total;
  const round = (x) => Math.round(x * 1000) / 1000;
  const words = [];
  let t = lead;
  for (const [word, weight, pause] of spans) {
    words.push([word, round(t), round(t + weight * unit)]);
    t += (weight + pause) * unit;
  }
  return words;
}

function wavBase64(samples, sampleRate) {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  const str = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, "RIFF"); v.setUint32(4, 36 + samples.length * 2, true); str(8, "WAVE");
  str(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  str(36, "data"); v.setUint32(40, samples.length * 2, true);
  const pcm = new Int16Array(buf, 44); // WAV is little-endian, like every machine browsers run on
  for (let i = 0; i < samples.length; i++) pcm[i] = Math.max(-1, Math.min(1, samples[i])) * 32767;
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

async function speak(voice, text, speed = 1) {
  speaking = voice;
  try {
    return await render(voice, text, speed);
  } finally {
    speaking = null;
  }
}

async function render(voice, text, speed) {
  const t0 = performance.now();
  const { session, config } = await loadVoice(voice);
  const t1 = performance.now();
  const ids = await phonemize(text, config.espeak.voice);
  const t2 = performance.now();
  const inf = config.inference;
  const feeds = {
    input: new ort.Tensor("int64", BigInt64Array.from(ids, BigInt), [1, ids.length]),
    input_lengths: new ort.Tensor("int64", BigInt64Array.from([BigInt(ids.length)]), [1]),
    scales: new ort.Tensor("float32", Float32Array.from([inf.noise_scale, inf.length_scale * lengthFor(speed), inf.noise_w]), [3]),
  };
  if (config.num_speakers > 1) feeds.sid = new ort.Tensor("int64", BigInt64Array.from([0n]), [1]);
  const { output } = await session.run(feeds);
  const sr = config.audio.sample_rate;
  const duration = output.data.length / sr;
  return {
    audio: wavBase64(output.data, sr),
    words: estimateWords(text, duration),
    duration: Math.round(duration * 1000) / 1000,
    timing: { loadMs: Math.round(t1 - t0), phonemizeMs: Math.round(t2 - t1), renderMs: Math.round(performance.now() - t2), ...takeFirstTiming() },
  };
}

// One sentence at a time: they share one CPU core anyway. Downloads and unloads don't wait in line.
let queue = Promise.resolve();
const reply = (id, run) =>
  run().then(
    (result) => self.postMessage({ id, ...result }),
    (e) => self.postMessage({ id, error: String(e?.message || e), fatal: e instanceof VoiceError }),
  );

self.onmessage = ({ data }) => {
  if (data.type === "download") return reply(data.id, () => ensureDownloaded(data.voice).then(() => ({ ok: true })));
  if (data.type === "warm") {
    // Load a voice that's already downloaded, so reading starts sooner. Never downloads.
    return reply(data.id, async () => {
      const v = entry(data.voice);
      const cache = await caches.open(CACHE);
      const have = (await cache.match(`${NV_CATALOG.base}/${v.onnx.path}`)) || (await reuseOlder(cache, v.onnx));
      if (!have) return { ok: false };
      phonemizer ??= newPhonemizer();
      await loadVoice(data.voice);
      return { ok: true };
    });
  }
  if (data.type === "unload") {
    return reply(data.id, async () => {
      await unloadVoice(data.voice);
      return { ok: true };
    });
  }
  queue = queue.then(() => reply(data.id, () => speak(data.voice, data.text, data.speed)));
};
