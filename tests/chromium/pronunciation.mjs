// Your pronunciations: the Settings section (add, replace, edit, remove, try), the engine reading the
// replacement while the word times keep the page's words, reading a page with an entry, the
// right-click shortcut (options.html?word=…), and cleaning an imported dictionary.
// Needs Cori downloaded (KEEP=1; it downloads otherwise).
import { browser, waitFor, sleep, check, finish, CORI } from "./lib.mjs";

const b = await browser();
await b.sw.ev(`chrome.storage.local.clear()`);
const opt = await b.open(b.extUrl("options.html"), "options");
await waitFor(() => opt.ev(`document.querySelectorAll('#mine .voice').length >= 5 && document.querySelectorAll('#dictLang option').length >= 3`), 8000);
const dict = async () => (await b.sw.ev(`chrome.storage.local.get('dictionary')`)).dictionary || [];
const fill = (word, say, lang = "") =>
  opt.ev(`(() => { $('dictWord').value = ${JSON.stringify(word)}; $('dictSay').value = ${JSON.stringify(say)}; $('dictLang').value = ${JSON.stringify(lang)}; $('dictAdd').click(); })()`);

check("language choices: all voices, English, Swedish", await opt.ev(`[...$('dictLang').options].map(o => o.textContent).join(' | ')`) === "All voices | English voices | Swedish voices");

// Typing with real key presses (a key handler must not swallow letters), then Enter adds it.
const typeInto = async (id, text) => {
  await opt.ev(`$('${id}').value = ''; $('${id}').focus()`);
  for (const ch of text) {
    await opt.send("Input.dispatchKeyEvent", { type: "keyDown", key: ch, text: ch });
    await opt.send("Input.dispatchKeyEvent", { type: "keyUp", key: ch });
  }
  return opt.ev(`$('${id}').value`);
};
check("typing works in both boxes", (await typeInto("dictWord", "Tyop")) === "Tyop" && (await typeInto("dictSay", "typo")) === "typo", await opt.ev(`$('dictWord').value + '|' + $('dictSay').value`));
await opt.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, text: "\r" });
const typed = await waitFor(async () => (await dict()).some((e) => e.word === "Tyop" && e.say === "typo"), 3000);
check("Enter adds the word", !!typed, JSON.stringify(await dict()));
await b.sw.ev(`chrome.storage.local.remove('dictionary')`);
await waitFor(() => opt.ev(`!document.querySelector('#dict .voice')`), 3000);

await fill("Skerry", "sherry");
let d = await waitFor(async () => { const x = await dict(); return x.length === 1 && x; }, 3000);
check("Add saves the word", d?.[0]?.word === "Skerry" && d[0].say === "sherry" && d[0].lang === "", JSON.stringify(d));
check("the list shows it", /Skerry → sherry/.test(await opt.ev(`$('dict').textContent`)), await opt.ev(`$('dict').textContent`));

await fill("skerry", "skerri");
d = await waitFor(async () => { const x = await dict(); return x[0]?.say === "skerri" && x; }, 3000);
check("the same word again (any case) replaces it", d?.length === 1, JSON.stringify(d));

await fill("Göteborg", "jöteborj", "sv");
await waitFor(async () => (await dict()).length === 2, 3000);
await opt.ev(`[...document.querySelectorAll('#dict .voice')].find(r => /skerri/.test(r.textContent)).querySelector('button:nth-child(2)').click()`);
check("Edit fills the form", (await opt.ev(`$('dictWord').value + '|' + $('dictSay').value`)) === "skerry|skerri");
await opt.ev(`$('dictWord').value = 'Skerry Light'; $('dictSay').value = 'sherry light'; $('dictAdd').click()`);
d = await waitFor(async () => { const x = await dict(); return x.some((e) => e.word === "Skerry Light") && x; }, 3000);
check("Edit + Add replaces the edited entry", d?.length === 2 && !d.some((e) => e.word.toLowerCase() === "skerry"), JSON.stringify(d));

await opt.ev(`[...document.querySelectorAll('#dict .voice')].find(r => /Skerry Light/.test(r.textContent)).querySelector('button').click()`);
const played = await waitFor(() => opt.ev(`!audio.paused && audio.src.startsWith('blob:')`), 30000);
check("▶ Try plays the word with the fix", !!played, await opt.ev(`$('dictNote').textContent`));

// The engine reads "say"; the word times still list the page's words.
const tts = (say) => opt.ev(`chrome.runtime.sendMessage(${JSON.stringify({ type: "tts", text: "NASA.", voice: CORI, speed: 1, ...(say ? { say } : {}) })}).then(r => ({ d: r.duration, w: r.words.map(w => w[0]).join(' '), e: r.error }))`);
const plain = await tts(), fixed = await tts("National Aeronautics and Space Administration.");
check("the voice reads the replacement", fixed?.d > plain?.d * 2, `${plain?.d} s → ${fixed?.d} s ${plain?.e || fixed?.e || ""}`);
check("word times keep the page's word", fixed?.w === "NASA", fixed?.w);

// Reading a page: the heading "The Keeper of Skerry Light" goes to the voice with the fix.
const page = await b.open("long.html");
const since = Date.now();
await b.readPage();
const log = await b.waitLog(/pronunciation: .*sherry light/i, since, 30000);
check("reading a page uses the pronunciation", !!log, log?.text || "no pronunciation logged");
check("the Swedish entry isn't used by the English voice", !(log?.text || "").includes("jöteborj"));
await waitFor(async () => (await b.state()) === "playing", 30000);
await b.stopAll();

const removeBtn = `[...document.querySelectorAll('#dict .voice')].find(r => /Göteborg/.test(r.textContent)).querySelector('button:last-child').click()`;
await opt.ev(removeBtn);
d = await waitFor(async () => { const x = await dict(); return x.length === 1 && x; }, 3000);
check("Remove deletes it", d?.[0]?.word === "Skerry Light", JSON.stringify(d));

const cleaned = await opt.ev(`cleanSettings({ dictionary: [{ word: ' Hej ', say: 'hey', lang: 'sv' }, { word: '', say: 'x' }, { word: 5, say: 'x' }, { word: 'a', say: '' }, 'junk', { word: 'b', say: 'bee' }] }).dictionary`);
check("import keeps only good entries", JSON.stringify(cleaned) === JSON.stringify([{ word: "Hej", say: "hey", lang: "sv" }, { word: "b", say: "bee", lang: "" }]), JSON.stringify(cleaned));

// The right-click item opens Settings with the word filled in.
const menu = await b.open(b.extUrl("options.html?word=Skerry"), "menu");
const prefilled = await waitFor(() => menu.ev(`$('dictWord').value === 'Skerry' && document.activeElement === $('dictSay')`), 5000);
check("Fix pronunciation opens Settings with the word filled in", !!prefilled, await menu.ev(`$('dictWord').value`));
await sleep(1000); // the voice lists above are drawn by now; the section must still be in view
const top = await menu.ev(`Math.round($('pronunciation').getBoundingClientRect().top) + ' of ' + innerHeight`);
check("...scrolled to the Pronunciation section", parseInt(top) >= -2 && parseInt(top) < 80, `section top at ${top} px`);

await b.sw.ev(`chrome.storage.local.remove('dictionary')`);
finish(b.errors);
