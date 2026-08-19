/* ============================================================
   Mise — recipe box
   Vanilla JS. No build step. Hash-routed so it works on GitHub Pages.
   ============================================================ */

const SITE_NAME = "Mise"; // ← rename your collection here (and the <title> in index.html)

const app = document.getElementById("app");
const dockEl = document.getElementById("timer-dock");

/* ---------- small helpers ---------- */
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );

function formatTime(s) {
  s = Math.max(0, Math.round(s));
  const h = Math.floor(s / 3600),
    m = Math.floor((s % 3600) / 60),
    sec = s % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return h ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

// Turn a scaled number into a cook-friendly string with common fractions.
function formatQuantity(value) {
  if (value == null) return "";
  const rounded = Math.round(value * 1000) / 1000;
  let whole = Math.floor(rounded + 1e-9);
  const frac = rounded - whole;
  const table = [
    [0, ""], [1 / 8, "⅛"], [1 / 4, "¼"], [1 / 3, "⅓"], [3 / 8, "⅜"],
    [1 / 2, "½"], [5 / 8, "⅝"], [2 / 3, "⅔"], [3 / 4, "¾"], [7 / 8, "⅞"], [1, ""],
  ];
  let best = table[0], bestDiff = Infinity;
  for (const t of table) {
    const d = Math.abs(frac - t[0]);
    if (d < bestDiff) { bestDiff = d; best = t; }
  }
  if (bestDiff <= 0.05) {
    let sym = best[1];
    if (best[0] === 1) { whole += 1; sym = ""; }
    if (whole === 0 && sym) return sym;
    if (sym) return whole + sym;
    return String(whole);
  }
  return String(Math.round(value * 100) / 100);
}

async function fetchJSON(url) {
  const res = await fetch(url, { cache: "no-cache" });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

/* ============================================================
   Router
   ============================================================ */
const recipeCache = {};
let allRecipes = null; // [{slug, data}] for the home grid

function parseHash() {
  const h = location.hash.replace(/^#\/?/, "");
  const parts = h.split("/").filter(Boolean);
  if (parts[0] === "recipe" && parts[1])
    return { name: "recipe", slug: decodeURIComponent(parts[1]) };
  return { name: "home" };
}

async function route() {
  clearAllTimers(); // timers belong to a recipe view; leaving cancels them
  window.scrollTo(0, 0);
  const r = parseHash();
  if (r.name === "recipe") await renderRecipe(r.slug);
  else await renderHome();
}

window.addEventListener("hashchange", route);
window.addEventListener("DOMContentLoaded", route);

/* ============================================================
   HOME
   ============================================================ */
function topbar(extra = "") {
  return `<header class="topbar">
    <a class="brand" href="#/">${esc(SITE_NAME)}<span class="dot">.</span></a>
    ${extra}
  </header>`;
}

function loadingScreen() {
  app.innerHTML = `${topbar()}<div class="status"><div class="spinner"></div><p>Loading…</p></div>`;
}

async function renderHome() {
  document.title = `${SITE_NAME} · Recipe Box`;
  loadingScreen();

  let manifest;
  try {
    manifest = await fetchJSON("recipes/index.json");
  } catch (err) {
    app.innerHTML = `${topbar()}<div class="status">
      <h2>Couldn't load the recipe list</h2>
      <p>The app needs to be served over http(s), not opened as a file. Publish it with GitHub Pages, or run <code>python3 -m http.server</code> in this folder and open the address it prints.</p>
    </div>`;
    return;
  }

  const slugs = (manifest.recipes || []).slice();
  const results = await Promise.allSettled(
    slugs.map((slug) => getRecipe(slug).then((data) => ({ slug, data })))
  );
  allRecipes = results
    .filter((r) => r.status === "fulfilled")
    .map((r) => r.value);

  app.innerHTML = `${topbar()}
    <main class="home"><div class="home__inner">
      <div class="hero">
        <p class="hero__eyebrow">Everything in its place</p>
        <h1 class="hero__title">The recipe box.</h1>
        <p class="hero__lede">Cook from any screen — with step timers running as you go and ingredients that scale to the table.</p>
        <label class="searchbar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
          <input id="search" type="search" placeholder="Search recipes, tags…" autocomplete="off" aria-label="Search recipes" />
        </label>
      </div>
      <p class="count" id="count"></p>
      <div class="grid" id="grid"></div>
    </div></main>`;

  const search = document.getElementById("search");
  search.addEventListener("input", () => renderGrid(search.value.trim().toLowerCase()));
  renderGrid("");
}

function renderGrid(filter) {
  const grid = document.getElementById("grid");
  const count = document.getElementById("count");
  if (!grid) return;

  const list = allRecipes.filter(({ data }) => {
    if (!filter) return true;
    const hay = [data.title, data.description, ...(data.tags || [])]
      .join(" ")
      .toLowerCase();
    return hay.includes(filter);
  });

  count.textContent = list.length
    ? `${list.length} recipe${list.length === 1 ? "" : "s"}`
    : "";

  if (!list.length) {
    grid.innerHTML = `<div class="empty-state"><h2>Nothing here yet</h2><p>${
      allRecipes.length ? "No recipes match that search." : "Add a recipe file to <code>recipes/</code> to get started."
    }</p></div>`;
    return;
  }

  grid.innerHTML = list.map(({ slug, data }) => card(slug, data)).join("");
}

function card(slug, r) {
  const time = r.times?.total ? `${esc(r.times.total)}` : "";
  const media = r.image
    ? `<div class="card__media"><img src="${esc(r.image)}" alt="" loading="lazy" onerror="this.parentNode.classList.add('card__media--empty');this.parentNode.innerHTML='<span>${esc((r.title||'?')[0])}</span>'" />${time ? `<span class="card__time">${time}</span>` : ""}</div>`
    : `<div class="card__media card__media--empty"><span>${esc((r.title || "?")[0])}</span></div>`;
  const tags = (r.tags || []).slice(0, 3).map((t) => `<span class="tag">${esc(t)}</span>`).join("");
  return `<a class="card" href="#/recipe/${encodeURIComponent(slug)}">
    ${media}
    <div class="card__body">
      <h2 class="card__title">${esc(r.title)}</h2>
      ${r.description ? `<p class="card__desc">${esc(r.description)}</p>` : ""}
      <div class="card__tags">${tags}</div>
    </div>
  </a>`;
}

async function getRecipe(slug) {
  if (recipeCache[slug]) return recipeCache[slug];
  const data = await fetchJSON(`recipes/${slug}.json`);
  recipeCache[slug] = data;
  return data;
}

/* ============================================================
   RECIPE
   ============================================================ */
let current = null; // { recipe, servings }

async function renderRecipe(slug) {
  loadingScreen();
  let r;
  try {
    r = await getRecipe(slug);
  } catch (err) {
    app.innerHTML = `${topbar(backLink())}<div class="status">
      <h2>Recipe not found</h2>
      <p>Couldn't load <code>recipes/${esc(slug)}.json</code>.</p>
    </div>`;
    return;
  }

  document.title = `${r.title} · ${SITE_NAME}`;
  current = { recipe: r, servings: r.servings || 1 };
  const noun = r.servingNoun || "servings";

  const meta = [];
  if (r.times?.total) meta.push(metaItem("Total", r.times.total));
  if (r.times?.prep) meta.push(metaItem("Prep", r.times.prep));
  if (r.times?.cook) meta.push(metaItem("Cook", r.times.cook));
  if (r.source?.url)
    meta.push(`<span class="recipe-meta__item">Source: <a href="${esc(r.source.url)}" target="_blank" rel="noopener">${esc(r.source.name || "link")}</a></span>`);

  app.innerHTML = `
  <div class="screen screen--recipe">
    ${topbar(backLink())}
    <div class="recipe-head"><div class="recipe-head__inner">
      <h1 class="recipe-title">${esc(r.title)}</h1>
      ${r.subtitle ? `<p class="recipe-sub">${esc(r.subtitle)}</p>` : ""}
      <div class="recipe-meta">${meta.join('<span class="dotsep">·</span>')}</div>
    </div></div>

    <div class="panes">
      <aside class="pane pane--ingredients"><div class="pane__inner">
        <div class="pane__sticky">
          <div class="pane__head">
            <h2 class="pane__title">Ingredients</h2>
            <div class="servings">
              <span class="servings__label">${esc(noun)}</span>
              <div class="stepper">
                <button data-action="serv-dec" aria-label="Fewer ${esc(noun)}">–</button>
                <span class="stepper__value" id="serv-value">${current.servings}</span>
                <button data-action="serv-inc" aria-label="More ${esc(noun)}">+</button>
              </div>
            </div>
          </div>
          <p class="scaled-note" id="scaled-note"></p>
        </div>
        <ul class="ing-list" id="ing-list">
          ${r.ingredients.map((ing, i) => ingredientRow(ing, i)).join("")}
        </ul>
      </div></aside>

      <main class="pane pane--method"><div class="pane__inner">
        <div class="pane__sticky"><div class="pane__head">
          <h2 class="pane__title">Method</h2>
        </div></div>
        <ol class="steps" id="steps">
          ${r.steps.map((s, i) => stepRow(s, i)).join("")}
        </ol>
      </div></main>
    </div>
  </div>`;

  updateAmounts();
}

function backLink() {
  return `<a class="back" href="#/">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>
    All recipes
  </a>`;
}

function metaItem(label, value) {
  return `<span class="recipe-meta__item">${esc(label)} <b>${esc(value)}</b></span>`;
}

function ingredientRow(ing, i) {
  const hasQty = ing.quantity != null;
  return `<li class="ing" data-i="${i}">
    <input class="ing__check" type="checkbox" aria-label="Mark ${esc(ing.item)}" />
    <span class="ing__amt ${hasQty ? "" : "ing__amt--empty"}" data-amt="${i}"></span>
    <span class="ing__name">${esc(ing.item)}${ing.note ? `<span class="note">${esc(ing.note)}</span>` : ""}</span>
  </li>`;
}

function stepRow(s, i) {
  const timer = s.timer
    ? `<button class="timer" data-action="timer" data-i="${i}" data-duration="${s.timer}" data-label="${esc(s.timerLabel || s.title || "Timer")}" aria-label="Start ${formatTime(s.timer)} timer">
        <svg class="timer__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="13" r="8"/><path d="M12 13V9"/><path d="M9 2h6"/></svg>
        <span class="timer__label-txt">Start</span>
        <span class="timer__time">${formatTime(s.timer)}</span>
      </button>`
    : "";
  return `<li class="step" data-step="${i}">
    ${s.title ? `<h3 class="step__title">${esc(s.title)}</h3>` : ""}
    <p class="step__text">${esc(s.text)}</p>
    ${s.note ? `<p class="step__note">${esc(s.note)}</p>` : ""}
    <div class="step__actions">
      ${timer}
      <button class="step__done" data-action="step-done" data-i="${i}">Mark done</button>
    </div>
  </li>`;
}

/* ---------- servings scaling ---------- */
function updateAmounts() {
  if (!current) return;
  const { recipe, servings } = current;
  const base = recipe.servings || 1;
  const factor = servings / base;

  document.querySelectorAll("[data-amt]").forEach((cell) => {
    const ing = recipe.ingredients[+cell.dataset.amt];
    if (ing.quantity == null) return; // "to taste" etc.
    const scale = ing.scale === false ? false : true;
    const value = scale ? ing.quantity * factor : ing.quantity;
    const num = formatQuantity(value);
    cell.textContent = ing.unit ? `${num} ${ing.unit}` : num;
  });

  const note = document.getElementById("scaled-note");
  if (note) {
    if (servings !== base) {
      const f = Math.round(factor * 100) / 100;
      note.textContent = `Scaled from ${base} · ×${f}`;
    } else note.textContent = "";
  }
  const val = document.getElementById("serv-value");
  if (val) val.textContent = servings;
}

/* ---------- events (bound once; #app persists across renders) ---------- */
app.addEventListener("click", onAppClick);
app.addEventListener("change", onAppChange);

function onAppClick(e) {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const action = btn.dataset.action;

  if (action === "serv-inc" || action === "serv-dec") {
    const delta = action === "serv-inc" ? 1 : -1;
    current.servings = Math.min(60, Math.max(1, current.servings + delta));
    updateAmounts();
    return;
  }
  if (action === "step-done") {
    btn.closest(".step").classList.toggle("is-done");
    btn.textContent = btn.closest(".step").classList.contains("is-done") ? "Done ✓" : "Mark done";
    return;
  }
  if (action === "timer") {
    handleTimerClick(btn);
    return;
  }
}

function onAppChange(e) {
  const chk = e.target.closest(".ing__check");
  if (chk) chk.closest(".ing").classList.toggle("is-checked", chk.checked);
}

/* ============================================================
   Timers
   ============================================================ */
const timers = new Map(); // id -> {id, i, label, duration, remaining, status, endAt}
let ticker = null;
let audioCtx = null;

function timerId(i) {
  return `${current?.recipe?.slug || "r"}:${i}`;
}

function handleTimerClick(btn) {
  const i = +btn.dataset.i;
  const id = timerId(i);
  const existing = timers.get(id);

  if (!existing) {
    // start
    unlockAudio();
    const duration = +btn.dataset.duration;
    const label = btn.dataset.label;
    timers.set(id, {
      id, i, label, duration,
      remaining: duration, status: "running",
      endAt: Date.now() + duration * 1000,
    });
    ensureTicker();
    paintTimerButton(timers.get(id), btn);
    renderDock();
  } else {
    // running or done → reset to idle
    timers.delete(id);
    resetTimerButton(btn);
    renderDock();
    stopTickerIfIdle();
  }
}

function ensureTicker() {
  if (!ticker) ticker = setInterval(tickAll, 250);
}
function stopTickerIfIdle() {
  const running = [...timers.values()].some((t) => t.status === "running");
  if (!running && ticker) { clearInterval(ticker); ticker = null; }
}

function tickAll() {
  const now = Date.now();
  timers.forEach((t) => {
    if (t.status !== "running") return;
    t.remaining = Math.max(0, Math.round((t.endAt - now) / 1000));
    if (t.remaining <= 0) {
      t.status = "done";
      onTimerDone(t);
    }
    const btn = document.querySelector(`.timer[data-i="${t.i}"]`);
    if (btn) paintTimerButton(t, btn);
  });
  renderDock();
  stopTickerIfIdle();
}

function paintTimerButton(t, btn) {
  btn.classList.toggle("is-running", t.status === "running");
  btn.classList.toggle("is-done", t.status === "done");
  const label = btn.querySelector(".timer__label-txt");
  const time = btn.querySelector(".timer__time");
  if (t.status === "running") {
    label.textContent = "";
    time.textContent = formatTime(t.remaining);
    btn.setAttribute("aria-label", `${t.label}: ${formatTime(t.remaining)} left. Tap to cancel.`);
  } else if (t.status === "done") {
    label.textContent = "Done";
    time.textContent = "✓";
    btn.setAttribute("aria-label", `${t.label} finished. Tap to reset.`);
  }
}

function resetTimerButton(btn) {
  const duration = +btn.dataset.duration;
  btn.classList.remove("is-running", "is-done");
  btn.querySelector(".timer__label-txt").textContent = "Start";
  btn.querySelector(".timer__time").textContent = formatTime(duration);
  btn.setAttribute("aria-label", `Start ${formatTime(duration)} timer`);
}

function onTimerDone(t) {
  beep();
  if (navigator.vibrate) navigator.vibrate([220, 120, 220]);
}

function clearAllTimers() {
  timers.clear();
  if (ticker) { clearInterval(ticker); ticker = null; }
  renderDock();
}

/* ---------- live dock ---------- */
function renderDock() {
  const items = [...timers.values()].filter(
    (t) => t.status === "running" || t.status === "done"
  );
  if (!items.length) {
    dockEl.hidden = true;
    dockEl.innerHTML = "";
    return;
  }
  dockEl.hidden = false;
  dockEl.innerHTML = items
    .map(
      (t) => `<div class="dock__item ${t.status === "done" ? "is-done" : ""}">
        <span class="dock__pulse"></span>
        <span class="dock__label dock__jump" data-jump="${t.i}">${esc(t.label)}</span>
        <span class="dock__time">${t.status === "done" ? "Done" : formatTime(t.remaining)}</span>
        <button class="dock__x" data-dismiss="${t.i}" aria-label="Dismiss timer">×</button>
      </div>`
    )
    .join("");
}

dockEl.addEventListener("click", (e) => {
  const jump = e.target.closest("[data-jump]");
  if (jump) {
    const step = document.querySelector(`.step[data-step="${jump.dataset.jump}"]`);
    if (step) step.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }
  const x = e.target.closest("[data-dismiss]");
  if (x) {
    const i = x.dataset.dismiss;
    timers.delete(timerId(+i));
    const btn = document.querySelector(`.timer[data-i="${i}"]`);
    if (btn) resetTimerButton(btn);
    renderDock();
    stopTickerIfIdle();
  }
});

/* ---------- sound ---------- */
function unlockAudio() {
  if (audioCtx) return;
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  } catch (e) {
    audioCtx = null;
  }
}
function beep() {
  if (!audioCtx) return;
  const ctx = audioCtx;
  const now = ctx.currentTime;
  [[0, 784], [0.26, 784], [0.52, 1046]].forEach(([t, freq]) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = freq;
    o.connect(g);
    g.connect(ctx.destination);
    g.gain.setValueAtTime(0.0001, now + t);
    g.gain.linearRampToValueAtTime(0.25, now + t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + t + 0.24);
    o.start(now + t);
    o.stop(now + t + 0.26);
  });
}
