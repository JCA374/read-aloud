// Real websites (needs the internet; live pages change, so it is only in the release group): for each page,
// reading starts within 10 s, the first sentence read is the title or in the article (not in a menu, header
// or footer), and there are enough sentences to be the article rather than a few links. On Firefox's add-on
// store, where no add-on can run, the popup says so.
import { browser, EXT, waitFor, check, finish } from "./lib.mjs";

const SITES = [
  ["Wikipedia (English)", "https://en.wikipedia.org/wiki/Lighthouse", "en_GB"],
  ["Wikipedia (Swedish)", "https://sv.wikipedia.org/wiki/Fyr", "sv_SE"],
  ["MDN", "https://developer.mozilla.org/en-US/docs/Web/HTML", "en_GB"],
  ["GitHub README", "https://github.com/rhasspy/piper", "en_GB"],
  ["Essay (old table layout)", "https://paulgraham.com/hwh.html", "en_GB"],
  ["Mozilla manifesto", "https://www.mozilla.org/en-US/about/manifesto/", "en_GB"],
];

const b = await browser(process.argv[2], { quiet: true });
await b.goto(b.ext, `${EXT}/options.html`);
for (const [name, url, voice] of SITES) {
  const tab = (await b.send("browsingContext.create", { type: "tab" })).result.context;
  const nav = await b.send("browsingContext.navigate", { context: tab, url, wait: "complete" });
  if (nav.error) { check(`${name}: page opens`, false, nav.message); continue; }
  const ready = await waitFor(() => b.ev(b.ext, `chrome.tabs.query({}).then(ts => Promise.any(ts.filter(t => t.url.startsWith(${JSON.stringify(url)})).map(t => chrome.tabs.sendMessage(t.id, {cmd: 'status'})))).then(() => true, () => false)`), 10000);
  if (!ready) { check(`${name}: the add-on runs on the page`, false, "no answer from the page"); await b.close(tab); continue; }
  const t0 = Date.now();
  await b.ev(b.ext, `chrome.tabs.query({}).then(ts => Promise.any(ts.filter(t => t.url.startsWith(${JSON.stringify(url)})).map(t => chrome.tabs.sendMessage(t.id, {cmd: 'readPage'})))).then(() => true)`);
  const first = await waitFor(() => b.word(tab), 10000, 50);
  const where = await b.ev(tab, `(() => { const h = CSS.highlights.get('nv-classic-sentence'); const r = h && [...h][0]; if (!r) return 'none';
    const el = r.commonAncestorContainer.nodeType === 1 ? r.commonAncestorContainer : r.commonAncestorContainer.parentElement;
    const title = el.closest('h1'); // the article's title may sit in a header; reading it first is right
    const bad = !title && el.closest('nav,header,footer,aside,[role=navigation],[role=banner],[role=contentinfo]');
    return (bad ? 'IN ' + bad.tagName + ': ' : '') + r.toString().slice(0, 70); })()`);
  const p = await b.player(tab);
  const total = +(((await p?.status()) || "").match(/\/ (\d+)/) || [])[1];
  const s = await b.status();
  check(`${name}: reads the article`, !!first && !/^(IN |none)/.test(where) && total >= 10 && (s.voice || "").includes(voice),
    `${first ? ((Date.now() - t0) / 1000).toFixed(1) + " s" : "no sound in 10 s"}; ${total} sentences; ${s.voice}; starts "${where}"`);
  await b.stopAll();
  await waitFor(async () => (await b.status()).state === "idle", 3000);
  await b.close(tab);
}
// Firefox's add-on store: no add-on can run there, so the popup says so (no "reload" advice)
const store = (await b.send("browsingContext.create", { type: "tab" })).result.context;
await b.send("browsingContext.navigate", { context: store, url: "https://addons.mozilla.org/en-US/firefox/addon/a9f96c5f57e94f0c8762/", wait: "complete" });
const popup = (await b.send("browsingContext.create", { type: "tab", background: true })).result.context;
await b.send("browsingContext.activate", { context: store });
await b.send("browsingContext.navigate", { context: popup, url: `${EXT}/popup.html`, wait: "complete" });
const said = await waitFor(() => b.ev(popup, `document.querySelector('.notice:not([hidden])')?.textContent.trim()`), 5000);
check("add-on store: the popup says why it can't be read", /add-on store/.test(said || ""), said || "no notice");
// Pages from the internet log their own warnings; only the add-on's count here.
finish(b.errors().filter((e) => /Neural Voices|moz-extension/.test(e)));
