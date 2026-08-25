/* ============================================================
   Mise — app.js  (vanilla JS, no build step)
   ============================================================ */
"use strict";

const view = document.getElementById("view");
const RECIPES_DIR = "recipes";
const SITE_NAME = "Mise";
const APP_VERSION = "1.11.0";

/* Recipe discovery.
   On GitHub Pages we can list the recipes/ folder via the GitHub API, so you
   can just drop a .json file in and it appears — no index to edit. Falls back
   to a static recipes/index.json (for local testing / offline / private repos).
   To force a specific repo, set REPO_OVERRIDE = { owner, repo }. */
const REPO_OVERRIDE = null;
const SLUGS_CACHE_KEY = "mise:slugs";

function detectRepo() {
  if (REPO_OVERRIDE) return REPO_OVERRIDE;
  try {
    const host = location.hostname;               // e.g. partylime99.github.io
    if (!/\.github\.io$/i.test(host)) return null; // not a Pages host
    const owner = host.split(".")[0];
    const seg = location.pathname.split("/").filter(Boolean)[0];
    const repo = seg || `${owner}.github.io`;      // project page vs user page
    return { owner, repo };
  } catch (e) { return null; }
}

async function listFilesViaGitHub(repo, folder) {
  const url = `https://api.github.com/repos/${repo.owner}/${repo.repo}/contents/${folder}`;
  const res = await fetch(url, { headers: { Accept: "application/vnd.github+json" } });
  if (!res.ok) throw new Error(`github ${res.status}`);
  const items = await res.json();
  if (!Array.isArray(items)) throw new Error("github: unexpected response");
  return items.filter((f) => f.type === "file").map((f) => f.name);
}
async function listRecipesViaGitHub(repo) {
  const names = await listFilesViaGitHub(repo, RECIPES_DIR);
  return names
    .filter((n) => /\.json$/i.test(n) && n.toLowerCase() !== "index.json")
    .map((n) => n.replace(/\.json$/i, ""))
    .sort();
}

/* ---------- automatic images (images/<slug>.<ext>) ---------- */
const IMAGES_DIR = "images";
const IMAGES_CACHE_KEY = "mise:images";
let IMAGE_MAP = {};          // slug(lowercased) -> "images/<file>"
let IMAGE_LISTING_OK = false; // did we get a reliable folder listing?

async function loadImageMap() {
  IMAGE_MAP = {}; IMAGE_LISTING_OK = false;
  const repo = detectRepo();
  const useCache = () => {
    const c = store.get(IMAGES_CACHE_KEY, null);
    if (c && c.map) { IMAGE_MAP = c.map; IMAGE_LISTING_OK = !!c.ok; }
  };
  if (!repo) { useCache(); return; }
  try {
    const files = await listFilesViaGitHub(repo, IMAGES_DIR);
    const map = {};
    files.filter((n) => /\.(jpe?g|png|webp|gif|avif)$/i.test(n)).forEach((name) => {
      const base = name.replace(/\.[^.]+$/, "").toLowerCase();
      if (!(base in map)) map[base] = `${IMAGES_DIR}/${name}`;
    });
    IMAGE_MAP = map; IMAGE_LISTING_OK = true;
    store.set(IMAGES_CACHE_KEY, { map, ok: true });
  } catch (e) { useCache(); }  // 404 (no images folder), offline, private, or rate-limited
}
function resolveImage(recipe) {
  if (recipe.image) return recipe.image;                 // explicit override wins
  const key = (recipe.slug || "").toLowerCase();
  return IMAGE_MAP[key] || null;
}

/* ---------- storage helpers (localStorage, safe) ---------- */
const store = {
  get(key, fallback) {
    try { const v = localStorage.getItem(key); return v == null ? fallback : JSON.parse(v); }
    catch (e) { return fallback; }
  },
  set(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {} },
};
const FAV_KEY = "mise:favourites";
const THEME_KEY = "mise:theme";
const UNITS_KEY = "mise:units";
const STATS_KEY = "mise:stats";
const PANTRY_KEY = "mise:pantry";
const SHOPPING_KEY = "mise:shopping";
const INSTALL_DISMISS_KEY = "mise:installDismissed";
const noteKey = (slug) => `mise:note:${slug}`;

const getUnits = () => Object.assign({ amounts: "fraction", volume: "native" }, store.get(UNITS_KEY, {}));
const setUnits = (u) => store.set(UNITS_KEY, Object.assign(getUnits(), u));

const getStats = () => store.get(STATS_KEY, {});
function bumpView(slug) {
  const s = getStats(); const e = s[slug] || { count: 0, last: 0 };
  e.count += 1; e.last = Date.now(); s[slug] = e; store.set(STATS_KEY, s);
}
const getPantry = () => new Set(store.get(PANTRY_KEY, []));
const setPantry = (set) => store.set(PANTRY_KEY, [...set]);

const getFavs = () => store.get(FAV_KEY, []);
const isFav = (slug) => getFavs().includes(slug);
const toggleFav = (slug) => {
  const favs = getFavs();
  const i = favs.indexOf(slug);
  if (i >= 0) favs.splice(i, 1); else favs.push(slug);
  store.set(FAV_KEY, favs);
  return favs.includes(slug);
};

/* ---------- tiny DOM helper ---------- */
const el = (tag, attrs = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") n.className = v;
    else if (k === "html") n.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v === true ? "" : v);
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    n.append(kid.nodeType ? kid : document.createTextNode(kid));
  }
  return n;
};
const clear = (node) => { while (node.firstChild) node.removeChild(node.firstChild); };
const wide = () => window.matchMedia("(min-width: 900px)").matches;

/* icons */
const ICON = {
  search: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg>',
  back:   '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
  check:  '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 6"/></svg>',
  play:   '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l11-6.5z"/></svg>',
  pause:  '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6.5" y="5.5" width="4" height="13" rx="1"/><rect x="13.5" y="5.5" width="4" height="13" rx="1"/></svg>',
  reset:  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v4h4"/></svg>',
  bell:   '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 22a2.4 2.4 0 0 0 2.3-1.8H9.7A2.4 2.4 0 0 0 12 22zm7-5-1.6-1.7V10a5.4 5.4 0 0 0-4-5.2V4a1.4 1.4 0 0 0-2.8 0v.8A5.4 5.4 0 0 0 6.6 10v5.3L5 17a.9.9 0 0 0 .7 1.5h12.6A.9.9 0 0 0 19 17z"/></svg>',
  starO:  '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 3.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.6 9.7l5.8-.8z"/></svg>',
  starF:  '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.6 9.7l5.8-.8z"/></svg>',
  chart:  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
  chevL:  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
  chevR:  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>',
  copy:   '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>',
  chevD:  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>',
  sort:   '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h12M3 12h9M3 18h6M17 6v12M17 18l3-3M17 18l-3-3"/></svg>',
  share:  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>',
  cook:   '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16M6 20V9a6 6 0 0 1 12 0v11"/><path d="M9 9a3 3 0 0 1 6 0"/></svg>',
  cart:   '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2 3h3l2.6 12.4a1.5 1.5 0 0 0 1.5 1.2h8.2a1.5 1.5 0 0 0 1.5-1.2L22 7H6"/></svg>',
  trash:  '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14M10 11v6M14 11v6"/></svg>',
  plus:   '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
};

/* diet labels */
const DIET_LABELS = { vegetarian: "Vegetarian", vegan: "Vegan", "gluten-free": "Gluten-free", "dairy-free": "Dairy-free", pescatarian: "Pescatarian" };
const dietLabel = (id) => DIET_LABELS[id] || id;

/* ---------- amount formatting + scaling ---------- */
const FRACTION_UNITS = new Set(["", "tsp", "tbsp", "cup", "cups", "clove", "cloves", "pinch", "can", "cans", "slice", "slices", "handful", "sprig", "sprigs"]);
const FRAC_TABLE = [[0.125, "\u215B"], [0.25, "\u00BC"], [0.333, "\u2153"], [0.5, "\u00BD"], [0.667, "\u2154"], [0.75, "\u00BE"], [0.875, "\u215E"]];
const round = (n, dp) => { const f = 10 ** dp; return Math.round(n * f) / f; };

function formatAmount(value, unit) {
  if (value == null || isNaN(value)) return "";
  const decimals = getUnits().amounts === "decimal";
  if (!decimals && FRACTION_UNITS.has((unit || "").toLowerCase())) return toFraction(value);
  const abs = Math.abs(value);
  if (abs >= 10) return String(Math.round(value));
  if (abs >= 1)  return String(round(value, 1));
  return String(round(value, 2));
}
function toFraction(value) {
  const whole = Math.floor(value + 1e-9);
  const frac = value - whole;
  if (frac <= 0.02) return String(whole);
  let best = null, bestDiff = 0.07;
  for (const [v, glyph] of FRAC_TABLE) { const d = Math.abs(v - frac); if (d < bestDiff) { best = glyph; bestDiff = d; } }
  if (best) return (whole > 0 ? whole : "") + best;
  return String(round(value, 2));
}
const VOL_ML = { tsp: 5, tbsp: 15, cup: 250, cups: 250, fl_oz: 30, floz: 30 };
let volumeOverride = null; // temporary per-recipe override of the Settings volume default
const effVolume = () => volumeOverride || getUnits().volume;
const hasVolumeUnits = (recipe) => (recipe.ingredients || []).some((i) => VOL_ML[(i.unit || "").toLowerCase()]);
function amountText(ing, factor) {
  if (ing.amount == null) return "";
  const u = (ing.unit || "").toLowerCase();
  if (effVolume() === "ml" && VOL_ML[u]) {
    return `${Math.round(ing.amount * factor * VOL_ML[u])}ml`;
  }
  const amt = formatAmount(ing.amount * factor, ing.unit);
  if (!amt) return "";
  if (ing.unit) {
    const tight = ["g", "kg", "ml", "l"].includes(u);
    return tight ? `${amt}${ing.unit}` : `${amt} ${ing.unit}`;
  }
  return amt;
}
// optional parenthetical gram estimate for countable items (e.g. "1 onion (≈150 g)")
function gramsBracket(ing, factor) {
  const each = Number(ing.gramsEach);
  if (!each || isNaN(each)) return "";
  const count = ing.amount != null ? ing.amount : 1;
  const g = each * count * factor;
  if (!g) return "";
  const rounded = g >= 100 ? Math.round(g / 10) * 10 : Math.round(g / 5) * 5;
  return `\u2248\u202F${rounded}\u202Fg`;
}

