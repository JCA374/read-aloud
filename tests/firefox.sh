#!/usr/bin/env bash
# Run one Firefox test against the add-on:  tests/firefox.sh <test.mjs> [extension dir]
#
# Starts headless Firefox with WebDriver BiDi on port 9334 (the test installs the add-on itself and
# opens its pages at moz-extension://11111111-2222-3333-4444-555555555555/), serves tests/site on 8799.
# Options: FRESH=1 starts from an empty profile (voices download again); TIMEOUT=s (default 200).
# Firefox caches the add-on's file list in the profile; it's cleared on every run.
here=$(cd "$(dirname "$0")" && pwd)
test=$(realpath "$1"); ext=$(realpath "${2:-$here/../extension}")
profile=$HOME/snap/firefox/common/nv-profile   # the Firefox snap can't see /tmp
mine() { for p in $(pgrep -f "nv-profile"); do [ "$(ps -o comm= -p "$p")" != bash ] && echo "$p"; done; }
stop_browser() { for p in $(mine); do kill "$p" 2>/dev/null; done; sleep 2; }

curl -s -o /dev/null http://127.0.0.1:8799/ || (cd "$here/site" && python3 -m http.server 8799 >/dev/null 2>&1 &)
stop_browser
[ -n "$FRESH" ] && rm -rf "$profile"
mkdir -p "$profile"; rm -rf "$profile/startupCache" "$profile/addonStartup.json.lz4"
cat >"$profile/user.js" <<'PREFS'
user_pref("extensions.webextensions.uuids", "{\"neural-voices@jca374.github.io\":\"11111111-2222-3333-4444-555555555555\"}");
user_pref("media.autoplay.default", 0);
user_pref("media.autoplay.blocking_policy", 0);
user_pref("browser.shell.checkDefaultBrowser", false);
PREFS
(firefox --headless --no-remote --profile "$profile" --remote-debugging-port 9334 --remote-allow-system-access >/dev/null 2>&1 &)
timeout "${TIMEOUT:-200}" node "$test" "$ext"
status=$?
stop_browser
exit $status
