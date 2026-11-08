// The reader: Firefox runs no add-on scripts on its add-on store (addons.mozilla.org), so an add-on's store
// page can't be read where it is. This page gets the same text from the store's public API and shows it as
// plain paragraphs; content.js reads it like any page. Opened as reader.html?url=<store page>[&read=1].
const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);

function el(tag, props = {}, ...kids) {
  const e = Object.assign(document.createElement(tag), props);
  e.append(...kids);
  return e;
}

// Store text may hold a few HTML tags (b, i, a, ul, li, br…): keep only the words, one paragraph per line.
// DOMParser makes an inert document: nothing in it runs or loads.
function paragraphs(html) {
  if (!html) return [];
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  doc.querySelectorAll("br").forEach((br) => br.replaceWith("\n"));
  doc.querySelectorAll("li, p, h1, h2, h3, h4, blockquote, pre").forEach((b) => b.append("\n"));
  return doc.body.textContent.split(/\n+/).map((t) => t.trim()).filter(Boolean);
}

const text = (s) => (s && typeof s === "object" ? Object.values(s)[0] : s) || "";

async function load(url) {
  const store = NV.storeAddon(url);
  if (!store) return notice(`Neural Voices can't show this page: ${url}`);
  $("source").href = url;
  notice("Getting the text…");
  let a;
  try {
    const res = await fetch(`https://addons.mozilla.org/api/v5/addons/addon/${encodeURIComponent(store.slug)}/?lang=${encodeURIComponent(store.lang)}`);
    if (!res.ok) throw new Error(`the store answered ${res.status}`);
    a = await res.json();
  } catch (e) {
    return notice(`Couldn't get the text from the add-on store (${e.message}).`);
  }
  const name = text(a.name);
  $("name").textContent = name;
  document.title = `${name} · Neural Voices`;
  document.documentElement.lang = store.lang;
  const by = (a.authors || []).map((p) => p.name).filter(Boolean).join(", ");
  const section = (title, body) => {
    const ps = paragraphs(text(body));
    return ps.length ? [el("h2", { textContent: title }), ...ps.map((p) => el("p", { textContent: p }))] : [];
  };
  $("article").replaceChildren(
    el("h1", { textContent: name }),
    ...paragraphs(text(a.summary)).map((p) => el("p", { className: "summary", textContent: p })),
    ...(by ? [el("p", { textContent: `By ${by}.` })] : []),
    ...section("About this extension", a.description),
    ...section("Developer comments", a.developer_comments),
    ...section(`Release notes for ${a.current_version?.version || "this version"}`, a.current_version?.release_notes),
  );
  notice();
  $("text").hidden = false;
  $("read").disabled = false;
  if (params.has("read")) dispatchEvent(new Event("nv-read-page"));
}

function notice(msg) {
  $("notice").replaceChildren(...(msg ? [el("p", { textContent: msg })] : []));
  $("notice").hidden = !msg;
}

$("read").onclick = () => dispatchEvent(new Event("nv-read-page"));
load(params.get("url") || "");
