---
name: status-page
description: Update the development status (STATUS.md) and, when users would see a difference, the public info page (docs/page.html) after a test run, a finished feature, a fix or a setup step. Use whenever CLAUDE.md says to report progress.
---

# Update the status and the info page

CLAUDE.md has the rules for what goes where; this is the procedure.

1. **`STATUS.md`** (always): the "Updated <date>, after <what>" line; the three "At a glance" counts (count
   the ✅ and 🟡 rows so they match); "Do this next"; new rows with *how* each was verified (measured numbers,
   not plans); real slips in "How the sessions went", with what each cost.
2. **`docs/page.html`** (only when what a user sees changed: a feature, voice, install step, privacy): the
   public info page. Unreleased features carry a `<span class="chip todo">Next version</span>` until the
   release. Then republish to the **same** Artifact URL `https://claude.ai/artifact/DzigF14FjENFe38iWR56Bm`
   (Artifact tool, `file_path` = `docs/page.html`) and run `docs/make-index.sh`.
3. Never: home-folder paths, the owner's other programs or ports, their other work. Paths relative to the repo.
4. Commit (with the code changes it reports on) and `git push origin main`. Check `git status -sb` shows
   nothing ahead of origin.
5. Reply in the terminal with 2–4 short lines and `https://github.com/JCA374/read-aloud/blob/main/STATUS.md`.

Run edit scripts as files (not inline with quotes) and check they succeeded before publishing or committing.
