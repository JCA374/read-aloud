const $ = (id) => document.getElementById(id);
const DEFAULTS = { voice: "piper:en_US-lessac-medium", speed: 1.0 };
const VOICE_GROUPS = { kokoro: "Natural · Kokoro (~1 GB RAM)", piper: "Light & fast · Piper (~100 MB RAM)" };
function voiceOptions(voices) {
  const groups = {};
  for (const v of voices) (groups[v.engine || "kokoro"] ??= []).push(`<option value="${v.id}">${v.label}</option>`);
  return Object.entries(groups).map(([g, opts]) => `<optgroup label="${VOICE_GROUPS[g] || g}">${opts.join("")}</optgroup>`).join("");
}

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

async function init() {
  const settings = await chrome.storage.local.get(DEFAULTS);
  $("speed").value = settings.speed;
  $("speedOut").textContent = `${settings.speed}×`;

  const health = await chrome.runtime.sendMessage({ type: "health" });
  $("server").className = `dot ${health?.ok ? "ok" : "bad"}`;
  $("offline").hidden = !!health?.ok;
  const voices = health?.voices || [{ id: settings.voice, label: settings.voice }];
  $("voice").innerHTML = voiceOptions(voices);
  $("voice").value = settings.voice;

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
$("voice").onchange = () => chrome.storage.local.set({ voice: $("voice").value });
$("speed").oninput = () => {
  const speed = Math.round(parseFloat($("speed").value) * 100) / 100;
  $("speedOut").textContent = `${speed}×`;
  chrome.storage.local.set({ speed });
};

init();
