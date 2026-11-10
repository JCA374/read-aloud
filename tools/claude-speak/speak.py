#!/usr/bin/env python3
"""Read Claude Code's replies aloud with the add-on's Piper voices (Cori for English, Alma for Swedish).

Claude Code runs it from hooks (see README.md):
  speak.py hook   Stop hook: reads the reply that just finished (in the background)
  speak.py stop   UserPromptSubmit hook: stops reading when you send a new message
By hand:
  speak.py on | off | status     turn reading on or off
  speak.py last [session id]     read the reply before your latest message (the /read command)
  speak.py say "some text"       read a text
  speak.py speed 1.2             faster (or slower, below 1)
"""
import json, os, re, signal, subprocess, sys, tempfile, time
from pathlib import Path

HERE = Path(__file__).resolve().parent
VOICES = {"en": HERE / "voices/en_GB-cori-medium.onnx", "sv": HERE / "voices/sv_SE-alma-medium.onnx"}
OFF, PID, SPEED, SKIP = HERE / ".off", HERE / ".pid", HERE / ".speed", HERE / ".skip"
PYTHON = HERE / ".venv/bin/python"


def clean(md):
    """Markdown reply → plain sentences worth hearing: no code, tables, links or markup."""
    t = re.sub(r"```.*?(```|$)", " ", md, flags=re.S)  # code blocks
    lines = []
    for line in t.splitlines():
        s = line.strip()
        if s.startswith("|") or re.fullmatch(r"[-=*_ ]{3,}", s):  # tables, rules
            continue
        s = re.sub(r"^#+\s*|^>\s*|^[-*+]\s+|^\d+[.)]\s+", "", s)  # headings, quotes, list marks
        if s and not re.search(r"[.!?:;]$", s):
            s += "."  # a heading or list item is its own sentence
        lines.append(s)
    t = " ".join(lines)
    t = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", t)  # [text](url) → text
    t = re.sub(r"https?://\S+", "a link", t)

    def code(m):  # inline code: a path → its file name, anything long → dropped
        c = re.sub(r":\d+(-\d+)?$", "", m.group(1))
        if "/" in c:
            c = c.rstrip("/").rsplit("/", 1)[-1]
        return c if len(c) <= 30 else ""

    t = re.sub(r"`([^`]*)`", code, t)
    t = re.sub(r"\*\*|__|(?<!\w)[*_](?=\S)|(?<=\S)[*_](?!\w)", "", t)  # bold, italics
    t = t.replace("→", " to ").replace("–", ", ").replace("—", ", ").replace("&", " and ")
    t = re.sub(r"\(\s*\)|\s+([.,!?;:])", r"\1", t)
    t = re.sub(r"([.!?:;,])(\s*[.:;,])+", r"\1", t)
    return re.sub(r"\s+", " ", t).strip(" .") + "." if t.strip(" .") else ""


def language(t):
    words = re.findall(r"[a-zåäö]+", t.lower())
    sv = sum(w in {"och", "att", "det", "är", "som", "inte", "jag", "på", "för", "med", "har", "du", "vi"} for w in words)
    en = sum(w in {"the", "and", "to", "is", "it", "that", "of", "you", "for", "with", "this", "in", "a"} for w in words)
    return "sv" if sv > en else "en"


def last_reply(event):
    """The text of the reply that just finished, from the hook's input or else the transcript."""
    if event.get("last_assistant_message"):
        return event["last_assistant_message"]
    path = event.get("transcript_path")
    if not path:
        return ""
    for _ in range(5):  # the transcript can lag the hook by a moment
        parts = []
        for line in reversed(Path(path).read_text().splitlines()):
            try:
                e = json.loads(line)
            except ValueError:
                continue
            content = (e.get("message") or {}).get("content")
            if e.get("type") == "user" and not (isinstance(content, list) and any(b.get("type") == "tool_result" for b in content)):
                break  # back at your message: the reply is everything after it
            if e.get("type") == "assistant" and isinstance(content, list):
                parts += [b["text"] for b in reversed(content) if b.get("type") == "text"]
                if parts:
                    break  # only the final answer, not the progress notes before it
        if parts:
            return "\n\n".join(reversed(parts))
        time.sleep(0.2)
    return ""


