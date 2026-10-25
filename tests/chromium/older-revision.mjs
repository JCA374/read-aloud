// A voice downloaded at an older revision of the voice collection is reused, not downloaded again:
// Settings shows it as downloaded, and it reads with huggingface.co blocked.
// Needs a profile where Cori is downloaded (KEEP=1) and EXTRA='--host-resolver-rules=MAP huggingface.co ~NOTFOUND'.
import { browser, waitFor, check, finish, CORI } from "./lib.mjs";

const b = await browser();
const opt = await b.open(b.extUrl("options.html"), "options");
await b.sw.ev(`chrome.storage.local.clear()`);
// Move Cori's files to the address an older revision would have used.
const moved = await opt.ev(`(async () => {
  const v = NV_CATALOG.voices.find((v) => v.id === ${JSON.stringify(CORI)});
  const cache = await caches.open("piper-voices");
  const old = NV_CATALOG.base.replace(/[^/]+$/, "0000000000000000000000000000000000000000");
  for (const f of [v.onnx, v.config]) {
    const res = await cache.match(NV_CATALOG.base + "/" + f.path);
    if (!res) return false;
    await cache.put(old + "/" + f.path, res);
    await cache.delete(NV_CATALOG.base + "/" + f.path);
  }
  return true;
})()`);
if (!check("Cori was downloaded in this profile, and moved to an older revision's address", moved)) finish();

await opt.send("Page.reload");
const row = await waitFor(() => opt.ev(`[...document.querySelectorAll('#mine .voice')].find((r) => /Cori/.test(r.textContent))?.textContent`), 5000);
check("Settings counts it as downloaded", /Downloaded/.test(row || ""), row);

const page = await b.open("long.html");
await b.readPage();
const playing = await waitFor(async () => (await b.state()) === "playing", 30000, 250);
check("reads with Cori while huggingface.co is blocked", !!playing, await b.state());
await b.stopAll();

const where = await opt.ev(`(async () => {
  const keys = (await (await caches.open("piper-voices")).keys()).map((r) => r.url).filter((u) => /cori/.test(u));
  return { current: keys.filter((u) => u.startsWith(NV_CATALOG.base)).length, old: keys.filter((u) => /\\/0{40}\\//.test(u)).length };
})()`);
check("files are now under the current revision, the old copies gone", where?.current === 2 && where?.old === 0, JSON.stringify(where));
finish(b.errors);
