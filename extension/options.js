const $ = (id) => document.getElementById(id);
const CACHE = "piper-voices";
const REPO = "https://huggingface.co/rhasspy/piper-voices/resolve/"; // files from an older revision count too (the engine reuses them)
const SAMPLES = "https://rhasspy.github.io/piper-samples/samples"; // the Piper project's sample of every voice
const DETAILS = Object.fromEntries(NV_CATALOG.voices.map((v) => [v.id, v]));
const ADD_LIMIT = 50; // rows shown under "Add voices" before "Show all"
const FILTER_DEFAULTS = { lang: "en", quality: "", freeOnly: false, downloadedOnly: false };

let settings;
let voices; // all voices in the catalogue
let downloaded = new Set(); // voice ids whose files are in the cache
const progress = {}; // voice id -> percent, while downloading
const errors = {}; // voice id -> last download error
let filter = { ...FILTER_DEFAULTS, ...load("addFilter") }; // remembered in this browser only
let query = "";
let showAll = false;

function el(tag, props = {}, ...kids) {
  const e = Object.assign(document.createElement(tag), props);
  e.append(...kids.filter((k) => k != null));
  return e;
}

function load(key) {
  try {
    return JSON.parse(localStorage.getItem(key)) || {};
  } catch {
    return {};
  }
}

