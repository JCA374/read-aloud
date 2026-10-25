---
name: addon-tests
description: Decide which browser tests to run after changing the Neural Voices add-on, run them in headless Chromium/Firefox, and log the results so they're not repeated. Use before claiming a change works, and after any change to extension/.
---

# Browser tests for the add-on

Tests live in `tests/`; `tests/README.md` lists every test and how long it takes, `tests/RESULTS.md` has
the newest result of each.

1. **Run `tests/run.sh` in the background** (Bash `run_in_background`) and wait for the completion notice.
   Don't wait in the foreground for minutes and don't poll. It runs, in about 2–3 minutes:
   instant checks (syntax, manifest, Mozilla's checker), the Chromium and Firefox smoke tests side by side,
   and any longer test whose files changed since it last passed. It prints one line per test.
   - `tests/run.sh <test>` for one test, `tests/run.sh all` for every functional test (before a release).
   - If it says timing tests are due (engine, offscreen or background.js changed), run `tests/run.sh timing`
     in the background as a separate step. It takes 15–25 min and must run alone; don't start other browser
     tests meanwhile.
2. **A failing line**: read its log in `tests/out/`. Check the test before the add-on if a number looks
   too good or too bad (earlier slips: a CPU limit that didn't apply, part of Firefox's processes missed,
   page parts renamed, a check that looked for a *different* word after a restart on the same word).
   Re-run only the failing test by name.
3. **Don't edit `tests/*.sh` or a test while a run is going**: bash reads scripts as it runs them.
4. **Log** in `tests/RESULTS.md` (date, commit, test, result with numbers), newest first in its section, and
   commit it with the change. Never log a test as passed that didn't run.
5. A new behaviour needs a check: add it to the smoke test if it's quick, otherwise a new test with
   `check()`/`finish()` from `chromium/lib.mjs`, listed in `run.sh` (with the files it covers),
   `tests/README.md`, and a section in `RESULTS.md`.
6. Then update the project page (the `status-page` skill).

Machine quirks (snap paths, ports, killing processes safely) are in `CLAUDE.local.md`.
