// Read Aloud (Kokoro): page text -> sentences -> local TTS -> playback with sentence + word highlighting.
(() => {
  if (window.__kokoroReader) return;
  window.__kokoroReader = true;

  const DEFAULTS = { voice: "piper:en_GB-cori-medium", voiceSv: "piper:sv_SE-alma-medium", speed: 1.0 };
  const SPEEDS = [0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2];
  const AHEAD_SECONDS = 60; // keep this much audio rendered ahead of what's playing
  const AHEAD_MAX = 30; // ...but never more than this many pieces
  const STAGES = [45, 100, 200]; // max characters of the first pieces: short first, so sound starts fast
  let settings = { ...DEFAULTS };
  let voices = [{ id: "piper:en_GB-cori-medium", label: "Cori (UK, female)", engine: "piper", lang: "en" }];

  const VOICE_GROUPS = {
    "kokoro|en": "English · natural (Kokoro, ~1 GB RAM)",
    "piper|en": "English · light & fast (Piper)",
    "piper|sv": "Svenska · light & fast (Piper)",
  };
  function voiceOptions(voices) {
    const groups = {};
    for (const v of voices) (groups[`${v.engine || "kokoro"}|${v.lang || "en"}`] ??= []).push(`<option value="${v.id}">${v.label}</option>`);
    return Object.entries(groups).map(([g, opts]) => `<optgroup label="${VOICE_GROUPS[g] || g}">${opts.join("")}</optgroup>`).join("");
  }
  const voiceLang = (id) => voices.find((v) => v.id === id)?.lang || (id.startsWith("piper:sv") ? "sv" : "en");
  // Which voice setting a language uses. Each language remembers its own voice.
  const VOICE_KEY = { en: "voice", sv: "voiceSv" };

  chrome.storage.local.get(DEFAULTS).then((s) => {
    settings = s;
    ui.sync();
  });
  chrome.storage.onChanged.addListener((changes) => {
    for (const [k, { newValue }] of Object.entries(changes)) if (k in DEFAULTS) settings[k] = newValue;
    player.settingsChanged();
    ui.sync();
  });

  // ---------------------------------------------------------------- text extraction

  const SKIP = "script,style,noscript,template,svg,canvas,textarea,input,select,button,iframe,object,math,kokoro-reader,[aria-hidden=true],[hidden]";
  const BOILERPLATE = "nav,header,footer,aside,[role=navigation],[role=banner],[role=contentinfo],[role=complementary],[role=search],.mw-editsection,.noprint";
  const ACCEPT = NodeFilter.FILTER_ACCEPT;
  const SKIPNODE = NodeFilter.FILTER_SKIP;
  const HAS_WORD = /[\p{L}\p{N}]/u;

  function isBoilerplate(el, root) {
    const b = el.closest(BOILERPLATE);
    if (!b || b === root || !root.contains(b)) return false;
    // An article's own <header> holds its title: keep it. Its <footer> (share buttons, tags) is skipped.
    if (b.tagName === "HEADER" && b.parentElement?.closest("article,main,[role=main]")) return false;
    return true;
  }

  // Wikipedia-style reference marks like [12]
  function isFootnoteMark(el) {
    const sup = el.closest("sup");
    return sup && /^\s*\[?[\d,\s–-]+\]?\s*$|^\s*\[\w{1,12}\]\s*$/.test(sup.textContent);
  }

  function isVisible(el, cache) {
    let v = cache.get(el);
    if (v === undefined) {
      v = el.checkVisibility ? el.checkVisibility({ visibilityProperty: true }) : el.getClientRects().length > 0;
      if (v) {
        const r = el.getBoundingClientRect();
        if (r.width <= 1 && r.height <= 1) v = false; // screen-reader-only text
      }
      cache.set(el, v);
    }
    return v;
  }

  function blockOf(el, cache = new Map()) {
    for (let e = el; e && e !== document.body; e = e.parentElement) {
      let d = cache.get(e);
      if (d === undefined) cache.set(e, (d = getComputedStyle(e).display));
      if (!d.startsWith("inline") && d !== "contents") return e;
    }
    return document.body;
  }

  function brBetween(a) {
    let x = a;
    while (x && !x.nextSibling) x = x.parentNode;
    x = x?.nextSibling;
    return x?.nodeName === "BR";
  }

  // Text nodes inside `range`, grouped per block element into chunks: {block, pieces: [{node, start, end, offset}], text}
  function collectChunks(range, root, skipBoilerplate) {
    const display = new Map();
    const visible = new Map();
    let container = range.commonAncestorContainer;
    if (container.nodeType !== Node.ELEMENT_NODE) container = container.parentElement;
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        if (!n.data.trim() || !range.intersectsNode(n)) return SKIPNODE;
        const el = n.parentElement;
        if (!el || el.closest(SKIP) || isFootnoteMark(el)) return SKIPNODE;
        if (skipBoilerplate && isBoilerplate(el, root)) return SKIPNODE;
        return isVisible(el, visible) ? ACCEPT : SKIPNODE;
      },
    });
    const chunks = [];
    let cur = null;
    let prev = null;
    for (let n; (n = walker.nextNode()); ) {
      const start = n === range.startContainer ? range.startOffset : 0;
      const end = n === range.endContainer ? range.endOffset : n.data.length;
      if (end <= start) continue;
      const block = blockOf(n.parentElement, display);
      if (!cur || cur.block !== block) {
        cur = { block, pieces: [], text: "" };
        chunks.push(cur);
        prev = null;
      }
      if (prev && brBetween(prev)) cur.text += "\n";
      cur.pieces.push({ node: n, start, end, offset: cur.text.length });
      cur.text += n.data.slice(start, end);
      prev = n;
    }
    return chunks.filter((c) => HAS_WORD.test(c.text));
  }

  let segmenter;
  try {
    segmenter = new Intl.Segmenter(document.documentElement.lang || "en", { granularity: "sentence" });
  } catch {
    segmenter = new Intl.Segmenter("en", { granularity: "sentence" });
  }
  // A "sentence" ending in one of these is merged with the next one ("Dr. Smith", "J. R. R. Tolkien").
  const ABBREV = /(?:\b(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|Mt|vs|e\.g|i\.e|cf|Fig|No|Vol|Inc|Ltd|Co|approx|t\.ex|bl\.a|s\.k|d\.v\.s|dvs|f\.d|resp|ca|kl|nr|jfr|fr\.o\.m|t\.o\.m)|(?:^|\s)[A-Z])\.\s*$/;

  function splitLong(text, s, e, max) {
    const out = [];
    while (e - s > max) {
      const w = text.slice(s, s + max);
      let cut = Math.max(w.lastIndexOf(", "), w.lastIndexOf("; "), w.lastIndexOf(": "), w.lastIndexOf(" – "), w.lastIndexOf(" — "));
      if (cut < max / 3) cut = w.lastIndexOf(" ");
      if (cut <= 0) cut = max - 1;
      out.push([s, s + cut + 1]);
      s += cut + 1;
    }
    out.push([s, e]);
    return out;
  }

  // Chunks -> sentences: {chunk, start, end, text}.
  function toSentences(chunks) {
    const segs = [];
    for (const chunk of chunks) {
      const parts = [];
      let pending = null;
      for (const { segment, index } of segmenter.segment(chunk.text)) {
        if (pending) pending[1] = index + segment.length;
        else pending = [index, index + segment.length];
        if (!ABBREV.test(chunk.text.slice(pending[0], pending[1]))) {
          parts.push(pending);
          pending = null;
        }
      }
      if (pending) parts.push(pending);
      for (const [s0, e0] of parts) {
        for (const [s, e] of splitLong(chunk.text, s0, e0, 300)) {
          let a = s;
          let b = e;
          while (a < b && /\s/.test(chunk.text[a])) a++;
          while (b > a && /\s/.test(chunk.text[b - 1])) b--;
          const text = chunk.text.slice(a, b);
          if (HAS_WORD.test(text)) segs.push({ chunk, start: a, end: b, text });
        }
      }
    }
    return segs;
  }

  // Split a sentence after a comma (or a space) before `max` characters: [head, rest], or [seg] if it's short.
  function splitSeg(seg, max) {
    const t = seg.text;
    if (t.length <= max * 1.3) return [seg];
    const w = t.slice(0, max);
    let cut = Math.max(...[",", ";", ":", " –", " —"].map((p) => w.lastIndexOf(p + " ")));
    if (cut >= 0 && t[cut] === " ") cut++; // keep the dash with the head
    if (cut < max / 3) cut = w.lastIndexOf(" ") - 1;
    if (cut < 8) return [seg];
    const head = t.slice(0, cut + 1).trimEnd();
    let a = cut + 1;
    while (a < t.length && /\s/.test(t[a])) a++;
    return [
      { ...seg, end: seg.start + head.length, text: head },
      { ...seg, start: seg.start + a, text: t.slice(a) },
    ];
  }

  // Cut the text where reading starts into growing pieces (about 45, 100, 200 characters), so the first
  // sound comes quickly and each next piece is rendered while the one before it plays.
  function stageStart(segs, i) {
    segs = segs.slice();
    for (let k = 0, p = i; k < STAGES.length && p < segs.length; k++, p++) {
      segs.splice(p, 1, ...splitSeg(segs[p], STAGES[k]));
    }
    return segs;
  }

  function makeRange(chunk, a, b) {
    const ps = chunk.pieces;
    const sp = ps.find((p) => a < p.offset + (p.end - p.start)) || ps[ps.length - 1];
    const ep = ps.findLast((p) => p.offset < b) || ps[0];
    try {
      const r = document.createRange();
      r.setStart(sp.node, sp.start + Math.min(Math.max(0, a - sp.offset), sp.end - sp.start));
      r.setEnd(ep.node, ep.start + Math.min(Math.max(0, b - ep.offset), ep.end - ep.start));
      return r;
    } catch {
      return null; // the page changed under us
    }
  }

  // Match the server's word timings to positions in the sentence.
  function wordRanges(seg, words) {
    const out = [];
    let cur = 0;
    for (const [w, s, e] of words) {
      if (!HAS_WORD.test(w)) continue;
      const idx = seg.text.indexOf(w, cur);
      if (idx < 0 || idx - cur > 60) continue;
      cur = idx + w.length;
      const r = makeRange(seg.chunk, seg.start + idx, seg.start + cur);
      if (r) out.push({ s, e, r });
    }
    return out;
  }

  // The element holding the page's main text.
  function pickRoot() {
    let best = null;
    let bestLen = 0;
    for (const el of document.querySelectorAll("article, main, [role=main], #content, .post-content, .entry-content")) {
      const len = el.innerText?.length || 0;
      if (len > bestLen) [best, bestLen] = [el, len];
    }
    return best && bestLen > 500 ? best : document.body;
  }

  // ---------------------------------------------------------------- highlighting

  const HAS_HL = typeof CSS !== "undefined" && CSS.highlights && typeof Highlight === "function";
  function highlight(name, range) {
    if (!HAS_HL) return;
    if (range) CSS.highlights.set(name, new Highlight(range));
    else CSS.highlights.delete(name);
  }

  let lastUserScroll = 0;
  for (const ev of ["wheel", "touchmove"]) addEventListener(ev, () => (lastUserScroll = Date.now()), { passive: true });
  addEventListener("keydown", (e) => {
    if (["PageDown", "PageUp", "ArrowDown", "ArrowUp", "Home", "End", " "].includes(e.key)) lastUserScroll = Date.now();
  });

  function scrollToRange(r) {
    if (!r || Date.now() - lastUserScroll < 4000) return;
    const rect = r.getBoundingClientRect();
    if (!rect.height) return;
    if (rect.top < 60 || rect.bottom > innerHeight - 120) {
      scrollBy({ top: rect.top - innerHeight / 3, behavior: "smooth" });
    }
  }

  // ---------------------------------------------------------------- player

  function b64ToBytes(b64) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes.buffer;
  }

  const player = {
    segs: [],
    i: 0,
    state: "idle", // idle | loading | playing | paused
    error: "",
    token: 0,
    ctx: null,
    source: null,
    startAt: 0,
    words: [],
    wordIdx: -1,
    cache: new Map(), // `${i}|${voice}|${speed}` -> Promise<{buffer, words} | {error}>
    durations: new Map(), // same keys -> seconds of audio, once rendered
    inflight: false,
    stats: null, // {t0, first, waits, waitTime}: how fast sound started, and any waits after that

    lang: "en",

    voice() {
      return settings[VOICE_KEY[this.lang]] || settings.voice;
    },

    key(i) {
      return `${i}|${this.voice()}|${settings.speed}`;
    },

    fetch(i) {
      const key = this.key(i);
      if (!this.cache.has(key)) {
        const seg = this.segs[i];
        const p = chrome.runtime
          .sendMessage({ type: "tts", text: seg.text, voice: this.voice(), speed: settings.speed })
          .then(async (res) => {
            if (!res || res.error) return { error: res?.error || "offline" };
            const buffer = await this.ctx.decodeAudioData(b64ToBytes(res.audio));
            this.durations.set(key, buffer.duration);
            return { buffer, words: res.words };
          })
          .catch(() => ({ error: "offline" }));
        this.cache.set(key, p);
      }
      return this.cache.get(key);
    },

    // Render ahead one request at a time, in order (the server renders one at a time anyway),
    // until AHEAD_SECONDS of audio is ready. The server never sits idle while there's room in the buffer.
    pump() {
      if (this.inflight || this.state === "idle") return;
      let ahead = 0;
      for (let j = this.i; j < Math.min(this.segs.length, this.i + AHEAD_MAX); j++) {
        const key = this.key(j);
        if (this.cache.has(key)) {
          if (j > this.i) ahead += this.durations.get(key) || 0;
          if (ahead >= AHEAD_SECONDS) return;
          continue;
        }
        this.inflight = true;
        this.fetch(j).then(() => {
          this.inflight = false;
          this.pump();
        });
        return;
      }
    },

    async start(segs, i = 0, lang = "en") {
      this.stop();
      if (!segs.length) return ui.flash("No readable text found");
      this.segs = stageStart(segs, i);
      this.lang = lang;
      this.stats = { t0: performance.now(), first: null, waits: 0, waitTime: 0 };
      this.ctx ??= new AudioContext();
      this.ctx.resume().catch(() => {});
      ui.show();
      this.playIndex(i, 0);
    },

    async playIndex(i, gap) {
      const tok = ++this.token;
      this.halt();
      if (i < 0) i = 0;
      if (i >= this.segs.length) return this.finish();
      this.i = i;
      const seg = this.segs[i];
      const sentence = makeRange(seg.chunk, seg.start, seg.end);
      highlight("kokoro-sentence", sentence);
      highlight("kokoro-word", null);
      scrollToRange(sentence);
      if (this.state !== "paused") this.setState("loading");
      this.pump();

      const waitFrom = performance.now();
      const res = await this.fetch(i);
      if (tok !== this.token) return;
      const st = this.stats;
      const waited = performance.now() - waitFrom;
      if (st.first !== null && waited > 150 && this.state !== "paused") {
        st.waits++;
        st.waitTime += waited;
        console.debug(`[Read Aloud] waited ${(waited / 1000).toFixed(1)} s for piece ${i} (${seg.text.length} chars)`);
      }
      if (res.error) {
        this.cache.delete(this.key(i));
        if (res.error === "offline") {
          this.error = "TTS server offline — run start-server.sh";
          return this.stop(true);
        }
        console.warn("[Read Aloud] skipping sentence:", res.error, seg.text);
        return this.playIndex(i + 1, 0);
      }
      this.words = wordRanges(seg, res.words);
      this.wordIdx = -1;
      const src = this.ctx.createBufferSource();
      src.buffer = res.buffer;
      src.connect(this.ctx.destination);
      src.onended = () => {
        if (this.source !== src) return;
        this.source = null;
        // Pause a little longer between paragraphs than between sentences.
        const next = this.segs[i + 1];
        this.playIndex(i + 1, next && next.chunk !== seg.chunk ? 0.3 : 0);
      };
      this.source = src;
      this.startAt = this.ctx.currentTime + gap;
      src.start(this.startAt);
      if (st.first === null) st.first = performance.now() - st.t0;
      // Drop audio for sentences we've passed.
      for (const k of [...this.cache.keys()]) {
        if (parseInt(k) < i - 2) {
          this.cache.delete(k);
          this.durations.delete(k);
        }
      }
      if (this.state === "paused") return;
      this.setState("playing");
      if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
      this.tick();
    },

    tickId: 0,
    tick(id = ++this.tickId) {
      if (id !== this.tickId || this.state !== "playing" || !this.source) return;
      const t = this.ctx.currentTime - this.startAt;
      let w = -1;
      for (let k = 0; k < this.words.length && this.words[k].s <= t; k++) w = k;
      if (w !== this.wordIdx) {
        this.wordIdx = w;
        highlight("kokoro-word", w >= 0 ? this.words[w].r : null);
      }
      requestAnimationFrame(() => this.tick(id));
    },

    halt() {
      if (this.source) {
        const s = this.source;
        this.source = null;
        try {
          s.stop();
        } catch {}
      }
    },

    pause() {
      if (this.state !== "playing" && this.state !== "loading") return;
      this.ctx.suspend();
      this.setState("paused");
    },

    resume() {
      if (this.state !== "paused") return;
      this.ctx.resume();
      this.setState(this.source ? "playing" : "loading");
      this.tick();
    },

    toggle() {
      if (this.state === "paused") this.resume();
      else if (this.state === "idle") readSelectionOrPage();
      else this.pause();
    },

    skip(d) {
      if (this.state === "idle") return;
      if (this.state === "paused") {
        this.ctx.resume();
        this.state = "loading";
      }
      this.playIndex(this.i + d, 0);
    },

    stop(keepError = false) {
      this.token++;
      this.halt();
      const st = this.stats;
      if (st?.first != null) {
        console.info(`[Read Aloud] first sound after ${(st.first / 1000).toFixed(2)} s; waited ${st.waits} times (${(st.waitTime / 1000).toFixed(1)} s) after that`);
      }
      this.stats = null;
      this.cache.clear();
      this.durations.clear();
      highlight("kokoro-sentence", null);
      highlight("kokoro-word", null);
      if (!keepError) this.error = "";
      this.ctx?.resume().catch(() => {});
      this.setState("idle");
    },

    finish() {
      this.stop();
    },

    // Voice or speed changed: keep the sentence that's playing, re-render the ones after it.
    settingsChanged() {
      if (this.state === "idle") return;
      for (const k of [...this.cache.keys()]) if (parseInt(k) !== this.i) this.cache.delete(k);
      this.pump();
    },

    setState(s) {
      const was = this.state;
      this.state = s;
      // Tell the background when this tab starts or stops reading, so it can stop other tabs.
      if ((was === "idle") !== (s === "idle")) chrome.runtime.sendMessage({ type: "reading", state: s }).catch(() => {});
      ui.sync();
    },
  };

  // ---------------------------------------------------------------- commands

  // ---------------------------------------------------------------- language

  const SV_WORDS = new Set("och att det är som på för med inte av till den har jag de om ett men var så vi kan när från också eller vid hon han sig efter mycket där här ska skulle vara blir finns".split(" "));
  const EN_WORDS = new Set("the and to of is that it in for with on was as are this be by not you he she they have from or but at an his her which were would there".split(" "));

  function pageLang(el = document.documentElement) {
    const attr = (el.closest?.("[lang]")?.lang || document.documentElement.lang || "").toLowerCase();
    return attr.startsWith("sv") ? "sv" : "en";
  }

  // The words decide; the page's lang attribute only breaks ties (many sites leave lang="en" in their template).
  function detectLang(text, el) {
    const words = text.toLowerCase().match(/\p{L}+/gu) || [];
    let sv = 0;
    let en = 0;
    for (const w of words.slice(0, 500)) {
      if (SV_WORDS.has(w)) sv++;
      if (EN_WORDS.has(w)) en++;
    }
    sv += (text.slice(0, 3000).match(/[åäö]/gi) || []).length / 4;
    if (words.length >= 3 && sv !== en) return sv > en ? "sv" : "en";
    return pageLang(el);
  }

  function readRange(range, root, skipBoilerplate, startAt) {
    const { segs, lang, i } = plan(range, root, skipBoilerplate, startAt);
    player.start(segs, i, lang);
  }

  // Start rendering the first words of a selection before the speaker button is clicked.
  // The server keeps the result, so the click plays it almost at once.
  function prewarmSelection() {
    const sel = getSelection();
    if (!sel.rangeCount || sel.isCollapsed || player.state !== "idle") return;
    const { segs, lang } = plan(sel.getRangeAt(0), document.body, false);
    if (!segs.length) return;
    const voice = settings[VOICE_KEY[lang]] || settings.voice;
    const first = stageStart(segs, 0)[0];
    chrome.runtime.sendMessage({ type: "tts", text: first.text, voice, speed: settings.speed }).catch(() => {});
  }

  function plan(range, root, skipBoilerplate, startAt) {
    const segs = toSentences(collectChunks(range, root, skipBoilerplate));
    const container = range.commonAncestorContainer;
    const lang = detectLang(segs.slice(0, 40).map((s) => s.text).join(" "), container.nodeType === 1 ? container : container.parentElement);
    let i = 0;
    if (startAt) {
      for (const [k, s] of segs.entries()) {
        const p = s.chunk.pieces.find((p) => p.node === startAt.node);
        if (p && startAt.offset - p.start + p.offset < s.end) {
          i = k;
          break;
        }
      }
    }
    return { segs, lang, i };
  }

  function readSelection() {
    const sel = getSelection();
    if (!sel.rangeCount || sel.isCollapsed) return false;
    const range = sel.getRangeAt(0);
    sel.removeAllRanges();
    readRange(range, document.body, false);
    return true;
  }

  function readPage() {
    const root = pickRoot();
    const range = document.createRange();
    range.selectNodeContents(root);
    readRange(range, root, true);
  }

  function readSelectionOrPage() {
    if (!readSelection()) readPage();
  }

  function caretAt(x, y) {
    if (document.caretPositionFromPoint) {
      const c = document.caretPositionFromPoint(x, y);
      return c && { node: c.offsetNode, offset: c.offset };
    }
    const r = document.caretRangeFromPoint?.(x, y);
    return r && { node: r.startContainer, offset: r.startOffset };
  }

  // Read from the paragraph containing `target` to the end of the article (or page).
  function readFrom(target, x, y) {
    if (!(target instanceof Element)) target = target?.parentElement;
    if (!target) return readPage();
    let root = pickRoot();
    if (!root.contains(target)) root = document.body;
    const range = document.createRange();
    range.setStartBefore(blockOf(target));
    range.setEnd(root, root.childNodes.length);
    const caret = x != null ? caretAt(x, y) : null;
    readRange(range, root, !isBoilerplate(target, root), caret?.node?.nodeType === Node.TEXT_NODE ? caret : null);
  }

  let contextTarget = null;
  let contextPoint = null;
  addEventListener("contextmenu", (e) => {
    contextTarget = e.target;
    contextPoint = [e.clientX, e.clientY];
  }, true);

  // ---------------------------------------------------------------- click-to-read mode

  let clickMode = false;
  let hoverEl = null;
  function setHover(el) {
    hoverEl?.classList.remove("kokoro-hover");
    hoverEl = el;
    el?.classList.add("kokoro-hover");
  }
  function setClickMode(on) {
    clickMode = on;
    if (on) ui.show();
    else setHover(null);
    ui.sync();
  }
  addEventListener("mouseover", (e) => {
    if (!clickMode || e.target === ui.host) return;
    const el = blockOf(e.target);
    setHover(el === document.body ? null : el);
  }, true);
  addEventListener("click", (e) => {
    if (!clickMode || e.button !== 0 || e.composedPath().includes(ui.host)) return;
    e.preventDefault();
    e.stopPropagation();
    readFrom(e.target, e.clientX, e.clientY);
  }, true);
  addEventListener("keydown", (e) => {
    if (e.key === "Escape" && clickMode) setClickMode(false);
  });

  // ---------------------------------------------------------------- UI (floating player + selection bubble)

  const ICONS = {
    play: '<path d="M8 5.5v13a1 1 0 0 0 1.5.86l11-6.5a1 1 0 0 0 0-1.72l-11-6.5A1 1 0 0 0 8 5.5z"/>',
    pause: '<rect x="6.5" y="5" width="4" height="14" rx="1"/><rect x="13.5" y="5" width="4" height="14" rx="1"/>',
    prev: '<path d="M6 5h2v14H6zM19 6.2v11.6a.8.8 0 0 1-1.2.7L9.6 12.7a.8.8 0 0 1 0-1.4l8.2-5.8a.8.8 0 0 1 1.2.7z"/>',
    next: '<path d="M16 5h2v14h-2zM5 6.2v11.6a.8.8 0 0 0 1.2.7l8.2-5.8a.8.8 0 0 0 0-1.4L6.2 5.5A.8.8 0 0 0 5 6.2z"/>',
    stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
    click: '<path d="M9 3.5v11.2l2.7-2.6 2 4.6 2.2-1-2-4.5h3.8z"/>',
    close: '<path d="M6.4 5 12 10.6 17.6 5 19 6.4 13.4 12 19 17.6 17.6 19 12 13.4 6.4 19 5 17.6 10.6 12 5 6.4z"/>',
    speaker: '<path d="M4 9.5v5h3.5L12 19V5L7.5 9.5zM15 8.5a5 5 0 0 1 0 7M17.5 6a8.5 8.5 0 0 1 0 12" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round"/><path d="M4 9.5v5h3.5L12 19V5L7.5 9.5z"/>',
  };
  const icon = (name) => `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${ICONS[name]}</svg>`;

  const CSS_TEXT = `
    :host { all: initial; }
    * { box-sizing: border-box; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; }
    .bar {
      --bg: #ffffff; --fg: #1f2328; --muted: #6a737d; --line: #e3e6ea; --accent: #e8590c; --accent-fg: #fff; --hover: #f2f3f5;
      position: fixed; z-index: 2147483647; right: 24px; bottom: 24px;
      display: none; align-items: center; gap: 4px; padding: 6px 8px;
      background: var(--bg); color: var(--fg); border: 1px solid var(--line); border-radius: 999px;
      box-shadow: 0 8px 30px rgba(0,0,0,.18), 0 2px 6px rgba(0,0,0,.08); font-size: 13px; user-select: none;
    }
    @media (prefers-color-scheme: dark) {
      .bar { --bg: #24272c; --fg: #e8eaed; --muted: #9aa0a6; --line: #3a3f45; --hover: #30343a; }
    }
    .bar.open { display: flex; }
    button { all: unset; display: grid; place-items: center; width: 32px; height: 32px; border-radius: 50%; cursor: pointer; color: var(--fg); }
    button:hover { background: var(--hover); }
    button:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
    button svg { width: 18px; height: 18px; }
    button.play { width: 40px; height: 40px; background: var(--accent); color: var(--accent-fg); position: relative; }
    button.play:hover { filter: brightness(1.08); background: var(--accent); }
    button.play svg { width: 20px; height: 20px; }
    button.play.loading::after {
      content: ""; position: absolute; inset: -3px; border-radius: 50%;
      border: 3px solid transparent; border-top-color: var(--accent); animation: spin .8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    button.on { background: var(--accent); color: var(--accent-fg); }
    button.small { width: 28px; height: 28px; color: var(--muted); }
    button.small svg { width: 16px; height: 16px; }
    .grip { width: 10px; height: 28px; cursor: grab; margin-left: 2px;
      background: radial-gradient(circle, var(--muted) 1.2px, transparent 1.6px) 0 0 / 5px 5px; opacity: .6; }
    .sep { width: 1px; height: 22px; background: var(--line); margin: 0 4px; }
    select { all: unset; cursor: pointer; padding: 6px 8px; border-radius: 8px; color: var(--fg); font-size: 13px; }
    select:hover { background: var(--hover); }
    select option { color: #1f2328; background: #fff; }
    select.voice { max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .status { color: var(--muted); font-size: 12px; padding: 0 6px; white-space: nowrap; max-width: 260px; overflow: hidden; text-overflow: ellipsis; }
    .status:empty { display: none; }
    .status.err { color: #d1242f; }
    .bubble {
      position: fixed; z-index: 2147483647; display: none; width: 34px; height: 34px;
      background: #e8590c; color: #fff; box-shadow: 0 4px 14px rgba(0,0,0,.25);
    }
    .bubble:hover { background: #e8590c; filter: brightness(1.08); }
    .bubble.open { display: grid; }
  `;

  const ui = {
    host: null,
    bar: null,
    els: {},
    flashTimer: 0,

    build() {
      if (this.host) return;
      this.host = document.createElement("kokoro-reader");
      const root = this.host.attachShadow({ mode: "closed" });
      root.innerHTML = `<style>${CSS_TEXT}</style>
        <div class="bar" role="toolbar" aria-label="Read aloud">
          <div class="grip" title="Drag to move"></div>
          <button class="prev" title="Previous sentence">${icon("prev")}</button>
          <button class="play" title="Play / pause (Alt+Shift+R)">${icon("play")}</button>
          <button class="next" title="Next sentence">${icon("next")}</button>
          <button class="stop" title="Stop (Alt+Shift+X)">${icon("stop")}</button>
          <span class="sep"></span>
          <select class="speed" title="Speed">${SPEEDS.map((s) => `<option value="${s}">${s}×</option>`).join("")}</select>
          <select class="voice" title="Voice"></select>
          <button class="click" title="Click-to-read: click any paragraph to start reading there (Esc to leave)">${icon("click")}</button>
          <span class="status"></span>
          <button class="close small" title="Close">${icon("close")}</button>
        </div>
        <button class="bubble" title="Read selection aloud">${icon("speaker")}</button>`;
      const $ = (s) => root.querySelector(s);
      this.bar = $(".bar");
      this.els = { play: $(".play"), speed: $(".speed"), voice: $(".voice"), click: $(".click"), status: $(".status"), bubble: $(".bubble") };
      $(".prev").onclick = () => player.skip(-1);
      $(".next").onclick = () => player.skip(1);
      $(".stop").onclick = () => player.stop();
      this.els.play.onclick = () => player.toggle();
      this.els.click.onclick = () => setClickMode(!clickMode);
      $(".close").onclick = () => {
        player.stop();
        setClickMode(false);
        this.bar.classList.remove("open");
      };
      this.els.speed.onchange = () => chrome.storage.local.set({ speed: parseFloat(this.els.speed.value) });
      this.els.voice.onchange = () => {
        const id = this.els.voice.value;
        chrome.storage.local.set({ [VOICE_KEY[voiceLang(id)] || "voice"]: id });
      };
      const bubble = this.els.bubble;
      bubble.onmousedown = (e) => e.preventDefault(); // keep the selection
      bubble.onpointerenter = prewarmSelection;
      bubble.onclick = () => {
        bubble.classList.remove("open");
        readSelection();
      };
      this.makeDraggable($(".grip"));
      document.documentElement.appendChild(this.host);
      this.loadVoices();
      this.sync();
    },

    loadVoices() {
      chrome.runtime.sendMessage({ type: "health" }).then((res) => {
        if (res?.voices?.length) voices = res.voices;
        this.sync();
      }).catch(() => {});
    },

    makeDraggable(grip) {
      grip.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        grip.setPointerCapture(e.pointerId);
        const r = this.bar.getBoundingClientRect();
        const dx = e.clientX - r.left;
        const dy = e.clientY - r.top;
        const move = (ev) => {
          const left = Math.min(Math.max(0, ev.clientX - dx), innerWidth - r.width);
          const top = Math.min(Math.max(0, ev.clientY - dy), innerHeight - r.height);
          Object.assign(this.bar.style, { left: `${left}px`, top: `${top}px`, right: "auto", bottom: "auto" });
        };
        grip.addEventListener("pointermove", move);
        grip.addEventListener("pointerup", () => grip.removeEventListener("pointermove", move), { once: true });
      });
    },

    show() {
      this.build();
      this.bar.classList.add("open");
      this.sync();
    },

    flash(text) {
      this.show();
      this.els.status.textContent = text;
      clearTimeout(this.flashTimer);
      this.flashTimer = setTimeout(() => this.sync(), 3000);
    },

    sync() {
      if (!this.host) return;
      const { play, speed, voice, click, status } = this.els;
      const s = player.state;
      play.innerHTML = icon(s === "playing" || s === "loading" ? "pause" : "play");
      play.classList.toggle("loading", s === "loading");
      click.classList.toggle("on", clickMode);
      if (![...speed.options].some((o) => o.value === String(settings.speed))) {
        speed.add(new Option(`${settings.speed}×`, String(settings.speed)));
      }
      speed.value = String(settings.speed);
      if (voice.options.length !== voices.length) {
        voice.innerHTML = voiceOptions(voices);
      }
      const key = VOICE_KEY[player.state === "idle" ? pageLang() : player.lang];
      voice.value = settings[key] || settings.voice;
      if (!voice.value && voices.length > 1) voice.value = DEFAULTS[key]; // saved voice was removed
      status.classList.toggle("err", !!player.error);
      status.textContent =
        player.error ||
        (s === "loading" ? (player.stats?.waits && !player.voice().startsWith("piper:") ? "Rendering… (a light voice won't pause)" : "Rendering…") : s === "idle" && clickMode ? "Click a paragraph to start" : s === "idle" ? "" : `${player.i + 1} / ${player.segs.length}`);
    },
  };

  // Selection bubble: a small speaker button next to selected text.
  document.addEventListener("mouseup", (e) => {
    if (e.composedPath().includes(ui.host)) return;
    setTimeout(() => {
      const sel = getSelection();
      const text = sel.toString().trim();
      if (!ui.host && text.length < 2) return;
      ui.build();
      const b = ui.els.bubble;
      const inField = document.activeElement?.matches?.("input, textarea, [contenteditable]");
      if (text.length < 2 || inField || clickMode || !sel.rangeCount) return b.classList.remove("open");
      // Next to where the mouse let go, like NaturalReader.
      b.style.left = `${Math.min(e.clientX + 8, innerWidth - 44)}px`;
      b.style.top = `${Math.max(e.clientY - 44, 6)}px`;
      b.classList.add("open");
    }, 10);
  });
  document.addEventListener("selectionchange", () => {
    if (ui.host && getSelection().isCollapsed) ui.els.bubble.classList.remove("open");
  });
  addEventListener("scroll", () => ui.host && ui.els.bubble.classList.remove("open"), { passive: true });

  // ---------------------------------------------------------------- messages from popup / background

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    switch (msg.cmd) {
      case "readSelection":
        readSelection() || readPage();
        break;
      case "readFromHere":
        readFrom(contextTarget, ...(contextPoint || []));
        break;
      case "readPage":
        readPage();
        break;
      case "toggle":
        player.toggle();
        break;
      case "stop":
        player.stop();
        break;
      case "clickMode":
        setClickMode(!clickMode);
        break;
    }
    sendResponse({ state: player.state, clickMode, hasSelection: !getSelection().isCollapsed });
  });
})();
