// Settings and voice choice, shared by the content script, background, popup and settings page.
var NV = (() => {
  const PIPER_VOICES = [
    ["piper:en_GB-cori-medium", "Cori (UK, female)"],
    ["piper:en_GB-alba-medium", "Alba (Scottish, female)"],
    ["piper:en_GB-northern_english_male-medium", "Northern English (UK, male)"],
    ["piper:sv_SE-alma-medium", "Alma (svenska, kvinna)"],
    ["piper:sv_SE-lisa-medium", "Lisa (svenska, kvinna)"],
    ["piper:sv_SE-nst-medium", "NST (svenska, man)"],
  ].map(([id, label]) => ({ id, label, engine: "piper", lang: id.slice(6, 8) }));

  const DEFAULTS = {
    voice: "piper:en_GB-cori-medium", // default for English text
    voiceSv: "piper:sv_SE-alma-medium", // default for Swedish text
    autoDetect: true, // pick the voice by the language of the text
    fixedVoice: "", // the one voice used when autoDetect is off ("" = the English default)
    shown: null, // ids of the voices in your list (null = all)
    kokoro: false, // also offer Kokoro voices from the local server
    speed: 1.0,
  };

  const LANGS = { en: "English", sv: "Swedish" };
  const VOICE_KEY = { en: "voice", sv: "voiceSv" }; // which setting holds each language's default

  // The voices in your list. Never empty: if nothing is ticked, all voices show.
  function shownVoices(voices, s) {
    const list = s.shown ? voices.filter((v) => s.shown.includes(v.id)) : voices;
    return list.length ? list : voices;
  }

  // The voice to read text in this language with, using only voices from your list.
  function voiceFor(lang, s, voices) {
    const shown = shownVoices(voices, s);
    const ok = (id) => shown.some((v) => v.id === id);
    if (!s.autoDetect) {
      for (const id of [s.fixedVoice, s.voice]) if (ok(id)) return id;
      return shown[0].id;
    }
    const want = s[VOICE_KEY[lang] || "voice"];
    if (ok(want)) return want;
    // That language's default isn't in your list: another voice for the language, else the English default.
    return (shown.find((v) => v.lang === lang) || shown.find((v) => v.id === s.voice) || shown[0]).id;
  }

  // The setting a voice picked by hand is saved to.
  function keyFor(id, s, voices) {
    if (!s.autoDetect) return "fixedVoice";
    const lang = voices.find((v) => v.id === id)?.lang || "en";
    return VOICE_KEY[lang] || "voice";
  }

  // All voices: Piper always; Kokoro only if turned on and the local server answers.
  async function allVoices(s) {
    if (!s.kokoro) return PIPER_VOICES;
    const res = await chrome.runtime.sendMessage({ type: "health" }).catch(() => null);
    return res?.voices?.length ? res.voices : PIPER_VOICES;
  }

  const GROUPS = { piper: "Piper", kokoro: "Kokoro (local server)" };
  function voiceOptions(voices) {
    const groups = {};
    for (const v of voices) (groups[`${LANGS[v.lang] || v.lang} · ${GROUPS[v.engine] || v.engine}`] ??= []).push(v);
    return Object.entries(groups)
      .map(([g, vs]) => `<optgroup label="${g}">${vs.map((v) => `<option value="${v.id}">${v.label}</option>`).join("")}</optgroup>`)
      .join("");
  }

  return { PIPER_VOICES, DEFAULTS, LANGS, VOICE_KEY, shownVoices, voiceFor, keyFor, allVoices, voiceOptions };
})();