/* ============================================================
   MODES / VARIANTS
   A recipe has an implicit "original" mode plus optional variants
   (e.g. vegetarian, vegan). Each mode yields an effective ingredient
   list (base with swaps applied) and a set of diet ids it satisfies.
   ============================================================ */
/* ---------- scaling (servings or weight) ---------- */
function scaleFactor(state) {
  if (state.kind === "weight") return state.baseWeight ? state.weightG / state.baseWeight : 1;
  return state.base ? state.servings / state.base : 1;
}
// cooking time that scales with weight, with optional rate brackets (e.g. 36 min/lb up to 3lb…)
function timerMinutesForWeight(perWeight, weightG) {
  const kg = weightG / 1000;
  const brs = (perWeight && perWeight.brackets) || [];
  if (!brs.length) return 0;
  let chosen = brs[brs.length - 1];
  for (const b of brs) { if (kg <= (b.upToKg != null ? b.upToKg : Infinity)) { chosen = b; break; } }
  const rate = chosen ? (Number(chosen.minutesPerKg) || 0) : 0;
  const base = perWeight.plusMinutes ? Number(perWeight.plusMinutes) : 0;
  return Math.max(1, Math.round(rate * kg + base));
}
const KG = 1000, LB = 453.592;
const fmtWeight = (g) => g >= 1000 ? `${round(g / 1000, 2)} kg` : `${Math.round(g)} g`;

function recipeModes(recipe) {
  const base = recipe.ingredients || [];
  const modes = [{
    id: null,
    label: "Original",
    diets: recipe.diets || [],
    ingredients: base,
  }];
  (recipe.variants || []).forEach((v) => {
    const swaps = v.swaps || {};
    const ings = base.map((ing) => {
      const s = ing.id && swaps[ing.id];
      if (!s) return ing;
      if (s.remove) return Object.assign({}, ing, { _removed: true });   // left out in this variant
      return Object.assign({}, ing, s, { _swapped: true, _original: ing.item });
    });
    modes.push({ id: v.id, label: v.label || dietLabel(v.id), diets: v.diets || [v.id], ingredients: ings });
  });
  return modes;
}
function modeById(recipe, id) {
  const modes = recipeModes(recipe);
  return modes.find((m) => m.id === id) || modes[0];
}
function recipeDiets(recipe) {
  const set = new Set();
  recipeModes(recipe).forEach((m) => (m.diets || []).forEach((d) => set.add(d)));
  return [...set];
}
function ingredientItemsForMode(mode) {
  // removed ingredients aren't part of this version (so "without X" filters match)
  return (mode.ingredients || []).filter((i) => !i._removed).map((i) => (i.item || "").toLowerCase());
}

/* ---------- data loading ---------- */
async function loadManifest() {
  // 1) Auto-discover on GitHub Pages — just drop files in, no index to edit.
  const repo = detectRepo();
  if (repo) {
    try {
      const slugs = await listRecipesViaGitHub(repo);
      if (slugs && slugs.length) { store.set(SLUGS_CACHE_KEY, slugs); return slugs; }
    } catch (e) { /* rate-limited / private / offline — fall through */ }
  }
  // 2) Static manifest fallback (local testing, offline first load, private repos).
  try {
    const res = await fetch(`${RECIPES_DIR}/index.json`, { cache: "no-cache" });
    if (res.ok) {
      const slugs = await res.json();
      if (Array.isArray(slugs) && slugs.length) { store.set(SLUGS_CACHE_KEY, slugs); return slugs; }
    }
  } catch (e) { /* fall through */ }
  // 3) Last known list from a previous visit (keeps the installed app working offline).
  const cached = store.get(SLUGS_CACHE_KEY, null);
  if (cached && cached.length) return cached;
  throw new Error("no recipe manifest available");
}
async function loadRecipe(slug) {
  const res = await fetch(`${RECIPES_DIR}/${slug}.json`, { cache: "no-cache" });
  if (!res.ok) throw new Error(`${slug} ${res.status}`);
  const data = await res.json();
  data.slug = data.slug || slug;
  return data;
}

/* ============================================================
   ROUTER
   ============================================================ */
window.addEventListener("hashchange", route);
window.addEventListener("DOMContentLoaded", route);

