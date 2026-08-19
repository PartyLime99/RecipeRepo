/* ============================================================
   The Pantry — app.js  (vanilla JS, no build step)
   ============================================================ */
"use strict";

const view = document.getElementById("view");
const RECIPES_DIR = "recipes";

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

/* icons (inline SVG strings) */
const ICON = {
  search: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg>',
  back:   '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
  check:  '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 6"/></svg>',
  play:   '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l11-6.5z"/></svg>',
  pause:  '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6.5" y="5.5" width="4" height="13" rx="1"/><rect x="13.5" y="5.5" width="4" height="13" rx="1"/></svg>',
  reset:  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v4h4"/></svg>',
  bell:   '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 22a2.4 2.4 0 0 0 2.3-1.8H9.7A2.4 2.4 0 0 0 12 22zm7-5-1.6-1.7V10a5.4 5.4 0 0 0-4-5.2V4a1.4 1.4 0 0 0-2.8 0v.8A5.4 5.4 0 0 0 6.6 10v5.3L5 17a.9.9 0 0 0 .7 1.5h12.6A.9.9 0 0 0 19 17z"/></svg>',
};

/* ---------- amount formatting + scaling ---------- */
const FRACTION_UNITS = new Set(["", "tsp", "tbsp", "cup", "cups", "clove", "cloves", "pinch", "can", "cans", "slice", "slices", "handful", "sprig", "sprigs"]);
const FRAC_TABLE = [[0.125, "\u215B"], [0.25, "\u00BC"], [0.333, "\u2153"], [0.5, "\u00BD"], [0.667, "\u2154"], [0.75, "\u00BE"], [0.875, "\u215E"]];

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
  for (const [v, glyph] of FRAC_TABLE) {
    const d = Math.abs(v - frac);
    if (d < bestDiff) { best = glyph; bestDiff = d; }
  }
  if (best) return (whole > 0 ? whole : "") + best;
  return String(round(value, 2));
}
const round = (n, dp) => { const f = 10 ** dp; return Math.round(n * f) / f; };

