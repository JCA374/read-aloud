#!/usr/bin/env bash
# Sign a new version on addons.mozilla.org (unlisted) with the owner's API keys:
#   tools/sign.sh            -> dist/neural-voices-<version>-signed.xpi
# Keys: .amo-keys at the top of the repo (ignored by git), with WEB_EXT_API_KEY (JWT issuer) and
# WEB_EXT_API_SECRET (JWT secret) from https://addons.mozilla.org/developers/addon/api/key/
# Steps: check keys and that the version is new, ./build.sh, source zip, web-ext sign with the reviewer
# notes (docs/reviewer-notes.txt) and release notes (the version's section in CHANGELOG.md).
set -euo pipefail
root=$(cd "$(dirname "$0")/.." && pwd)
cd "$root"

[ -f .amo-keys ] || { echo "No .amo-keys file. See docs/RELEASING.md (API keys)." >&2; exit 1; }
set -a; . ./.amo-keys; set +a
[ -n "${WEB_EXT_API_KEY:-}" ] && [ -n "${WEB_EXT_API_SECRET:-}" ] || { echo ".amo-keys: WEB_EXT_API_KEY or WEB_EXT_API_SECRET is empty." >&2; exit 1; }

version=$(python3 -c 'import json; print(json.load(open("extension/manifest.json"))["version"])')
id=$(python3 -c 'import json; print(json.load(open("extension/manifest.json"))["browser_specific_settings"]["gecko"]["id"])')

# Mozilla's newest version (any channel). Also proves the keys work.
latest=$(python3 tools/amo.py latest "$id")
echo "addons.mozilla.org has $latest; this is $version"
if [ "$(printf '%s\n%s\n' "$latest" "$version" | sort -V | tail -1)" = "$latest" ]; then
  echo "Version must be higher than $latest: raise \"version\" in extension/manifest.json." >&2
  exit 1
fi
grep -q "^## $version" CHANGELOG.md || { echo "CHANGELOG.md has no \"## $version\" section." >&2; exit 1; }
[ -z "$(git status --porcelain -- extension)" ] || { echo "extension/ has uncommitted changes: commit them first." >&2; exit 1; }

./build.sh
src="dist/neural-voices-$version-source.zip"
git archive -o "$src" HEAD
meta=$(mktemp "${TMPDIR:-/tmp}/nv-meta.XXXXXX.json")
trap 'rm -f "$meta"' EXIT
python3 - "$version" "$meta" <<'PY'
import json, re, sys
version, out = sys.argv[1:]
log = open("CHANGELOG.md").read()
notes = re.search(rf"^## {re.escape(version)}[^\n]*\n(.*?)(?=^## |\Z)", log, re.M | re.S).group(1).strip()
json.dump({"version": {"approval_notes": open("docs/reviewer-notes.txt").read(),
                       "release_notes": {"en-US": notes}}}, open(out, "w"))
PY

before=$(ls dist/*.xpi 2>/dev/null || true)
npx -y web-ext sign --channel=unlisted --source-dir dist/firefox --artifacts-dir dist \
  --amo-metadata "$meta" --upload-source-code "$src" --approval-timeout 3600000
new=$(comm -13 <(echo "$before" | sort) <(ls dist/*.xpi | sort) | head -1)
[ -n "$new" ] || { echo "web-ext finished but no new .xpi appeared in dist/." >&2; exit 1; }
out="dist/neural-voices-$version-signed.xpi"
mv "$new" "$out"
echo "Signed: $out"
sha256sum "$out"
