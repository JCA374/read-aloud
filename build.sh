#!/usr/bin/env bash
# Package the extension for signing on addons.mozilla.org -> dist/read-aloud-kokoro.zip
cd "$(dirname "$0")/extension" && mkdir -p ../dist && rm -f ../dist/read-aloud-kokoro.zip
zip -qr ../dist/read-aloud-kokoro.zip . -x '.*' && echo "dist/read-aloud-kokoro.zip"