/* ---------- data loading ---------- */
async function loadManifest() {
  const res = await fetch(`${RECIPES_DIR}/index.json`, { cache: "no-cache" });
  if (!res.ok) throw new Error(`index.json ${res.status}`);
  return res.json();
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
  const hash = location.hash.replace(/^#\/?/, "");
  const [section, slug] = hash.split("/");
  if (section === "r" && slug) {
    document.body.className = "route-recipe";
    renderRecipePage(decodeURIComponent(slug));
  } else {
    document.body.className = "route-list";
    renderListPage();
  }
  try { view.scrollTop = 0; window.scrollTo(0, 0); } catch (e) {}
}

/* ============================================================
   LIST PAGE
   ============================================================ */
let LIST_STATE = { recipes: [], query: "", tag: null };

async function renderListPage() {
  clear(view);
  const wrap = el("section", { class: "list" });
  wrap.append(
    el("div", { class: "list__intro" },
      el("p", { class: "eyebrow" }, "The Pantry"),
      el("h1", { class: "list__title" }, "What are we cooking?"),
      el("p", { class: "list__lede" }, "A personal collection \u2014 every recipe scales to any number of people and runs its own step timers while you cook.")
    )
  );
  const controls = el("div", { class: "controls" });
  const grid = el("div", { class: "grid" });
  wrap.append(controls, grid);
  view.append(wrap);

  for (let i = 0; i < 3; i++) {
    grid.append(el("div", { class: "card skeleton" },
      el("div", { class: "card__media" }),
      el("div", { class: "card__body" },
        el("div", { class: "sk-line" }),
        el("div", { class: "sk-line short" }))));
  }

  let slugs;
  try {
    slugs = await loadManifest();
  } catch (e) {
    clear(grid);
    grid.append(el("p", { class: "empty" },
      el("strong", {}, "Couldn't load the recipe list. "),
      "If you're opening this file directly, run it through a local server (see the README) \u2014 browsers block fetch on file:// pages."));
    return;
  }

  const results = await Promise.allSettled(slugs.map(loadRecipe));
  const recipes = results.filter(r => r.status === "fulfilled").map(r => r.value);
  LIST_STATE.recipes = recipes;

  clear(controls);
  buildControls(controls, grid);
  renderCards(grid);
}

function buildControls(controls, grid) {
  const search = el("div", { class: "search" },
    el("span", { html: ICON.search }),
    el("input", {
      type: "search", placeholder: "Search recipes\u2026", "aria-label": "Search recipes",
      value: LIST_STATE.query,
      oninput: (e) => { LIST_STATE.query = e.target.value.trim().toLowerCase(); renderCards(grid); }
    })
  );
  const tags = [...new Set(LIST_STATE.recipes.flatMap(r => r.tags || []))].sort();
  const tagbar = el("div", { class: "tagbar" });
  const mkTagBtn = (label, value) => el("button", {
    "aria-pressed": (LIST_STATE.tag === value) ? "true" : "false",
    onclick: () => { LIST_STATE.tag = (LIST_STATE.tag === value) ? null : value; buildControls(controls, grid); renderCards(grid); }
  }, label);
  tagbar.append(mkTagBtn("All", null));
  tags.forEach(t => tagbar.append(mkTagBtn(t, t)));

  clear(controls);
  controls.append(search, tagbar);
}

function renderCards(grid) {
  clear(grid);
  let list = LIST_STATE.recipes.slice();
  if (LIST_STATE.tag) list = list.filter(r => (r.tags || []).includes(LIST_STATE.tag));
  if (LIST_STATE.query) {
    const q = LIST_STATE.query;
    list = list.filter(r =>
      r.title.toLowerCase().includes(q) ||
      (r.description || "").toLowerCase().includes(q) ||
      (r.tags || []).some(t => t.toLowerCase().includes(q)) ||
      (r.ingredients || []).some(i => (i.item || "").toLowerCase().includes(q))
    );
  }
  if (!list.length) {
    grid.append(el("p", { class: "empty" }, el("strong", {}, "Nothing here yet. "), "Try a different search."));
    return;
  }
  list.sort((a, b) => a.title.localeCompare(b.title));
  list.forEach(r => grid.append(recipeCard(r)));
}

function recipeCard(r) {
  const media = el("div", { class: "card__media" });
  if (r.image) {
    media.append(el("img", { src: r.image, alt: "", loading: "lazy",
      onerror: (e) => { e.target.remove(); media.append(placeholder(r.title)); } }));
  } else {
    media.append(placeholder(r.title));
  }
  if (r.totalTime) media.append(el("span", { class: "card__time" }, `${r.totalTime} min`));

  return el("a", { class: "card", href: `#/r/${r.slug}` },
    media,
    el("div", { class: "card__body" },
      el("h2", { class: "card__title" }, r.title),
      r.description ? el("p", { class: "card__desc" }, truncate(r.description, 96)) : null,
      (r.tags && r.tags.length) ? el("div", { class: "card__tags" },
        r.tags.slice(0, 3).map(t => el("span", { class: "chip" }, t))) : null
    )
  );
}
const placeholder = (title) => el("div", { class: "card__placeholder" }, (title || "?").trim()[0].toUpperCase());
const truncate = (s, n) => s.length > n ? s.slice(0, n - 1).trimEnd() + "\u2026" : s;

/* ============================================================
   RECIPE PAGE
   ============================================================ */
async function renderRecipePage(slug) {
  clear(view);
  view.append(el("p", { class: "loading-msg" }, "Loading recipe\u2026"));

  let r;
  try {
    r = await loadRecipe(slug);
  } catch (e) {
    clear(view);
    view.append(el("section", { class: "list" },
      el("p", { class: "empty" },
        el("strong", {}, "Recipe not found. "),
        "It may not be listed in recipes/index.json yet."),
      el("p", { style: "text-align:center" }, el("a", { class: "backlink", href: "#/" },
        el("span", { html: ICON.back }), "Back to all recipes"))));
    return;
  }

  document.title = `${r.title} \u2014 The Pantry`;
  const base = Number(r.servings) || 1;
  const state = { servings: base, base, noun: r.servingsNoun || "servings" };

  clear(view);
  const page = el("section", { class: "recipe" });

  /* ---- top block (title, meta, servings) ---- */
  const valueEl = el("span", { class: "scaler__value" }, String(state.servings));
  const minusBtn = el("button", { class: "scaler__btn", "aria-label": "Fewer servings" }, "\u2013");
  const plusBtn  = el("button", { class: "scaler__btn", "aria-label": "More servings" }, "+");
  const resetBtn = el("button", { class: "scaler__reset", hidden: true }, "reset");

  const ingList = el("ul", { class: "ing" });

  const setServings = (n) => {
    state.servings = Math.max(1, Math.min(50, n));
    valueEl.textContent = String(state.servings);
    minusBtn.disabled = state.servings <= 1;
    resetBtn.hidden = state.servings === state.base;
    renderIngredients(ingList, r, state);
  };
  minusBtn.addEventListener("click", () => setServings(state.servings - 1));
  plusBtn.addEventListener("click", () => setServings(state.servings + 1));
  resetBtn.addEventListener("click", () => setServings(state.base));

  const scaler = el("div", { class: "scaler", role: "group", "aria-label": "Scale servings" },
    el("span", { class: "scaler__label" }, "Serves"),
    minusBtn, valueEl, plusBtn,
    el("span", { class: "scaler__noun" }, state.noun),
    resetBtn
  );

  const meta = el("div", { class: "meta" });
  const addMeta = (label, val) => { if (val) meta.append(el("span", { class: "meta__item" }, `${label} `, el("b", {}, String(val)))); };
  addMeta("Prep", r.prepTime && `${r.prepTime} min`);
  addMeta("Cook", r.cookTime && `${r.cookTime} min`);
  addMeta("Total", r.totalTime && `${r.totalTime} min`);
  if (r.cuisine) addMeta("Cuisine", r.cuisine);
  if (r.source && r.source.url) {
    meta.append(el("span", { class: "meta__item meta__src" }, "Source ",
      el("a", { href: r.source.url, target: "_blank", rel: "noopener" }, r.source.name || "original")));
  }

  const top = el("div", { class: "recipe__top" },
    el("div", { class: "recipe__topinner" },
      el("a", { class: "backlink", href: "#/" }, el("span", { html: ICON.back }), "All recipes"),
      el("div", { class: "recipe__headrow" },
        el("div", { class: "recipe__heading" },
          el("h1", { class: "recipe__title" }, r.title),
          r.subtitle ? el("p", { class: "recipe__subtitle" }, r.subtitle) : null,
          meta
        ),
        scaler
      )
    )
  );

  /* ---- two panes ---- */
  const ingPane = el("div", { class: "pane pane--ingredients" },
    el("h2", { class: "pane__title", id: "ingredients-heading" }, "Ingredients"),
    r.image ? el("img", { class: "recipe__hero", src: r.image, alt: "", loading: "lazy",
      onerror: (e) => e.target.remove() }) : null,
    ingList
  );

  const stepsList = el("ol", { class: "steps" });
  (r.steps || []).forEach((s, i) => stepsList.append(stepRow(s, i)));
  const methodPane = el("div", { class: "pane pane--method" },
    el("h2", { class: "pane__title" }, "Method"),
    stepsList
  );

  const cook = el("div", { class: "cook" }, ingPane, methodPane);
  page.append(top, cook);
  view.append(page);

  setServings(state.servings);

  /* ---- notes + nutrition ---- */
  if ((r.notes && r.notes.length) || r.nutrition) {
    const extra = el("div", { class: "extra" });
    const notes = el("div", { class: "notes" });
    if (r.notes && r.notes.length) {
      notes.append(el("h3", {}, "Notes"),
        el("ul", {}, r.notes.map(n => el("li", {}, n))));
    }
    if (r.nutrition) {
      const nut = el("div", { class: "nutrition" });
      if (r.nutrition.note) nut.append(el("span", { class: "nut-note" }, r.nutrition.note));
      for (const [k, v] of Object.entries(r.nutrition)) {
        if (k === "note") continue;
        nut.append(el("span", {}, `${k}: `, el("b", {}, String(v))));
      }
      notes.append(nut);
    }
    extra.append(notes);
    if (window.matchMedia && window.matchMedia("(min-width: 900px)").matches) methodPane.append(extra);
    else page.append(extra);
  }
}

/* ---------- ingredients (re-rendered on scale) ---------- */
function renderIngredients(listEl, recipe, state) {
  clear(listEl);
  const factor = state.servings / state.base;
  const scaled = Math.abs(factor - 1) > 1e-9;
  let lastGroup = undefined;

  (recipe.ingredients || []).forEach((ing) => {
    if (ing.group && ing.group !== lastGroup) {
      lastGroup = ing.group;
      listEl.append(el("li", { class: "ing__group" }, ing.group));
    }
    const amt = (ing.amount != null) ? formatAmount(ing.amount * factor, ing.unit) : "";
    let amountText = amt;
    if (amt && ing.unit) {
      const tight = ["g", "kg", "ml", "l"].includes(ing.unit.toLowerCase());
      amountText = tight ? `${amt}${ing.unit}` : `${amt} ${ing.unit}`;
    }

    const row = el("li", { class: "ing__row", role: "button", tabindex: "0" });
    const toggle = () => row.classList.toggle("done");
    row.addEventListener("click", toggle);
    row.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } });

    row.append(
      el("span", { class: "ing__check", "aria-hidden": "true", html: ICON.check }),
      el("span", { class: "ing__amount" }, amountText || "\u00A0"),
      el("span", { class: "ing__item" }, ing.item),
      ing.note ? el("span", { class: "ing__note" }, ing.note) : null
    );
    listEl.append(row);
  });

  const heading = document.getElementById("ingredients-heading");
  if (heading) {
    const old = heading.querySelector(".scaled-flag");
    if (old) old.remove();
    if (scaled) heading.append(el("span", { class: "scaled-flag" }, `\u00D7 ${round(factor, 2)}`));
  }
}