function route() {
  stopAllTimers();
  closePopovers();
  if (cleanupScroll) { cleanupScroll(); cleanupScroll = null; }
  toggleCookMode(null, false);                       // leave cook mode when navigating
  volumeOverride = null;                              // temporary unit override is per-recipe
  const ib = document.getElementById("install-banner"); if (ib) ib.remove();
  const hash = location.hash.replace(/^#\/?/, "");
  const parts = hash.split("/");
  if (parts[0] === "r" && parts[1]) {
    document.body.className = "route-recipe";
    renderRecipePage(decodeURIComponent(parts[1]), parts[2] ? decodeURIComponent(parts[2]) : undefined);
  } else if (parts[0] === "shopping" && parts[1] === "add") {
    document.body.className = "route-list route-pick";
    renderListPage({ pick: true });
  } else if (parts[0] === "shopping") {
    document.body.className = "route-shopping";
    renderShoppingPage();
  } else {
    document.body.className = "route-list";
    renderListPage();
  }
  try { view.scrollTop = 0; if (window.scrollTo) window.scrollTo(0, 0); } catch (e) {}
}

/* ============================================================
   LIST PAGE
   ============================================================ */
let LIST_STATE = { recipes: [], query: "", cuisines: new Set(), diets: new Set(), favOnly: false, inc: new Set(), exc: new Set(), sort: "name" };
const emptyFilters = () => ({ recipes: LIST_STATE.recipes, query: "", cuisines: new Set(), diets: new Set(), favOnly: false, inc: new Set(), exc: new Set(), sort: LIST_STATE.sort });
const anyFilterActive = () => LIST_STATE.query || LIST_STATE.cuisines.size || LIST_STATE.diets.size || LIST_STATE.favOnly || LIST_STATE.inc.size || LIST_STATE.exc.size;
let PICK_MODE = false;
const defaultQty = (r) => r.scaleBy === "weight" ? (Number(r.weightBase) || 1000) : (Number(r.servings) || 2);
function addMealToShopping(r) {
  const sel = store.get(SHOPPING_KEY, {});
  if (!(r.slug in sel)) sel[r.slug] = defaultQty(r);
  store.set(SHOPPING_KEY, sel);
}

async function renderListPage(opts) {
  PICK_MODE = !!(opts && opts.pick);
  clear(view);
  const wrap = el("section", { class: "list" });
  if (PICK_MODE) {
    wrap.append(el("div", { class: "list__intro" },
      el("p", { class: "eyebrow" }, "Shopping list"),
      el("h1", { class: "list__title" }, "Add a meal"),
      el("p", { class: "list__lede" }, "Tap a recipe to add it to your shopping list."),
      el("a", { class: "chipbtn primary intro-shop", href: "#/shopping" }, "Done \u2192 back to list")
    ));
  } else {
    wrap.append(el("div", { class: "list__intro" },
      el("p", { class: "eyebrow" }, SITE_NAME),
      el("h1", { class: "list__title" }, "What are we cooking?"),
      el("p", { class: "list__lede" }, "A personal collection \u2014 every recipe scales to any number of people, adapts to diets, and runs its own step timers while you cook."),
      el("a", { class: "chipbtn primary intro-shop", href: "#/shopping" }, el("span", { html: ICON.cart }), "Make a shopping list")
    ));
  }
  const controls = el("div", { class: "controls" });
  const grid = el("div", { class: "grid" });
  wrap.append(controls, grid);
  view.append(wrap);

  for (let i = 0; i < 3; i++) {
    grid.append(el("div", { class: "card skeleton" },
      el("div", { class: "card__media" }),
      el("div", { class: "card__body" }, el("div", { class: "sk-line" }), el("div", { class: "sk-line short" }))));
  }

  let slugs;
  try { slugs = await loadManifest(); }
  catch (e) {
    clear(grid);
    grid.append(el("p", { class: "empty" },
      el("strong", {}, "Couldn't load the recipe list. "),
      "If you're opening this file directly, run it through a local server (see the README) \u2014 browsers block fetch on file:// pages."));
    return;
  }

  const results = await Promise.allSettled(slugs.map(loadRecipe));
  LIST_STATE.recipes = results.filter(r => r.status === "fulfilled").map(r => r.value);

  await loadImageMap();   // resolve images/<slug>.<ext> so cards can auto-match

  clear(controls);
  buildControls(controls, grid);
  renderCards(grid);
}

function buildControls(controls, grid) {
  clear(controls);

  const search = el("div", { class: "search" },
    el("span", { html: ICON.search }),
    el("input", { type: "search", placeholder: "Search recipes\u2026", "aria-label": "Search recipes",
      value: LIST_STATE.query,
      oninput: (e) => { LIST_STATE.query = e.target.value.trim().toLowerCase(); renderCards(grid); } })
  );
  const favBtn = el("button", { class: "pill fav", "aria-pressed": String(LIST_STATE.favOnly),
    onclick: () => { LIST_STATE.favOnly = !LIST_STATE.favOnly; buildControls(controls, grid); renderCards(grid); } },
    el("span", { html: LIST_STATE.favOnly ? ICON.starF : ICON.starO }), "Favourites");

  const SORTS = [["name", "Name (A\u2013Z)"], ["newest", "Newest"], ["quickest", "Quickest"], ["most", "Most viewed"], ["recent", "Recently viewed"]];
  const sortLbl = () => (SORTS.find((s) => s[0] === LIST_STATE.sort) || SORTS[0])[1];
  const sortBtn = el("button", { class: "pill dropdown-btn", "data-poptrigger": "1", title: "Sort recipes" },
    el("span", { class: "chev", html: ICON.sort }), el("span", { class: "sort-lbl" }, sortLbl()), el("span", { class: "chev", html: ICON.chevD }));
  sortBtn.addEventListener("click", () => toggleMenu(sortBtn, "sort", () => openFilterMenu(sortBtn, {
    id: "sort", title: "Sort by", kind: "radio", grid,
    items: SORTS.map(([v, l]) => ({ value: v, label: l })),
    stateOf: (v) => LIST_STATE.sort === v,
    onToggle: (v) => { LIST_STATE.sort = v; },
    onChange: () => { sortBtn.querySelector(".sort-lbl").textContent = sortLbl(); closePopovers(); },
  })));

  const row1 = el("div", { class: "controls__row" }, search, favBtn, sortBtn);

  const filterbar = el("div", { class: "filterbar" });
  const clearBtn = el("button", { class: "filter-clear", hidden: !anyFilterActive(),
    onclick: () => { closePopovers(); LIST_STATE = emptyFilters(); buildControls(controls, grid); renderCards(grid); } },
    "Clear all");
  const refreshClear = () => { clearBtn.hidden = !anyFilterActive(); };
  search.querySelector("input").addEventListener("input", refreshClear);

  const cuisines = [...new Set(LIST_STATE.recipes.map(r => r.cuisine).filter(Boolean))].sort();
  const allDiets = [...new Set(LIST_STATE.recipes.flatMap(recipeDiets))].sort();
  const allIngredients = [...new Set(LIST_STATE.recipes.flatMap(r => (r.ingredients || []).map(i => (i.item || "").toLowerCase())))].filter(Boolean).sort();

  // 1) Cuisine
  if (cuisines.length) {
    const btn = dropdownButton("Cuisine", () => LIST_STATE.cuisines.size);
    btn.addEventListener("click", () => toggleMenu(btn, "cuisine", () => openFilterMenu(btn, {
      id: "cuisine", title: "Cuisine", kind: "check", grid,
      searchable: cuisines.length > 10,
      items: cuisines.map((c) => ({ value: c, label: c })),
      stateOf: (v) => LIST_STATE.cuisines.has(v),
      onToggle: (v) => { LIST_STATE.cuisines.has(v) ? LIST_STATE.cuisines.delete(v) : LIST_STATE.cuisines.add(v); },
      onChange: () => { btn._refresh(); refreshClear(); },
      onClear: () => { LIST_STATE.cuisines.clear(); },
    })));
    filterbar.append(btn);
  }

  // 2) Dietary
  if (allDiets.length) {
    const btn = dropdownButton("Dietary", () => LIST_STATE.diets.size);
    btn.addEventListener("click", () => toggleMenu(btn, "dietary", () => openFilterMenu(btn, {
      id: "dietary", title: "Dietary", kind: "check", grid,
      items: allDiets.map((d) => ({ value: d, label: dietLabel(d) })),
      stateOf: (v) => LIST_STATE.diets.has(v),
      onToggle: (v) => { LIST_STATE.diets.has(v) ? LIST_STATE.diets.delete(v) : LIST_STATE.diets.add(v); },
      onChange: () => { btn._refresh(); refreshClear(); },
      onClear: () => { LIST_STATE.diets.clear(); },
    })));
    filterbar.append(btn);
  }

  // 3) Ingredients (tri-state: with / without / off)
  if (allIngredients.length) {
    const btn = dropdownButton("Ingredients", () => LIST_STATE.inc.size + LIST_STATE.exc.size);
    btn.addEventListener("click", () => toggleMenu(btn, "ingredients", () => openFilterMenu(btn, {
      id: "ingredients", title: "Ingredients", kind: "tri", grid, searchable: true,
      hint: "Tap to cycle: with \u2192 without \u2192 off",
      items: allIngredients.map((it) => ({ value: it, label: it })),
      stateOf: (v) => LIST_STATE.inc.has(v) ? "inc" : LIST_STATE.exc.has(v) ? "exc" : "",
      onToggle: (v) => {
        if (LIST_STATE.inc.has(v)) { LIST_STATE.inc.delete(v); LIST_STATE.exc.add(v); }
        else if (LIST_STATE.exc.has(v)) { LIST_STATE.exc.delete(v); }
        else { LIST_STATE.inc.add(v); }
      },
      onChange: () => { btn._refresh(); refreshClear(); },
      onClear: () => { LIST_STATE.inc.clear(); LIST_STATE.exc.clear(); },
    })));
    filterbar.append(btn);
  }

  filterbar.append(clearBtn);
  controls.append(row1, filterbar);
}

function dropdownButton(label, countFn) {
  const count = el("span", { class: "count" });
  const btn = el("button", { class: "pill dropdown-btn", "data-poptrigger": "1" },
    label, count, el("span", { class: "chev", html: ICON.chevD }));
  btn._refresh = () => { const n = countFn(); count.textContent = n ? String(n) : ""; btn.classList.toggle("active", n > 0); };
  btn._refresh();
  return btn;
}
// open this button's menu, or close it if it's already the open one (toggle)
function toggleMenu(btn, id, openFn) {
  const alreadyOpen = document.querySelector(`.menu[data-menu="${id}"]`);
  closePopovers();
  if (!alreadyOpen) openFn();
}

function openFilterMenu(anchor, opts) {
  let q = "";
  const listEl = el("div", { class: "menu__list" });
  const makeRow = (it) => {
    const st = opts.stateOf(it.value);
    const indicator = opts.kind === "tri"
      ? el("span", { class: "menu__state" }, st === "inc" ? "WITH" : st === "exc" ? "WITHOUT" : "\u00B7")
      : el("span", { class: "menu__box", html: ICON.check });
    const row = el("div", { class: "menu__row", role: "button", tabindex: "0" },
      el("span", { class: "menu__label" }, it.label), indicator);
    const paint = () => {
      const s = opts.stateOf(it.value);
      if (opts.kind === "tri") {
        row.classList.toggle("inc", s === "inc");
        row.classList.toggle("exc", s === "exc");
        indicator.textContent = s === "inc" ? "WITH" : s === "exc" ? "WITHOUT" : "\u00B7";
      } else {
        row.classList.toggle("on", !!s);
      }
    };
    paint();
    const act = () => { opts.onToggle(it.value); paint(); renderCards(opts.grid); opts.onChange && opts.onChange(); };
    row.addEventListener("click", act);
    row.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); act(); } });
    return row;
  };
  const renderRows = () => {
    clear(listEl);
    const items = opts.items.filter((it) => !q || it.label.toLowerCase().includes(q)).slice(0, 300);
    if (!items.length) { listEl.append(el("div", { class: "menu__empty" }, "No matches")); return; }
    items.forEach((it) => listEl.append(makeRow(it)));
  };

  const clearLink = el("button", { onclick: () => { opts.onClear && opts.onClear(); renderRows(); renderCards(opts.grid); opts.onChange && opts.onChange(); } }, "Clear");
  const pop = el("div", { class: "menu", "data-popover": "1", "data-menu": opts.id },
    el("div", { class: "menu__title" }, el("span", {}, opts.title), clearLink),
    opts.hint ? el("p", { class: "menu__hint" }, opts.hint) : null,
    opts.searchable ? el("div", { class: "menu__search" },
      el("input", { type: "search", placeholder: `Find\u2026`, oninput: (e) => { q = e.target.value.trim().toLowerCase(); renderRows(); } })) : null,
    listEl);
  renderRows();
  document.body.append(pop);
  positionPopover(pop, anchor);
}

/* choose the best matching mode for a recipe under current filters.
   returns { ok, modeId } — ok=false means it doesn't match. */
function matchRecipe(recipe) {
  if (LIST_STATE.cuisines.size && !LIST_STATE.cuisines.has(recipe.cuisine || "")) return { ok: false };
  const modes = recipeModes(recipe);
  const diets = [...LIST_STATE.diets];
  const inc = [...LIST_STATE.inc];
  const exc = [...LIST_STATE.exc];

  let chosen = null;
  for (const m of modes) {
    const items = ingredientItemsForMode(m);
    const dietsOk = diets.every((d) => (m.diets || []).includes(d));
    const incOk = inc.every((q) => items.some((it) => it.includes(q)));
    const excOk = exc.every((q) => !items.some((it) => it.includes(q)));
    if (dietsOk && incOk && excOk) {
      // prefer the original mode when it satisfies everything
      if (m.id === null) { chosen = m; break; }
      if (!chosen) chosen = m;
    }
  }
  return chosen ? { ok: true, modeId: chosen.id } : { ok: false };
}

function renderCards(grid) {
  clear(grid);
  let list = [];
  for (const r of LIST_STATE.recipes) {
    if (LIST_STATE.favOnly && !isFav(r.slug)) continue;
    if (LIST_STATE.query) {
      const q = LIST_STATE.query;
      const hit = r.title.toLowerCase().includes(q) ||
        (r.description || "").toLowerCase().includes(q) ||
        (r.tags || []).some(t => t.toLowerCase().includes(q)) ||
        (r.ingredients || []).some(i => (i.item || "").toLowerCase().includes(q));
      if (!hit) continue;
    }
    const m = matchRecipe(r);
    if (!m.ok) continue;
    list.push({ r, modeId: m.modeId });
  }

  if (!list.length) {
    grid.append(el("p", { class: "empty" }, el("strong", {}, "Nothing matches. "), "Try loosening the filters."));
    return;
  }
  const stats = getStats();
  const cmpName = (a, b) => a.r.title.localeCompare(b.r.title);
  const addedTime = (r) => { const t = Date.parse(r.added || r.date || ""); return isNaN(t) ? -Infinity : t; };
  const sorters = {
    name: cmpName,
    newest: (a, b) => (addedTime(b.r) - addedTime(a.r)) || cmpName(a, b),
    quickest: (a, b) => ((a.r.totalTime || 1e9) - (b.r.totalTime || 1e9)) || cmpName(a, b),
    most: (a, b) => (((stats[b.r.slug] || {}).count || 0) - ((stats[a.r.slug] || {}).count || 0)) || cmpName(a, b),
    recent: (a, b) => (((stats[b.r.slug] || {}).last || 0) - ((stats[a.r.slug] || {}).last || 0)) || cmpName(a, b),
  };
  list.sort(sorters[LIST_STATE.sort] || cmpName);
  list.forEach(({ r, modeId }) => grid.append(recipeCard(r, modeId)));
}

