#!/usr/bin/env bash
# Start the local TTS server (Piper + Kokoro) for the Read Aloud extension.
here=$(cd "$(dirname "$0")" && pwd)
py="$here/.venv/bin/python"
if [ ! -x "$py" ]; then
  echo "No Python environment found. Set one up with:" >&2
  echo "  python3 -m venv $here/.venv" >&2
  echo "  $here/.venv/bin/pip install torch --index-url https://download.pytorch.org/whl/cpu" >&2
  echo "  $here/.venv/bin/pip install kokoro piper-tts soundfile && $here/.venv/bin/python -m spacy download en_core_web_sm" >&2
  exit 1
fi
exec "$py" "$here/server/tts_server.py" "$@"
