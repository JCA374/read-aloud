import * as ort from "onnxruntime-web";
import { readFileSync } from "node:fs";
ort.env.wasm.numThreads = 1;
const model = readFileSync(process.argv[2]);
const ids = Array.from({ length: 120 }, (_, i) => BigInt([1, 0, 25, 0, 59, 0, 14, 0, 120, 0, 3, 0][i % 12]));
for (const level of (process.argv[3] || "all,extended,basic,disabled").split(",")) {
  let t = performance.now();
  const s = await ort.InferenceSession.create(model, { executionProviders: ["wasm"], graphOptimizationLevel: level });
  const create = performance.now() - t;
  const feeds = {
    input: new ort.Tensor("int64", BigInt64Array.from(ids), [1, ids.length]),
    input_lengths: new ort.Tensor("int64", BigInt64Array.from([BigInt(ids.length)]), [1]),
    scales: new ort.Tensor("float32", Float32Array.from([0.667, 1, 0.8]), [3]),
  };
  let runs = [];
  for (let k = 0; k < 3; k++) { t = performance.now(); const { output } = await s.run(feeds); runs.push([performance.now() - t, output.data.length / 22050]); }
  const rtf = runs.slice(1).map(([ms, a]) => ms / 1000 / a);
  console.log(`${level.padEnd(9)} create ${create.toFixed(0)} ms, real-time factor ${(rtf.reduce((a, b) => a + b) / rtf.length).toFixed(3)} (audio ${runs[0][1].toFixed(1)} s)`);
  await s.release();
}
