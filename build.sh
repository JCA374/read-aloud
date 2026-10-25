#!/usr/bin/env bash
# Package the add-on:  ./build.sh  ->  dist/neural-voices-<version>-firefox.zip  (for addons.mozilla.org)
#                                     dist/neural-voices-<version>-chromium.zip
#                                     dist/firefox/  (the Firefox build unpacked: load it or sign it)
# Each holds extension/ (without READMEs and hidden files) plus LICENSE, THIRD-PARTY-NOTICES and licenses/.
# The Firefox build leaves out what only Chromium uses (the offscreen page, its permission and the service
# worker entry), so Firefox shows no manifest warnings. Files are added in a fixed order with fixed dates,
# so the same source gives the same zips. Then Mozilla's checker runs on the Firefox build.
set -euo pipefail
root=$(cd "$(dirname "$0")" && pwd)
version=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["version"])' "$root/extension/manifest.json")

stage=$(mktemp -d "${TMPDIR:-/tmp}/nv-build.XXXXXX")
trap 'rm -rf "$stage"' EXIT
(cd "$root/extension" && find . -type f ! -name '.*' ! -name 'README.md' -print0 | cpio -0pdm --quiet "$stage")
cp -r "$root/LICENSE" "$root/THIRD-PARTY-NOTICES" "$root/licenses" "$stage/"
find "$stage" -exec touch -h -d '2000-01-01T00:00:00Z' {} +

# Firefox: no offscreen page, no "offscreen" permission, no service worker entry
ff="$root/dist/firefox"
rm -rf "$ff" && cp -r "$stage" "$ff" && rm "$ff/offscreen.html" "$ff/offscreen.js"
python3 - "$ff/manifest.json" <<'PY'
import json, sys
p = sys.argv[1]; m = json.load(open(p))
m["permissions"].remove("offscreen")
del m["background"]["service_worker"]
open(p, "w").write(json.dumps(m, indent=2, ensure_ascii=False) + "\n")
PY
find "$ff" -exec touch -h -d '2000-01-01T00:00:00Z' {} +

mkdir -p "$root/dist" && rm -f "$root"/dist/neural-voices*.zip
for target in firefox chromium; do
  dir=$stage; [ $target = firefox ] && dir=$ff
  out="$root/dist/neural-voices-$version-$target.zip"
  (cd "$dir" && find . -type f | LC_ALL=C sort | zip -qX -9 "$out" -@)
  echo "$out ($(du -h "$out" | cut -f1), $(unzip -Z1 "$out" | wc -l) files)"
done

lint=$(npx -y web-ext lint --source-dir "$ff" --output json 2>/dev/null || true)
echo "$lint" | python3 -c '
import json, sys
d = json.load(sys.stdin)
print("web-ext lint (Firefox build):", len(d["errors"]), "errors,", len(d["warnings"]), "warnings")
for m in d["errors"] + d["warnings"]: print("  " + m["code"], m.get("file", ""))
sys.exit(1 if d["errors"] else 0)'
