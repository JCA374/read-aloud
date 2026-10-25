#!/usr/bin/env bash
# Package the add-on for signing on addons.mozilla.org (the same zip loads in Chromium):
#   ./build.sh  ->  dist/neural-voices-<version>.zip
# The zip holds extension/ (without READMEs and hidden files) plus LICENSE, THIRD-PARTY-NOTICES and
# licenses/. Files are added in a fixed order with fixed dates, so the same source gives the same zip.
# Then Mozilla's checker runs on the result.
set -euo pipefail
root=$(cd "$(dirname "$0")" && pwd)
version=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["version"])' "$root/extension/manifest.json")
out="$root/dist/neural-voices-$version.zip"

stage=$(mktemp -d "${TMPDIR:-/tmp}/nv-build.XXXXXX")
trap 'rm -rf "$stage"' EXIT
(cd "$root/extension" && find . -type f ! -name '.*' ! -name 'README.md' -print0 | cpio -0pdm --quiet "$stage")
cp -r "$root/LICENSE" "$root/THIRD-PARTY-NOTICES" "$root/licenses" "$stage/"
find "$stage" -exec touch -h -d '2000-01-01T00:00:00Z' {} +

mkdir -p "$root/dist" && rm -f "$out"
(cd "$stage" && find . -type f | LC_ALL=C sort | zip -qX -9 "$out" -@)
echo "$out ($(du -h "$out" | cut -f1), $(unzip -Z1 "$out" | wc -l) files)"

lint=$(npx -y web-ext lint --source-dir "$stage" --output json 2>/dev/null || true)
echo "$lint" | python3 -c '
import json, sys
d = json.load(sys.stdin)
print("web-ext lint:", len(d["errors"]), "errors,", len(d["warnings"]), "warnings")
for m in d["errors"]: print("  error:", m["code"], m.get("file", ""))
sys.exit(1 if d["errors"] else 0)'
