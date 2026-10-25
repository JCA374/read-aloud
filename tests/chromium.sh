#!/usr/bin/env bash
# Run one Chromium test against the add-on:  tests/chromium.sh <test.mjs> [extension dir]
#
# Starts headless Chromium with the add-on loaded and remote debugging on port 9333, serves tests/site on
# port 8799, and runs the test script (node 22+). Options (environment):
#   KEEP=1     reuse the last browser profile, so voices are already downloaded. If background.js or
#              manifest.json changed since, the profile is started fresh anyway (old service worker).
#   PROFILE=x  use another profile folder (e.g. a throwaway one for tests that need no voices downloaded)
#   QUOTA=50%  limit the browser's CPU (simulates a slow computer)
#   EXTRA=...  one extra browser flag, e.g. '--host-resolver-rules=MAP huggingface.co ~NOTFOUND'
#   TIMEOUT=s  how long the test may run (default 200)
here=$(cd "$(dirname "$0")" && pwd)
test=$(realpath "$1"); ext=$(realpath "${2:-$here/../extension}")
profile=$HOME/snap/chromium/common/${PROFILE:-nv-test-profile}   # the Chromium snap can't see /tmp
log=$(mktemp)
mine() { for p in $(pgrep -f "common/${PROFILE:-nv-test-profile}"); do [ "$(ps -o comm= -p "$p")" != bash ] && echo "$p"; done; }
stop_browser() { for p in $(mine); do kill "$p" 2>/dev/null; done; sleep 2; }

# The server must not keep this script's output open, or "| tail" after the runner never finishes.
curl -s -o /dev/null http://127.0.0.1:8799/ || { (cd "$here/site" && exec python3 -m http.server 8799 </dev/null >/dev/null 2>&1) & }

stop_browser; [ -z "$KEEP" ] && rm -rf "$profile"
# A kept profile keeps running the old service worker after background.js changes: start fresh then.
print=$(cat "$ext/background.js" "$ext/manifest.json" | sha1sum | cut -c1-12)
if [ -d "$profile" ] && [ "$(cat "$profile/.nv-fingerprint" 2>/dev/null)" != "$print" ]; then
  echo "fresh profile: background.js or manifest.json changed"; rm -rf "$profile"
fi
mkdir -p "$profile"; echo "$print" >"$profile/.nv-fingerprint"
(chromium --headless=new --remote-debugging-port=9333 --user-data-dir="$profile" --no-first-run \
  --load-extension="$ext" --disable-extensions-except="$ext" --autoplay-policy=no-user-gesture-required \
  ${EXTRA:+"$EXTRA"} about:blank >"$log" 2>&1 &)
for _ in $(seq 50); do curl -s -o /dev/null http://127.0.0.1:9333/json/version && break; sleep 0.2; done
if [ -n "$QUOTA" ]; then
  # The snap moves Chromium into its own scope, so limit that scope.
  scope=$(sed -n 's|.*/||p' "/proc/$(mine | head -1)/cgroup" | head -1)
  systemctl --user set-property --runtime "$scope" CPUQuota="$QUOTA" && echo "limited $scope to $QUOTA"
fi
timeout "${TIMEOUT:-200}" node "$test"
status=$?
stop_browser
exit $status
