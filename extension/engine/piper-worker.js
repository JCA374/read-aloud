// Piper text-to-speech in WebAssembly, run in a Web Worker so pages never freeze.
// espeak-ng (in piper_phonemize) turns text into phoneme ids; ONNX Runtime runs the voice model.
// All code ships in vendor/; only the voice model files are downloaded (and cached).

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
  const hit = !!res;
  if (!res) {
    res = await fetch(url);
    if (!res.ok) throw new Error(`Download failed (${res.status}): ${url}`);
    await cache.put(url, res.clone());
  }
  return { res, hit };
}

async function loadVoice(name) {
  if (voices[name]) return { downloadMs: 0, loadMs: 0, fromCache: true };
  let t = performance.now();
  const url = modelUrl(name);
  const [model, config] = await Promise.all([cached(url), cached(url + ".json")]);
  const bytes = await model.res.arrayBuffer();
  const json = await config.res.json();
  const downloadMs = performance.now() - t;
  t = performance.now();
  const session = await ort.InferenceSession.create(bytes, { executionProviders: ["wasm"] });
  voices[name] = { session, config: json };
  return { downloadMs, loadMs: performance.now() - t, fromCache: model.hit, sizeMB: bytes.byteLength / 1e6 };
}

function phonemize(text, espeakVoice) {
  return new Promise((resolve, reject) => {
    createPiperPhonemize({
      print: (line) => resolve(JSON.parse(line).phoneme_ids),
      printErr: (msg) => reject(new Error(msg)),
      locateFile: (file) => VENDOR + file,
    }).then((mod) => {
      mod.callMain(["-l", espeakVoice, "--input", JSON.stringify([{ text }]), "--espeak_data", "/espeak-ng-data"]);
    }, reject);
  });
}

async function speak(name, text, speed = 1) {
  const timing = await loadVoice(name);
  const { session, config } = voices[name];
  let t = performance.now();
  const ids = await phonemize(text, config.espeak.voice);
  const phonemizeMs = performance.now() - t;
  t = performance.now();
  const inf = config.inference;
  const feeds = {
    input: new ort.Tensor("int64", BigInt64Array.from(ids, BigInt), [1, ids.length]),
    input_lengths: new ort.Tensor("int64", BigInt64Array.from([BigInt(ids.length)]), [1]),
    scales: new ort.Tensor("float32", Float32Array.from([inf.noise_scale, inf.length_scale / speed, inf.noise_w]), [3]),
  };
  if (config.num_speakers > 1) feeds.sid = new ort.Tensor("int64", BigInt64Array.from([0n]), [1]);
  const { output } = await session.run(feeds);
  const samples = new Float32Array(output.data);
  return {
    samples,
    sampleRate: config.audio.sample_rate,
    timing: { ...timing, phonemizeMs, inferMs: performance.now() - t },
  };
}

self.onmessage = async ({ data }) => {
  try {
    const result = await speak(data.voice, data.text, data.speed);
    self.postMessage({ id: data.id, ...result }, [result.samples.buffer]);
  } catch (e) {
    self.postMessage({ id: data.id, error: String(e?.stack || e) });
  }
};
