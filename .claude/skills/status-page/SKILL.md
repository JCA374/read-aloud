---
name: status-page
description: Update and publish the project page (docs/page.html) after a test run, a finished feature, a fix or a setup step. Use whenever CLAUDE.md says to report progress on the page.
---

# Update the project page

The page has two tabs: **About** (public info about the add-on) and **In development** (status for the
owner). CLAUDE.md has the rules for what goes in each section; this is the procedure.

1. Edit `docs/page.html` on `main`. GitHub Pages builds from `main`.
   - Development tab: update the "Updated <date>, after <what>" line, the three "At a glance" counts
     (count the `chip ok">Tested` and `chip warn">Not tested` items so they match), "Do this next",
     and add items with *how* each was verified (measured numbers, not plans).
   - Add real slips to "How the session went", with what each cost.
   - Never: home-folder paths, the owner's other programs or ports, their other work. Paths relative to the repo.
   - About tab: what the add-on does now, for anyone who finds it. Keep it accurate after every feature change.
2. Republish to the **same** Artifact URL: `https://claude.ai/artifact/DzigF14FjENFe38iWR56Bm`
   (Artifact tool, `file_path` = `docs/page.html`, no new artifact).
3. `docs/make-index.sh`, then commit (with the code changes it reports on) and `git push origin main`.
4. Reply in the terminal with 2–4 short lines and `https://jca374.github.io/read-aloud/#development`.

Check before replying: `git status -sb` shows nothing ahead of origin.
