// Firefox versions of what the Chromium tests cover: a pronunciation typed into Settings with real keys and
// used when reading; the player's buttons, speed and volume (arrow keys, mute); Escape; and the engine
// starting again after Firefox stops the background page, and long pieces surviving Firefox's idle limit.
// Run with IDLE_MS=8000 (tests/run.sh does): Firefox then stops an idle background page after 8 s, not 30.
import { browser, EXT, waitFor, sleep, check, finish } from "./lib.mjs";

const b = await browser(process.argv[2], { quiet: true });
const store = (js) => b.ev(b.ext, `chrome.storage.local.${js}.then(r => JSON.stringify(r ?? null))`);
await b.goto(b.ext, `${EXT}/options.html`);
await store("clear()");
await b.goto(b.ext, `${EXT}/options.html`);
await waitFor(() => b.ev(b.ext, `document.querySelectorAll('#mine .voice').length >= 5 && !!$('dictAdd')`), 8000);

// 1. A pronunciation, typed like a user, then Enter
await b.ev(b.ext, `$('dictWord').focus(), true`);
await b.keys(b.ext, "Skerry");
await b.ev(b.ext, `$('dictSay').focus(), true`);
await b.keys(b.ext, "sherry\uE007");
const dict = await waitFor(async () => { const d = JSON.parse(await store("get('dictionary')")).dictionary; return d?.length && d; }, 3000);
check("Settings: typing a pronunciation and Enter saves it", dict?.[0]?.word === "Skerry" && dict[0].say === "sherry", JSON.stringify(dict) + " " + (await b.ev(b.ext, `$('dictWord').value + '|' + $('dictSay').value`)));

// 2. Reading uses it; the player's buttons work
const tab = await b.open("long.html");
let since = Date.now();
await b.readPage("long.html");
await waitFor(() => b.word(tab), 30000, 50);
const log = await waitFor(() => b.logs.find((l) => l.at >= since && /pronunciation: .*sherry light/i.test(l.text)), 15000);
check("reading uses the pronunciation", !!log, log?.text || "no pronunciation logged");
check("the page keeps the original word", await b.ev(tab, `document.body.textContent.includes('Skerry Light')`));

const p = await waitFor(() => b.player(tab), 5000);
const pos = async () => +((await p.status()).match(/^(\d+) \//) || [])[1];
await p.click("play");
check("pause", (await waitFor(async () => (await b.status()).state === "paused", 3000)) !== null);
await p.click("play");
check("resume", (await waitFor(async () => (await b.status()).state === "playing", 5000)) !== null);
const n0 = await waitFor(pos, 5000);
await p.click("next");
const n1 = await waitFor(async () => { const n = await pos(); return n > n0 && n; }, 15000);
check("next sentence", n1 === n0 + 1, `${n0} -> ${n1}`);
await p.click("prev");
const n2 = await waitFor(async () => { const n = await pos(); return n < n1 && n; }, 15000);
check("previous sentence", n2 === n0, `${n1} -> ${n2}`);
await store("set({speed: 1.5})");
const w = await b.word(tab);
check("speed 1.5 keeps reading", (await waitFor(async () => (await b.status()).state === "playing" && (await b.word(tab)) !== w, 8000)) !== null);
await store("set({speed: 1})");

// 3. Volume: arrow keys on the slider, mute and unmute
await b.send("browsingContext.activate", { context: tab });
await p.focusVolume();
await b.keys(tab, "\uE012\uE012\uE012\uE012");
await waitFor(async () => Math.abs(JSON.parse(await store("get('volume')")).volume - 0.8) < 0.001, 3000);
const vol = JSON.parse(await store("get('volume')")).volume;
check("4 × ← on the volume slider lowers it to 80% and saves it", Math.abs(vol - 0.8) < 0.001 && (await p.volume()) === "0.8", `${vol}, slider ${await p.volume()}`);
await p.click("mute");
const muted = await waitFor(async () => JSON.parse(await store("get('volume')")).volume === 0, 3000);
check("mute sets 0 and the button says Unmute", muted && /Unmute/.test(await p.muteTitle()), await p.muteTitle());
await p.click("mute");
const back = await waitFor(async () => Math.abs(JSON.parse(await store("get('volume')")).volume - 0.8) < 0.001, 3000);
check("unmute brings back 80%", !!back, await p.volume());

// 4. Escape stops and clears the highlight
await b.keys(tab, "\uE00C");
check("Escape stops", (await waitFor(async () => (await b.status()).state === "idle", 3000)) !== null);
check("Escape clears the highlight", (await waitFor(async () => !(await b.word(tab)), 2000)) !== null);

// 5. Firefox closes an idle background page even while it is still rendering (here after 8 s). A render that
// takes longer survives only with the keep-alive messages content.js sends every 5 s while it waits
// (askEngine); without them the answer is lost. The second case is a control: if Firefox ever stops doing
// this, the keep-alive can go.
await b.goto(b.ext, `${EXT}/popup.html`);
const longTts = (ping) => b.ev(b.ext, `(() => { const t = Date.now(), k = ${ping} && setInterval(() => chrome.runtime.sendMessage({type: 'keepAlive'}).catch(() => {}), 5000);
  return chrome.runtime.sendMessage({type: 'tts', text: ${JSON.stringify("The keeper climbed the stairs every evening to light the lamp. ".repeat(20))} + ${ping}, voice: 'piper:en_GB-cori-medium', speed: 1})
    .then(r => r?.error || (r ? 'ok' : 'no answer'), e => e.message).finally(() => clearInterval(k)).then(r => r + ' after ' + (Date.now() - t) + ' ms'); })()`);
const kept = await longTts(true);
check("a render longer than the idle limit finishes with keep-alive messages", /^ok after (\d+)/.test(kept) && +kept.match(/(\d+) ms/)[1] > 8000, kept);
const lost = await longTts(false);
check("...and is lost without them (Firefox still closes busy background pages)", /Receiving end does not exist/.test(lost), lost);

// 6. Firefox stops the idle background page (and the engine with it); reading must start again.
// A repeated request is answered from the engine's memory while it runs, and rendered again after a restart.
await b.goto(b.ext, `${EXT}/popup.html`); // an add-on page that only talks to the background now and then
const tts = async () => { const t = Date.now(); const r = await b.ev(b.ext, `chrome.runtime.sendMessage({type: 'tts', text: 'The keeper climbed the stairs.', voice: 'piper:en_GB-cori-medium', speed: 1}).then(r => r.error || 'ok')`); return [r, Date.now() - t]; };
let warm = Infinity;
for (let k = 0; k < 4 && warm > 300; k++) warm = (await tts())[1]; // until the engine answers from memory
await sleep(20000);
const [cold, coldMs] = await tts();
check("after the background page stopped, the engine starts again", warm <= 300 && cold === "ok" && coldMs > warm + 150, `${warm} ms from memory, ${coldMs} ms after 20 s idle (${cold})`);
since = Date.now();
await b.send("browsingContext.activate", { context: tab });
await b.readPage("long.html");
const again = await waitFor(() => b.word(tab), 30000, 50);
check("reading works again after the restart", !!again, `${((Date.now() - since) / 1000).toFixed(1)} s`);
await b.stopAll();
await store("clear()");
finish(b.errors());
