#!/usr/bin/env bash
# Pick and run the add-on's tests.   tests/run.sh [quick|all|timing|<test>...]
#
#   quick (default)  instant checks, then the Chromium and Firefox smoke tests side by side, plus any
#                    longer test whose files changed since it last passed. Tests whose files (and own
#                    script) haven't changed since they passed are skipped. About 1.5 min, 5 s if nothing changed.
#   all              instant checks and every functional test (both browsers side by side)
#   timing           start-up, CPU and memory measurements, one at a time (15-25 min: run in the background)
#   <test>           one or more tests by name, e.g. chromium/voice-management
#
# Prints one line per test; the full output is in tests/out/<browser>-<test>.log.
# A test that passed is remembered (tests/out/.passed/) together with a fingerprint of the files it covers.
# Exit status 1 if anything failed or timed out.
cd "$(dirname "$0")/.." || exit 1
out=tests/out; mkdir -p "$out/.passed"

# name | settings (separated by ;) | files it covers (git pathspecs) | time limit (s)
TESTS="
chromium/smoke|KEEP=1|extension|150
firefox/smoke||extension|150
chromium/voice-management|PROFILE=nv-fresh-profile|extension/options.* extension/catalog.js extension/common.js extension/engine/piper-worker.js|240
chromium/download-failure|PROFILE=nv-fresh-profile;EXTRA=--host-resolver-rules=MAP huggingface.co ~NOTFOUND|extension/engine extension/background.js extension/offscreen.*|150
chromium/settings-voice-switch|KEEP=1|extension|150
chromium/settings-extras|KEEP=1|extension/options.* extension/common.js extension/content.js extension/background.js tests/site/code.html|200
chromium/pdf|KEEP=1|extension/pdf* extension/content.js extension/common.js extension/background.js tests/site/doc.pdf|150
chromium/older-revision|KEEP=1;EXTRA=--host-resolver-rules=MAP huggingface.co ~NOTFOUND|extension/engine/piper-worker.js extension/options.js|150
chromium/mixed-and-controls|KEEP=1|extension|200
chromium/warm-up|KEEP=1|extension/engine extension/offscreen.* extension/background.js|150
chromium/long-page-cpu|KEEP=1|extension/engine extension/offscreen.* extension/background.js extension/content.js|200
chromium/memory|KEEP=1;TIMEOUT=1000|extension/engine extension/offscreen.* extension/background.js|1060
firefox/memory|TIMEOUT=700|extension/engine extension/offscreen.* extension/background.js|760
"
QUICK="chromium/smoke firefox/smoke"
AFFECTED="chromium/voice-management chromium/download-failure chromium/older-revision chromium/settings-extras chromium/pdf"   # added to quick when their files changed
ALL="chromium/smoke firefox/smoke $AFFECTED chromium/settings-voice-switch chromium/mixed-and-controls"
TIMING="chromium/warm-up chromium/long-page-cpu chromium/memory firefox/memory"

