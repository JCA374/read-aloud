// Speak every line of script.json with the add-on's own engine and save the audio and word timings:
//   tests/chromium.sh tools/video/narrate.mjs        -> tools/video/out/line-NN.wav + narration.json
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
const here = new URL(".", import.meta.url).pathname;
const script = JSON.parse(readFileSync(`${here}script.json`, "utf8"));
mkdirSync(`${here}out`, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const list = async () => (await (await fetch("http://127.0.0.1:9333/json")).json());
let targets;
for (let k = 0; k < 60; k++) { try { targets = await list(); if (targets.some((t) => t.type === "service_worker")) break; } catch {} await sleep(500); }
const extId = new URL(targets.find((t) => t.type === "service_worker").url).host;
await fetch(`http://127.0.0.1:9333/json/new?chrome-extension://${extId}/options.html`, { method: "PUT" });
await sleep(1500);
const t = (await list()).find((t) => t.url.includes("options.html"));
const ws = new WebSocket(t.webSocketDebuggerUrl); let id = 0; const pending = new Map();
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } };
await new Promise((r) => (ws.onopen = r));
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const out = [];
for (const [i, line] of script.entries()) {
  const r = await send("Runtime.evaluate", {
    expression: `chrome.runtime.sendMessage({type: "tts", voice: ${JSON.stringify(line.voice)}, text: ${JSON.stringify(line.text)}, speed: 1})`,
    awaitPromise: true, returnByValue: true,
  });
  const res = r.result?.result?.value;
  if (!res || res.error) { console.log(`line ${i}: ERROR ${res?.error || JSON.stringify(r).slice(0, 200)}`); process.exit(1); }
  const file = `line-${String(i).padStart(2, "0")}.wav`;
  writeFileSync(`${here}out/${file}`, Buffer.from(res.audio, "base64"));
  out.push({ ...line, file, duration: res.duration, words: res.words });
  console.log(`line ${i} (slide ${line.slide}, ${line.voice.slice(6)}): ${res.duration.toFixed(1)} s`);
}
writeFileSync(`${here}out/narration.json`, JSON.stringify(out, null, 1));
process.exit(0);
