"""Local TTS server for the Read Aloud extension, with two engines:

  Kokoro  natural voices, ~1 GB RAM, ~40 s to load, slow on a busy CPU
  Piper   lighter voices, ~100 MB RAM, ~1 s to load, many times faster

Each engine loads the first time one of its voices is used, so if you only use
Piper voices, Kokoro never loads. Piper voices download on first use (~60 MB each).

Listens on 127.0.0.1 only. The extension's background script calls it:

  GET  /health   -> {"ok": true, "loading": bool, "voices": [{id, label, engine}, ...]}
  POST /tts      {"text", "voice", "speed"} -> {"audio": <base64 wav>, "words": [[text, start, end], ...], "duration"}

No CORS headers are sent on purpose: web pages can't call this server, only
the extension (which has a host permission for it).
"""

import argparse
import base64
import io
import json
import os
import re
import socket
import threading
import time
import urllib.request
import warnings
from collections import OrderedDict
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import numpy as np
import soundfile as sf

warnings.filterwarnings("ignore")

MAX_TEXT = 2000
CACHE_SIZE = 300
DATA_DIR = Path(os.environ.get("XDG_DATA_HOME", Path.home() / ".local/share")) / "read-aloud"
STATE_FILE = DATA_DIR / "last_voice"
PIPER_URL = "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/{region}/{name}/{quality}/{id}.onnx"

# Kokoro: the first letter of the id sets the accent (a = US, b = UK).
KOKORO_VOICES = OrderedDict([
    ("af_heart", "Heart (US, female)"),
    ("af_bella", "Bella (US, female)"),
    ("af_nicole", "Nicole (US, female, soft)"),
    ("af_sarah", "Sarah (US, female)"),
    ("am_michael", "Michael (US, male)"),
    ("am_fenrir", "Fenrir (US, male)"),
    ("am_puck", "Puck (US, male)"),
    ("bf_emma", "Emma (UK, female)"),
    ("bf_isabella", "Isabella (UK, female)"),
    ("bm_george", "George (UK, male)"),
    ("bm_fable", "Fable (UK, male)"),
    ("bm_lewis", "Lewis (UK, male)"),
])
PIPER_VOICES = OrderedDict([
    ("piper:en_US-lessac-medium", "Lessac (US, female)"),
    ("piper:en_US-amy-medium", "Amy (US, female)"),
    ("piper:en_US-hfc_female-medium", "HFC (US, female)"),
    ("piper:en_US-ryan-medium", "Ryan (US, male)"),
    ("piper:en_US-joe-medium", "Joe (US, male)"),
    ("piper:en_US-hfc_male-medium", "HFC (US, male)"),
    ("piper:en_GB-cori-medium", "Cori (UK, female)"),
    ("piper:en_GB-alba-medium", "Alba (Scottish, female)"),
    ("piper:en_GB-northern_english_male-medium", "Northern English (UK, male)"),
])
VOICES = [{"id": k, "label": v, "engine": "kokoro"} for k, v in KOKORO_VOICES.items()] + [
    {"id": k, "label": v, "engine": "piper"} for k, v in PIPER_VOICES.items()
]
VOICE_IDS = {v["id"] for v in VOICES}

_lock = threading.Lock()  # one synthesis (or model load) at a time: they share the CPU
_loading = threading.Event()  # set while an engine or voice is loading
_warm = threading.Event()  # set once the startup warm-up is done
_cache = OrderedDict()
_cache_lock = threading.Lock()
_last_request = time.time()


# ---------------------------------------------------------------- Kokoro

_kokoro = {}  # lang code -> KPipeline


def kokoro(text, voice, speed):
    from kokoro import KPipeline

    lang = voice[0]
    if lang not in _kokoro:
        _loading.set()
        try:
            model = next(iter(_kokoro.values())).model if _kokoro else True
            _kokoro[lang] = KPipeline(lang_code=lang, repo_id="hexgrad/Kokoro-82M", model=model)
        finally:
            _loading.clear()
    sr = 24000
    chunks, words, offset = [], [], 0.0
    for result in _kokoro[lang](text, voice=voice, speed=speed):
        if result.audio is None:
            continue
        audio = result.audio.numpy()
        for tok in result.tokens or []:
            if tok.start_ts is not None and tok.end_ts is not None and tok.text.strip():
                words.append([tok.text, round(offset + tok.start_ts, 3), round(offset + tok.end_ts, 3)])
        chunks.append(audio)
        offset += len(audio) / sr
    return chunks, sr, words


# ---------------------------------------------------------------- Piper

_piper = {}  # voice id -> PiperVoice


def piper_model(voice_id):
    name = voice_id.split(":", 1)[1]
    path = DATA_DIR / "piper" / f"{name}.onnx"
    if not path.exists():
        region, speaker, quality = name.split("-")
        url = PIPER_URL.format(region=region, name=speaker, quality=quality, id=name)
        path.parent.mkdir(parents=True, exist_ok=True)
        for src, dst in [(url + ".json", Path(str(path) + ".json")), (url, path)]:
            print(f"Downloading {src}", flush=True)
            tmp = dst.with_suffix(dst.suffix + ".part")
            urllib.request.urlretrieve(src, tmp)
            tmp.rename(dst)
    return path