/* ---------- a method step (may carry a timer) ---------- */
function stepRow(step, index) {
  const body = el("div", { class: "step__body" },
    el("p", { class: "step__text" }, step.text || step.instruction || ""));
  if (step.timer) {
    const seconds = (Number(step.timer.minutes) || 0) * 60 + (Number(step.timer.seconds) || 0);
    if (seconds > 0) body.append(buildTimer(seconds, step.timer.label || `Step ${index + 1}`));
  }
  return el("li", { class: "step" },
    el("span", { class: "step__num" }, String(index + 1)),
    body);
}

/* ============================================================
   TIMERS
   ============================================================ */
const activeTimers = new Set();
let audioCtx = null;

function ensureAudio() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) audioCtx = new AC();
  }
  if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
}
function beep(when = 0, freq = 880, dur = 0.16, gain = 0.28) {
  if (!audioCtx) return;
  const t = audioCtx.currentTime + when;
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(audioCtx.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}
function ringPattern() { beep(0, 880, 0.16); beep(0.22, 1174, 0.2); }

function fmt(s) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function buildTimer(totalSeconds, label) {
  let remaining = totalSeconds;
  let iv = null, ringIv = null, statusName = "idle";

  const readout = el("span", { class: "timer__readout" }, fmt(remaining));
  const labelEl = el("span", { class: "timer__label" }, label);
  const barFill = el("i");
  const bar = el("div", { class: "timer__bar" }, barFill);

  const primaryBtn = el("button", { class: "timer__btn primary", "aria-label": "Start timer", html: ICON.play });
  const resetBtn = el("button", { class: "timer__btn ghost", "aria-label": "Reset timer", html: ICON.reset, hidden: true });

  const card = el("div", { class: "timer__card" }, labelEl, readout, primaryBtn, resetBtn);
  const wrap = el("div", { class: "timer" }, card, bar);

  const paint = () => {
    readout.textContent = fmt(remaining);
    barFill.style.width = `${100 * (1 - remaining / totalSeconds)}%`;
  };
  const controller = { stop: () => hardStop() };

  function tick() {
    remaining -= 1;
    if (remaining <= 0) { remaining = 0; paint(); finish(); return; }
    paint();
  }
  function start() {
    ensureAudio();
    if (statusName === "done") reset();
    if (statusName === "running") return;
    statusName = "running";
    card.classList.remove("done"); card.classList.add("running");
    primaryBtn.innerHTML = ICON.pause; primaryBtn.setAttribute("aria-label", "Pause timer");
    resetBtn.hidden = false;
    iv = setInterval(tick, 1000);
    activeTimers.add(controller);
  }
  function pause() {
    statusName = "paused";
    clearInterval(iv); iv = null;
    card.classList.remove("running");
    primaryBtn.innerHTML = ICON.play; primaryBtn.setAttribute("aria-label", "Resume timer");
  }
  function reset() {
    clearInterval(iv); iv = null; stopRinging();
    remaining = totalSeconds; statusName = "idle";
    card.classList.remove("running", "done");
    labelEl.textContent = label;
    primaryBtn.innerHTML = ICON.play; primaryBtn.setAttribute("aria-label", "Start timer");
    resetBtn.hidden = true;
    paint();
  }
  function finish() {
    clearInterval(iv); iv = null;
    statusName = "done";
    card.classList.remove("running"); card.classList.add("done");
    primaryBtn.innerHTML = ICON.bell; primaryBtn.setAttribute("aria-label", "Stop alarm");
    labelEl.textContent = `${label} \u2014 done`;
    if (navigator.vibrate) { try { navigator.vibrate([200, 120, 200]); } catch (e) {} }
    ringPattern();
    ringIv = setInterval(ringPattern, 2000);
  }
  function stopRinging() { if (ringIv) { clearInterval(ringIv); ringIv = null; } }
  function hardStop() { clearInterval(iv); iv = null; stopRinging(); activeTimers.delete(controller); }

  primaryBtn.addEventListener("click", () => {
    if (statusName === "running") pause();
    else if (statusName === "done") reset();
    else start();
  });
  resetBtn.addEventListener("click", () => reset());

  paint();
  return wrap;
}

function stopAllTimers() {
  for (const t of Array.from(activeTimers)) t.stop();
  activeTimers.clear();
}
