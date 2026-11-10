# Reading Claude Code's replies aloud

A small extra that isn't part of the add-on. It reads each reply from Claude Code (in the terminal) aloud,
with the add-on's default voices: Cori for English, Alma for Swedish. It skips code blocks and tables and
says only the file name of a path. It runs on your computer, with no server. It stops when you send a new
message. Linux only for now (it plays sound with `aplay`).

## Set it up

From the repo root:

```
python3 -m venv tools/claude-speak/.venv
tools/claude-speak/.venv/bin/pip install piper-tts
```

The voices go in `tools/claude-speak/voices/`, from the same Hugging Face revision as the add-on uses:

```
B=https://huggingface.co/rhasspy/piper-voices/resolve/5041a7a49ae5b3a0f30e6837769eb03fdbb231bd
cd tools/claude-speak/voices
for p in en/en_GB/cori/medium/en_GB-cori-medium sv/sv_SE/alma/medium/sv_SE-alma-medium; do
  curl -fLO $B/$p.onnx && curl -fLO $B/$p.onnx.json
done
```

Then add two hooks in Claude Code (type `/hooks`, or edit `~/.claude/settings.json` to have it in every
project). Replace `REPO` with the full path to this repo:

```json
"hooks": {
  "Stop": [{"hooks": [{"type": "command", "command": "python3 REPO/tools/claude-speak/speak.py hook", "timeout": 10}]}],
  "UserPromptSubmit": [{"hooks": [{"type": "command", "command": "python3 REPO/tools/claude-speak/speak.py stop", "timeout": 5}]}]
}
```

### The /read command

`/read` reads the reply before it aloud, whether or not automatic reading is on. To add it, run this from
the repo root (it copies `read-skill.md` into your Claude Code skills, with the repo's path filled in):

```
mkdir -p ~/.claude/skills/read && sed "s|REPO|$PWD|g" tools/claude-speak/read-skill.md > ~/.claude/skills/read/SKILL.md
```

It finds the reply in the session's log (`~/.claude/projects/<folder>/<session>.jsonl`), so run Claude
Code from the same folder. Only the final answer is read, not the short progress notes before it.

## Using it

In Claude Code, the `!` in front runs a command:

| What | Command |
|---|---|
| Turn off / on | `! python3 tools/claude-speak/speak.py off` (or `on`) |
| Stop the current reply | send a new message, or `! python3 tools/claude-speak/speak.py stop` |
| Faster or slower | `! python3 tools/claude-speak/speak.py speed 1.2` |
| Read the previous reply | `/read` |
| Read any text | `python3 tools/claude-speak/speak.py say "Hello"` |

It starts talking about 5 seconds after a reply ends, because loading the voice takes that long.