function recipeCard(r, modeId) {
  const media = el("div", { class: "card__media" });
  const src = resolveImage(r);
  if (src) {
    const img = el("img", { src, alt: "", loading: "lazy" });
    img.addEventListener("error", () => { img.remove(); media.append(placeholder(r.title, r.slug)); });
    media.append(img);
  } else if (!IMAGE_LISTING_OK) {
    attachGuessedImage(media, r);   // local/offline: try images/<slug>.<ext>
  } else {
    media.append(placeholder(r.title, r.slug));
  }
  if (r.totalTime) media.append(el("span", { class: "card__time" }, `${r.totalTime} min`));

  const favOn = isFav(r.slug);
  const fav = el("button", { class: "card__fav" + (favOn ? " on" : ""), "aria-label": favOn ? "Remove favourite" : "Add favourite",
    onclick: (e) => { e.preventDefault(); e.stopPropagation(); const now = toggleFav(r.slug); fav.classList.toggle("on", now); fav.innerHTML = now ? ICON.starF : ICON.starO;
      if (LIST_STATE.favOnly) { const grid = document.querySelector(".grid"); if (grid) renderCards(grid); } },
    html: favOn ? ICON.starF : ICON.starO });
  media.append(fav);

  // link to recipe, carrying the chosen mode when a diet filter selected it
  const href = modeId ? `#/r/${r.slug}/${modeId}` : `#/r/${r.slug}`;
  const dietsShown = (r.diets || []);
  if (PICK_MODE) {
    return el("a", { class: "card card--pick", href: "#/shopping",
      onclick: () => { addMealToShopping(r); toast(`Added ${r.title}`); } },
      media,
      el("div", { class: "card__body" },
        el("h2", { class: "card__title" }, r.title),
        el("div", { class: "card__tags" }, el("span", { class: "chip add-chip" }, "+ Add to list"))));
  }
  return el("a", { class: "card", href },
    media,
    el("div", { class: "card__body" },
      el("h2", { class: "card__title" }, r.title),
      r.description ? el("p", { class: "card__desc" }, truncate(r.description, 96)) : null,
      el("div", { class: "card__tags" },
        (r.tags || []).slice(0, 3).map(t => el("span", { class: "chip" }, t)),
        dietsShown.slice(0, 2).map(d => el("span", { class: "chip diet" }, dietLabel(d)))
      )
    )
  );
}
// local/offline fallback: probe common extensions, then fall back to a pattern
function attachGuessedImage(media, r) {
  const exts = ["jpg", "jpeg", "png", "webp"]; let i = 0;
  const img = el("img", { alt: "", loading: "lazy" });
  const tryNext = () => {
    if (i >= exts.length) { img.remove(); media.append(placeholder(r.title, r.slug)); return; }
    img.src = `${IMAGES_DIR}/${r.slug}.${exts[i++]}`;
  };
  img.addEventListener("error", tryNext);
  media.append(img); tryNext();
}
const PH_PATTERNS = ["pat-dots", "pat-grid", "pat-diag", "pat-cross", "pat-waves", "pat-scale"];
function hashStr(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); }
function placeholder(title, slug) {
  const key = slug || title || "x";
  const pat = PH_PATTERNS[hashStr(key) % PH_PATTERNS.length];
  return el("div", { class: `card__placeholder ${pat}` },
    el("span", { class: "ph-letter" }, (title || "?").trim()[0].toUpperCase()));
}
const truncate = (s, n) => s.length > n ? s.slice(0, n - 1).trimEnd() + "\u2026" : s;

/* ---------- ingredient include/exclude filter popover ---------- */
/* ============================================================
   SHOPPING LIST PAGE  (#/shopping)
   Pick recipes (each with its own servings), merge ingredients,
   tick off what you already have, then copy/share the rest.
   ============================================================ */
async function renderShoppingPage() {
  clear(view);
  const sel = store.get(SHOPPING_KEY, {});           // { slug: servings|grams }
  const pantry = getPantry();                          // Set of ticked item names (lowercased)
  const slugs = Object.keys(sel);

  view.append(el("p", { class: "loading-msg" }, "Loading\u2026"));
  const loaded = await Promise.allSettled(slugs.map(loadRecipe));
  const bySlug = {};
  loaded.forEach((res) => { if (res.status === "fulfilled") bySlug[res.value.slug] = res.value; });
  // drop any selections whose recipe no longer exists
  Object.keys(sel).forEach((s) => { if (!bySlug[s]) delete sel[s]; });
  store.set(SHOPPING_KEY, sel);

  clear(view);
  const page = el("section", { class: "shopping" });
  page.append(el("div", { class: "shopping__top" },
    el("h1", { class: "shopping__title" }, "Shopping list"),
    el("a", { class: "chipbtn primary", href: "#/shopping/add" }, el("span", { html: ICON.plus }), "Add meal")));

  const mealsWrap = el("div", { class: "shop-meals" });
  const listWrap = el("div", { class: "shop-list" });
  page.append(mealsWrap, listWrap);
  view.append(page);

  const saveSel = () => store.set(SHOPPING_KEY, sel);
  const factorFor = (r) => r.scaleBy === "weight" ? (sel[r.slug] / (Number(r.weightBase) || 1000)) : (sel[r.slug] / (Number(r.servings) || 1));

  const renderMeals = () => {
    clear(mealsWrap);
    const chosen = Object.keys(sel).filter((s) => bySlug[s]);
    if (!chosen.length) {
      mealsWrap.append(el("div", { class: "shop-empty" },
        el("p", {}, "No meals yet."),
        el("a", { class: "chipbtn primary", href: "#/shopping/add" }, el("span", { html: ICON.plus }), "Add your first meal")));
      return;
    }
    chosen.map((s) => bySlug[s]).sort((a, b) => a.title.localeCompare(b.title)).forEach((r) => {
      const byWeight = r.scaleBy === "weight";
      const step = byWeight ? (Number(r.weightStep) || 100) : 1;
      const unit = byWeight ? "g" : (r.servingsNoun || "servings");
      const val = el("span", { class: "shop-meal__val" }, String(sel[r.slug]));
      const dec = el("button", { class: "mini", "aria-label": "less", onclick: () => { sel[r.slug] = Math.max(step, (sel[r.slug] || step) - step); val.textContent = String(sel[r.slug]); saveSel(); renderList(); } }, "\u2013");
      const inc = el("button", { class: "mini", "aria-label": "more", onclick: () => { sel[r.slug] = (sel[r.slug] || 0) + step; val.textContent = String(sel[r.slug]); saveSel(); renderList(); } }, "+");
      const bin = el("button", { class: "shop-meal__bin", "aria-label": `Remove ${r.title}`, title: "Remove",
        onclick: () => { delete sel[r.slug]; saveSel(); renderMeals(); renderList(); }, html: ICON.trash });
      mealsWrap.append(el("div", { class: "shop-meal" },
        el("a", { class: "shop-meal__name", href: `#/r/${r.slug}` }, r.title),
        el("div", { class: "shop-meal__qty" }, el("span", { class: "shop-meal__lbl" }, "Serves"), dec, val, inc, el("span", { class: "shop-meal__unit" }, unit)),
        bin));
    });
  };

  const mergeItems = () => {
    const merged = new Map();
    Object.keys(sel).filter((s) => bySlug[s]).forEach((slug) => {
      const r = bySlug[slug]; const factor = factorFor(r);
      (modeById(r, null).ingredients || []).forEach((ing) => {
        if (ing._removed) return;
        const key = (ing.item || "").toLowerCase().trim(); if (!key) return;
        if (!merged.has(key)) merged.set(key, { item: ing.item, entries: [] });
        merged.get(key).entries.push(ing.amount != null ? { amount: ing.amount * factor, unit: ing.unit || "" } : { amount: null, unit: ing.unit || "" });
      });
    });
    return merged;
  };
  const fmtMerged = (rec) => {
    const nums = rec.entries.filter((e) => e.amount != null);
    if (!nums.length) return "";
    const units = [...new Set(nums.map((e) => e.unit.toLowerCase()))];
    if (units.length === 1) return amountText({ amount: nums.reduce((s, e) => s + e.amount, 0), unit: nums[0].unit }, 1);
    return nums.map((e) => amountText({ amount: e.amount, unit: e.unit }, 1)).join(" + ");
  };

  const renderList = () => {
    clear(listWrap);
    const merged = mergeItems();
    const rows = [...merged.values()].sort((a, b) => a.item.localeCompare(b.item));
    listWrap.append(el("div", { class: "shop-list__head" },
      el("h2", { class: "shop-h" }, "Ingredients"),
      rows.length ? el("button", { class: "chipbtn", onclick: copyList }, el("span", { html: ICON.copy }), "Copy") : null,
      rows.length && navigator.share ? el("button", { class: "chipbtn", onclick: shareList }, el("span", { html: ICON.share }), "Share") : null));
    if (!rows.length) { listWrap.append(el("p", { class: "empty" }, "Add a meal to build your list.")); return; }
    const ul = el("ul", { class: "shop-items" });
    rows.forEach((rec) => {
      const key = rec.item.toLowerCase().trim();
      const have = pantry.has(key);
      const li = el("li", { class: "shop-item" + (have ? " have" : ""), role: "button", tabindex: "0" });
      const toggle = () => { have ? pantry.delete(key) : pantry.add(key); setPantry(pantry); renderList(); };
      li.addEventListener("click", toggle);
      li.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } });
      li.append(
        el("span", { class: "shop-item__check", html: have ? ICON.check : "" }),
        el("span", { class: "shop-item__amt" }, fmtMerged(rec) || "\u00A0"),
        el("span", { class: "shop-item__name" }, rec.item));
      ul.append(li);
    });
    listWrap.append(ul);
    const haveCount = rows.filter((r) => pantry.has(r.item.toLowerCase().trim())).length;
    listWrap.append(el("p", { class: "shop-hint" }, `${rows.length - haveCount} to buy \u00b7 ${haveCount} already have. Tap an item to mark it as in your cupboard.`));
  };

  const buildText = () => {
    const rows = [...mergeItems().values()]
      .filter((rec) => !pantry.has(rec.item.toLowerCase().trim()))
      .sort((a, b) => a.item.localeCompare(b.item))
      .map((rec) => { const amt = fmtMerged(rec); return (amt ? amt + " " : "") + rec.item; });
    return "Shopping list\n" + rows.join("\n");
  };
  function copyList() {
    const text = buildText(); const done = () => toast("Shopping list copied");
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
    else fallbackCopy(text, done);
  }
  async function shareList() {
    const text = buildText();
    if (navigator.share) { try { await navigator.share({ title: "Shopping list", text }); return; } catch (e) { if (e && e.name === "AbortError") return; } }
    copyList();
  }

  renderMeals();
  renderList();
}
/* ============================================================
   RECIPE PAGE
   ============================================================ */
