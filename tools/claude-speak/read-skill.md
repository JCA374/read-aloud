---
name: read
description: Read the previous reply aloud with the Neural Voices terminal reader (tools/claude-speak).
disable-model-invocation: true
allowed-tools: Bash(python3 REPO/tools/claude-speak/speak.py last:*)
---

!`python3 REPO/tools/claude-speak/speak.py last ${CLAUDE_SESSION_ID}`

The line above is the result. If it is missing or shows the command instead, run
`python3 REPO/tools/claude-speak/speak.py last ${CLAUDE_SESSION_ID}` with Bash from the current folder.
Then reply with only that one line of output, nothing else.
