#!/usr/bin/env bash
# Try the development version before it's released, without touching your installed add-on:
#   tools/try.sh            Firefox: a separate window with its own profile, add-on loaded from extension/
#   tools/try.sh chromium   Chromium: the same, with its own profile
#   tools/try.sh android    Firefox on an Android phone connected by USB (needs adb; see docs/MANUAL-TEST.md)
# The profile is kept between runs (voices stay downloaded). Code changes reload by themselves in Firefox.
# Close the window when done. TRY_PROFILE=<dir> picks another profile folder.
set -euo pipefail
root=$(cd "$(dirname "$0")/.." && pwd)
browser=${1:-firefox}
# Snap browsers can't see /tmp, so the profile lives in the snap's own folder when there is one.
base=$HOME/.cache/neural-voices; [ -d "$HOME/snap/$browser/common" ] && base=$HOME/snap/$browser/common
profile=${TRY_PROFILE:-$base/nv-try-profile}
mkdir -p "$profile"
echo "Opening $browser with the development add-on (profile: $profile)"

if [ "$browser" = android ]; then
  adb=$(command -v adb || echo "$HOME/.local/share/platform-tools/adb")
  [ -x "$adb" ] || { echo "adb not found: install it with  sudo apt install adb  (see docs/MANUAL-TEST.md)" >&2; exit 1; }
  device=$("$adb" devices | awk 'NR > 1 && $2 == "device" { print $1; exit }')
  [ -n "$device" ] || { echo "No phone found. Connect it by USB, allow USB debugging on the phone, and check: adb devices" >&2; exit 1; }
  echo "Installing the development add-on in Firefox on $device (keep Firefox open on the phone)"
  exec npx -y web-ext run --source-dir "$root/extension" --target firefox-android --adb-bin "$adb" \
    --android-device "$device" --firefox-apk org.mozilla.firefox "${@:2}"
fi

if [ "$browser" = firefox ]; then
  exec npx -y web-ext run --source-dir "$root/extension" --target firefox-desktop \
    --firefox-profile "$profile" --profile-create-if-missing --keep-profile-changes \
    --start-url "https://en.wikipedia.org/wiki/Lighthouse" "${@:2}"
else
  bin=$(command -v chromium || command -v chromium-browser || command -v google-chrome)
  exec "$bin" --user-data-dir="$profile" --load-extension="$root/extension" --no-first-run \
    "https://en.wikipedia.org/wiki/Lighthouse" "${@:2}"
fi