let cleanupScroll = null;

async function renderRecipePage(slug, initialModeId) {
  clear(view);
  view.append(el("p", { class: "loading-msg" }, "Loading recipe\u2026"));

  let r;
  try { r = await loadRecipe(slug); }
  catch (e) {
    clear(view);
    view.append(el("section", { class: "list" },
      el("p", { class: "empty" }, el("strong", {}, "Recipe not found. "), "It may not be listed in recipes/index.json yet."),
      el("p", { style: "text-align:center" }, el("a", { class: "backlink", href: "#/" }, el("span", { html: ICON.back }), "Back to all recipes"))));
    return;
  }

  document.title = `${r.title} \u2014 ${SITE_NAME}`;
  bumpView(r.slug);
  const modes = recipeModes(r);
  let modeId = modes.some(m => m.id === initialModeId) ? initialModeId : null;

  const byWeight = r.scaleBy === "weight";
  const base = Number(r.servings) || 1;
  const baseWeight = Number(r.weightBase) || 1000;
  const wStep = Number(r.weightStep) || 100;
  const wMin = Number(r.weightMin) || wStep;
  const wMax = Number(r.weightMax) || baseWeight * 8;
  const state = byWeight
    ? { kind: "weight", weightG: baseWeight, baseWeight, modeId }
    : { kind: "servings", servings: base, base, noun: r.servingsNoun || "servings", modeId };

  clear(view);
  const page = el("section", { class: "recipe" });

  const ingList = el("ul", { class: "ing" });
  const stepsWrap = el("ol", { class: "steps" });
  const rerenderCook = () => {
    const mode = modeById(r, state.modeId);
    renderIngredients(ingList, mode, state);
    renderSteps(stepsWrap, r, mode, state);
  };

  /* ---- scaler (servings or weight) ---- */
  let scaler;
  if (byWeight) {
    const input = el("input", { class: "scaler__input", type: "text", inputmode: "numeric",
      "aria-label": "Weight in grams", value: String(state.weightG) });
    const unit = el("span", { class: "scaler__unit" }, "g");
    const hint = el("span", { class: "scaler__hint" });
    const minusBtn = el("button", { class: "scaler__btn", "aria-label": "Less weight" }, "\u2013");
    const plusBtn = el("button", { class: "scaler__btn", "aria-label": "More weight" }, "+");
    const resetBtn = el("button", { class: "scaler__reset", hidden: true }, "reset");
    const paint = () => {
      input.value = String(state.weightG);
      hint.textContent = `\u2248 ${round(state.weightG / KG, 2)} kg \u00b7 ${round(state.weightG / LB, 1)} lb`;
      minusBtn.disabled = state.weightG <= wMin;
      resetBtn.hidden = state.weightG === baseWeight;
    };
    const setWeight = (g) => {
      g = Math.round(g / 1) ;
      state.weightG = Math.max(wMin, Math.min(wMax, Math.round(g)));
      paint(); rerenderCook();
    };
    minusBtn.addEventListener("click", () => setWeight(state.weightG - wStep));
    plusBtn.addEventListener("click", () => setWeight(state.weightG + wStep));
    resetBtn.addEventListener("click", () => setWeight(baseWeight));
    const commit = () => { const v = parseFloat(input.value.replace(/[^\d.]/g, "")); if (!isNaN(v)) setWeight(v); else paint(); };
    input.addEventListener("change", commit);
    input.addEventListener("blur", commit);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); input.blur(); } });
    scaler = el("div", { class: "scaler scaler--weight", role: "group", "aria-label": "Set weight" },
      el("span", { class: "scaler__label" }, "Weight"), minusBtn,
      el("span", { class: "scaler__field" }, input, unit), plusBtn, resetBtn,
      hint);
    setTimeout(paint, 0);
  } else {
    const valueEl = el("span", { class: "scaler__value" }, String(state.servings));
    const minusBtn = el("button", { class: "scaler__btn", "aria-label": "Fewer servings" }, "\u2013");
    const plusBtn = el("button", { class: "scaler__btn", "aria-label": "More servings" }, "+");
    const resetBtn = el("button", { class: "scaler__reset", hidden: true }, "reset");
    const setServings = (n) => {
      state.servings = Math.max(1, Math.min(50, n));
      valueEl.textContent = String(state.servings);
      minusBtn.disabled = state.servings <= 1;
      resetBtn.hidden = state.servings === state.base;
      rerenderCook();
    };
    minusBtn.addEventListener("click", () => setServings(state.servings - 1));
    plusBtn.addEventListener("click", () => setServings(state.servings + 1));
    resetBtn.addEventListener("click", () => setServings(state.base));
    scaler = el("div", { class: "scaler", role: "group", "aria-label": "Scale servings" },
      el("span", { class: "scaler__label" }, "Serves"), minusBtn, valueEl, plusBtn,
      el("span", { class: "scaler__noun" }, state.noun), resetBtn);
  }

  // favourite + nutrition + mode controls
  const favOn = isFav(r.slug);
  const favIcon = el("span", { html: favOn ? ICON.starF : ICON.starO });
  const favLabel = el("span", {}, favOn ? " Favourited" : " Favourite");
  const favBtn = el("button", { class: "chipbtn fav" + (favOn ? " on" : ""),
    onclick: () => { const now = toggleFav(r.slug); favBtn.classList.toggle("on", now); favIcon.innerHTML = now ? ICON.starF : ICON.starO; favLabel.textContent = now ? " Favourited" : " Favourite"; } },
    favIcon, favLabel);

  const actions = el("div", { class: "recipe__actions" }, scaler, favBtn);

  if (r.nutrition) actions.append(el("button", { class: "chipbtn", onclick: () => openNutrition(r) },
    el("span", { html: ICON.chart }), "Nutrition"));

  actions.append(el("button", { class: "chipbtn", onclick: () => shareRecipe(r) },
    el("span", { html: ICON.share }), "Share"));

  actions.append(el("button", { class: "chipbtn", onclick: () => toggleCookMode(page, true) },
    el("span", { html: ICON.cook }), "Cook mode"));

  // dietary mode selector
  if (modes.length > 1) {
    const modebar = el("div", { class: "modebar", role: "group", "aria-label": "Dietary mode" });
    const paint = () => modebar.querySelectorAll(".mode-btn").forEach(b => b.classList.toggle("on", b.dataset.mode === String(state.modeId)));
    modes.forEach((m) => {
      modebar.append(el("button", { class: "mode-btn", "data-mode": String(m.id),
        onclick: () => { state.modeId = m.id; paint(); rerenderCook(); } }, m.label));
    });
    actions.append(modebar);
    setTimeout(paint, 0);
  }

  const meta = el("div", { class: "meta" });
  const addMeta = (label, val) => { if (val) meta.append(el("span", { class: "meta__item" }, `${label} `, el("b", {}, String(val)))); };
  addMeta("Prep", r.prepTime && `${r.prepTime} min`);
  addMeta("Cook", r.cookTime && `${r.cookTime} min`);
  addMeta("Total", r.totalTime && `${r.totalTime} min`);
  if (r.cuisine) addMeta("Cuisine", r.cuisine);
  if (r.source && r.source.url) meta.append(el("span", { class: "meta__item meta__src" }, "Source ",
    el("a", { href: r.source.url, target: "_blank", rel: "noopener" }, r.source.name || "original")));

  const collapsible = el("div", { class: "recipe__collapsible" },
    r.subtitle ? el("p", { class: "recipe__subtitle" }, r.subtitle) : null, meta);
  const top = el("div", { class: "recipe__top" },
    el("div", { class: "recipe__topinner" },
      el("div", { class: "recipe__headrow" },
        el("div", { class: "recipe__heading" },
          el("h1", { class: "recipe__title" }, r.title),
          collapsible),
        actions)));

  /* ---- panes ---- */
  const ingHead = el("div", { class: "pane__head" },
    el("h2", { class: "pane__title", id: "ingredients-heading" }, "Ingredients"));
  const ingBody = el("div", { class: "pane__body" }, ingList);
  // temporary cups <-> ml toggle (overrides the Settings default just for this recipe)
  if (hasVolumeUnits(r)) {
    const vt = el("div", { class: "unit-toggle", role: "group", "aria-label": "Volume units" });
    const paintVT = () => vt.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.v === effVolume()));
    [["native", "cups"], ["ml", "ml"]].forEach(([v, l]) =>
      vt.append(el("button", { "data-v": v, onclick: () => { volumeOverride = v; paintVT(); rerenderCook(); } }, l)));
    ingHead.append(vt);
    setTimeout(paintVT, 0);
  }
  const copyBtn = el("button", { class: "pane__copy", "aria-label": "Copy unchecked ingredients", title: "Copy unchecked ingredients",
    onclick: () => copyIngredients(ingList, r.title, copyBtn), html: ICON.copy });
  const collapseBtn = el("button", { class: "pane__collapse", "aria-label": "Hide ingredients", title: "Hide ingredients",
    html: ICON.chevL });
  ingHead.append(copyBtn, collapseBtn);
  const ingPane = el("div", { class: "pane pane--ingredients" }, ingHead, ingBody);

  const methodBody = el("div", { class: "pane__body" }, stepsWrap);
  const methodPane = el("div", { class: "pane pane--method" },
    el("div", { class: "pane__head" }, el("h2", { class: "pane__title" }, "Method")), methodBody);

  const cook = el("div", { class: "cook" }, ingPane, methodPane);

  collapseBtn.addEventListener("click", () => {
    const collapsed = cook.classList.toggle("ing-collapsed");
    collapseBtn.innerHTML = collapsed ? ICON.chevR : ICON.chevL;
    collapseBtn.setAttribute("aria-label", collapsed ? "Show ingredients" : "Hide ingredients");
  });

  page.append(top, cook);

  /* ---- tips + notes (extra) ---- */
  const extra = buildExtra(r);
  // On wide screens tips/notes scroll with the method pane; on narrow they go under the page.
  const bodyRegion = el("div", { class: "recipe__body" });
  if (wide()) methodBody.append(extra); else { bodyRegion.append(extra); }
  page.append(bodyRegion);

  view.append(page);

  rerenderCook();

  /* ---- smooth collapse-on-scroll (interpolated, not a jump) ---- */
  if (cleanupScroll) { cleanupScroll(); cleanupScroll = null; }
  const RANGE = 96;         // px of scroll over which the header fully collapses
  let natural = 0, actNatural = 0, lastT = 0, ticking = false;
  const measure = () => {
    const prev = collapsible.style.height;
    collapsible.style.height = "auto";
    natural = collapsible.scrollHeight || 0;
    collapsible.style.height = prev || (natural + "px");
    if (wide()) {
      const ap = actions.style.height; actions.style.height = "auto";
      actNatural = actions.scrollHeight || 0; actions.style.height = ap || (actNatural + "px");
    }
  };
  const apply = (t) => {
    lastT = t;
    page.style.setProperty("--collapse", t.toFixed(3));
    collapsible.style.height = (natural * (1 - t)) + "px";
    collapsible.style.opacity = String(1 - t);
    collapsible.style.pointerEvents = t > 0.6 ? "none" : "";
    if (wide()) {                         // on tablet, the serves/nutrition/actions row folds away too
      actions.style.overflow = "hidden";
      actions.style.height = (actNatural * (1 - t)) + "px";
      actions.style.opacity = String(1 - t);
      actions.style.pointerEvents = t > 0.6 ? "none" : "";
    } else {
      actions.style.height = ""; actions.style.opacity = ""; actions.style.pointerEvents = ""; actions.style.overflow = "";
    }
  };
  const readY = () => wide()
    ? Math.max(methodBody.scrollTop || 0, ingBody.scrollTop || 0)
    : (window.scrollY || document.documentElement.scrollTop || 0);
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      apply(Math.max(0, Math.min(1, readY() / RANGE)));
    });
  };
  const onResize = () => { measure(); apply(lastT); };

  methodBody.addEventListener("scroll", onScroll, { passive: true });
  ingBody.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onResize);
  cleanupScroll = () => {
    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("resize", onResize);
  };

  // measure after layout settles, then set initial state
  requestAnimationFrame(() => { measure(); apply(0); });
  setTimeout(maybeShowInstallBanner, 600);   // gentle nudge for people arriving via a shared link
}

