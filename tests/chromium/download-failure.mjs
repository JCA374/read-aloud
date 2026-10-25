// Downloads blocked: the player must stop with a clear message instead of skipping sentences.
// Run with a profile that has no voices and EXTRA='--host-resolver-rules=MAP huggingface.co ~NOTFOUND'.
import { browser, waitFor, check, finish, player } from "./lib.mjs";

const b = await browser();
const page = await b.open("long.html");
const t0 = Date.now();
await b.readPage();
const p = await waitFor(async () => { const x = await player(page); return (await x.status()) !== undefined && x; }, 5000);
let last = "";
const msg = await waitFor(async () => {
  const s = await p.status();
  if (s !== last) console.log(`${((Date.now() - t0) / 1000).toFixed(1)} s: ${JSON.stringify(s)}`);
  last = s;
  return /Couldn't/.test(s) && s;
}, 60000, 250);
check("clear message when the voice can't download", !!msg, msg ? `after ${((Date.now() - t0) / 1000).toFixed(1)} s` : `last status ${JSON.stringify(last)}`);
check("reading stopped", !!(await waitFor(async () => (await b.state()) === "idle", 5000)), await b.state());
// the download failure is logged as an error on purpose; anything else is not expected
finish(b.errors.filter((e) => !/download|fetch|Couldn't/i.test(e)));
