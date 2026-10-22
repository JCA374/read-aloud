---
name: status-page
description: Update and publish the project page (docs/page.html) after a test run, a finished feature, a fix or a setup step. Use whenever CLAUDE.md says to report progress on the page.
---

# Update the project page

The page has two tabs: **About** (public info about the add-on) and **In development** (status for the
owner). CLAUDE.md has the rules for what goes in each section; this is the procedure.

1. Edit `docs/page.html` in the **main** checkout (branch `main`). GitHub Pages builds from `main`.
   - Development tab: update the "Updated <date>, after <what>" line, the three "At a glance" counts
     (count the `chip ok">Tested` and `chip warn">Not tested` items so they match), "Do this next",
     and add items with *how* each was verified (measured numbers, not plans).
   - Add real slips to "How the session went", with what each cost.
   - Never: home-folder paths, the owner's other programs or ports, their other work. Paths relative to the repo.
   - About tab: only for things that are on `main` (released to the owner). Neural Voices news goes in the
     Development tab until it's merged.
2. Republish to the **same** Artifact URL: `https://claude.ai/artifact/DzigF14FjENFe38iWR56Bm`
   (Artifact tool, `file_path` = `docs/page.html`, no new artifact).
3. `docs/make-index.sh`, then commit `docs/` on `main` and `git push origin main`.
4. Keep the `neural-voices` branch in step (its worktree is the folder next to the main checkout): `git cherry-pick <that commit> && git push origin neural-voices`.
5. Reply in the terminal with 2–4 short lines and `https://jca374.github.io/read-aloud/#development`.

Check before replying: `git status -sb` in both checkouts
both show nothing ahead of origin.
