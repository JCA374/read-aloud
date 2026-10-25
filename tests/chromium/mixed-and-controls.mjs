// The whole mixed-language page (every sentence gets the voice for its language) and the controls on a
// 400-paragraph page, including Escape, which the smoke test doesn't press.
import { browser, waitFor, sleep, check, finish, hl, player, CORI, ALMA } from "./lib.mjs";

const b = await browser({ quiet: true });

// 1. Mixed page, read to the end: Swedish sentences with Alma, English with Cori
const mixed = await b.open("mixed.html");
await b.readPage();
await waitFor(() => hl(mixed, "word"), 30000, 50);
const pm = await player(mixed);
const seen = new Map();
await waitFor(async () => {
  const s = (await hl(mixed, "sentence")).slice(0, 30);
  if (s && !seen.has(s)) seen.set(s, await pm.voice());
  return seen.size > 0 && (await b.state()) === "idle";
}, 120000, 250);
const wrong = [...seen].filter(([s, v]) => (/[åäö]|^(Fyren|Varje|Hans|Hon)/.test(s) ? v !== ALMA : v !== CORI));
check("mixed page read to the end", seen.size >= 8, `${seen.size} sentences`);
check("every sentence read with the voice for its language", wrong.length === 0, wrong.map(([s, v]) => `${s} -> ${v}`).join("; "));

// 2. Controls on the long page
const huge = await b.open("huge.html");
await b.readPage();
const p = await player(huge);
await waitFor(() => hl(huge, "word"), 30000, 50);
const pos = async () => +((await p.status()).match(/^(\d+) \//) || [])[1];
await p.click("play");
check("pause", (await waitFor(async () => (await b.state()) === "paused", 3000)) !== null);
const held = await hl(huge, "word"); await sleep(1500);
check("pause holds the word highlight", (await hl(huge, "word")) === held, JSON.stringify(held));
await p.click("play");
check("resume", (await waitFor(async () => (await b.state()) === "playing", 5000)) !== null);
const n0 = await waitFor(pos, 5000);
await p.click("next");
const n1 = await waitFor(async () => { const n = await pos(); return n > n0 && n; }, 5000);
check("next sentence", n1 === n0 + 1, `${n0} -> ${n1}`);
await p.click("prev");
const n2 = await waitFor(async () => { const n = await pos(); return n < n1 && n; }, 5000);
check("previous sentence", n2 === n0, `${n1} -> ${n2}`);
await b.sw.ev(`chrome.storage.local.set({speed: 1.5})`);
const w = await hl(huge, "word");
check("speed 1.5 keeps reading", (await waitFor(async () => (await b.state()) === "playing" && (await hl(huge, "word")) !== w, 5000)) !== null);
await b.sw.ev(`chrome.storage.local.set({speed: 1})`);
for (const type of ["keyDown", "keyUp"]) await huge.send("Input.dispatchKeyEvent", { type, key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
check("Escape stops", (await waitFor(async () => (await b.state()) === "idle", 3000)) !== null);
check("Escape clears the highlights", (await waitFor(async () => !(await hl(huge, "sentence")) && !(await hl(huge, "word")), 2000)) !== null);
await b.readPage();
await waitFor(async () => (await b.state()) === "playing", 10000);
await p.click("stop");
check("Stop button stops", (await waitFor(async () => (await b.state()) === "idle", 3000)) !== null);
finish(b.errors);
