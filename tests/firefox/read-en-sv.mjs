// Firefox: reads an English and a Swedish page (marked lang="en" on purpose) and checks the first word,
// the highlight moving, the voice, and that the add-on still answers after a second page. A longer
// version of the reading part of the smoke test (more words watched).
import { browser, EXT, waitFor, check, finish } from "./lib.mjs";

const b = await browser(process.argv[2]);
await b.goto(b.ext, `${EXT}/popup.html`); // the add-on's own page, used to send it commands
for (const [page, voice] of [["long.html", "en_GB-cori"], ["sv.html", "sv_SE-alma"]]) {
  const tab = await b.open(page);
  const t0 = Date.now();
  await b.readPage(page);
  const first = await waitFor(() => b.word(tab), 30000, 50);
  check(`${page}: first word highlighted`, !!first, first ? `${((Date.now() - t0) / 1000).toFixed(1)} s` : "nothing within 30 s");
  const words = new Set();
  await waitFor(async () => { const w = await b.word(tab); if (w) words.add(w); return words.size >= 20; }, 25000);
  check(`${page}: highlight moves word by word`, words.size >= 20, `${words.size} different words`);
  const s = await b.status();
  check(`${page}: read with ${voice}`, (s.voice || "").includes(voice), s.voice);
  await b.stopAll();
  check(`${page}: Stop`, (await waitFor(async () => (await b.status()).state === "idle", 3000)) !== null);
  await b.close(tab);
}
finish(b.errors());
