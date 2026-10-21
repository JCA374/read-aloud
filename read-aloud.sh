#!/usr/bin/env bash
# Desktop icon: install the signed Firefox add-on (first time) and warm up the voices.
here=$(cd "$(dirname "$0")" && pwd)
icon="$here/extension/icons/icon128.png"
xpi=$(ls -t "$here"/dist/*.xpi 2>/dev/null | head -1)
marker="$here/dist/.installed"
if [ -n "$xpi" ] && [ "$xpi" -nt "$marker" ]; then
  firefox "$xpi" &
  touch "$marker"
  notify-send -i "$icon" "Read Aloud" "Firefox will ask you to add the extension. Click Add."
fi
# Wake the server (systemd starts it on demand); it loads the last voice you used.
health() { curl -s --max-time 5 127.0.0.1:5123/health; }
if ! health | grep -q '"ok"'; then
  notify-send -u critical -i "$icon" "Read Aloud" "The voice server didn't start. Check: journalctl --user -u read-aloud-tts"
  exit 1
fi
if health | grep -q '"loading": true'; then
  notify-send -i "$icon" "Read Aloud" "Loading your voice…"
  for _ in $(seq 300); do sleep 2; health | grep -q '"loading": false' && break; done
fi
notify-send -i "$icon" "Read Aloud" "Voices are ready. Select text on any page and click the speaker."
