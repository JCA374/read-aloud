// Reads an English page, a Swedish page (marked lang="en" on purpose), then the English page again
// (text already rendered, so it should start at once). First highlighted word, words moving, right voice.
import { browser, waitFor, check, finish, hl, player, CORI, ALMA } from "./lib.mjs";

const b = await browser();
for (const [run, page, voice, limit] of [["English", "long.html", CORI, 30], ["Swedish", "sv.html", ALMA, 30], ["English again", "long.html", CORI, 2]]) {
  const tab = await b.open(page);
  const t0 = Date.now();
  await b.readPage();
  const first = await waitFor(() => hl(tab, "word"), limit * 1000, 50);
  const secs = (Date.now() - t0) / 1000;
  check(`${run}: first word highlighted within ${limit} s`, !!first, first ? `${secs.toFixed(1)} s` : "nothing");
  const words = new Set();
  await waitFor(async () => { const w = await hl(tab, "word"); if (w) words.add(w); return words.size >= 15; }, 20000);
  check(`${run}: highlight moves word by word`, words.size >= 15, `${words.size} different words`);
  check(`${run}: read with ${voice.slice(6)}`, (await (await player(tab)).voice()) === voice);
  await b.stopAll();
  check(`${run}: Stop`, (await waitFor(async () => (await b.state()) === "idle", 3000)) !== null);
}
finish(b.errors);
