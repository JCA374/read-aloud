// Settings and voice choice, shared by the content script, background, popup and settings page.
var NV = (() => {
  // Shown until the full list arrives from the background (the content script doesn't load the catalogue).
  const STARTER_VOICES = [
    ["piper:en_GB-cori-medium", "Cori (UK, female)"],
    ["piper:en_GB-alba-medium", "Alba (Scottish, female)"],
    ["piper:en_GB-northern_english_male-medium", "Northern English (UK, male)"],
    ["piper:sv_SE-alma-medium", "Alma (svenska, kvinna)"],
    ["piper:sv_SE-nst-medium", "NST (svenska, man)"],
  ].map(([id, label]) => ({ id, label, engine: "piper", lang: id.slice(6, 8), langName: id[6] === "s" ? "Swedish" : "English" }));

  const DEFAULTS = {
    voice: "piper:en_GB-cori-medium", // default for English text
    voiceSv: "piper:sv_SE-alma-medium", // default for Swedish text
    langVoices: {}, // defaults for other languages: {de: id, ...}
    autoDetect: true, // pick the voice by the language of the text
    fixedVoice: "", // the one voice used when autoDetect is off ("" = the English default)
    shown: STARTER_VOICES.map((v) => v.id), // the voices in your list
    speed: 1.0,
    volume: 1.0,
    highlight: "classic", // classic | blue | green | underline | off
    autoScroll: true, // keep the sentence being read in view
    pause: 0, // extra seconds of silence after each sentence
    skipCode: true, // don't read code blocks (<pre>)
  };

  const HIGHLIGHTS = {
    classic: "Yellow sentence, orange word",
    blue: "Blue",
    green: "Green",
    underline: "Underline only",
    off: "Off",
  };

  // The voices in your list, in list order. Never empty: if none of them exist, all voices show.
  function shownVoices(voices, s) {
    const list = (s.shown || DEFAULTS.shown).map((id) => voices.find((v) => v.id === id)).filter(Boolean);
    return list.length ? list : voices;
  }

  // Languages with at least one voice in your list: [[code, name], ...], English and Swedish first.
  function listLangs(voices, s) {
    const out = new Map();
    for (const v of shownVoices(voices, s)) if (!out.has(v.lang)) out.set(v.lang, v.langName || v.lang);
    const rank = (l) => ({ en: 0, sv: 1 })[l] ?? 2;
    return [...out].sort((a, b) => rank(a[0]) - rank(b[0]) || a[1].localeCompare(b[1]));
  }

  function langDefault(lang, s) {
    return lang === "en" ? s.voice : lang === "sv" ? s.voiceSv : s.langVoices?.[lang];
  }

  // The voice to read text in this language with, using only voices from your list.
  function voiceFor(lang, s, voices) {
    const shown = shownVoices(voices, s);
    const ok = (id) => shown.some((v) => v.id === id);
    if (!s.autoDetect) {
      for (const id of [s.fixedVoice, s.voice]) if (ok(id)) return id;
      return shown[0].id;
    }
    const want = langDefault(lang, s);
    if (ok(want)) return want;
    // No default for that language in your list: another voice for the language, else the English default.
    return (shown.find((v) => v.lang === lang) || shown.find((v) => v.id === s.voice) || shown[0]).id;
  }

  // What to save when a voice is picked by hand: the default for its language (or the one fixed voice).
  function pick(id, s, voices) {
    if (!s.autoDetect) return { fixedVoice: id };
    const lang = voices.find((v) => v.id === id)?.lang || "en";
    if (lang === "en") return { voice: id };
    if (lang === "sv") return { voiceSv: id };
    return { langVoices: { ...s.langVoices, [lang]: id } };
  }

  // All voices in the catalogue (the content script doesn't load it, so ask the background).
  async function allVoices() {
    const list = await chrome.runtime.sendMessage({ type: "voices" }).catch(() => null);
    return list?.length ? list : STARTER_VOICES;
  }

  function fillVoiceSelect(select, voices) {
    const groups = {};
    for (const v of voices) (groups[v.langName || v.lang] ??= []).push(v);
    select.replaceChildren(
      ...Object.entries(groups).map(([g, vs]) => {
        const group = document.createElement("optgroup");
        group.label = g;
        group.append(...vs.map((v) => new Option(v.label, v.id)));
        return group;
      }),
    );
  }

  return { STARTER_VOICES, DEFAULTS, HIGHLIGHTS, shownVoices, listLangs, langDefault, voiceFor, pick, allVoices, fillVoiceSelect };
})();