def estimate_words(text, duration):
    """Piper gives no word timings: spread the words over the audio by length, with pauses at punctuation."""
    lead, tail = 0.08, 0.2
    spans = []  # (word, weight, pause after)
    matches = list(re.finditer(r"\w[\w'’-]*", text))
    for k, m in enumerate(matches):
        gap = text[m.end(): matches[k + 1].start() if k + 1 < len(matches) else len(text)]
        pause = 6 if re.search(r"[.!?;:]", gap) else 3 if re.search(r"[,—–()]", gap) else 0
        spans.append((m.group(), len(m.group()) + 1, pause))
    total = sum(w + p for _, w, p in spans)
    if not total:
        return []
    unit = max(duration - lead - tail, 0.1) / total
    words, t = [], lead
    for word, weight, pause in spans:
        words.append([word, round(t, 3), round(t + weight * unit, 3)])
        t += (weight + pause) * unit
    return words


def piper(text, voice, speed):
    from piper import PiperVoice, SynthesisConfig

    if voice not in _piper:
        _loading.set()
        try:
            _piper[voice] = PiperVoice.load(str(piper_model(voice)))
        finally:
            _loading.clear()
    chunks, sr = [], 22050
    for chunk in _piper[voice].synthesize(text, syn_config=SynthesisConfig(length_scale=1 / speed)):
        chunks.append(chunk.audio_float_array)
        sr = chunk.sample_rate
    duration = sum(len(c) for c in chunks) / sr
    return chunks, sr, estimate_words(text, duration)


# ---------------------------------------------------------------- rendering

def render(text, voice, speed):
    key = (text, voice, round(speed, 2))
    with _cache_lock:
        if key in _cache:
            _cache.move_to_end(key)
            return _cache[key]
    with _lock:
        engine = piper if voice.startswith("piper:") else kokoro
        chunks, sr, words = engine(text, voice, speed)
    audio = np.concatenate(chunks) if chunks else np.zeros(int(0.2 * sr), dtype=np.float32)
    buf = io.BytesIO()
    sf.write(buf, audio, sr, format="WAV", subtype="PCM_16")
    result = {
        "audio": base64.b64encode(buf.getvalue()).decode("ascii"),
        "words": words,
        "duration": round(len(audio) / sr, 3),
    }
    with _cache_lock:
        _cache[key] = result
        while len(_cache) > CACHE_SIZE:
            _cache.popitem(last=False)
    return result


def remember_voice(voice):
    try:
        if not STATE_FILE.exists() or STATE_FILE.read_text().strip() != voice:
            STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
            STATE_FILE.write_text(voice)
    except OSError:
        pass


def warm_up():
    """Load the engine of the last voice used, so the first sentence comes quickly."""
    try:
        voice = STATE_FILE.read_text().strip()
    except OSError:
        voice = ""
    if voice in VOICE_IDS:
        t = time.time()
        _loading.set()
        try:
            render("Ready.", voice, 1.0)
            print(f"Loaded {voice} in {time.time() - t:.0f}s.", flush=True)
        except Exception as e:
            print(f"Warm-up failed: {e}", flush=True)
    _loading.clear()
    _warm.set()


class Handler(BaseHTTPRequestHandler):
    def _send(self, status, payload):
        body = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/health":
            loading = _loading.is_set() or not _warm.is_set()
            self._send(200, {"ok": True, "loading": loading, "voices": VOICES})
        else:
            self._send(404, {"error": "not found"})

    def do_POST(self):
        global _last_request
        if self.path != "/tts":
            return self._send(404, {"error": "not found"})
        try:
            req = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))))
            text = " ".join(str(req.get("text", "")).split())[:MAX_TEXT]
            voice = req.get("voice", "af_heart")
            speed = min(max(float(req.get("speed", 1.0)), 0.5), 2.0)
        except (ValueError, TypeError):
            return self._send(400, {"error": "bad request"})
        if voice not in VOICE_IDS:
            return self._send(400, {"error": f"unknown voice {voice}"})
        if not text:
            return self._send(400, {"error": "empty text"})
        _last_request = time.time()
        remember_voice(voice)
        t = time.time()
        try:
            result = render(text, voice, speed)
        except Exception as e:  # keep serving after a bad sentence
            return self._send(500, {"error": str(e)})
        if self.server.verbose:
            print(f"{time.time() - t:5.1f}s  {result['duration']:5.1f}s audio  {voice:<10.10} {text[:50]!r}", flush=True)
        _last_request = time.time()
        self._send(200, result)

    def log_message(self, *args):
        pass


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--port", type=int, default=5123)
    ap.add_argument("--quiet", action="store_true", help="don't log each rendered sentence")
    ap.add_argument("--idle-exit", type=float, default=0, metavar="MIN",
                    help="exit after this many minutes without requests (frees the RAM; systemd restarts it on demand)")
    args = ap.parse_args()

    if os.environ.get("LISTEN_FDS") == "1" and os.environ.get("LISTEN_PID") == str(os.getpid()):
        # Started by systemd socket activation: the listening socket is fd 3.
        server = ThreadingHTTPServer(("127.0.0.1", args.port), Handler, bind_and_activate=False)
        server.socket.close()
        server.socket = socket.socket(fileno=3)
    else:
        server = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    server.verbose = not args.quiet
    threading.Thread(target=server.serve_forever, daemon=True).start()
    print(f"Listening on http://127.0.0.1:{args.port}", flush=True)
    warm_up()

    try:
        while True:
            time.sleep(30)
            if args.idle_exit and time.time() - _last_request > args.idle_exit * 60:
                print(f"Idle for {args.idle_exit:g} min, exiting.", flush=True)
                break
    except KeyboardInterrupt:
        pass
    server.shutdown()


if __name__ == "__main__":
    main()
