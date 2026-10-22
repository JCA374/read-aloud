#!/usr/bin/env bash
# Run one Chromium test against the add-on:  tests/chromium.sh <test.mjs> [extension dir]
#
# Starts headless Chromium with the add-on loaded and remote debugging on port 9333, serves tests/site on
# port 8799, and runs the test script (node 22+). Options (environment):
#   KEEP=1     reuse the last browser profile, so voices are already downloaded.
#              Don't use it after changing background.js: the old service worker keeps running.
#   QUOTA=50%  limit the browser's CPU (simulates a slow computer)
#   EXTRA=...  one extra browser flag, e.g. '--host-resolver-rules=MAP huggingface.co ~NOTFOUND'
#   TIMEOUT=s  how long the test may run (default 200)
# If the optional Kokoro server's systemd socket is active, it's paused so the test proves the add-on
# works without it.
here=$(cd "$(dirname "$0")" && pwd)
test=$(realpath "$1"); ext=$(realpath "${2:-$here/../extension}")
profile=$HOME/snap/chromium/common/nv-test-profile   # the Chromium snap can't see /tmp
log=$(mktemp)
mine() { for p in $(pgrep -f "nv-test-profile"); do [ "$(ps -o comm= -p "$p")" != bash ] && echo "$p"; done; }
stop_browser() { for p in $(mine); do kill "$p" 2>/dev/null; done; sleep 2; }

curl -s -o /dev/null http://127.0.0.1:8799/ || (cd "$here/site" && python3 -m http.server 8799 >/dev/null 2>&1 &)
server=$(systemctl --user is-active read-aloud-tts.socket 2>/dev/null)
[ "$server" = active ] && systemctl --user stop read-aloud-tts.socket read-aloud-tts.service

stop_browser; [ -z "$KEEP" ] && rm -rf "$profile"
(chromium --headless=new --remote-debugging-port=9333 --user-data-dir="$profile" --no-first-run \
  --load-extension="$ext" --disable-extensions-except="$ext" --autoplay-policy=no-user-gesture-required \
  ${EXTRA:+"$EXTRA"} about:blank >"$log" 2>&1 &)
sleep 5
if [ -n "$QUOTA" ]; then
  # The snap moves Chromium into its own scope, so limit that scope.
  scope=$(sed -n 's|.*/||p' "/proc/$(mine | head -1)/cgroup" | head -1)
  systemctl --user set-property --runtime "$scope" CPUQuota="$QUOTA" && echo "limited $scope to $QUOTA"
fi
timeout "${TIMEOUT:-200}" node "$test"
status=$?
stop_browser
[ "$server" = active ] && systemctl --user start read-aloud-tts.socket
exit $status
