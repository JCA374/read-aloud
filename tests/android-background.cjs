// Firefox for Android has no chrome.contextMenus and no chrome.commands. Load background.js with a stand-in
// `chrome` that lacks both, and check that it still gets to registering its message handler (speech,
// downloads). Exits 1 otherwise. Used by tests/run.sh (instant checks).
const fs = require("fs");
const missing = new Set(process.argv.slice(2).length ? process.argv.slice(2) : ["contextMenus", "commands", "offscreen"]);
const registered = [];
const fake = (path) => new Proxy(function () {}, {
  get: (_, key) => (key === "then" || typeof key === "symbol" ? undefined : path === "chrome" && missing.has(key) ? undefined : fake(`${path}.${key}`)),
  apply: () => { if (path.endsWith(".addListener")) registered.push(path); return Promise.resolve(); },
});
globalThis.chrome = fake("chrome");
globalThis.importScripts = () => {};
for (const f of ["catalog.js", "common.js", "background.js"]) {
  try { (0, eval)(fs.readFileSync(`extension/${f}`, "utf8").replace(/^var /m, "globalThis.")); }
  catch (e) { console.log(`${f} stopped: ${e.message}`); process.exit(1); }
}
if (!registered.includes("chrome.runtime.onMessage.addListener")) { console.log("no message handler registered"); process.exit(1); }
