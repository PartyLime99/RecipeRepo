# Mise

A personal, installable recipe site. Pure static files — no build step, no framework. Runs on GitHub Pages.

Features: recipe list with search, diet + ingredient filters, and favourites; a two‑pane cook view (ingredients and method scroll independently on wide screens, stack on mobile); per‑step countdown timers with a chime; ingredient scaling by number of people; tappable ingredients in the method that show quantities; dietary substitution modes (e.g. vegetarian / vegan); a nutrition popup; light/dark/system themes; and per‑recipe notes you can save. Favourites, notes and theme are stored on the device.

## Run locally

`fetch` is blocked on `file://`, so use a tiny local server:

```bash
cd mise
python3 -m http.server 8000
# open http://localhost:8000
```

## Deploy to GitHub Pages

1. Put the **contents** of this folder in the root of a repo (so `index.html` is at the top level).
2. Push to GitHub.
3. Settings → Pages → Build and deployment → **Deploy from a branch** → your branch, folder **/ (root)** → Save.
4. Your site appears at `https://<user>.github.io/<repo>/`.

Install prompt and offline caching need HTTPS, which Pages provides. When you change the app shell (HTML/CSS/JS/icons), bump `CACHE_VERSION` in `sw.js` so clients pick up the update.

## Adding a recipe

On GitHub Pages, just add `recipes/<slug>.json` and commit — the site lists the `recipes/` folder automatically (via the GitHub API), so the recipe appears with no index editing. `<slug>` must match the filename minus `.json`.

**How discovery works and its fallbacks.** The app first asks the GitHub API to list `recipes/`. If that isn't available — you're testing locally, you're offline, or the repo is private — it falls back to a static `recipes/index.json`, and then to the last list it saw (so an installed app still works offline). This means:

- **Public repo on Pages:** drop the file in, done. `index.json` is optional.
- **Local testing (`file://` or localhost):** keep `recipes/index.json` up to date (a JSON array of slugs, e.g. `["chorizo-pasta"]`), since the API isn't used there.
- **Private repo:** the unauthenticated API can't list it — keep `recipes/index.json` current, or generate it with a GitHub Action.

The app auto-detects your `owner/repo` from the Pages URL. If detection ever fails, set `REPO_OVERRIDE = { owner: "you", repo: "YourRepo" }` at the top of `assets/app.js`.

> Note: the unauthenticated GitHub API allows 60 requests/hour per IP. The site uses one request per home-page load, so this is plenty for personal use; if you ever hit it, the app falls back to the cached list automatically.

### Recipe schema

```jsonc
{
  "slug": "chorizo-pasta",              // must match the filename
  "title": "Creamy Chorizo Pasta",
  "subtitle": "One pot · 20 minutes",   // optional
  "description": "…",                    // shown on the card
  "image": "https://…",                 // optional; falls back to a lettered tile
  "source": { "name": "…", "url": "…" },// optional
  "cuisine": "Italian",                  // optional
  "tags": ["pasta", "quick"],            // free-text chips + search
  "diets": [],                           // diets satisfied AS WRITTEN (see below)
  "prepTime": 2, "cookTime": 18, "totalTime": 20, // minutes, optional
  "servings": 2,                         // base number the amounts are written for
  "servingsNoun": "people",              // optional (default "servings")

  "ingredients": [
    // id is needed for method tokens and variant swaps
    { "id": "chorizo", "amount": 150, "unit": "g", "item": "chorizo", "note": "cubed" },
    { "id": "oil", "amount": null, "unit": "", "item": "Olive oil", "note": "for frying" }
    // amount:null → shown with no number and never scaled (e.g. "to taste")
  ],

  // optional dietary modes — each lists which ingredients to swap
  "variants": [
    {
      "id": "vegan",
      "label": "Vegan",
      "diets": ["vegan", "vegetarian", "dairy-free"], // diets this mode satisfies
      "swaps": {
        "chorizo": { "item": "vegan chorizo", "note": "soy or pea-based" },
        "cream":   { "item": "oat cream" }             // amount/unit optional
      }
    }
  ],

  "steps": [
    // {{id}} tokens become tappable chips that show the scaled quantity
    { "text": "Fry the {{chorizo}} until it releases its oil.",
      "timer": { "minutes": 5, "label": "Fry the chorizo" } },
    { "text": "Serve." }                 // timer optional
  ],

  "notes": ["Shown under “Tips”."],       // optional
  "nutrition": { "note": "…", "calories": "1106 kcal", "protein": "43 g", "carbs": "100 g", "fat": "58 g" }
}
```

Notes on behaviour:

- **Filtering.** A recipe matches a diet filter if the original *or* any variant satisfies it. If you filter by a diet and open a recipe, it opens in that mode. The ingredient filter (with / without) also considers variants, so “without chicken stock” can surface a recipe via its vegetarian variant.
- **Units.** `g kg ml l` render tight (`150g`); `tsp tbsp cup clove pinch` etc. scale to nice fractions (½, ⅓, ¾…). Others get a space.
- **Images.** Name a file after the recipe's slug and drop it in `images/` — it's picked up automatically (`recipes/baked-ham.json` → `images/baked-ham.jpg`, `.png`, or `.webp`), no `image` field needed. Set `"image": "images/other.jpg"` (or an external URL) on a recipe only to override. Recipes with no matching image get a generated pattern tile. On GitHub Pages the match uses the same folder listing as recipes; when testing locally the app probes `images/<slug>.{jpg,jpeg,png,webp}` directly.
