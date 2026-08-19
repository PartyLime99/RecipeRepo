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

1. Add `recipes/<slug>.json` (schema below).
2. Add `"<slug>"` to the array in `recipes/index.json`.

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
- **Images.** Hotlinking the source image works but is fragile. To self‑host, drop a file in `images/` and set `"image": "images/your-file.jpg"`.
