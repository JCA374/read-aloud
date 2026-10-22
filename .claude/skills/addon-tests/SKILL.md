---
name: addon-tests
description: Decide which browser tests to run after changing the Neural Voices add-on, run them in headless Chromium/Firefox, and log the results so they're not repeated. Use before claiming a change works, and after any change to extension/.
---

# Browser tests for the add-on

Tests live in `tests/`. `tests/README.md` lists every
test, its options and how long it takes; `tests/RESULTS.md` has the newest result of each.

1. **Don't repeat tests needlessly.** For each section of `tests/RESULTS.md`, compare its "re-run when"
   files with the commit of the last run: `git diff --stat <commit> -- <files>`. Only run tests whose
   files changed, or that cover the change you just made. Say which tests you skipped and why.
2. **Run** with the runners (they handle the profiles and the test pages on port 8799):
   `tests/chromium.sh tests/chromium/<test>.mjs` and `tests/firefox.sh tests/firefox/<test>.mjs`.
   - `KEEP=1` saves re-downloading voices, but after a `background.js` change use a fresh profile:
     a kept Chromium profile keeps running the old service worker.
   - Long tests (`memory.mjs`): run in the background and wait for the completion notice.
   - Machine quirks (snap paths, ports, killing processes safely) are in `CLAUDE.local.md`.
3. **Read numbers critically.** Earlier runs were misleading when a CPU limit didn't apply, when only part
   of Firefox's process tree was counted, and when a test looked for page parts that had been renamed.
   If a number looks too good or too bad, check the test before the add-on.
4. **Log** every run in `tests/RESULTS.md` (date, commit, test, result with numbers), newest first in its
   section, and commit it with the change. Never log a test as passed that didn't run.
5. A new behaviour needs a test: add a script next to the others, list it in `tests/README.md`, and give
   it a "re-run when" section in `RESULTS.md`.
6. Then update the project page (the `status-page` skill).
