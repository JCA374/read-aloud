// Chromium, fresh profile: settings page (add, download, delete), download progress in the player,
// a German page, highlight styles. Exits 1 if any check fails.
import { browser, waitFor, check, finish, hl, player } from "./lib.mjs";

const b = await browser();
const T = "piper:de_DE-thorsten-medium";
const thorsten = (sel) => `[...document.querySelectorAll('#mine .voice')].find(r => r.querySelector('b').textContent.startsWith('Thorsten'))${sel}`;

// 1. Settings page: add Thorsten (German), download it, delete the download
const opt = await b.open(b.extUrl("options.html"), "options");
const mine = await waitFor(() => opt.ev(`[...document.querySelectorAll('#mine .voice b')].map(b => b.textContent).join(', ')`), 5000);
check("settings: your voices listed", (mine || "").split(", ").length >= 5, mine);
const langs = await opt.ev(`document.querySelector('#addLang').options.length`);
check("settings: languages to add from", langs > 40, `${langs}`);
await opt.ev(`(() => { const s = document.querySelector('#addLang'); s.value = 'de'; s.dispatchEvent(new Event('change')); })()`);
const german = await waitFor(() => opt.ev(`[...document.querySelectorAll('#add .voice')].map(r => r.querySelector('b').textContent + ' [' + r.querySelector('.licence')?.textContent + ']').join(' | ')`), 3000);
check("settings: German voices with licences", /Thorsten[^|]*Licence: /.test(german || ""), german);
const tags = await opt.ev(`[...document.querySelectorAll('#add .voice')].map(r => r.querySelector('b').textContent + ': ' + (r.querySelector('.tag')?.textContent || '-')).join(' | ')`);
check("settings: unclear licences tagged, Thorsten (CC0) not", /Karlsson[^|]*: Licence unclear/.test(tags) && /Thorsten \(Germany\): -/.test(tags), tags);
await opt.ev(`[...document.querySelectorAll('#add .voice')].find(r => r.querySelector('b').textContent.startsWith('Thorsten (Germany)')).querySelector('button').click()`);
const shown = await waitFor(async () => { const s = (await b.sw.ev(`chrome.storage.local.get('shown')`)).shown; return s?.includes(T) && s; }, 3000);
check("settings: Thorsten added to your list", !!shown);
await opt.ev(thorsten(`.querySelector('button').click()`)); // Download
const seen = [];
const done = await waitFor(async () => {
  const st = await opt.ev(thorsten(`.querySelector('.side').textContent`));
  if (!seen.includes(st)) seen.push(st);
  return st.includes("Downloaded");
}, 60000, 200);
check("settings: download shows progress and finishes", done && seen.length >= 3, `${seen.length} states, last ${JSON.stringify(seen.at(-1))}`);
await opt.ev(thorsten(`.querySelector('button').click()`)); // Delete download
const deleted = await waitFor(async () => !(await opt.ev(thorsten(`.querySelector('.side').textContent`))).includes("Downloaded"), 3000);
check("settings: download deleted", !!deleted, await opt.ev(thorsten(`.querySelector('.side').textContent`)));

// 2. Read English on a fresh profile: the player shows download progress
const page = await b.open("long.html", "en");
await b.readPage();
const p = await waitFor(async () => { const x = await player(page); return (await x.status()) !== undefined && x; }, 5000);
const statuses = [];
await waitFor(async () => { const s = await p.status(); if (!statuses.includes(s)) statuses.push(s); return /^\d+ \//.test(s); }, 60000, 200);
check("player shows download progress, then reads", statuses.some((s) => /Downloading .*%/.test(s)) && /^\d+ \//.test(statuses.at(-1)), statuses.slice(0, 3).join(" | ") + " ... " + statuses.at(-1));
// highlight styles
const names = () => page.ev(`[...CSS.highlights.keys()].join(',')`);
check("highlight: classic", /nv-classic/.test(await waitFor(names, 5000)), await names());
await b.sw.ev(`chrome.storage.local.set({highlight: 'blue'})`);
check("highlight: blue", !!(await waitFor(async () => /blue/.test(await names()), 3000)), await names());
await b.sw.ev(`chrome.storage.local.set({highlight: 'off'})`);
check("highlight: off", !!(await waitFor(async () => (await names()) === "", 3000)), JSON.stringify(await names()));
await b.sw.ev(`chrome.storage.local.set({highlight: 'classic', volume: 0.5})`);
await b.stopAll();

// 3. German page (lang="de"): read with Thorsten (downloads again, since it was deleted)
const de = await b.open("de.html", "de");
await b.readPage();
const word = await waitFor(() => hl(de, "word"), 60000, 100);
check("German page read with Thorsten", !!word && (await (await player(de)).voice()) === T, `first word ${JSON.stringify(word)}`);
await b.stopAll();
finish(b.errors);
