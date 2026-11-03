#!/usr/bin/env bash
# Sign a new version on addons.mozilla.org with the owner's API keys:
#   tools/sign.sh            unlisted -> dist/neural-voices-<version>-signed.xpi
#   tools/sign.sh --listed   in the store: the listing texts go first (amo.py listing), then the version with
#                            its licence; waits up to 15 min for Mozilla, else download later with amo.py
#   tools/sign.sh --dry-run  checks and prints the metadata, uploads nothing
# Keys: .amo-keys at the top of the repo (ignored by git), with WEB_EXT_API_KEY (JWT issuer) and
# WEB_EXT_API_SECRET (JWT secret) from https://addons.mozilla.org/developers/addon/api/key/
# Steps: check keys and that the version is new, ./build.sh, source zip, web-ext sign with the reviewer
# notes (docs/reviewer-notes.txt) and release notes (the version's section in CHANGELOG.md).
set -euo pipefail
root=$(cd "$(dirname "$0")/.." && pwd)
cd "$root"
channel=unlisted; dry=""
for a in "$@"; do case $a in --listed) channel=listed ;; --dry-run) dry=1 ;; *) echo "unknown option $a" >&2; exit 1 ;; esac; done

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
[ "$(wc -c <docs/reviewer-notes.txt)" -le 3000 ] || { echo "docs/reviewer-notes.txt is over Mozilla's 3000 character limit." >&2; exit 1; }
grep -q "^## $version" CHANGELOG.md || { echo "CHANGELOG.md has no \"## $version\" section." >&2; exit 1; }
[ -z "$(git status --porcelain -- extension)" ] || { echo "extension/ has uncommitted changes: commit them first." >&2; exit 1; }

./build.sh
src="dist/neural-voices-$version-source.zip"
git archive -o "$src" HEAD
meta=$(mktemp "${TMPDIR:-/tmp}/nv-meta.XXXXXX.json")
trap 'rm -f "$meta"' EXIT
python3 - "$version" "$meta" "$channel" <<'PY'
import json, re, sys
version, out, channel = sys.argv[1:]
log = open("CHANGELOG.md").read()
notes = re.search(rf"^## {re.escape(version)}[^\n]*\n(.*?)(?=^## |\Z)", log, re.M | re.S).group(1).strip()
v = {"approval_notes": open("docs/reviewer-notes.txt").read(), "release_notes": {"en-US": notes}}
if channel == "listed":  # a listed version needs a licence; desktop Firefox only (no Android yet)
    v |= {"license": json.load(open("docs/listing/listing.json"))["license"], "compatibility": ["firefox"]}
json.dump({"version": v}, open(out, "w"))
PY
if [ -n "$dry" ]; then
  echo "Dry run ($channel). Version metadata:"; python3 -c 'import json,sys; d=json.load(open(sys.argv[1]))["version"]; d["approval_notes"]=d["approval_notes"][:80]+"…"; print(json.dumps(d, indent=1, ensure_ascii=False))' "$meta"
  [ $channel = listed ] && python3 tools/amo.py listing "$id" --dry-run | head -12
  exit 0
fi
[ $channel = listed ] && python3 tools/amo.py listing "$id"
timeout=3600000; [ $channel = listed ] && timeout=900000

before=$(ls dist/*.xpi 2>/dev/null || true)
npx -y web-ext sign --channel=$channel --source-dir dist/firefox --artifacts-dir dist \
  --amo-metadata "$meta" --upload-source-code "$src" --approval-timeout $timeout || {
  echo "web-ext sign stopped (see its message above). If it was uploaded but not signed in time (a human review), check: python3 tools/amo.py status $id; then: python3 tools/amo.py download $id $version" >&2
  exit 1; }
new=$(comm -13 <(echo "$before" | sort) <(ls dist/*.xpi | sort) | head -1)
[ -n "$new" ] || { echo "web-ext finished but no new .xpi appeared in dist/." >&2; exit 1; }
out="dist/neural-voices-$version-signed.xpi"
mv "$new" "$out"
echo "Signed: $out"
sha256sum "$out"
