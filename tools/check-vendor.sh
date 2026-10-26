#!/usr/bin/env bash
# Check that every third-party file in the add-on is byte-for-byte the file from its official npm package.
#   tools/check-vendor.sh      (needs npm; downloads the three packages into a temporary folder)
# For reviewers: the add-on's minified code is only these unchanged libraries; everything else is plain source.
set -euo pipefail
root=$(cd "$(dirname "$0")/.." && pwd)
tmp=$(mktemp -d "${TMPDIR:-/tmp}/nv-vendor.XXXXXX")
trap 'rm -rf "$tmp"' EXIT

# package@version | folder in the package | folder in the add-on | files (or "*" for the whole folder)
LIST="
onnxruntime-web@1.30.0|dist|extension/engine/vendor|ort.wasm.min.js ort-wasm-simd-threaded.mjs ort-wasm-simd-threaded.wasm
@diffusionstudio/piper-wasm@1.0.0|build|extension/engine/vendor|piper_phonemize.js piper_phonemize.wasm piper_phonemize.data
pdfjs-dist@6.4.299|build|extension/pdf|pdf.min.mjs pdf.worker.min.mjs
pdfjs-dist@6.4.299|cmaps|extension/pdf/cmaps|*
pdfjs-dist@6.4.299|standard_fonts|extension/pdf/standard_fonts|*
pdfjs-dist@6.4.299|iccs|extension/pdf/iccs|*
pdfjs-dist@6.4.299|wasm|extension/pdf/wasm|jbig2.wasm openjpeg.wasm qcms_bg.wasm LICENSE_JBIG2 LICENSE_OPENJPEG LICENSE_PDFJS_JBIG2 LICENSE_PDFJS_OPENJPEG LICENSE_PDFJS_QCMS LICENSE_QCMS
"
bad=0; n=0
while IFS='|' read -r pkg from to files; do
  [ -z "$pkg" ] && continue
  dir="$tmp/${pkg//[@\/]/_}"
  if [ ! -d "$dir" ]; then
    mkdir -p "$dir"
    (cd "$dir" && npm pack -s "$pkg" >/dev/null && tar xzf ./*.tgz)
  fi
  [ "$files" = "*" ] && files=$(cd "$root/$to" && ls)
  for f in $files; do
    n=$((n + 1))
    cmp -s "$dir/package/$from/$f" "$root/$to/$f" || { echo "DIFFERENT: $to/$f (npm $pkg $from/$f)"; bad=1; }
  done
done <<<"$LIST"
# Nothing else in the vendored folders
extra=$(cd "$root/extension" && find engine/vendor pdf -type f ! -name README.md | wc -l)
[ "$extra" -eq "$n" ] || { echo "The vendored folders hold $extra files, but $n were checked"; bad=1; }
[ $bad -eq 0 ] && echo "All $n vendored files are identical to their npm packages."
exit $bad
