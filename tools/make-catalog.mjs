// Builds extension/catalog.js: the Piper voices the add-on can offer, pinned to one revision of
// huggingface.co/rhasspy/piper-voices, with each file's size (to check downloads) and the
// voice's licence from its model card.
//
//   node tools/make-catalog.mjs            (needs network; run again to update the voice list)
//
// Voices are skipped when the bundled espeak-ng can't phonemize their language,
// or when they don't use espeak phonemes.

import { readFileSync, writeFileSync } from "node:fs";

const REPO = "https://huggingface.co/rhasspy/piper-voices";
const REVISION = process.argv[2] || (await (await fetch("https://huggingface.co/api/models/rhasspy/piper-voices")).json()).sha;
const base = `${REPO}/resolve/${REVISION}`;
const root = new URL("..", import.meta.url).pathname;

// Languages the bundled espeak-ng data has dictionaries for.
const phonemizer = readFileSync(`${root}extension/engine/vendor/piper_phonemize.js`, "utf8");
const espeak = new Set([
  ...[...phonemizer.matchAll(/"\/espeak-ng-data\/([a-z_-]+)_dict"/g)].map((m) => m[1]),
  ...[...phonemizer.matchAll(/"\/espeak-ng-data\/lang\/[a-z/-]*\/([a-z_-]+)"/g)].map((m) => m[1]), // e.g. nb
]);

// Hand-written labels for the starter voices (the catalogue has no gender).
const LABELS = {
  "en_GB-cori-medium": "Cori (UK, female)",
  "en_GB-alba-medium": "Alba (Scottish, female)",
  "en_GB-northern_english_male-medium": "Northern English (UK, male)",
  "sv_SE-alma-medium": "Alma (svenska, kvinna)",
  "sv_SE-lisa-medium": "Lisa (svenska, kvinna)",
  "sv_SE-nst-medium": "NST (svenska, man)",
};

const title = (s) => s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

// The licence text from a model card: a "* License:" line, a "## License" section or YAML front matter.
function licenceText(card) {
  const line = card.match(/^\s*\*\s*Licen[cs]e:\s*(.+)$/im)?.[1];
  const section = card.match(/^##\s*Licen[cs]e\s*\n+([^\n#]+)/im)?.[1];
  const yaml = card.match(/^---\n[\s\S]*?^license:\s*(.+)$/m)?.[1];
  return (line || section || yaml || "").trim().replace(/\s+/g, " ");
}

// The cards spell licences in 37 ways: reduce them to a short name and a kind the settings page can tag.
//   free: CC0, public domain, CC BY, MIT, Apache   share-alike: CC BY-SA, GPL, AGPL
//   non-commercial: CC BY-NC(-SA), research-only data   unclear: the card doesn't say
function licence(card) {
  const t = licenceText(card);
  const ver = t.match(/\b([1-4]\.0)\b/)?.[1] || ""; // some cards give no version
  if (/lessac_blizzard/i.test(t)) return { licence: "Lessac data, research only", kind: "non-commercial" };
  if (/iitm\.ac\.in/i.test(t)) return { licence: "IndicTTS, non-commercial", kind: "non-commercial" };
  if (/by-nc-sa/i.test(t) || /nc-sa/i.test(t)) return { licence: `CC BY-NC-SA ${ver}`.trim(), kind: "non-commercial" };
  if (/by-nc|non-?commercial/i.test(t)) return { licence: `CC BY-NC ${ver}`.trim(), kind: "non-commercial" };
  if (/agpl/i.test(t)) return { licence: "AGPL-3.0", kind: "share-alike" };
  if (/\bgpl\b/i.test(t)) return { licence: `GPL-${t.match(/\d\.\d/)?.[0] || "3.0"}`, kind: "share-alike" };
  if (/by-sa|sharealike|share-alike/i.test(t)) return { licence: `CC BY-SA ${ver}${/\bES\b/.test(t) ? " ES" : ""}`.replace(/ +/g, " ").trim(), kind: "share-alike" };
  if (/cc0/i.test(t)) return { licence: "CC0", kind: "free" };
  if (/public domain/i.test(t)) return { licence: "Public domain", kind: "free" };
  if (/unlicense/i.test(t)) return { licence: "Unlicense", kind: "free" };
  if (/apache/i.test(t)) return { licence: "Apache-2.0", kind: "free" };
  if (/^mit$/i.test(t)) return { licence: "MIT", kind: "free" };
  if (/cc[- ]by|by\/[34]\.0|attribution/i.test(t)) return { licence: `CC BY ${ver}`.trim(), kind: "free" };
  return { licence: "Not stated", kind: "unclear" };
}

async function text(url) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const r = await fetch(url);
    if (r.ok) return r.text();
    await new Promise((res) => setTimeout(res, 1000 * (attempt + 1)));
  }
  throw new Error(`Failed: ${url}`);
}

const index = JSON.parse(await text(`${base}/voices.json`));
const entries = Object.values(index);
const out = [];
const skipped = [];
for (let i = 0; i < entries.length; i += 12) {
  await Promise.all(
    entries.slice(i, i + 12).map(async (v) => {
      const files = Object.entries(v.files);
      const [onnxPath, onnx] = files.find(([p]) => p.endsWith(".onnx"));
      const [jsonPath, json] = files.find(([p]) => p.endsWith(".onnx.json"));
      const cardPath = files.find(([p]) => p.endsWith("MODEL_CARD"))?.[0];
      const config = JSON.parse(await text(`${base}/${jsonPath}`));
      const espeakVoice = config.espeak?.voice || "";
      const type = config.phoneme_type || "espeak";
      if (type !== "espeak" || !espeak.has(espeakVoice.split("-")[0])) {
        skipped.push(`${v.key} (${type}, ${espeakVoice})`);
        return;
      }
      const card = cardPath ? await text(`${base}/${cardPath}`) : "";
      const lang = v.language;
      out.push({
        id: `piper:${v.key}`,
        label: LABELS[v.key] || `${title(v.name)} (${lang.country_english}${v.quality === "medium" ? "" : `, ${v.quality}`})`,
        lang: lang.family,
        langName: lang.name_english,
        country: lang.country_english,
        quality: v.quality,
        speakers: v.num_speakers,
        onnx: { path: onnxPath, size: onnx.size_bytes, md5: onnx.md5_digest },
        config: { path: jsonPath, size: json.size_bytes },
        card: cardPath || "",
        ...licence(card),
      });
    }),
  );
  process.stdout.write(`\r${Math.min(i + 12, entries.length)}/${entries.length}`);
}
out.sort((a, b) => a.langName.localeCompare(b.langName) || a.label.localeCompare(b.label));

writeFileSync(
  `${root}extension/catalog.js`,
  `// Generated by tools/make-catalog.mjs from ${REPO} at revision ${REVISION}. Do not edit by hand.\n` +
    `var NV_CATALOG = ${JSON.stringify({ base, revision: REVISION, voices: out })};\n`,
);
console.log(`\n${out.length} voices written to extension/catalog.js; skipped ${skipped.length}: ${skipped.join(", ")}`);
const kinds = Object.groupBy(out, (v) => v.kind);
console.log(`Licences: ${Object.entries(kinds).map(([k, vs]) => `${vs.length} ${k}`).join(", ")}`);
