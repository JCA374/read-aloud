// The add-on store (needs the internet): Firefox runs no add-on scripts on addons.mozilla.org, so the popup
// offers the reader there. Like a user: open the add-on's store page, open the popup over it, click
// "Read it in Neural Voices"; the reader tab shows the store text and reads it.
import { browser, EXT, waitFor, sleep, check, finish } from "./lib.mjs";

const STORE = "https://addons.mozilla.org/en-US/firefox/addon/a9f96c5f57e94f0c8762/";
const b = await browser(process.argv[2], { quiet: true });
await b.goto(b.ext, `${EXT}/options.html`);
const tabs = () => b.send("browsingContext.getTree", { maxDepth: 0 }).then((r) => r.result.contexts);

// 1. The store page: the add-on can't run there
const store = (await b.send("browsingContext.create", { type: "tab" })).result.context;
await b.send("browsingContext.navigate", { context: store, url: STORE, wait: "complete" });
await sleep(2000);
const blocked = await b.ev(b.ext, `chrome.tabs.query({}).then(ts => Promise.any(ts.filter(t => t.url.startsWith(${JSON.stringify(STORE)})).map(t => chrome.tabs.sendMessage(t.id, {cmd: 'status'})))).then(() => 'answered', () => 'blocked')`);
check("Firefox blocks add-ons on the store page", blocked === "blocked", blocked);

// 2. The popup, opened over the store page (a background tab, so the store page stays the active tab)
const popup = (await b.send("browsingContext.create", { type: "tab", background: true })).result.context;
await b.send("browsingContext.activate", { context: store });
await b.send("browsingContext.navigate", { context: popup, url: `${EXT}/popup.html`, wait: "complete" });
const offered = await waitFor(() => b.ev(popup, `!document.getElementById('store').hidden && document.getElementById('nopage').hidden`), 5000);
check("popup offers the reader on the store page", !!offered, await b.ev(popup, `document.querySelector('.notice:not([hidden])')?.textContent.trim() || 'no notice'`));
const before = (await tabs()).map((t) => t.context);
await b.ev(popup, `document.getElementById('openReader').click(), true`);
const reader = await waitFor(async () => (await tabs()).find((t) => !before.includes(t.context) && t.url.startsWith(`${EXT}/reader.html`))?.context, 5000);
check("the button opens the reader in a new tab", !!reader);
if (!reader) finish(b.errors());

// 3. The reader shows the store text and reads it
const shown = await waitFor(() => b.ev(reader, `!document.getElementById('text').hidden && document.getElementById('article').innerText`), 10000);
check("reader shows the name, summary and description", /^Neural Voices/.test(shown || "") && /WHAT IT DOES/.test(shown) && /About this extension/.test(shown), (shown || "").slice(0, 80));
check("reader shows no HTML tags", shown && !/<\/?[a-z]+>/i.test(shown));
const first = await waitFor(() => b.word(reader), 30000, 50);
check("reading starts by itself", !!first, first || "no word highlighted within 30 s");
const sentence = await b.ev(reader, `(() => { const h = CSS.highlights.get('nv-classic-sentence'); const r = h && [...h][0]; return r ? r.toString() : ''; })()`);
check("it starts at the add-on's name", /Neural Voices/.test(sentence), sentence.slice(0, 60));
await b.stopAll();
await b.ev(reader, `dispatchEvent(new Event('nv-stop')), true`);

// 4. A store address that isn't an add-on page gets a message, not an empty page
await b.goto(reader, `${EXT}/reader.html?url=${encodeURIComponent("https://example.com/")}`);
const msg = await waitFor(() => b.ev(reader, `document.getElementById('notice').hidden ? '' : document.getElementById('notice').textContent`), 3000);
check("reader explains a page it can't show", /can't show/.test(msg || ""), msg || "no message");
const urls = await b.ev(b.ext, `JSON.stringify(["https://addons.mozilla.org/sv-SE/firefox/addon/ublock-origin/", "https://addons.mozilla.org/en-US/firefox/addon/ublock-origin/reviews/", "https://addons.mozilla.org/en-US/firefox/", "https://example.com/firefox/addon/x/"].map(u => NV.storeAddon(u)))`);
check("store add-on pages are recognised, other pages not", urls === '[{"lang":"sv-SE","slug":"ublock-origin"},null,null,null]', urls);
finish(b.errors());
