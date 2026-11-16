// Pages with frames: frames.html holds an article in an iframe from another site (like an artifact on
// claude.ai) and a tiny frame with text. "Read page" (toggle, as the popup and the shortcut send it) reads
// the article frame, not the page's few words or the tiny frame; status and Stop reach the reading frame;
// selected text in the page wins; a frame that starts stops the page; click-to-read is switched in every
// frame at once, and Escape in the frame switches it off everywhere.
import { browser, waitFor, check, finish, hl, CORI } from "./lib.mjs";

const b = await browser({ quiet: true });
await b.sw.ev(`chrome.storage.local.clear()`);
const page = await b.open("frames.html");
const tabId = await b.sw.ev(`chrome.tabs.query({active: true}).then(ts => ts[0].id)`);
const list = async () => (await (await fetch("http://127.0.0.1:9333/json")).json());
const frameTarget = await waitFor(async () => (await list()).find((t) => t.type === "iframe" && /long\.html/.test(t.url)), 10000);
check("the article frame is a page of its own", !!frameTarget);
const frame = await b.connect(frameTarget, "frame");
const status = (frameId) => b.sw.ev(`chrome.tabs.sendMessage(${tabId}, {cmd: 'status'}, {frameId: ${frameId}})`);
const cmd = (c) => b.sw.ev(`toFrame(${tabId}, {cmd: ${JSON.stringify(c)}})`); // as the popup's and the shortcut's commands go

// 1. Every frame bids; the article frame has the most text
const bids = await waitFor(async () => {
  const got = await b.sw.ev(`(async () => { const got = []; bids.set('t', got); await chrome.tabs.sendMessage(${tabId}, {cmd: 'bid', token: 't'}).catch(() => {});
    await new Promise(r => setTimeout(r, 300)); bids.delete('t'); return got.sort((a, b) => a.frameId - b.frameId); })()`);
  return got.length >= 3 && got;
}, 10000, 300);
check("the page, the article frame and the tiny frame answer", bids?.length === 3, JSON.stringify(bids));
const best = await b.sw.ev(`bestFrame(${tabId})`);
const article = bids?.find((x) => x.frameId === best);
check("the article frame is picked: most text, and the tiny frame counts as empty", best !== 0 && article?.text > 1000 && bids.some((x) => x.frameId !== 0 && x.frameId !== best && x.text === 0), `frame ${best}: ${JSON.stringify(article)}`);

// 2. Read page reads the article frame; status and Stop reach it
const started = await cmd("toggle"); // answered at once, before reading starts
check("Read page reaches a frame", !!started?.state, JSON.stringify(started));
check("reading starts in the article frame", (await waitFor(async () => (await status(best)).state !== "idle", 5000)) !== null, JSON.stringify(await status(best)));
const word = await waitFor(() => hl(frame, "word"), 30000, 50);
check("words highlighted inside the frame", !!word, word);
check("the page itself stays idle, nothing highlighted there", (await status(0)).state === "idle" && !(await hl(page, "sentence")));
const st = await cmd("status");
check("status (as the popup asks) comes from the reading frame", st?.state !== "idle" && st?.voice === CORI, JSON.stringify(st));
await cmd("stop");
check("Stop reaches the frame", (await waitFor(async () => (await status(best)).state === "idle", 3000)) !== null);
check("Stop clears the frame's highlight", (await waitFor(async () => !(await hl(frame, "sentence")), 2000)) !== null);

// 3. Selected text in the page wins over the frame's text
await page.ev(`getSelection().selectAllChildren(document.querySelector('p'))`);
await cmd("toggle");
const topWord = await waitFor(() => hl(page, "word"), 30000, 50);
check("selected text in the page is read, not the frame", !!topWord && !(await hl(frame, "sentence")) && (await status(best)).state === "idle", topWord);

// 4. The frame starts while the page reads: the page stops (one reader per tab)
await b.sw.ev(`chrome.tabs.sendMessage(${tabId}, {cmd: 'readPage'}, {frameId: ${best}})`);
await waitFor(() => hl(frame, "word"), 30000, 50);
check("when the frame starts, the page stops", (await waitFor(async () => (await status(0)).state === "idle" && !(await hl(page, "sentence")), 5000)) !== null);
await cmd("stop");
await waitFor(async () => (await status(best)).state === "idle", 3000);

// 5. Click-to-read is switched in every frame at once
const modes = () => b.sw.ev(`Promise.all([0, ${best}].map(f => chrome.tabs.sendMessage(${tabId}, {cmd: 'status'}, {frameId: f}).then(s => s.clickMode)))`);
await cmd("clickMode");
check("click-to-read from the popup: on in the page and in the frame", (await waitFor(async () => (await modes()).every(Boolean), 3000)) !== null, JSON.stringify(await modes()));
await frame.ev(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`);
check("Escape in the frame switches it off everywhere", (await waitFor(async () => !(await modes()).some(Boolean), 3000)) !== null, JSON.stringify(await modes()));

finish(b.errors);
