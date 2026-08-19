# The Pantry — a personal recipe site

A static, installable recipe collection. Two-pane cooking view (ingredients + method scroll
independently on large screens), live ingredient scaling by number of people, and a countdown
timer built into every step. No build step, no server code — just files you can host on GitHub Pages.

## Install it on your phone or tablet (PWA)

The site is a Progressive Web App, so it can be installed like a native app.

- **Android / Chrome / Edge:** open the site, then tap the red **Install app** button in the top bar
  (or the browser's own "Install" / "Add to Home screen" prompt). It gets its own icon and opens
  full-screen with no address bar.
- **Desktop Chrome / Edge:** click **Install app** in the top bar, or the install icon at the right
  end of the address bar.
- **iPhone / iPad (Safari):** tap the **Share** button, then **Add to Home Screen**. (Safari doesn't
  support one-tap install, so this is the manual equivalent — the app icon and full-screen mode still work.)

Once installed it also works **offline**: the app shell and any recipes you've opened are cached.

> Installability only works over **https** (or `localhost`). GitHub Pages serves https, so it works there.
> Opening the files from your hard drive (`file://`) will not offer install and will block recipe loading.

## Deploy to GitHub Pages

1. Create a repository and upload the **contents** of this folder (so `index.html` sits at the repo root).
2. Repo **Settings → Pages → Build and deployment → Deploy from a branch**, pick your branch and the
   `/ (root)` folder, save.
3. Wait a minute, then open the URL Pages gives you. Done.

## Run it locally

Because browsers block `fetch` on `file://`, use a tiny local server:

```bash
cd this-folder
python3 -m http.server 8000
# then open http://localhost:8000
```

## Add a new recipe

1. Drop a new `recipes/<slug>.json` file in the `recipes/` folder (see `chorizo-pasta.json` as the template).
2. Add its slug to the array in `recipes/index.json`:

   ```json
   ["chorizo-pasta", "your-new-slug"]
   ```

3. Commit. That's it — the home page picks it up automatically.

**If you change the app itself** (HTML/CSS/JS/icons), bump `CACHE_VERSION` in `sw.js` (e.g. `pantry-v1` → `pantry-v2`)
so installed copies pull the update instead of serving the old cache.

## Recipe file format (quick reference)

```jsonc
{
  "slug": "chorizo-pasta",              // must match the filename
  "title": "Creamy Chorizo Pasta",
  "subtitle": "One pot · 20 minutes",   // optional
  "description": "Short blurb for the card and page.",
  "image": "https://…/photo.jpg",       // optional
  "source": { "name": "Author · Site", "url": "https://…" },  // optional
  "cuisine": "Italian",                  // optional
  "tags": ["pasta", "quick"],
  "prepTime": 2, "cookTime": 18, "totalTime": 20,  // minutes, optional
  "servings": 2,                         // the base the amounts are written for
  "servingsNoun": "people",              // optional, defaults to "servings"
  "ingredients": [
    { "amount": 150, "unit": "g", "item": "chorizo", "note": "cubed" },
    { "amount": 1, "unit": "tsp", "item": "paprika" },
    { "amount": null, "unit": "", "item": "Olive oil", "note": "for frying" }  // null = not scaled/shown
  ],
  "steps": [
    { "text": "Fry the onion and garlic until soft.",
      "timer": { "minutes": 5, "label": "Soften aromatics" } },  // timer optional
    { "text": "Plate up and finish with parmesan." }
  ],
  "notes": ["Optional tips shown under the method."],            // optional
  "nutrition": { "note": "per serving", "calories": "1106 kcal" } // optional
}
```

- **Scaling:** every numeric `amount` multiplies by `servings ÷ base servings`. Use `"amount": null`
  for things like "oil for frying" or "salt to taste" — they show without a number and never scale.
- **Timers:** add a `timer` with `minutes` and/or `seconds` to any step to get a countdown with a
  chime + vibration when it finishes. Omit it for steps that don't need timing.

## What's in here

```
index.html                 app shell + PWA wiring
manifest.webmanifest       makes it installable
sw.js                      service worker (offline cache)
assets/styles.css          all styling
assets/app.js              all behaviour (routing, scaling, timers)
icons/                     app icons (regular + maskable)
recipes/index.json         the list of recipe slugs to show
recipes/chorizo-pasta.json the first recipe (use as a template)
```
