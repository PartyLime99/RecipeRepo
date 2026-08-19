# Mise — recipe box

A small, static recipe site you can host free on GitHub Pages. It has:

- a home page that lists every recipe (with search),
- a recipe view that puts **ingredients on one side and the method on the other** and scrolls them independently on wide screens,
- a **timer for every timed step** (they keep counting in a little dock as you scroll and beep when done),
- **ingredient scaling** — change the number of servings and every quantity updates.

## Files

```
index.html            the shell (rename your site in <title> here)
assets/styles.css     all styling
assets/app.js         all logic (rename SITE_NAME at the top)
recipes/index.json    the list of recipes to show
recipes/<slug>.json   one file per recipe
```

## Publish it on GitHub Pages

1. Create a new GitHub repository and upload everything in this folder (keep the structure).
2. In the repo, go to **Settings → Pages**.
3. Under **Build and deployment**, set **Source: Deploy from a branch**, pick your branch (usually `main`) and folder `/ (root)`, then **Save**.
4. Wait a minute, then open the URL Pages gives you (like `https://yourname.github.io/your-repo/`).

That's it — no build step.

> **Testing locally:** don't double-click `index.html` (browsers block file access).
> Run `python3 -m http.server` in this folder and open the address it prints.

## Adding a recipe

Each recipe is one JSON file plus one line in the list:

1. Add `recipes/your-recipe-slug.json` (see the schema in `recipes/chorizo-pasta.json`).
2. Add `"your-recipe-slug"` to the `recipes` array in `recipes/index.json`.

The easiest way is to start a new chat with me, paste a recipe (a link or the text), and ask me to build the file — I have a skill that produces it in the exact format this site expects.

## Renaming the site

- `index.html` → the `<title>`
- `assets/app.js` → the `SITE_NAME` constant at the top
- The hero text lives in the `renderHome()` function in `app.js`.