function remember(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

const mb = (bytes) => `${Math.round(bytes / 1e6)} MB`;
const fileUrl = (path) => `${NV_CATALOG.base}/${path}`;

async function save(changes) {
  Object.assign(settings, changes);
  await chrome.storage.local.set(changes);
  $("saved").textContent = "Saved";
  clearTimeout(save.timer);
  save.timer = setTimeout(() => ($("saved").textContent = ""), 1500);
  render();
}

async function refreshDownloaded() {
  const keys = await (await caches.open(CACHE)).keys();
  const paths = new Set(keys.filter((r) => r.url.startsWith(REPO)).map((r) => r.url.replace(/^.*?\/resolve\/[^/]+\//, "")));
  downloaded = new Set(NV_CATALOG.voices.filter((v) => paths.has(v.onnx.path)).map((v) => v.id));
}

async function download(id) {
  progress[id] = 0;
  delete errors[id];
  render();
  const res = await chrome.runtime.sendMessage({ type: "download", voice: id }).catch((e) => ({ error: String(e) }));
  delete progress[id];
  if (res?.error) errors[id] = res.error;
  await refreshDownloaded();
  render();
}

async function removeDownload(id) {
  const v = DETAILS[id];
  const cache = await caches.open(CACHE);
  const files = [v.onnx.path, v.config.path].map((p) => `/${p}`);
  const old = (await cache.keys()).filter((r) => r.url.startsWith(REPO) && files.some((f) => r.url.endsWith(f)));
  await Promise.all(old.map((r) => cache.delete(r)));
  await chrome.runtime.sendMessage({ type: "unload", voice: id }).catch(() => {});
  await refreshDownloaded();
  render();
}

// ---------------------------------------------------------------- ▶ Try

const audio = new Audio();
let trying = null; // id of the voice whose sample is playing

function stopSample() {
  audio.pause();
  if (audio.src.startsWith("blob:")) URL.revokeObjectURL(audio.src);
  trying = null;
}
audio.onended = () => {
  stopSample();
  render();
};

const sampleUrl = (v) => `${SAMPLES}/${v.onnx.path.replace(/\/[^/]+$/, "")}/speaker_0.mp3`;

// The online sample; if it can't load and the voice is downloaded, the voice reads "1, 2, 3, 4, 5." here instead.
async function trySample(id) {
  const was = trying;
  stopSample();
  delete errors[id];
  if (was === id) return render();
  trying = id;
  render();
  try {
    audio.src = sampleUrl(DETAILS[id]);
    await audio.play();
  } catch {
    if (trying !== id) return;
    try {
      if (!downloaded.has(id)) throw new Error("No sample online right now. Download the voice to hear it.");
      const res = await chrome.runtime.sendMessage({ type: "tts", text: "1, 2, 3, 4, 5.", voice: id, speed: settings.speed });
      if (!res || res.error) throw new Error(res?.error || "The voice couldn't read the sample.");
      if (trying !== id) return;
      const bytes = Uint8Array.from(atob(res.audio), (c) => c.charCodeAt(0));
      audio.src = URL.createObjectURL(new Blob([bytes], { type: "audio/wav" }));
      await audio.play();
    } catch (e) {
      if (trying === id) stopSample();
      errors[id] = e.message;
    }
  }
  render();
}

// ---------------------------------------------------------------- voice rows

// Licences that limit what you may do with the voice's audio get a tag: [text, explanation].
const LICENCE_TAGS = {
  "non-commercial": ["Non-commercial", "Fine for personal use; not for anything you sell or earn from."],
  "share-alike": ["Share-alike", "Free to use; things you make from it and share must use the same licence."],
  unclear: ["Licence unclear", "The model card doesn't state a licence. Personal use only, to be safe."],
};
const QUALITY = { x_low: "extra low quality", low: "low quality", high: "high quality" };

// One voice: name, details, licence, and its buttons (the first one is the main action).
function voiceRow(v, buttons) {
  const d = DETAILS[v.id];
  const meta = [d.langName, d.country, QUALITY[d.quality], mb(d.onnx.size)].filter(Boolean).join(" · ");
  let state = null;
  if (d && progress[v.id] != null) state = el("span", { className: "state" }, el("progress", { max: 100, value: progress[v.id] }), ` ${progress[v.id]}%`);
  else if (d && downloaded.has(v.id)) state = el("span", { className: "state ok", textContent: "✓ Downloaded" });
  const tag = d && LICENCE_TAGS[d.kind];
  const licence = d && el("div", { className: "licence" }, tag ? el("span", { className: `tag ${d.kind}`, title: tag[1], textContent: tag[0] }) : null, `Licence: ${d.licence}`, d.card ? " · " : "", d.card ? el("a", { href: fileUrl(d.card), target: "_blank", rel: "noopener", textContent: "model card" }) : null);
  const tryButton = button(trying === v.id ? "■ Stop" : "▶ Try", () => trySample(v.id), { className: "try", title: "Play a short sample of this voice" });
  const [main, ...rest] = buttons;
  return el(
    "div",
    { className: "voice" },
    el("div", { className: "info" }, el("b", { textContent: v.label }), el("div", { className: "meta", textContent: meta }), licence, errors[v.id] && el("div", { className: "error", textContent: errors[v.id] })),
    el("div", { className: "side" }, state, main, tryButton, ...rest),
  );
}

function button(text, onClick, opts = {}) {
  const b = el("button", { type: "button", textContent: text, ...opts });
  b.onclick = onClick;
  return b;
}

function renderMine() {
  const mine = NV.shownVoices(voices, settings);
  const ids = mine.map((x) => x.id);
  const move = (i, by) => {
    const next = [...ids];
    [next[i], next[i + by]] = [next[i + by], next[i]];
    save({ shown: next });
  };
  $("mine").replaceChildren(
    ...mine.map((v, i) => {
      const d = DETAILS[v.id];
      const buttons = [];
      if (d && progress[v.id] == null) {
        buttons.push(downloaded.has(v.id) ? button("Delete download", () => removeDownload(v.id), { title: `Free ${mb(d.onnx.size)}. It downloads again if you use it.` }) : button("Download", () => download(v.id)));
      }
      buttons.push(
        button("Remove", () => save({ shown: ids.filter((x) => x !== v.id) }), {
          disabled: mine.length < 2,
          title: mine.length < 2 ? "Keep at least one voice" : "Remove from your list (the download is kept)",
        }),
        button("↑", () => move(i, -1), { className: "move up", disabled: i === 0, title: "Move up" }),
        button("↓", () => move(i, 1), { className: "move down", disabled: i === mine.length - 1, title: "Move down" }),
      );
      return voiceRow(v, buttons);
    }),
  );
}

// The voices to offer under "Add voices": not in your list, matching the search and filters.
function filterVoices(all, f, q, mine, have) {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  return all.filter((v) => {
    const d = DETAILS[v.id];
    if (mine.has(v.id) || !d) return false;
    if (f.lang !== "all" && v.lang !== f.lang) return false;
    if (f.quality && d.quality !== f.quality) return false;
    if (f.freeOnly && (d.kind === "non-commercial" || d.kind === "unclear")) return false;
    if (f.downloadedOnly && !have.has(v.id)) return false;
    const text = `${v.label} ${d.langName} ${d.country} ${v.id}`.toLowerCase();
    return words.every((w) => text.includes(w));
  });
}

function renderAdd() {
  const select = $("addLang");
  const langs = {};
  for (const v of voices) (langs[v.lang] ??= { name: v.langName || v.lang, n: 0 }).n++;
  const options = Object.entries(langs).sort((a, b) => a[1].name.localeCompare(b[1].name));
  if (select.options.length !== options.length + 1) {
    select.replaceChildren(el("option", { value: "all", textContent: `All languages (${voices.length})` }), ...options.map(([code, { name, n }]) => el("option", { value: code, textContent: `${name} (${n})` })));
  }
  select.value = filter.lang;
  if (select.value !== filter.lang) select.value = filter.lang = "en";
  $("quality").value = filter.quality;
  $("freeOnly").checked = filter.freeOnly;
  $("downloadedOnly").checked = filter.downloadedOnly;
  const mine = NV.shownVoices(voices, settings);
  const rows = filterVoices(voices, filter, query, new Set(mine.map((v) => v.id)), downloaded);
  const shown = showAll ? rows : rows.slice(0, ADD_LIMIT);
  $("addCount").textContent = rows.length === 1 ? "1 voice" : `${rows.length} voices`;
  $("showAll").hidden = shown.length === rows.length;
  $("showAll").textContent = `Show all ${rows.length}`;
  $("add").replaceChildren(
    ...(rows.length
      ? shown.map((v) => voiceRow(v, [button("Add", () => save({ shown: [...mine.map((x) => x.id), v.id] }))]))
      : [el("p", { className: "hint", textContent: "No voices match. Try another language, or clear the search and filters." })]),
  );
}

function setFilter(changes) {
  Object.assign(filter, changes);
  remember("addFilter", filter);
  showAll = false;
  renderAdd();
}

// Default voice per language (detection on), or the one voice to use (detection off). Only voices from your list.
function renderDefaults() {
  $("autoDetect").checked = settings.autoDetect;
  const shown = NV.shownVoices(voices, settings);
  const picker = (title, list, value) => {
    const select = el("select");
    NV.fillVoiceSelect(select, list);
    select.value = value;
    select.onchange = () => save(NV.pick(select.value, settings, voices));
    return el("label", { className: "row" }, title, select);
  };
  if (!settings.autoDetect) {
    $("defaults").replaceChildren(picker("Always read with", shown, NV.voiceFor("en", settings, voices)));
    return;
  }
  const englishVoice = voices.find((v) => v.id === NV.voiceFor("en", settings, voices))?.label;
  const langs = NV.listLangs(voices, settings);
  const rows = langs.map(([lang, name]) => picker(`${name} text`, shown.filter((v) => v.lang === lang), NV.voiceFor(lang, settings, voices)));
  if (!langs.some(([l]) => l === "sv")) rows.push(el("p", { className: "note", textContent: `No Swedish voice in your list, so Swedish text is read with ${englishVoice}.` }));
  rows.push(el("p", { className: "note", textContent: `Text in a language with no voice in your list is read with ${englishVoice}.` }));
  $("defaults").replaceChildren(...rows);
}

// ---------------------------------------------------------------- storage and settings

async function renderStorage() {
  const n = downloaded.size;
  const bytes = [...downloaded].reduce((sum, id) => sum + DETAILS[id].onnx.size + DETAILS[id].config.size, 0);
  let text = n ? `Downloaded voices: ${n}, ${mb(bytes)}.` : "No voices downloaded yet.";
  const est = await navigator.storage?.estimate?.().catch(() => null);
  if (est?.quota) text += ` The browser allows this add-on about ${Math.floor((est.quota - est.usage) / 1e9)} GB more.`;
  $("storage").textContent = text;
  $("deleteAll").disabled = !n;
}

async function deleteAll() {
  if (!confirm(`Delete all ${downloaded.size} downloaded voices? Each downloads again the next time you use it.`)) return;
  const ids = [...downloaded];
  await caches.delete(CACHE);
  await Promise.all(ids.map((id) => chrome.runtime.sendMessage({ type: "unload", voice: id }).catch(() => {})));
  await refreshDownloaded();
  render();
}

// Only known settings with the right type; voice ids must be in the catalogue.
function cleanSettings(data) {
  const out = {};
  const known = (id) => typeof id === "string" && id in DETAILS;
  for (const [k, def] of Object.entries(NV.DEFAULTS)) {
    const v = data?.[k];
    if (v === undefined || typeof v !== typeof def || Array.isArray(v) !== Array.isArray(def)) continue;
    if (k === "shown") {
      const ids = v.filter(known);
      if (ids.length) out.shown = [...new Set(ids)];
    } else if (k === "langVoices") {
      out.langVoices = Object.fromEntries(Object.entries(v).filter(([lang, id]) => typeof lang === "string" && known(id)));
    } else if (["voice", "voiceSv"].includes(k)) {
      if (known(v)) out[k] = v;
    } else if (k === "fixedVoice") {
      if (v === "" || known(v)) out[k] = v;
    } else if (k === "highlight") {
      if (v in NV.HIGHLIGHTS) out[k] = v;
    } else out[k] = v;
  }
  return out;
}

function exportSettings() {
  const data = { app: "Neural Voices", version: chrome.runtime.getManifest().version, settings: cleanSettings(settings) };
  const a = el("a", { href: URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })), download: "neural-voices-settings.json" });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

async function importSettings(file) {
  let data;
  try {
    data = JSON.parse(await file.text());
  } catch {
    return alert("That file isn't a Neural Voices settings file.");
  }
  const changes = cleanSettings(data?.settings ?? data);
  if (!Object.keys(changes).length) return alert("No settings found in that file.");
  await save(changes);
}

async function renderShortcuts() {
  const commands = await chrome.commands.getAll();
  const firefox = typeof browser !== "undefined" && !!browser.runtime.getBrowserInfo;
  const list = el("ul", { className: "keys" }, ...commands.filter((c) => c.description).map((c) => el("li", {}, c.shortcut ? el("kbd", { textContent: c.shortcut }) : el("i", { textContent: "no key set" }), ` ${c.description}`)));
  const how = firefox
    ? el("p", { className: "hint", textContent: "To change them: open Add-ons (Ctrl+Shift+A), click the ⚙ menu at the top, then Manage Extension Shortcuts." })
    : el("p", { className: "hint" }, button("Change shortcuts", () => chrome.tabs.create({ url: "chrome://extensions/shortcuts" })));
  $("shortcuts").replaceChildren(list, how);
}

// ---------------------------------------------------------------- page

function render() {
  renderMine();
  renderAdd();
  renderDefaults();
  renderStorage();
  $("speed").value = settings.speed;
  $("speedOut").textContent = `${settings.speed}×`;
  $("volume").value = settings.volume;
  $("volumeOut").textContent = `${Math.round(settings.volume * 100)}%`;
  $("highlight").value = settings.highlight;
  $("pause").value = String(settings.pause);
  $("autoScroll").checked = settings.autoScroll;
  $("skipCode").checked = settings.skipCode;
}

$("addLang").onchange = () => setFilter({ lang: $("addLang").value });
$("quality").onchange = () => setFilter({ quality: $("quality").value });
$("freeOnly").onchange = () => setFilter({ freeOnly: $("freeOnly").checked });
$("downloadedOnly").onchange = () => setFilter({ downloadedOnly: $("downloadedOnly").checked });
$("search").oninput = () => {
  query = $("search").value;
  // A search looks through every language.
  setFilter(query.trim() ? { lang: "all" } : {});
};
$("showAll").onclick = () => {
  showAll = true;
  renderAdd();
};
$("autoDetect").onchange = () => save({ autoDetect: $("autoDetect").checked });
for (const [id, fmt] of [["speed", (x) => `${x}×`], ["volume", (x) => `${Math.round(x * 100)}%`]]) {
  $(id).oninput = () => {
    const value = Math.round(parseFloat($(id).value) * 100) / 100;
    $(`${id}Out`).textContent = fmt(value);
    settings[id] = value;
    chrome.storage.local.set({ [id]: value });
  };
}
$("highlight").replaceChildren(...Object.entries(NV.HIGHLIGHTS).map(([k, label]) => el("option", { value: k, textContent: label })));
$("highlight").onchange = () => save({ highlight: $("highlight").value });
$("pause").onchange = () => save({ pause: parseFloat($("pause").value) });
for (const id of ["autoScroll", "skipCode"]) $(id).onchange = () => save({ [id]: $(id).checked });
$("deleteAll").onclick = deleteAll;
$("reset").onclick = () => confirm("Put all settings back to how they were when the add-on was installed? Downloaded voices stay.") && save({ ...NV.DEFAULTS });
$("export").onclick = exportSettings;
$("import").onclick = () => $("importFile").click();
$("importFile").onchange = () => {
  const file = $("importFile").files[0];
  $("importFile").value = "";
  if (file) importSettings(file);
};
$("source").append(
  el("b", { textContent: "Voices" }),
  " download from ",
  el("a", { href: "https://huggingface.co/rhasspy/piper-voices", target: "_blank", rel: "noopener", textContent: "huggingface.co/rhasspy/piper-voices" }),
  `, pinned to version ${NV_CATALOG.revision.slice(0, 7)}, and each file's size is checked.`,
);

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type !== "voiceProgress" || !(msg.voice in progress)) return;
  progress[msg.voice] = Math.floor((100 * msg.loaded) / msg.total);
  renderMine();
});

// Settings changed elsewhere (popup, player, another settings tab): show them here too.
chrome.storage.onChanged.addListener((changes) => {
  if (!settings) return;
  let changed = false;
  for (const [k, { newValue }] of Object.entries(changes)) {
    if (!(k in NV.DEFAULTS) || JSON.stringify(settings[k]) === JSON.stringify(newValue)) continue;
    settings[k] = newValue ?? NV.DEFAULTS[k];
    changed = true;
  }
  if (changed) render();
});

(async () => {
  settings = await chrome.storage.local.get(NV.DEFAULTS);
  voices = await NV.allVoices();
  await refreshDownloaded();
  render();
  renderShortcuts();
})();
