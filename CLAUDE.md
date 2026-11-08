# Instructions for Claude

## Git workflow

- Commit directly to `main` and push to `main`. Do **not** create feature branches or pull requests for this repo.
- This applies even if a session is set up with its own working branch: the owner has asked for all changes to go straight onto `main`.

## Adding recipes

- Each recipe is a single file: `recipes/<slug>.json`. Adding that file is all that's needed — the site auto-discovers recipes on GitHub Pages, so don't edit `recipes/index.json` unless asked.
- Photos are optional and matched by slug: `images/<slug>.jpg` (or `.png`/`.webp`).