/* treat empty / "null" / "undefined" note values as no note */
const cleanNote = (n) => {
  if (n == null) return "";
  const s = String(n).trim();
  return (s === "" || s.toLowerCase() === "null" || s.toLowerCase() === "undefined") ? "" : s;
};

/* ---------- ingredients (re-rendered on scale/mode) ---------- */
function renderIngredients(listEl, mode, state) {
  clear(listEl);
  const factor = scaleFactor(state);
  const scaled = Math.abs(factor - 1) > 1e-9;
  let lastGroup;

  (mode.ingredients || []).forEach((ing) => {
    if (ing.group && ing.group !== lastGroup) { lastGroup = ing.group; listEl.append(el("li", { class: "ing__group" }, ing.group)); }

    if (ing._removed) {
      // still shown, struck out, so you can see it's deliberately left out of this version
      listEl.append(el("li", { class: "ing__row removed", "aria-label": `${ing.item}, left out of this version` },
        el("span", { class: "ing__check", "aria-hidden": "true" }),
        el("span", { class: "ing__amount" }, "\u2014"),
        el("span", { class: "ing__item" }, ing.item, el("span", { class: "ing__swap out" }, "left out")),
        el("span", { class: "ing__note" }, `Not used in the ${mode.label} version`)));
      return;
    }

    const note = cleanNote(ing.note);
    const amt = amountText(ing, factor);
    const gb = gramsBracket(ing, factor);
    const row = el("li", { class: "ing__row", role: "button", tabindex: "0" },
      el("span", { class: "ing__check", "aria-hidden": "true", html: ICON.check }),
      el("span", { class: "ing__amount" }, amt || "\u00A0"),
      el("span", { class: "ing__item" }, ing.item,
        gb ? el("span", { class: "ing__grams" }, ` (${gb})`) : null,
        ing._swapped ? el("span", { class: "ing__swap", title: `was ${ing._original}` }, "swap") : null),
      note ? el("span", { class: "ing__note" }, note) : null
    );
    row.dataset.copy = (amt ? amt + " " : "") + ing.item + (gb ? ` (${gb})` : "");
    const toggle = () => row.classList.toggle("done");
    row.addEventListener("click", toggle);
    row.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } });
    listEl.append(row);
  });

  const heading = document.getElementById("ingredients-heading");
  if (heading) {
    const old = heading.querySelector(".scaled-flag"); if (old) old.remove();
    if (scaled) heading.append(el("span", { class: "scaled-flag" }, `\u00D7 ${round(factor, 2)}`));
  }
}

/* ---------- method (tokens -> tappable ingredient chips) ---------- */
function renderSteps(listEl, recipe, mode, state) {
  clear(listEl);
  const factor = scaleFactor(state);
  const byId = {};
  (mode.ingredients || []).forEach((i) => { if (i.id) byId[i.id] = i; });

  let n = 0;
  (recipe.steps || []).forEach((step) => {
    // per-variant text override: textByVariant[<modeId>]; empty string / null => skip step in this variant
    let text = step.text || step.instruction || "";
    if (mode.id && step.textByVariant && Object.prototype.hasOwnProperty.call(step.textByVariant, mode.id)) {
      text = step.textByVariant[mode.id];
    }
    if (text == null || String(text).trim() === "") return; // step dropped in this variant

    n += 1;
    const body = el("div", { class: "step__body" });
    body.append(renderStepText(text, byId, factor));
    if (step.timer) {
      let seconds = (Number(step.timer.minutes) || 0) * 60 + (Number(step.timer.seconds) || 0);
      if (step.timer.perWeight && state.kind === "weight") {
        seconds = timerMinutesForWeight(step.timer.perWeight, state.weightG) * 60;
      } else if (step.timer.scale) {
        seconds = Math.max(1, Math.round(seconds * scaleFactor(state)));  // opt-in: time grows with the batch
      }
      if (seconds > 0) body.append(buildTimer(seconds, step.timer.label || `Step ${n}`));
    }
    listEl.append(el("li", { class: "step" }, el("span", { class: "step__num" }, String(n)), body));
  });
}

function renderStepText(text, byId, factor) {
  const p = el("p", { class: "step__text" });
  const parts = String(text).split(/(\{\{[^}]+\}\})/g);
  parts.forEach((part) => {
    const m = part.match(/^\{\{([^}]+)\}\}$/);
    if (m) {
      const ing = byId[m[1].trim()];
      if (ing && ing._removed) {
        p.append(el("span", { class: "iref out", title: "left out of this version" }, ing.item));
        return;
      }
      if (ing) {
        const chip = el("button", { class: "iref", type: "button",
          onclick: (e) => showQtyPopover(e.currentTarget, ing, factor) }, ing.item);
        p.append(chip);
        return;
      }
      p.append(document.createTextNode(part)); // unknown id, leave literal
    } else if (part) {
      p.append(document.createTextNode(part));
    }
  });
  return p;
}

function showQtyPopover(anchor, ing, factor) {
  closePopovers();
  const amt = amountText(ing, factor);
  const gb = gramsBracket(ing, factor);
  const note = cleanNote(ing.note);
  const pop = el("div", { class: "popover", "data-popover": "1" },
    el("div", { class: "pop-amt" }, (amt || "to taste") + (gb ? ` (${gb})` : "")),
    el("div", { class: "pop-item" }, ing.item),
    note ? el("div", { class: "pop-note" }, note) : null);
  document.body.append(pop);
  positionPopover(pop, anchor, true);
}

/* ---------- tips + user notes ---------- */
function buildExtra(recipe) {
  const extra = el("div", { class: "extra" });

  if (recipe.notes && recipe.notes.length) {
    extra.append(el("div", { class: "tips" },
      el("h3", {}, "Tips"),
      el("ul", {}, recipe.notes.map(n => el("li", {}, n)))));
  }

  // user notes (persisted per recipe)
  const saved = store.get(noteKey(recipe.slug), "");
  const status = el("span", { class: "usernotes__status" }, saved ? "Saved" : "");
  let t;
  const save = () => { store.set(noteKey(recipe.slug), t.value); status.textContent = "Saved"; };
  let debounce;
  t = el("textarea", { placeholder: "Add your own notes \u2014 tweaks, timings, what you'd change next time\u2026 (saved on this device)",
    oninput: () => { status.textContent = "Saving\u2026"; clearTimeout(debounce); debounce = setTimeout(save, 500); } });
  t.value = saved;
  const notes = el("div", { class: "usernotes" },
    el("h3", {}, "My notes"),
    t,
    el("div", { class: "usernotes__foot" },
      el("button", { class: "chipbtn", onclick: () => { save(); } }, "Save note"),
      status));
  extra.append(notes);
  return extra;
}

/* ============================================================
   NUTRITION + SETTINGS MODALS
   ============================================================ */