def previous_reply(session=""):
    """For /read: the reply before your latest message, in this folder's newest (or the given) session."""
    folder = Path.home() / ".claude/projects" / re.sub(r"[^A-Za-z0-9]", "-", os.getcwd())
    logs = [folder / f"{session}.jsonl"] if session and (folder / f"{session}.jsonl").exists() else \
        sorted(folder.glob("*.jsonl"), key=lambda p: p.stat().st_mtime)[-1:]
    if not logs:
        return ""
    parts, seen_prompt = [], False
    for line in reversed(logs[0].read_text().splitlines()):
        try:
            e = json.loads(line)
        except ValueError:
            continue
        content = (e.get("message") or {}).get("content")
        if e.get("type") == "user" and not e.get("isMeta") and not (
                isinstance(content, list) and any(b.get("type") == "tool_result" for b in content)):
            seen_prompt = True  # first your /read, then the reply before it
        elif seen_prompt and e.get("type") == "assistant" and isinstance(content, list):
            parts += [b["text"] for b in reversed(content) if b.get("type") == "text"]
            if parts:
                break  # only the final answer, not the progress notes before it
    return "\n\n".join(reversed(parts))


def stop():
    try:
        os.killpg(int(PID.read_text()), signal.SIGTERM)
    except (OSError, ValueError):
        pass
    PID.unlink(missing_ok=True)


def speak_later(text):
    """Read the text in a detached process, so the hook returns at once."""
    stop()
    text = clean(text)
    if not text:
        return
    with tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False) as f:
        f.write(text)
    p = subprocess.Popen([str(PYTHON), __file__, "play", f.name], start_new_session=True,
                         stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    PID.write_text(str(p.pid))


def play(path):
    from piper import PiperVoice, SynthesisConfig

    text = Path(path).read_text()
    os.unlink(path)
    voice = PiperVoice.load(str(VOICES[language(text)]))
    speed = float(SPEED.read_text()) if SPEED.exists() else 1.0
    player = subprocess.Popen(["aplay", "-q", "-t", "raw", "-f", "S16_LE", "-c", "1", "-r", str(voice.config.sample_rate)],
                              stdin=subprocess.PIPE)
    try:  # one sentence at a time, so it starts talking quickly
        for chunk in voice.synthesize(text, SynthesisConfig(length_scale=1 / speed)):
            player.stdin.write(chunk.audio_int16_bytes)
            player.stdin.flush()
            player.stdin.write(b"\0\0" * int(voice.config.sample_rate * 0.15))  # short pause between sentences
        player.stdin.close()
        player.wait()
    except BrokenPipeError:
        pass
    finally:
        if PID.exists() and PID.read_text() == str(os.getpid()):
            PID.unlink()


def main():
    cmd = sys.argv[1] if len(sys.argv) > 1 else "status"
    if cmd == "hook":
        event = json.load(sys.stdin)
        if SKIP.exists():
            SKIP.unlink()  # the short answer to /read: keep reading the earlier reply
        elif not OFF.exists() and not event.get("stop_hook_active"):
            speak_later(last_reply(event))
    elif cmd == "last":
        text = previous_reply(sys.argv[2] if len(sys.argv) > 2 else "")
        speak_later(text)
        SKIP.touch()
        print("Reading the last reply aloud." if clean(text) else "Found no reply to read.")
    elif cmd == "stop":
        stop()
    elif cmd == "play":
        play(sys.argv[2])
    elif cmd == "say":
        speak_later(" ".join(sys.argv[2:]) or sys.stdin.read())
    elif cmd == "on":
        OFF.unlink(missing_ok=True)
        print("Reading replies aloud: on")
    elif cmd == "off":
        OFF.touch()
        stop()
        print("Reading replies aloud: off")
    elif cmd == "speed":
        SPEED.write_text(str(float(sys.argv[2])))
        print("Speed:", sys.argv[2])
    elif cmd == "status":
        print("Reading replies aloud:", "off" if OFF.exists() else "on")
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    main()
