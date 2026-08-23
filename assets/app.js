/* ============================================================
   Mise — app.js  (vanilla JS, no build step)
   ============================================================ */
"use strict";

const view = document.getElementById("view");
const RECIPES_DIR = "recipes";
const SITE_NAME = "Mise";
const APP_VERSION = "1.6.0";

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

async function listRecipesViaGitHub(repo) {
  const url = `https://api.github.com/repos/${repo.owner}/${repo.repo}/contents/${RECIPES_DIR}`;
  const res = await fetch(url, { headers: { Accept: "application/vnd.github+json" } });
  if (!res.ok) throw new Error(`github ${res.status}`);
  const items = await res.json();
  if (!Array.isArray(items)) throw new Error("github: unexpected response");
  return items
    .filter((f) => f.type === "file" && /\.json$/i.test(f.name) && f.name.toLowerCase() !== "index.json")
    .map((f) => f.name.replace(/\.json$/i, ""))
    .sort();
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
const noteKey = (slug) => `mise:note:${slug}`;

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
  if (FRACTION_UNITS.has((unit || "").toLowerCase())) return toFraction(value);
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
function amountText(ing, factor) {
  if (ing.amount == null) return "";
  const amt = formatAmount(ing.amount * factor, ing.unit);
  if (!amt) return "";
  if (ing.unit) {
    const tight = ["g", "kg", "ml", "l"].includes(ing.unit.toLowerCase());
    return tight ? `${amt}${ing.unit}` : `${amt} ${ing.unit}`;
  }
  return amt;
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
  const hash = location.hash.replace(/^#\/?/, "");
  const parts = hash.split("/");
  if (parts[0] === "r" && parts[1]) {
    document.body.className = "route-recipe";
    renderRecipePage(decodeURIComponent(parts[1]), parts[2] ? decodeURIComponent(parts[2]) : undefined);
  } else {
    document.body.className = "route-list";
    renderListPage();
  }
  try { view.scrollTop = 0; if (window.scrollTo) window.scrollTo(0, 0); } catch (e) {}
}

/* ============================================================
   LIST PAGE
   ============================================================ */
let LIST_STATE = { recipes: [], query: "", diets: new Set(), favOnly: false, inc: new Set(), exc: new Set() };

async function renderListPage() {
  clear(view);
  const wrap = el("section", { class: "list" });
  wrap.append(el("div", { class: "list__intro" },
    el("p", { class: "eyebrow" }, SITE_NAME),
    el("h1", { class: "list__title" }, "What are we cooking?"),
    el("p", { class: "list__lede" }, "A personal collection \u2014 every recipe scales to any number of people, adapts to diets, and runs its own step timers while you cook.")
  ));
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

  const row1 = el("div", { class: "controls__row" }, search, favBtn);

  // diet chips (derived from all recipes)
  const allDiets = [...new Set(LIST_STATE.recipes.flatMap(recipeDiets))].sort();
  const filterbar = el("div", { class: "filterbar" });
  allDiets.forEach((d) => {
    const on = LIST_STATE.diets.has(d);
    filterbar.append(el("button", { class: "pill", "aria-pressed": String(on),
      onclick: () => { on ? LIST_STATE.diets.delete(d) : LIST_STATE.diets.add(d); buildControls(controls, grid); renderCards(grid); } },
      dietLabel(d)));
  });

  const incN = LIST_STATE.inc.size, excN = LIST_STATE.exc.size;
  const ingBtn = el("button", { class: "pill" + ((incN + excN) ? " active" : ""), "data-poptrigger": "1",
    onclick: (e) => openIngredientFilter(e.currentTarget, controls, grid) },
    "Ingredients", (incN + excN) ? el("span", { class: "count" }, `${incN + excN}`) : null);
  filterbar.append(ingBtn);

  if (LIST_STATE.diets.size || incN || excN || LIST_STATE.favOnly || LIST_STATE.query) {
    filterbar.append(el("button", { class: "filter-clear",
      onclick: () => { LIST_STATE = { recipes: LIST_STATE.recipes, query: "", diets: new Set(), favOnly: false, inc: new Set(), exc: new Set() }; buildControls(controls, grid); renderCards(grid); } },
      "Clear all"));
  }

  controls.append(row1, filterbar);
}

/* choose the best matching mode for a recipe under current filters.
   returns { ok, modeId } — ok=false means it doesn't match. */
function matchRecipe(recipe) {
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
  list.sort((a, b) => a.r.title.localeCompare(b.r.title));
  list.forEach(({ r, modeId }) => grid.append(recipeCard(r, modeId)));
}

function recipeCard(r, modeId) {
  const media = el("div", { class: "card__media" });
  if (r.image) media.append(el("img", { src: r.image, alt: "", loading: "lazy",
    onerror: (e) => { e.target.remove(); media.append(placeholder(r.title)); } }));
  else media.append(placeholder(r.title));
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
const placeholder = (title) => el("div", { class: "card__placeholder" }, (title || "?").trim()[0].toUpperCase());
const truncate = (s, n) => s.length > n ? s.slice(0, n - 1).trimEnd() + "\u2026" : s;

/* ---------- ingredient include/exclude filter popover ---------- */
function openIngredientFilter(anchor, controls, grid) {
  closePopovers();
  const allItems = [...new Set(LIST_STATE.recipes.flatMap(r => (r.ingredients || []).map(i => (i.item || "").toLowerCase())))].filter(Boolean).sort();
  let q = "";

  const listEl = el("div", { class: "ingfilter__list" });
  const renderRows = () => {
    clear(listEl);
    allItems.filter(it => it.includes(q)).slice(0, 200).forEach((it) => {
      const state = LIST_STATE.inc.has(it) ? "inc" : LIST_STATE.exc.has(it) ? "exc" : "";
      const row = el("div", { class: "ingfilter__row" + (state ? " " + state : ""),
        onclick: () => {
          // cycle: none -> include -> exclude -> none
          if (LIST_STATE.inc.has(it)) { LIST_STATE.inc.delete(it); LIST_STATE.exc.add(it); }
          else if (LIST_STATE.exc.has(it)) { LIST_STATE.exc.delete(it); }
          else { LIST_STATE.inc.add(it); }
          renderRows(); renderCards(grid); buildControls(controls, grid);
        } },
        el("span", {}, it),
        el("span", { class: "ingfilter__state" }, LIST_STATE.inc.has(it) ? "WITH" : LIST_STATE.exc.has(it) ? "WITHOUT" : "\u00B7"));
      listEl.append(row);
    });
  };

  const pop = el("div", { class: "ingfilter", "data-popover": "1" },
    el("h4", {}, "Filter by ingredient"),
    el("p", { class: "hint" }, "Tap to cycle: with \u2192 without \u2192 off."),
    el("div", { class: "ingfilter__search" },
      el("input", { type: "search", placeholder: "Find an ingredient\u2026", oninput: (e) => { q = e.target.value.trim().toLowerCase(); renderRows(); } })),
    listEl
  );
  renderRows();
  document.body.append(pop);
  positionPopover(pop, anchor);
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
      el("a", { class: "backlink", href: "#/" }, el("span", { html: ICON.back }), "All recipes"),
      el("div", { class: "recipe__headrow" },
        el("div", { class: "recipe__heading" },
          el("h1", { class: "recipe__title" }, r.title),
          collapsible),
        actions)));

  /* ---- panes ---- */
  const ingHead = el("div", { class: "pane__head" },
    el("h2", { class: "pane__title", id: "ingredients-heading" }, "Ingredients"));
  const ingBody = el("div", { class: "pane__body" }, ingList);
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
  let natural = 0, lastT = 0, ticking = false;
  const measure = () => {
    const prev = collapsible.style.height;
    collapsible.style.height = "auto";
    natural = collapsible.scrollHeight || 0;
    collapsible.style.height = prev || (natural + "px");
  };
  const apply = (t) => {
    lastT = t;
    page.style.setProperty("--collapse", t.toFixed(3));
    collapsible.style.height = (natural * (1 - t)) + "px";
    collapsible.style.opacity = String(1 - t);
    collapsible.style.pointerEvents = t > 0.6 ? "none" : "";
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
    const row = el("li", { class: "ing__row", role: "button", tabindex: "0" },
      el("span", { class: "ing__check", "aria-hidden": "true", html: ICON.check }),
      el("span", { class: "ing__amount" }, amt || "\u00A0"),
      el("span", { class: "ing__item" }, ing.item, ing._swapped ? el("span", { class: "ing__swap", title: `was ${ing._original}` }, "swap") : null),
      note ? el("span", { class: "ing__note" }, note) : null
    );
    row.dataset.copy = (amt ? amt + " " : "") + ing.item;
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
  const note = cleanNote(ing.note);
  const pop = el("div", { class: "popover", "data-popover": "1" },
    amt ? el("div", { class: "pop-amt" }, amt) : el("div", { class: "pop-amt" }, "to taste"),
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

  panel.append(el("p", { class: "nut-note" }, "Favourites, notes and appearance are stored on this device only."));
  panel.append(el("p", { class: "nut-note", style: "margin-top:6px; font-family:var(--mono); letter-spacing:.04em;" }, `${SITE_NAME} v${APP_VERSION}`));
  setTimeout(paint, 0);
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
  const text = (title ? title + "\n" : "") + lines.map((l) => "\u2610 " + l).join("\n");
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