function modalShell(title) {
  const overlay = el("div", { class: "modal open", onclick: (e) => { if (e.target === overlay) close(); } });
  const panel = el("div", { class: "modal__panel" });
  const close = () => overlay.remove();
  panel.append(el("div", { class: "modal__head" },
    el("h2", { class: "modal__title" }, title),
    el("button", { class: "modal__close", "aria-label": "Close", onclick: close }, "\u00D7")));
  overlay.append(panel);
  document.body.append(overlay);
  document.addEventListener("keydown", function esc(e) { if (e.key === "Escape") { close(); document.removeEventListener("keydown", esc); } });
  return { overlay, panel, close };
}

function openNutrition(recipe) {
  const { panel } = modalShell("Nutrition");
  panel.classList.add("modal__panel--wide");
  const n = recipe.nutrition || {};
  if (Array.isArray(n.items) && n.items.length) renderNutriTable(panel, n);
  else renderNutriLegacy(panel, n);
}

const capFirst = (s) => s.charAt(0).toUpperCase() + s.slice(1);
function fmtNut(v, unit) {
  if (v == null || isNaN(v)) return "";
  const num = Math.abs(v) >= 100 ? Math.round(v) : Math.round(v * 10) / 10;
  return `${num}${unit || ""}`;
}
const riPct = (v, ri) => (ri && v != null ? Math.round((v / ri) * 100) + "%" : "");

function renderNutriTable(panel, n) {
  const items = n.items;
  const hasPer100 = items.some((i) => i.per100g != null);

  const headRow = el("tr", {}, el("th", {}, "Typical value"));
  if (hasPer100) headRow.append(el("th", {}, "Per 100g"));
  const servHdr = (n.servingLabel || "Per serving") + (n.servingSize ? ` (${n.servingSize})` : "");
  headRow.append(el("th", {}, servHdr), el("th", {}, "%RI*"), el("th", {}, "RI*"));

  const tbody = el("tbody", {});
  items.forEach((it) => {
    const tr = el("tr", { class: it.sub ? "sub" : "" });
    tr.append(el("td", { class: it.sub ? "" : "rowlabel" }, it.label || ""));
    if (hasPer100) tr.append(el("td", { class: "num" }, fmtNut(it.per100g, it.unit)));
    tr.append(el("td", { class: "num" }, fmtNut(it.perServing, it.unit)));
    tr.append(el("td", { class: "pct" }, riPct(it.perServing, it.ri)));
    tr.append(el("td", { class: "num ri" }, fmtNut(it.ri, it.unit)));
    tbody.append(tr);
  });

  panel.append(el("table", { class: "nutri" }, el("thead", {}, headRow), tbody));

  const foot = el("div", { class: "nutri-foot" });
  if (n.servingsPerRecipe) foot.append(`This recipe makes ${n.servingsPerRecipe} servings. `);
  foot.append("*Reference intake of an average adult (8400 kJ / 2000 kcal).");
  panel.append(foot);
  panel.append(el("p", { class: "nutri-est" },
    (n.note ? n.note + " " : "") + "These figures are an estimate, not a lab analysis."));
}

function renderNutriLegacy(panel, n) {
  // Upgrade the old flat format to the label-style table so every recipe looks consistent.
  const num = (v) => { const f = parseFloat(String(v)); return isNaN(f) ? null : f; };
  const items = [];
  const kcal = num(n.calories);
  if (kcal != null) {
    items.push({ label: "Energy", unit: "kJ", perServing: Math.round(kcal * 4.184), ri: 8400 });
    items.push({ label: "", unit: "kcal", perServing: kcal, ri: 2000 });
  }
  if (num(n.fat) != null) items.push({ label: "Fat", unit: "g", perServing: num(n.fat), ri: 70 });
  if (num(n.saturates) != null) items.push({ label: "of which saturates", unit: "g", perServing: num(n.saturates), ri: 20, sub: true });
  if (num(n.carbs ?? n.carbohydrate) != null) items.push({ label: "Carbohydrate", unit: "g", perServing: num(n.carbs ?? n.carbohydrate), ri: 260 });
  if (num(n.sugar ?? n.sugars) != null) items.push({ label: "of which sugars", unit: "g", perServing: num(n.sugar ?? n.sugars), ri: 90, sub: true });
  if (num(n.fibre ?? n.fiber) != null) items.push({ label: "Fibre", unit: "g", perServing: num(n.fibre ?? n.fiber) });
  if (num(n.protein) != null) items.push({ label: "Protein", unit: "g", perServing: num(n.protein), ri: 50 });
  if (num(n.salt) != null) items.push({ label: "Salt", unit: "g", perServing: num(n.salt), ri: 6 });

  if (items.length) { renderNutriTable(panel, { note: n.note, items }); return; }

  // Truly unstructured — show whatever keys exist as a simple grid.
  const grid = el("div", { class: "nut-grid" });
  const order = ["calories", "protein", "carbs", "fat", "fibre", "sugar", "salt", "saturates"];
  const keys = [...new Set([...order.filter((k) => n[k] != null), ...Object.keys(n).filter((k) => k !== "note")])];
  keys.forEach((k) => grid.append(el("div", { class: "nut-cell" },
    el("div", { class: "k" }, capFirst(k)),
    el("div", { class: "v" }, String(n[k])))));
  panel.append(grid);
  panel.append(el("p", { class: "nutri-est" },
    (n.note ? n.note + " " : "") + "These figures are an estimate, not a lab analysis."));
}

function openSettings() {
  const { panel } = modalShell("Settings");
  const pref = store.get(THEME_KEY, "system");

  const seg = el("div", { class: "seg", role: "group", "aria-label": "Theme" });
  const opts = [["light", "Light"], ["dark", "Dark"], ["system", "System"]];
  const paint = () => seg.querySelectorAll("button").forEach(b => b.classList.toggle("on", b.dataset.v === (store.get(THEME_KEY, "system"))));
  opts.forEach(([v, label]) => seg.append(el("button", { "data-v": v, onclick: () => { store.set(THEME_KEY, v); applyTheme(); paint(); } }, label)));

  panel.append(el("div", { class: "setting" },
    el("div", {}, el("div", { class: "setting__label" }, "Appearance"),
      el("div", { class: "setting__sub" }, "System follows your device's light/dark setting.")),
    seg));

  const favs = getFavs();
  panel.append(el("div", { class: "setting" },
    el("div", {}, el("div", { class: "setting__label" }, "Favourites"),
      el("div", { class: "setting__sub" }, `${favs.length} saved on this device.`)),
    el("button", { class: "chipbtn", onclick: (e) => { if (confirm("Clear all favourites?")) { store.set(FAV_KEY, []); e.target.textContent = "Cleared"; } } }, "Clear")));

  // Amounts: fractions vs decimals
  const amtSeg = el("div", { class: "seg", role: "group", "aria-label": "Amounts" });
  [["fraction", "Fractions"], ["decimal", "Decimals"]].forEach(([v, l]) =>
    amtSeg.append(el("button", { "data-v": v, onclick: () => { setUnits({ amounts: v }); paintUnits(); reRenderForUnits(); } }, l)));
  panel.append(el("div", { class: "setting" },
    el("div", {}, el("div", { class: "setting__label" }, "Amounts"),
      el("div", { class: "setting__sub" }, "Show quantities as \u00bd or 0.5.")),
    amtSeg));

  // Volume: native vs ml
  const volSeg = el("div", { class: "seg", role: "group", "aria-label": "Volumes" });
  [["native", "Cups/tbsp"], ["ml", "ml"]].forEach(([v, l]) =>
    volSeg.append(el("button", { "data-v": v, onclick: () => { setUnits({ volume: v }); paintUnits(); reRenderForUnits(); } }, l)));
  panel.append(el("div", { class: "setting" },
    el("div", {}, el("div", { class: "setting__label" }, "Volumes"),
      el("div", { class: "setting__sub" }, "Convert tsp/tbsp/cups to millilitres.")),
    volSeg));

  const paintUnits = () => {
    const u = getUnits();
    amtSeg.querySelectorAll("button").forEach(b => b.classList.toggle("on", b.dataset.v === u.amounts));
    volSeg.querySelectorAll("button").forEach(b => b.classList.toggle("on", b.dataset.v === u.volume));
  };

  // Backup: export / import
  const importInput = el("input", { type: "file", accept: "application/json,.json", style: "display:none",
    onchange: (e) => { const f = e.target.files[0]; if (f) importData(f); } });
  panel.append(el("div", { class: "setting" },
    el("div", {}, el("div", { class: "setting__label" }, "Backup"),
      el("div", { class: "setting__sub" }, "Save or restore favourites, notes & settings.")),
    el("div", { class: "setting__btns" },
      el("button", { class: "chipbtn", onclick: exportData }, "Export"),
      el("button", { class: "chipbtn", onclick: () => importInput.click() }, "Import"),
      importInput)));

  panel.append(el("p", { class: "nut-note" }, "Favourites, notes and appearance are stored on this device only."));
  panel.append(el("p", { class: "nut-note", style: "margin-top:6px; font-family:var(--mono); letter-spacing:.04em;" }, `${SITE_NAME} v${APP_VERSION}`));
  setTimeout(() => { paint(); paintUnits(); }, 0);
}

// re-render whatever's on screen so unit changes show immediately
function reRenderForUnits() { route(); }

/* ---------- backup: export / import ---------- */
function collectData() {
  const data = { _mise: APP_VERSION, exportedAt: new Date().toISOString(), keys: {} };
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("mise:")) data.keys[k] = localStorage.getItem(k);
    }
  } catch (e) {}
  return data;
}
function exportData() {
  try {
    const blob = new Blob([JSON.stringify(collectData(), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = el("a", { href: url, download: `mise-backup-${new Date().toISOString().slice(0, 10)}.json` });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast("Backup downloaded");
  } catch (e) { toast("Couldn't export"); }
}
function importData(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      const keys = data && data.keys;
      if (!keys || typeof keys !== "object") throw new Error("bad file");
      // merge: favourites union; notes/others overwrite; keep existing where import absent
      Object.entries(keys).forEach(([k, v]) => {
        if (k === FAV_KEY) {
          try { const cur = new Set(getFavs()); JSON.parse(v).forEach(s => cur.add(s)); localStorage.setItem(k, JSON.stringify([...cur])); return; } catch (e) {}
        }
        try { localStorage.setItem(k, v); } catch (e) {}
      });
      applyTheme();
      toast("Backup restored");
      route();
    } catch (e) { toast("That file didn't look like a Mise backup"); }
  };
  reader.readAsText(file);
}

/* theme application (resolves "system") */
function applyTheme() {
  const pref = store.get(THEME_KEY, "system");
  const dark = pref === "dark" || (pref === "system" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", dark ? "#1b2a19" : "#33512f");
}
if (window.matchMedia) {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  (mq.addEventListener ? mq.addEventListener.bind(mq, "change") : mq.addListener.bind(mq))(() => { if (store.get(THEME_KEY, "system") === "system") applyTheme(); });
}
document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("settings-btn");
  if (btn) btn.addEventListener("click", openSettings);
});

