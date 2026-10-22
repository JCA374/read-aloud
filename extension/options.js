const $ = (id) => document.getElementById(id);
function el(tag, props = {}, ...kids) {
  const e = Object.assign(document.createElement(tag), props);
  e.append(...kids);
  return e;
}

let settings;
let voices;

async function save(changes) {
  Object.assign(settings, changes);
  await chrome.storage.local.set(changes);
  $("saved").textContent = "Saved";
  clearTimeout(save.timer);
  save.timer = setTimeout(() => ($("saved").textContent = ""), 1500);
  render();
}

// Voice list: a checkbox per voice, grouped by language. At least one voice stays ticked.
function renderList() {
  const shown = new Set(NV.shownVoices(voices, settings).map((v) => v.id));
  const groups = {};
  for (const v of voices) (groups[v.lang] ??= []).push(v);
  $("list").replaceChildren(
    ...Object.entries(groups).flatMap(([lang, vs]) => [
      el("h3", { textContent: NV.LANGS[lang] || lang }),
      ...vs.map((v) => {
        const box = el("input", { type: "checkbox", checked: shown.has(v.id) });
        box.onchange = () => {
          const next = new Set(shown);
          box.checked ? next.add(v.id) : next.delete(v.id);
          if (!next.size) return (box.checked = true); // keep at least one voice
          save({ shown: voices.filter((x) => next.has(x.id)).map((x) => x.id) });
        };
        const extra = v.engine === "kokoro" ? "Kokoro, local server" : "Piper";
        return el("label", { className: "check" }, box, el("span", {}, v.label, " ", el("small", { textContent: `· ${extra}` })));
      }),
    ]),
  );
}

// Default voice per language (detection on), or the one voice to use (detection off).
// Only voices from your list can be chosen.
function renderDefaults() {
  $("autoDetect").checked = settings.autoDetect;
  const shown = NV.shownVoices(voices, settings);
  const picker = (title, list, value, onPick) => {
    const select = el("select");
    select.innerHTML = NV.voiceOptions(list);
    select.value = value;
    select.onchange = () => onPick(select.value);
    return el("label", { className: "row" }, title, select);
  };
  if (!settings.autoDetect) {
    $("defaults").replaceChildren(
      picker("Always read with", shown, NV.voiceFor("en", settings, voices), (id) => save({ fixedVoice: id })),
    );
    return;
  }
  const englishVoice = voices.find((v) => v.id === NV.voiceFor("en", settings, voices))?.label;
  $("defaults").replaceChildren(
    ...Object.entries(NV.LANGS).map(([lang, name]) => {
      const list = shown.filter((v) => v.lang === lang);
      if (!list.length) {
        return el("p", { className: "note", textContent: `No ${name} voice in your list, so ${name} text is read with ${englishVoice}. Tick one above to change that.` });
      }
      return picker(`${name} text`, list, NV.voiceFor(lang, settings, voices), (id) => save({ [NV.VOICE_KEY[lang]]: id }));
    }),
  );
}

function render() {
  renderList();
  renderDefaults();
  $("speed").value = settings.speed;
  $("speedOut").textContent = `${settings.speed}×`;
  $("kokoro").checked = settings.kokoro;
}

$("autoDetect").onchange = () => save({ autoDetect: $("autoDetect").checked });
$("speed").oninput = () => {
  const speed = Math.round(parseFloat($("speed").value) * 100) / 100;
  $("speedOut").textContent = `${speed}×`;
  chrome.storage.local.set({ speed });
  settings.speed = speed;
};
$("kokoro").onchange = async () => {
  await save({ kokoro: $("kokoro").checked });
  voices = await NV.allVoices(settings);
  render();
};

(async () => {
  settings = await chrome.storage.local.get(NV.DEFAULTS);
  voices = await NV.allVoices(settings);
  render();
})();
