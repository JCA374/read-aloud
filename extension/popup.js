const $ = (id) => document.getElementById(id);

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function send(cmd) {
  const tab = await activeTab();
  try {
    return await chrome.tabs.sendMessage(tab.id, { cmd });
  } catch {
    $("nopage").hidden = false;
    return null;
  }
}

function render(status) {
  if (!status) return;
  const reading = status.state !== "idle";
  $("read").textContent = status.state === "paused" ? "Resume" : reading ? "Pause" : status.hasSelection ? "Read selection" : "Read page";
  $("click").classList.toggle("on", status.clickMode);
}

// With language detection on: one voice picker per language that has voices in your list.
// With it off: a single voice picker.
function renderVoices(settings, voices) {
  const shown = NV.shownVoices(voices, settings);
  const pickers = settings.autoDetect
    ? Object.entries(NV.LANGS)
        .map(([lang, name]) => ({ lang, title: `${name} voice`, list: shown.filter((v) => v.lang === lang) }))
        .filter((p) => p.list.length)
    : [{ lang: null, title: "Voice", list: shown }];
  $("voices").replaceChildren(
    ...pickers.map(({ lang, title, list }) => {
      const label = document.createElement("label");
      label.textContent = title;
      if (lang && pickers.length > 1) label.append(" ", Object.assign(document.createElement("small"), { textContent: "(used automatically)" }));
      const select = document.createElement("select");
      select.innerHTML = NV.voiceOptions(list);
      select.value = NV.voiceFor(lang || "en", settings, voices);
      select.onchange = () => chrome.storage.local.set({ [NV.keyFor(select.value, settings, voices)]: select.value });
      label.append(select);
      return label;
    }),
  );
}

async function init() {
  const settings = await chrome.storage.local.get(NV.DEFAULTS);
  $("speed").value = settings.speed;
  $("speedOut").textContent = `${settings.speed}×`;
  renderVoices(settings, await NV.allVoices(settings));
  render(await send("status"));
}

$("read").onclick = async () => {
  render(await send("toggle"));
  window.close();
};
$("click").onclick = async () => {
  render(await send("clickMode"));
  window.close();
};
$("stop").onclick = async () => render(await send("stop"));
$("settings").onclick = () => {
  chrome.runtime.openOptionsPage();
  window.close();
};
$("speed").oninput = () => {
  const speed = Math.round(parseFloat($("speed").value) * 100) / 100;
  $("speedOut").textContent = `${speed}×`;
  chrome.storage.local.set({ speed });
};

init();
