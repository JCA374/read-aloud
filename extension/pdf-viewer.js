// The add-on's PDF viewer: pdf.js draws each page, and a text layer of our own puts the page's text over it
// as invisible, positioned lines grouped into paragraphs (data-nv-block). content.js reads and highlights
// that text like any web page. Opened as pdf.html?file=<url>[&read=1], or with a file picked or dropped here.
import * as pdfjs from "./pdf/pdf.min.mjs";

pdfjs.GlobalWorkerOptions.workerSrc = "pdf/pdf.worker.min.mjs";
const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const KEEP_DRAWN = "150% 0px"; // pages drawn: on screen, plus one and a half screens above and below
let doc = null;
let zoom = 1; // on top of fitting the page width
let pages = []; // {el, page, base: viewport at scale 1, canvas, drawing}
const measure = document.createElement("canvas").getContext("2d");

function el(tag, props = {}, ...kids) {
  const e = Object.assign(document.createElement(tag), props);
  e.append(...kids);
  return e;
}

function notice(...kids) {
  $("notice").replaceChildren(...kids);
  $("notice").hidden = !kids.length;
}

const button = (text, onClick) => Object.assign(el("button", { type: "button", textContent: text }), { onclick: onClick });

// ---------------------------------------------------------------- loading

async function loadUrl(url) {
  $("name").textContent = decodeURIComponent(url.split(/[?#]/)[0].split("/").pop() || url);
  notice(el("p", { textContent: "Opening the PDF…" }));
  let res;
  try {
    res = await fetch(url, { credentials: "include" });
    if (!res.ok) throw new Error(`The server answered ${res.status}.`);
    return await load(new Uint8Array(await res.arrayBuffer()));
  } catch (e) {
    return cantFetch(url, e);
  }
}

// Fetching from another site needs the user's permission for it (asked once per site).
async function cantFetch(url, error) {
  const origin = /^https?:/.test(url) && `${new URL(url).origin}/*`;
  const allowed = origin && (await chrome.permissions.contains({ origins: [origin] }).catch(() => true));
  if (origin && !allowed) {
    return notice(
      el("p", { textContent: `To read this PDF, Neural Voices needs your permission to open files from ${new URL(url).host}. It only fetches the PDF; nothing is sent anywhere.` }),
      button(`Allow ${new URL(url).host}`, async () => {
        if (await chrome.permissions.request({ origins: [origin] }).catch(() => false)) loadUrl(url);
      }),
    );
  }
  const local = url.startsWith("file:");
  notice(
    el("p", { textContent: local ? "The browser doesn't let add-ons open files from your disk by their address." : `Couldn't open the PDF: ${error.message}` }),
    el("p", { textContent: "Open it with the button below, or drag the file into this page." }),
    button("Open a PDF…", () => $("file").click()),
  );
}

async function load(data) {
  notice(el("p", { textContent: "Preparing the text…" }));
  try {
    doc = await pdfjs.getDocument({ data, cMapUrl: "pdf/cmaps/", cMapPacked: true, standardFontDataUrl: "pdf/standard_fonts/", wasmUrl: "pdf/wasm/", iccUrl: "pdf/iccs/", isEvalSupported: false, enableXfa: false }).promise;
  } catch (e) {
    const locked = e?.name === "PasswordException";
    return notice(el("p", { textContent: locked ? "This PDF is protected with a password, which Neural Voices can't open yet." : `This file couldn't be opened as a PDF (${e.message}).` }));
  }
  const meta = await doc.getMetadata().catch(() => null);
  const title = meta?.info?.Title?.trim();
  if (title) $("name").textContent = title;
  document.title = `${title || $("name").textContent} · Neural Voices`;
  if (meta?.info?.Language) document.documentElement.lang = meta.info.Language;
  await build();
}

// ---------------------------------------------------------------- pages and text

async function build() {
  const main = $("pages");
  main.replaceChildren();
  pages = [];
  let words = 0;
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const base = page.getViewport({ scale: 1 });
    const p = { n, page, base, el: el("div", { className: "page" }), canvas: null, drawing: null };
    p.el.dataset.page = n;
    pages.push(p);
    size(p);
    const content = await page.getTextContent();
    const text = textLayer(content, page.getViewport({ scale: scaleFor(base) }));
    words += text.textContent.split(/\s+/).filter(Boolean).length;
    p.el.append(text);
    main.append(p.el);
    observer.observe(p.el);
    if (n % 10 === 0) notice(el("p", { textContent: `Preparing the text… page ${n} of ${doc.numPages}` }));
  }
  notice();
  $("pageInfo").textContent = `${doc.numPages} ${doc.numPages === 1 ? "page" : "pages"}`;
  if (!words) return notice(el("p", { textContent: "This PDF has no text layer (it's probably a scanned image), so there's nothing to read aloud." }));
  $("read").disabled = false;
  if (params.has("read")) dispatchEvent(new Event("nv-read-page"));
}

// Fit the page width (at most 1.5× its size), times the zoom.
function scaleFor(base) {
  return Math.min(1.5, (Math.min(innerWidth, 1400) - 32) / base.width) * zoom;
}

function size(p) {
  const v = p.page.getViewport({ scale: scaleFor(p.base) });
  Object.assign(p.el.style, { width: `${v.width}px`, height: `${v.height}px` });
  return v;
}

// The page's text as positioned spans, grouped into paragraphs, with spaces between words and lines
// (and words split by a hyphen at a line end joined again), so content.js gets readable sentences.
function textLayer({ items, styles }, viewport) {
  const layer = el("div", { className: "text" });
  const spans = [];
  for (const it of items) {
    if (!it.str?.trim()) {
      if (it.hasEOL && spans.length) spans.at(-1).eol = true;
      if (it.str && spans.length) spans.at(-1).space = true;
      continue;
    }
    const tx = pdfjs.Util.transform(viewport.transform, it.transform);
    const h = Math.hypot(tx[2], tx[3]);
    if (h < 1) continue;
    const style = styles[it.fontName] || {};
    const family = style.fontFamily || "sans-serif";
    const angle = Math.atan2(tx[1], tx[0]);
    const ascent = style.ascent || (style.descent ? 1 + style.descent : 0.8);
    const left = tx[4] - h * ascent * Math.sin(angle);
    const top = tx[5] - h * ascent * Math.cos(angle);
    measure.font = `${h}px ${family}`;
    const width = (style.vertical ? it.height : it.width) * viewport.scale;
    const measured = measure.measureText(it.str).width;
    const span = el("span");
    span.style.cssText = `left:${left}px;top:${top}px;font-size:${h}px;font-family:${family};transform:rotate(${angle}rad) scaleX(${measured ? width / measured : 1})`;
    spans.push({ span, text: it.str, x: tx[4], y: tx[5], h, right: tx[4] + width, eol: it.hasEOL, space: false });
  }
  let para = null;
  let prev = null;
  for (const s of spans) {
    const newLine = !prev || prev.eol || Math.abs(s.y - prev.y) > prev.h * 0.5 || s.x < prev.x;
    // A new paragraph: a bigger gap than between lines, a jump up (next column), or another text size.
    const newPara = !prev || (newLine && (s.y < prev.y - prev.h || s.y - prev.y > 1.75 * Math.max(s.h, prev.h) || Math.abs(s.h - prev.h) > 0.2 * prev.h));
    if (prev && !newPara) {
      const edge = /\s$/.test(prev.text) || /^\s/.test(s.text);
      if (newLine && /\p{L}-$/u.test(prev.text) && /^\p{Ll}/u.test(s.text)) prev.text = prev.text.slice(0, -1);
      else if (!edge && (newLine || prev.space || s.x - prev.right > 0.15 * s.h)) prev.text += " ";
    }
    if (newPara) {
      para = el("div", { className: "para" });
      para.dataset.nvBlock = "";
      layer.append(para);
    }
    para.append(s.span);
    prev = s;
  }
  for (const s of spans) s.span.textContent = s.text;
  return layer;
}

// Draw pages near the screen; drop the drawings of pages far away (they take a lot of memory).
const observer = new IntersectionObserver(
  (entries) => {
    for (const e of entries) {
      const p = pages[e.target.dataset.page - 1];
      if (e.isIntersecting) draw(p);
      else if (p.canvas) {
        p.drawing?.cancel();
        p.canvas.remove();
        p.canvas = p.drawing = null;
      }
    }
    const top = entries.length && pages.find((p) => p.el.getBoundingClientRect().bottom > 60);
    if (top) $("pageInfo").textContent = `Page ${top.n} of ${pages.length}`;
  },
  { rootMargin: KEEP_DRAWN },
);
addEventListener("scroll", () => {
  const top = pages.find((p) => p.el.getBoundingClientRect().bottom > 60);
  if (top) $("pageInfo").textContent = `Page ${top.n} of ${pages.length}`;
}, { passive: true });

function draw(p) {
  if (p.canvas) return;
  const v = p.page.getViewport({ scale: scaleFor(p.base) });
  const ratio = devicePixelRatio || 1;
  const canvas = el("canvas", { width: Math.floor(v.width * ratio), height: Math.floor(v.height * ratio) });
  p.el.prepend(canvas);
  p.canvas = canvas;
  p.drawing = p.page.render({ canvasContext: canvas.getContext("2d"), viewport: v, transform: ratio === 1 ? null : [ratio, 0, 0, ratio, 0, 0] });
  p.drawing.promise.catch(() => {});
}

// Zoom rebuilds the text layers at the new size (reading stops, since its text is replaced).
async function setZoom(z) {
  if (!doc) return;
  zoom = Math.min(3, Math.max(0.5, z));
  const at = pages.find((p) => p.el.getBoundingClientRect().bottom > 60)?.n || 1;
  dispatchEvent(new Event("nv-stop"));
  for (const p of pages) {
    p.drawing?.cancel();
    p.canvas?.remove();
    p.canvas = p.drawing = null;
    const v = size(p);
    p.el.querySelector(".text").replaceWith(textLayer(await p.page.getTextContent(), v));
  }
  pages[at - 1].el.scrollIntoView();
  for (const p of pages) { observer.unobserve(p.el); observer.observe(p.el); }
}

// ---------------------------------------------------------------- controls

$("read").onclick = () => dispatchEvent(new Event("nv-read-page"));
$("zoomIn").onclick = () => setZoom(zoom * 1.25);
$("zoomOut").onclick = () => setZoom(zoom / 1.25);
$("open").onclick = () => $("file").click();
$("file").onchange = () => {
  const f = $("file").files[0];
  $("file").value = "";
  if (f) openFile(f);
};
async function openFile(f) {
  $("name").textContent = f.name;
  history.replaceState(null, "", location.pathname); // a picked file has no address to come back to
  await load(new Uint8Array(await f.arrayBuffer()));
}
addEventListener("dragover", (e) => {
  e.preventDefault();
  $("notice").classList.add("drop");
});
addEventListener("dragleave", () => $("notice").classList.remove("drop"));
addEventListener("drop", (e) => {
  e.preventDefault();
  $("notice").classList.remove("drop");
  const f = [...(e.dataTransfer?.files || [])].find((f) => f.type === "application/pdf" || /\.pdf$/i.test(f.name));
  if (f) openFile(f);
});

const file = params.get("file");
if (file) loadUrl(file);
else notice(el("p", { textContent: "Open a PDF to have it read aloud, or drag one into this page." }), button("Open a PDF…", () => $("file").click()));
