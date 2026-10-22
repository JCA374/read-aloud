// Piper text-to-speech in WebAssembly, run in a Web Worker so pages never freeze.
// espeak-ng (in piper_phonemize) turns text into phoneme ids; ONNX Runtime runs the voice model.
// All code ships in vendor/; only the voice model files are downloaded (and cached).
//
// Request:  {id, voice: "piper:sv_SE-alma-medium", text, speed}
// Response: {id, audio: <base64 WAV>, words: [[text, start, end], ...], duration, timing} or {id, error}

importScripts("vendor/piper_phonemize.js", "vendor/ort.wasm.min.js");

const VENDOR = new URL("vendor/", self.location).href;
const PIPER_URL = "https://huggingface.co/rhasspy/piper-voices/resolve/main";
const CACHE = "piper-voices";

ort.env.wasm.wasmPaths = VENDOR;
ort.env.wasm.numThreads = 1; // threads need cross-origin isolation

const voices = {}; // name -> {session, config}

function modelUrl(name) {
  const [region, speaker, quality] = name.split("-");
  return `${PIPER_URL}/${region.split("_")[0]}/${region}/${speaker}/${quality}/${name}.onnx`;
}

async function cached(url) {
  const cache = await caches.open(CACHE);
  let res = await cache.match(url);
  if (!res) {
    res = await fetch(url);
    if (!res.ok) throw new Error(`Voice download failed (${res.status})`);
    await cache.put(url, res.clone());
  }
  return res;
}

async function loadVoice(name) {
  if (!voices[name]) {
    const url = modelUrl(name);
    const [model, config] = await Promise.all([cached(url), cached(url + ".json")]);
    const session = await ort.InferenceSession.create(await model.arrayBuffer(), { executionProviders: ["wasm"] });
    voices[name] = { session, config: await config.json() };
  }
  return voices[name];
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
  for (let i = 0; i < samples.length; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, samples[i])) * 32767, true);
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

async function speak(voice, text, speed = 1) {
  const t0 = performance.now();
  const { session, config } = await loadVoice(voice.replace(/^piper:/, ""));
  const t1 = performance.now();
  const ids = await phonemize(text, config.espeak.voice);
  const inf = config.inference;
  const feeds = {
    input: new ort.Tensor("int64", BigInt64Array.from(ids, BigInt), [1, ids.length]),
    input_lengths: new ort.Tensor("int64", BigInt64Array.from([BigInt(ids.length)]), [1]),
    scales: new ort.Tensor("float32", Float32Array.from([inf.noise_scale, inf.length_scale / speed, inf.noise_w]), [3]),
  };
  if (config.num_speakers > 1) feeds.sid = new ort.Tensor("int64", BigInt64Array.from([0n]), [1]);
  const { output } = await session.run(feeds);
  const sr = config.audio.sample_rate;
  const duration = output.data.length / sr;
  return {
    audio: wavBase64(output.data, sr),
    words: estimateWords(text, duration),
    duration: Math.round(duration * 1000) / 1000,
    timing: { loadMs: Math.round(t1 - t0), renderMs: Math.round(performance.now() - t1) },
  };
}

// One sentence at a time: they share one CPU core anyway.
let queue = Promise.resolve();
self.onmessage = ({ data }) => {
  queue = queue.then(async () => {
    try {
      self.postMessage({ id: data.id, ...(await speak(data.voice, data.text, data.speed)) });
    } catch (e) {
      self.postMessage({ id: data.id, error: String(e?.message || e) });
    }
  });
};