field() { echo "$TESTS" | awk -F'|' -v n="$1" -v f="$2" '$1 == n { print $f }'; }
fingerprint() { # content of the covered files plus the test itself, its helpers and runner, committed or not
  local b=${1%%/*}
  # shellcheck disable=SC2046
  git ls-files -co --exclude-standard -- $(field "$1" 3) "tests/$1.mjs" "tests/$b/lib.mjs" "tests/$b.sh" | sort | xargs cat 2>/dev/null | sha1sum | cut -c1-12
}
changed() { [ "$(cat "$out/.passed/${1//\//-}" 2>/dev/null)" != "$(fingerprint "$1")" ]; }

run_one() { # run one test, print one line
  local name=$1 log="$out/${1//\//-}.log" browser=${1%%/*} start=$SECONDS status settings
  [ -z "$(field "$name" 1)" ] && { echo "?    $name: unknown test"; return 1; }
  IFS=';' read -ra settings <<<"$(field "$name" 2)"
  (for a in "${settings[@]}"; do export "${a?}"; done
   exec timeout "$(field "$name" 4)" "tests/$browser.sh" "tests/$name.mjs") </dev/null >"$log" 2>&1
  status=$?
  local secs=$((SECONDS - start)) oks fails
  oks=$(grep -c '^ok ' "$log"); fails=$(grep '^FAIL' "$log" | head -2 | cut -c6- | paste -sd';')
  if [ $status -eq 124 ]; then echo "TIME $name: stopped after ${secs} s (limit)"; return 1
  elif [ $status -ne 0 ]; then echo "FAIL $name (${secs} s): ${fails:-exit $status, see $log}"; return 1
  elif grep -q '^RESULT: pass' "$log"; then echo "ok   $name (${secs} s): $oks checks"
  else echo "done $name (${secs} s): no automatic checks, read $log"
  fi
  fingerprint "$name" >"$out/.passed/${1//\//-}"
}

run_queue() { local failed=0; for t in "$@"; do run_one "$t" || failed=1; done; return $failed; }

instant_checks() {
  local bad=0 s=$SECONDS
  for f in extension/*.js extension/engine/*.js tests/*/*.mjs tools/*.mjs; do node --check "$f" 2>/dev/null || { echo "FAIL syntax error in $f"; bad=1; }; done
  bash -n build.sh tests/*.sh || { echo "FAIL syntax error in a shell script"; bad=1; }
  python3 -m json.tool extension/manifest.json >/dev/null || { echo "FAIL extension/manifest.json is not valid JSON"; bad=1; }
  # Licences: the files the build adds exist, and every voice has a known licence kind
  for f in LICENSE THIRD-PARTY-NOTICES licenses/onnxruntime-LICENSE.txt licenses/piper-phonemize-LICENSE.txt licenses/pdfjs-LICENSE.txt; do
    [ -s "$f" ] || { echo "FAIL licence file missing: $f"; bad=1; }
  done
  node -e 'eval(require("fs").readFileSync("extension/catalog.js", "utf8").replace(/^var /m, "globalThis."));
    const bad = NV_CATALOG.voices.filter((v) => !["free", "share-alike", "non-commercial", "unclear"].includes(v.kind) || !v.licence);
    eval(require("fs").readFileSync("extension/common.js", "utf8").replace(/^var /m, "globalThis."));
    const notFree = NV_CATALOG.voices.filter((v) => NV.DEFAULTS.shown.includes(v.id) && !["free", "share-alike"].includes(v.kind));
    if (bad.length || notFree.length) { console.log(bad.concat(notFree).map((v) => v.id).join(" ")); process.exit(1); }' ||
    { echo "FAIL voices without a known licence kind, or a starter voice that is not free to use"; bad=1; }
  # Mozilla's checker: no errors, and no warnings beyond the known ones (Chromium-only parts, ONNX Runtime, pdf.js)
  local lint; lint=$(npx -y web-ext lint --source-dir extension --output json 2>/dev/null)
  local summary; summary=$(echo "$lint" | python3 -c '
import json, sys
d = json.load(sys.stdin)
known = {"MANIFEST_PERMISSIONS", "BACKGROUND_SERVICE_WORKER_IGNORED", "UNSUPPORTED_API"}
new = [w for w in d["warnings"] if w["code"] not in known and not w.get("file", "").startswith(("engine/vendor/", "pdf/"))]
print(len(d["errors"]), len(new), "; ".join(m["code"] + " " + m.get("file", "") for m in d["errors"] + new)[:200])' 2>&1)
  read -r errs news rest <<<"$summary"
  if [ "$errs" = 0 ] && [ "$news" = 0 ]; then echo "ok   instant checks ($((SECONDS - s)) s): syntax, manifest, licences, Mozilla's checker"
  else echo "FAIL Mozilla's checker: $summary"; bad=1; fi
  return $bad
}

# Which tests to run
mode=${1:-quick}
case $mode in
  quick) list=""; for t in $QUICK $AFFECTED; do
           if changed "$t"; then list="$list $t"; else echo "skip $t: nothing it covers changed since it passed"; fi
         done ;;
  all) list="$ALL" ;;
  timing) list="$TIMING" ;;
  *) list="$*" ;;
esac

curl -s -o /dev/null http://127.0.0.1:8799/ || { (cd tests/site && exec python3 -m http.server 8799 </dev/null >/dev/null 2>&1) & }
failed=0
[ "$mode" != timing ] && { instant_checks || failed=1; }
cq=$(for t in $list; do [[ $t == chromium/* ]] && echo "$t"; done)
fq=$(for t in $list; do [[ $t == firefox/* ]] && echo "$t"; done)
if [ "$mode" = timing ]; then
  run_queue $list || failed=1   # one at a time: parallel runs would spoil the numbers
else
  # shellcheck disable=SC2086
  run_queue $cq & c=$!; run_queue $fq & f=$!
  wait $c || failed=1; wait $f || failed=1
fi
if [ "$mode" = quick ]; then
  due=$(for t in $TIMING; do changed "$t" && echo "$t"; done | paste -sd' ')
  [ -n "$due" ] && echo "note: timing tests due, their files changed since they last ran ($due): tests/run.sh timing"
fi
exit $failed