/* ============================================================
   POPOVER positioning + dismissal
   ============================================================ */
function positionPopover(pop, anchor, compact) {
  const a = anchor.getBoundingClientRect();
  const pw = pop.offsetWidth, ph = pop.offsetHeight;
  let left = a.left;
  let top = a.bottom + 8;
  if (left + pw > window.innerWidth - 10) left = window.innerWidth - pw - 10;
  if (left < 10) left = 10;
  if (top + ph > window.innerHeight - 10) top = a.top - ph - 8; // flip above
  if (top < 10) top = 10;
  pop.style.left = left + "px";
  pop.style.top = top + "px";
}
function closePopovers() { document.querySelectorAll('[data-popover="1"]').forEach(p => p.remove()); }
document.addEventListener("click", (e) => {
  if (!e.target.closest) return;
  if (!e.target.isConnected) return;   // element removed during its own handler (in-UI re-render) — not an outside click
  const inPopover = e.target.closest('[data-popover="1"]');
  const isTrigger = e.target.closest(".iref") || e.target.closest("[data-poptrigger]");
  if (!inPopover && !isTrigger) closePopovers();
});
window.addEventListener("resize", closePopovers);

/* ============================================================
   TIMERS
   ============================================================ */
const activeTimers = new Set();
let audioCtx = null;
function ensureAudio() {
  if (!audioCtx) { const AC = window.AudioContext || window.webkitAudioContext; if (AC) audioCtx = new AC(); }
  if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
}
function beep(when = 0, freq = 880, dur = 0.16, gain = 0.28) {
  if (!audioCtx) return;
  const t = audioCtx.currentTime + when;
  const osc = audioCtx.createOscillator(), g = audioCtx.createGain();
  osc.type = "sine"; osc.frequency.value = freq;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(audioCtx.destination); osc.start(t); osc.stop(t + dur + 0.02);
}
function ringPattern() { beep(0, 880, 0.16); beep(0.22, 1174, 0.2); }
function fmt(s) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

/* ---------- copy unchecked ingredients ---------- */
function copyIngredients(listEl, title, btn) {
  const lines = [...listEl.querySelectorAll(".ing__row:not(.done):not(.removed)")]
    .map((r) => r.dataset.copy).filter(Boolean);
  if (!lines.length) { toast("Nothing to copy \u2014 all ticked off"); return; }
  const text = (title ? title + "\n" : "") + lines.join("\n");
  const done = () => toast(`Copied ${lines.length} item${lines.length > 1 ? "s" : ""}`);
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
  } else fallbackCopy(text, done);
}
function fallbackCopy(text, done) {
  try {
    const ta = document.createElement("textarea");
    ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.append(ta); ta.select();
    document.execCommand("copy"); ta.remove(); done();
  } catch (e) { toast("Couldn't copy automatically"); }
}
let toastTimer = null;
function toast(msg) {
  let t = document.getElementById("mise-toast");
  if (!t) { t = el("div", { id: "mise-toast", class: "toast" }); document.body.append(t); }
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2200);
}

/* ---------- cook mode (bigger text + keep screen awake) ---------- */
let wakeLock = null;
async function acquireWakeLock() {
  try { if ("wakeLock" in navigator) { wakeLock = await navigator.wakeLock.request("screen"); } } catch (e) { /* ignore */ }
}
function releaseWakeLock() { try { if (wakeLock) { wakeLock.release(); wakeLock = null; } } catch (e) {} }
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && document.body.classList.contains("cooking")) acquireWakeLock();
});
function toggleCookMode(page, on) {
  document.body.classList.toggle("cooking", on);
  if (on) {
    acquireWakeLock();
    if (!document.getElementById("cook-exit")) {
      const bar = el("div", { id: "cook-exit", class: "cook-exit" },
        el("span", {}, "Cook mode \u00b7 screen stays awake"),
        el("button", { class: "chipbtn", onclick: () => toggleCookMode(page, false) }, "Exit"));
      document.body.append(bar);
    }
  } else {
    releaseWakeLock();
    const bar = document.getElementById("cook-exit"); if (bar) bar.remove();
  }
}

/* ---------- share a recipe ---------- */
function recipeUrl(slug) {
  const base = location.href.split("#")[0];
  return `${base}#/r/${slug}`;
}
async function shareRecipe(r) {
  const url = recipeUrl(r.slug);
  const data = { title: r.title, text: `${r.title} \u2014 on Mise`, url };
  if (navigator.share) { try { await navigator.share(data); return; } catch (e) { if (e && e.name === "AbortError") return; } }
  const done = () => toast("Link copied");
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done).catch(() => fallbackCopy(url, done));
  else fallbackCopy(url, done);
}

/* ---------- install banner for people arriving via a shared link ---------- */
let deferredInstall = null;
window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferredInstall = e; });
function maybeShowInstallBanner() {
  if (store.get(INSTALL_DISMISS_KEY, false)) return;
  const standalone = window.matchMedia && window.matchMedia("(display-mode: standalone)").matches || navigator.standalone;
  if (standalone) return;
  if (document.getElementById("install-banner")) return;
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const action = el("button", { class: "chipbtn primary", onclick: async () => {
    if (deferredInstall) { deferredInstall.prompt(); try { await deferredInstall.userChoice; } catch (e) {} deferredInstall = null; dismiss(); }
    else toast(isIOS ? "Tap Share, then \u201CAdd to Home Screen\u201D" : "Use your browser menu \u2192 Install");
  } }, "Add to home screen");
  const dismiss = () => { store.set(INSTALL_DISMISS_KEY, true); const b = document.getElementById("install-banner"); if (b) b.remove(); };
  const banner = el("div", { id: "install-banner", class: "install-banner" },
    el("span", { class: "brand__mark", "aria-hidden": "true", html: '<svg viewBox="0 0 32 32" width="22" height="22"><rect width="32" height="32" rx="7" fill="#33512f"/><path d="M7 15h18v6a4 4 0 0 1-4 4H11a4 4 0 0 1-4-4z" fill="#f5f1e8"/><rect x="4" y="13" width="24" height="2.4" rx="1.2" fill="#f5f1e8"/></svg>' }),
    el("div", { class: "install-banner__txt" }, el("b", {}, "Install Mise"), el("span", {}, "Add it to your home screen for quick, offline access.")),
    action,
    el("button", { class: "install-banner__x", "aria-label": "Dismiss", onclick: dismiss }, "\u00D7"));
  document.body.append(banner);
}

function buildTimer(totalSeconds, label) {
  let remaining = totalSeconds, iv = null, ringIv = null, statusName = "idle";
  const readout = el("span", { class: "timer__readout" }, fmt(remaining));
  const labelEl = el("span", { class: "timer__label" }, label);
  const barFill = el("i");
  const bar = el("div", { class: "timer__bar" }, barFill);
  const primaryBtn = el("button", { class: "timer__btn primary", "aria-label": "Start timer", html: ICON.play });
  const resetBtn = el("button", { class: "timer__btn ghost", "aria-label": "Reset timer", html: ICON.reset, hidden: true });
  const card = el("div", { class: "timer__card" }, labelEl, readout, primaryBtn, resetBtn);
  const wrap = el("div", { class: "timer" }, card, bar);
  const paint = () => { readout.textContent = fmt(remaining); barFill.style.width = `${100 * (1 - remaining / totalSeconds)}%`; };
  const controller = { stop: () => hardStop() };
  function tick() { remaining -= 1; if (remaining <= 0) { remaining = 0; paint(); finish(); return; } paint(); }
  function start() { ensureAudio(); if (statusName === "done") reset(); if (statusName === "running") return; statusName = "running"; card.classList.remove("done"); card.classList.add("running"); primaryBtn.innerHTML = ICON.pause; primaryBtn.setAttribute("aria-label", "Pause timer"); resetBtn.hidden = false; iv = setInterval(tick, 1000); activeTimers.add(controller); }
  function pause() { statusName = "paused"; clearInterval(iv); iv = null; card.classList.remove("running"); primaryBtn.innerHTML = ICON.play; primaryBtn.setAttribute("aria-label", "Resume timer"); }
  function reset() { clearInterval(iv); iv = null; stopRinging(); remaining = totalSeconds; statusName = "idle"; card.classList.remove("running", "done"); labelEl.textContent = label; primaryBtn.innerHTML = ICON.play; primaryBtn.setAttribute("aria-label", "Start timer"); resetBtn.hidden = true; paint(); }
  function finish() { clearInterval(iv); iv = null; statusName = "done"; card.classList.remove("running"); card.classList.add("done"); primaryBtn.innerHTML = ICON.bell; primaryBtn.setAttribute("aria-label", "Stop alarm"); labelEl.textContent = `${label} \u2014 done`; if (navigator.vibrate) { try { navigator.vibrate([200, 120, 200]); } catch (e) {} } ringPattern(); ringIv = setInterval(ringPattern, 2000); }
  function stopRinging() { if (ringIv) { clearInterval(ringIv); ringIv = null; } }
  function hardStop() { clearInterval(iv); iv = null; stopRinging(); activeTimers.delete(controller); }
  primaryBtn.addEventListener("click", () => { if (statusName === "running") pause(); else if (statusName === "done") reset(); else start(); });
  resetBtn.addEventListener("click", () => reset());
  paint();
  return wrap;
}
function stopAllTimers() { for (const t of Array.from(activeTimers)) t.stop(); activeTimers.clear(); }
