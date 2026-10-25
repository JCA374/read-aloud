const $ = (id) => document.getElementById(id);
const CACHE = "piper-voices";
const OLD_BASE = "https://huggingface.co/rhasspy/piper-voices/resolve/main"; // downloads from before voices were pinned
const DETAILS = Object.fromEntries(NV_CATALOG.voices.map((v) => [v.id, v]));

let settings;
let voices; // all voices in the catalogue
let downloaded = new Set(); // voice ids whose files are in the cache
const progress = {}; // voice id -> percent, while downloading
const errors = {}; // voice id -> last download error

function el(tag, props = {}, ...kids) {
  const e = Object.assign(document.createElement(tag), props);
  e.append(...kids.filter((k) => k != null));
  return e;
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
  const urls = new Set(keys.map((r) => r.url));
  downloaded = new Set(NV_CATALOG.voices.filter((v) => urls.has(fileUrl(v.onnx.path)) || urls.has(`${OLD_BASE}/${v.onnx.path}`)).map((v) => v.id));
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
  await Promise.all([v.onnx.path, v.config.path].flatMap((p) => [cache.delete(fileUrl(p)), cache.delete(`${OLD_BASE}/${p}`)]));
  await chrome.runtime.sendMessage({ type: "unload", voice: id }).catch(() => {});
  await refreshDownloaded();
  render();
}

// One voice: name, details, licence, and its buttons.
function voiceRow(v, buttons) {
  const d = DETAILS[v.id];
  const meta = [d.langName, d.country, d.quality !== "medium" && `${d.quality} quality`, mb(d.onnx.size)].filter(Boolean).join(" · ");
  let state = null;
  if (d && progress[v.id] != null) state = el("span", { className: "state" }, el("progress", { max: 100, value: progress[v.id] }), ` ${progress[v.id]}%`);
  else if (d && downloaded.has(v.id)) state = el("span", { className: "state ok", textContent: "✓ Downloaded" });
  const licence = d && el("div", { className: "licence" }, `Licence: ${d.licence}`, d.card ? " · " : "", d.card ? el("a", { href: fileUrl(d.card), target: "_blank", rel: "noopener", textContent: "model card" }) : null);
  return el(
    "div",
    { className: "voice" },
    el("div", { className: "info" }, el("b", { textContent: v.label }), el("div", { className: "meta", textContent: meta }), licence, errors[v.id] && el("div", { className: "error", textContent: errors[v.id] })),
    el("div", { className: "side" }, state, ...buttons),
  );
}

function button(text, onClick, opts = {}) {
  const b = el("button", { type: "button", textContent: text, ...opts });
  b.onclick = onClick;
  return b;
}

function renderMine() {
  const mine = NV.shownVoices(voices, settings);
  $("mine").replaceChildren(
    ...mine.map((v) => {
      const d = DETAILS[v.id];
      const buttons = [];
      if (d && progress[v.id] == null) {
        buttons.push(downloaded.has(v.id) ? button("Delete download", () => removeDownload(v.id), { title: `Free ${mb(d.onnx.size)}. It downloads again if you use it.` }) : button("Download", () => download(v.id)));
      }
      buttons.push(
        button("Remove", () => save({ shown: mine.map((x) => x.id).filter((x) => x !== v.id) }), {
          disabled: mine.length < 2,
          title: mine.length < 2 ? "Keep at least one voice" : "Remove from your list (the download is kept)",
        }),
      );
      return voiceRow(v, buttons);
    }),
  );
}

function renderAdd() {
  const select = $("addLang");
  const langs = {};
  for (const v of voices) (langs[v.lang] ??= { name: v.langName || v.lang, n: 0 }).n++;
  const options = Object.entries(langs).sort((a, b) => a[1].name.localeCompare(b[1].name));
  if (select.options.length !== options.length) {
    const was = select.value || "en";
    select.replaceChildren(...options.map(([code, { name, n }]) => el("option", { value: code, textContent: `${name} (${n})` })));
    select.value = was;
  }
  const mine = new Set(NV.shownVoices(voices, settings).map((v) => v.id));
  const rows = voices.filter((v) => v.lang === select.value && !mine.has(v.id));
  $("add").replaceChildren(
    ...(rows.length
      ? rows.map((v) => voiceRow(v, [button("Add", () => save({ shown: [...NV.shownVoices(voices, settings).map((x) => x.id), v.id] }))]))
      : [el("p", { className: "hint", textContent: "All voices for this language are in your list." })]),
  );
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

function render() {
  renderMine();
  renderAdd();
  renderDefaults();
  $("speed").value = settings.speed;
  $("speedOut").textContent = `${settings.speed}×`;
  $("volume").value = settings.volume;
  $("volumeOut").textContent = `${Math.round(settings.volume * 100)}%`;
  $("highlight").value = settings.highlight;
}

$("addLang").onchange = renderAdd;
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

(async () => {
  settings = await chrome.storage.local.get(NV.DEFAULTS);
  voices = await NV.allVoices();
  await refreshDownloaded();
  render();
})();
