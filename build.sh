#!/usr/bin/env bash
# Package the extension for signing on addons.mozilla.org -> dist/neural-voices.zip
cd "$(dirname "$0")/extension" && mkdir -p ../dist && rm -f ../dist/neural-voices.zip
zip -qr ../dist/neural-voices.zip . -x '.*' '*/README.md' && echo "dist/neural-voices.zip"
