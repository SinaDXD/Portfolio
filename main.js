// ═══════════════════════════════════════════════════════════════════
//  Sina portfolio — discipline map
//  Hub ("Projects") → disciplines on spokes. Each discipline tip fans out into
//  one sub-spoke per project, each with its own label. Zoom out → the photos
//  pile at the discipline node; zoom in → the sub-spokes open and each photo
//  slides to the tip of its branch. Hovering one project dims the others.
//  Click a project for the full view. A Map/Grid toggle switches to a grid.
// ═══════════════════════════════════════════════════════════════════

// PROJECTS and TOPICS are defined in projects-data.js (generated from the
// real portfolio_database) and loaded before this script.

const stage = document.querySelector("[data-stage]");
const canvas = document.querySelector("[data-canvas]");
const wires = document.querySelector("[data-wires]");
const hubEl = document.querySelector("[data-hub]");
const hint = document.querySelector("[data-hint]");
const NS = "http://www.w3.org/2000/svg";
const CANVAS_W = 2900, CANVAS_H = 2100;
const HUB = { x: CANVAS_W / 2, y: CANVAS_H / 2 };

const DEFAULT_SCALE = 1.1;                 // closer default — map sits centred on the hub
const MIN_SCALE = DEFAULT_SCALE, MAX_SCALE = 2.8;  // default IS the zoom-out floor — you can only zoom IN
const SEP_LO = 1.1, SEP_HI = 1.55;         // fan opens as you zoom past the default

// const reduceMotion =
//   matchMedia("(prefers-reduced-motion: reduce)").matches &&
//   !location.search.includes("motion");

const reduceMotion = false;  // for testing — set to true to disable all non-essential motion (zoom instantly, no easing, no inertia on pan end)

const rad = (d) => (d * Math.PI) / 180;
const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

hubEl.style.left = HUB.x + "px";
hubEl.style.top = HUB.y + "px";

// ── Build the map ─────────────────────────────────────────────────
// Place a label at fraction `f` along the line (px,py)→(nx,ny), rotated to
// follow the line's angle and lifted `d` px to sit just on top of the line.
// Text is flipped 180° when the line runs right-to-left so it always reads
// left-to-right rather than upside down.
function placeLabel(el, px, py, nx, ny, d, f) {
  const ax = px + (nx - px) * f, ay = py + (ny - py) * f;
  const a = Math.atan2(ny - py, nx - px);          // line direction (radians)
  // perpendicular to the line, forced to point "up" on screen (negative y)
  let perpx = Math.sin(a), perpy = -Math.cos(a);
  if (perpy > 0) { perpx = -perpx; perpy = -perpy; }
  let deg = (a * 180) / Math.PI;                   // text angle = line angle
  if (deg > 90 || deg < -90) deg += 180;           // keep it upright
  el.style.left = ax + perpx * d + "px";
  el.style.top = ay + perpy * d + "px";
  el.style.transformOrigin = "center";
  el.style.transform = `translate(-50%, -50%) rotate(${deg}deg)`;
}

// Sub-branch geometry: each discipline tip fans out into one sub-spoke per
// project. The fan is centred on the spoke direction; lengths vary per branch
// so the zoomed-in map reads as a lively, uneven tree rather than a rigid fan.
const FAN_SPREAD = 92;    // total degrees the sub-branches fan across (main angle — unchanged)
const INNER_GAP  = 60;    // a label begins this far out from the discipline node
const LABEL_PAD  = 30;    // breathing room around the label text on its line
const STAGGER    = 46;    // each branch in a fan reaches a little farther than the previous —
                          // small, so projects stay CLOSE; the line still always fits its own text
const BRANCH_MIN = 150;   // shortest a sub-spoke can be
const PHOTO_CLEAR = 47;   // gap kept between the label end and the photo — smaller = the
                          // project rests CLOSER in (how far the photo travels out)
const PHOTO_HALF = 62;    // half the photo size (124px) — used to clear the circle
const PHOTO_GAP  = 16;    // clearance left past the circle, whatever the branch angle
const PILE_OUT   = 92;    // where the photos rest (beyond the node) when piled

// Per-discipline fan tweaks. bias rotates the whole fan clockwise (deg); spread
// overrides the fan width. Used to steer a fan into open space so its branches
// don't cross a neighbouring spoke:
//   • Product (points left)  → +bias swings its branches UP (front + top), off the Inclusive spoke.
//   • Social  (points right) → +bias swings its branches DOWN, off the Interaction spoke above it.
const FAN_TWEAK = {
  product: { bias: 40, spread: 60 },
  social:  { bias: 40, spread: 60 },
};

// Per-discipline, per-project overrides for which corner of the photo the line's
// circle sits in (otherwise it's auto-chosen from the line direction). [sx, sy] is
// the photo-centre offset from the circle: x>0 = photo to the right, y<0 = photo up.
//   bottom-left corner → [ 1, -1]   bottom-right → [-1, -1]
//   top-left corner    → [ 1,  1]   top-right    → [-1,  1]
const PHOTO_ANCHOR = {
  interaction: { barryland: [1, -1] },                 // bottom-left corner
  social:      { stillbloom: [1, -1] },                // photo up-right, clear of Revive's label
  inclusive:   { saydo: [-1, 1] },                     // top-right corner
  product:     { saydo: [1, -1] },                     // saydo photo up-right, clear of By-Ber's label
};

const topics = TOPICS.map((t) => {
  const a = rad(t.angle);
  const dx = Math.cos(a), dy = Math.sin(a);
  const nx = HUB.x + dx * t.len, ny = HUB.y + dy * t.len;

  // ── main spoke ──
  const line = document.createElementNS(NS, "line");
  line.setAttribute("x1", HUB.x); line.setAttribute("y1", HUB.y);
  line.setAttribute("x2", nx); line.setAttribute("y2", ny);
  wires.appendChild(line);

  // ── discipline node + label ──
  const node = document.createElement("div");
  node.className = "node";
  node.style.left = nx + "px"; node.style.top = ny + "px";

  const label = document.createElement("button");
  label.type = "button"; label.className = "label";
  label.innerHTML = `<span>${t.label}</span>`;
  placeLabel(label, HUB.x, HUB.y, nx, ny, 14, 0.5);
  label.classList.add("in");

  // ── per-project sub-branches ──
  // Each project gets its own sub-spoke, sub-node and sub-label fanning out
  // from the discipline node. The photo rests piled at the node when zoomed
  // out and slides to the tip of its sub-spoke as you zoom in (driven by --sep).
  const branchset = document.createElement("div");
  branchset.className = "branchset";
  const n = t.projects.length;
  let sumFx = 0, sumFy = 0;                  // accumulate photo centres → discipline's projects-centre

  t.projects.forEach((pid, i) => {
    const tw = FAN_TWEAK[t.id] || {};
    const spread = tw.spread ?? FAN_SPREAD;
    const off = (n <= 1 ? 0 : (i / (n - 1) - 0.5) * spread) + (tw.bias ?? 0);
    // Tighter-angled fans need a touch more radial stagger so neighbouring labels
    // don't collide; wide fans stay as compact as possible.
    const stagger = STAGGER * Math.pow(FAN_SPREAD / spread, 2) * (tw.stag ?? 1);
    const ba = rad(t.angle + off);
    const bdx = Math.cos(ba), bdy = Math.sin(ba);

    // sub-label first, so we can size this branch to fit its rotated name
    const slabel = document.createElement("div");
    slabel.className = "label label--sub";
    slabel.innerHTML = `<span>${PROJECTS[pid].title}</span>`;
    canvas.append(slabel);
    const labelW = slabel.offsetWidth;                       // full text width (white-space:nowrap)

    // Each branch in the fan reaches a bit farther than the last (radial stagger),
    // and the line is always long enough to hold the whole name plus its photo —
    // so the text fits its line and labels never pile onto a neighbour near the node.
    const inner = INNER_GAP + i * stagger;                   // where this label begins
    // PHOTO_CLEAR sets how far past the label the photo rests (its travel distance).
    const len = Math.max(BRANCH_MIN + i * stagger, inner + labelW + PHOTO_CLEAR);
    const ex = nx + bdx * len, ey = ny + bdy * len;          // sub-node circle = end of the line
    // Anchor the photo to the circle by its INWARD corner or edge-midpoint, chosen from
    // the line's direction so it's consistent everywhere: a near-vertical line meets the
    // photo at its top/bottom edge midpoint, a near-horizontal one at a left/right edge
    // midpoint, and a diagonal at a corner. The photo always extends outward, so the
    // circle tucks neatly under it (this is the placement Industrial design already had).
    const AXIS = 0.383;   // within ~22.5° of an axis → edge midpoint; otherwise → corner
    const forced = PHOTO_ANCHOR[t.id] && PHOTO_ANCHOR[t.id][pid];
    const sx = forced ? forced[0] : (Math.abs(bdx) < AXIS ? 0 : Math.sign(bdx));
    const sy = forced ? forced[1] : (Math.abs(bdy) < AXIS ? 0 : Math.sign(bdy));
    const fx = ex + sx * PHOTO_HALF, fy = ey + sy * PHOTO_HALF; // photo centre — circle at its inward corner/edge
    sumFx += fx; sumFy += fy;

    // piled resting spot (small cascade just past the node) — used when zoomed out
    const px = nx + dx * PILE_OUT + i * 6;
    const py = ny + dy * PILE_OUT + i * 6;

    // sub-spoke line (node → circle)
    const sline = document.createElementNS(NS, "line");
    sline.setAttribute("x1", nx); sline.setAttribute("y1", ny);
    sline.setAttribute("x2", ex); sline.setAttribute("y2", ey);
    sline.setAttribute("class", "subwire");
    sline.setAttribute("pathLength", "1");   // lets CSS "draw" the line 0→1 in step with --sep
    wires.appendChild(sline);

    // sub-node dot at the tip
    const snode = document.createElement("div");
    snode.className = "node node--sub";
    snode.style.left = ex + "px"; snode.style.top = ey + "px";

    // centre the label on its allocated segment [inner, inner+labelW] of the line
    placeLabel(slabel, nx, ny, ex, ey, 10, (inner + labelW / 2) / len);

    // the project photo — piled at the node, slides out past its circle as --sep → 1
    const photo = document.createElement("button");
    photo.type = "button"; photo.className = "photo"; photo.dataset.pid = pid;
    photo.style.left = px + "px"; photo.style.top = py + "px";
    photo.style.setProperty("--i", i);
    photo.style.setProperty("--ddx", (fx - px).toFixed(1));
    photo.style.setProperty("--ddy", (fy - py).toFixed(1));
    photo.dataset.cx = fx.toFixed(1);            // settled canvas centre — used to pan the map to it
    photo.dataset.cy = fy.toFixed(1);
    photo.innerHTML = `<img src="${PROJECTS[pid].img}" alt="${PROJECTS[pid].title}" loading="lazy"${PROJECTS[pid].coverPos ? ` style="object-position:${PROJECTS[pid].coverPos}"` : ""} />`;
    photo.addEventListener("click", (e) => { e.stopPropagation(); enterProject(photo, pid); });

    canvas.append(snode);
    branchset.append(photo);
  });

  canvas.append(node, label, branchset);

  // centre of this discipline's projects (where the fan photos land) — used to frame it
  const pcx = sumFx / n, pcy = sumFy / n;
  const topic = { ...t, nx, ny, dx, dy, node, label, pcx, pcy };
  // tap a discipline → glide in to frame its projects
  const go = () => { interacted(); centerOn(pcx, pcy, 1.55); };
  node.addEventListener("click", go);
  label.addEventListener("click", go);
  return topic;
});

// ── Hint / first-interaction ──────────────────────────────────────
function interacted() { hint.classList.add("is-hidden"); }

// ── Fullscreen project ────────────────────────────────────────────
const pv = document.querySelector("[data-project]");
const PID_ORDER = Object.keys(PROJECTS);   // order projects appear in the grid (for prev/next)
let currentPid = null;
function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

// ── Media (images + Vimeo video boxes) ─────────────────────────────
// Real aspect ratio of a video (from its Vimeo w/h), so the box matches the
// content exactly and there are no black letterbox/pillar bars.
function videoAR(v) {
  if (v.w && v.h) return v.w / v.h;
  return ({ portrait: 9 / 16, vertical: 9 / 16, square: 1, landscape: 16 / 9, horizontal: 16 / 9 }[v.aspect]) || 16 / 9;
}
function isVertical(v) { return videoAR(v) < 0.85; }
// A Vimeo iframe box. showcase/micro (or loop) → silent looping background
// player; demo → normal click-to-play player with sound. Box is sized to the
// video's true aspect ratio.
function videoBox(v, title) {
  const loop = v.type === "showcase" || v.type === "micro" || v.loop;
  const src = loop
    ? `https://player.vimeo.com/video/${v.id}?background=1`
    : `https://player.vimeo.com/video/${v.id}`;
  const ar = videoAR(v);
  const cls = ar < 0.85 ? "portrait" : (ar > 1.25 ? "wide" : "square");
  const style = (v.w && v.h) ? ` style="aspect-ratio:${v.w} / ${v.h}"` : "";
  return `<div class="project__video project__video--${cls}"${style}>` +
    `<iframe src="${src}" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" ` +
    `allowfullscreen loading="lazy" title="${esc(v.label || title)}"></iframe></div>`;
}
// Build the media stack. If website_order is present, follow it exactly
// (image by file, video by matching label); otherwise images then videos.
// Consecutive vertical (story) videos are grouped into a side-by-side row.
function mediaHTML(p) {
  const img = (src) => `<img src="${src}" alt="${esc(p.title)}" loading="lazy" />`;
  const byLabel = {};
  (p.videos || []).forEach((v) => { byLabel[v.label] = v; });
  const items = [];
  if (p.website_order && p.website_order.length) {
    for (const o of p.website_order) {
      if (o.type === "image") items.push({ img: o.file });
      else if (o.type === "video" && byLabel[o.ref]) items.push({ v: byLabel[o.ref] });
    }
  } else {
    (p.images && p.images.length ? p.images : [p.img]).forEach((src) => items.push({ img: src }));
    (p.videos || []).forEach((v) => items.push({ v }));
  }
  const vert = (it) => it.v && isVertical(it.v);
  const out = [];
  for (let i = 0; i < items.length; ) {
    if (vert(items[i])) {
      const group = [];
      while (i < items.length && vert(items[i])) { group.push(items[i].v); i++; }
      out.push(group.length >= 2
        ? `<div class="project__video-row">${group.map((v) => videoBox(v, p.title)).join("")}</div>`
        : videoBox(group[0], p.title));
    } else {
      out.push(items[i].img ? img(items[i].img) : videoBox(items[i].v, p.title));
      i++;
    }
  }
  return out.join("");
}

// fill the page with a project's content (no show/transition)
function fillProject(pid) {
  const p = PROJECTS[pid];
  if (!p) return false;
  currentPid = pid;
  pv.querySelector("[data-project-field]").textContent = p.field;
  pv.querySelector("[data-project-title]").textContent = p.title;
  const metaLine = [p.year, p.collaboration].filter(Boolean).join(" · ");
  // Drop any section that just repeats the one-line summary (the "OVERVIEW"
  // sections duplicate it), so the lead isn't shown twice.
  const norm = (t) => (t || "").replace(/\s+/g, " ").trim().toLowerCase();
  const sumKey = norm(p.summary).slice(0, 50);
  const sections = (p.sections || []).filter((s) => !(sumKey && norm(s.body).slice(0, 50) === sumKey));
  pv.querySelector("[data-project-desc]").innerHTML =
    (metaLine ? `<p class="project__metaline">${esc(metaLine)}</p>` : "") +
    (p.summary ? `<p class="project__lead">${esc(p.summary)}</p>` : "") +
    sections.map((s) => {
      const head = s.label || s.heading;
      return (head ? `<h3>${esc(head)}</h3>` : "") + `<p>${esc(s.body)}</p>`;
    }).join("");
  pv.querySelector("[data-project-media]").innerHTML = mediaHTML(p);
  pv.scrollTop = 0; pv.querySelector(".project__grid").scrollTop = 0;
  pv.querySelector("[data-project-media]").scrollTop = 0;
  pv.querySelector(".project__meta").scrollTop = 0;
  return true;
}

// open from the grid — straight to full screen, with prev/next navigation
function openProject(pid) {
  if (!fillProject(pid)) return;
  clearSelection();
  pv.classList.remove("is-entering", "is-open");
  pv.classList.add("is-full", "from-grid");        // grid projects open full screen
  pv.hidden = false;
  requestAnimationFrame(() => pv.classList.add("in"));
}
// step to the previous / next project (grid full-screen mode)
function navProject(dir) {
  const idx = PID_ORDER.indexOf(currentPid);
  if (idx < 0) return;
  fillProject(PID_ORDER[(idx + dir + PID_ORDER.length) % PID_ORDER.length]);
}

// shared-element open (from a map photo): the rectangle GROWS, MOVES and changes
// PROPORTION into the page's hero image, then the background fills and the rest
// of the page (text + other photos) builds in.
function enterProject(photoEl, pid) {
  if (!fillProject(pid)) return;
  // Phone: no map morph / gutter — open straight to a plain full-screen page.
  if (!isDesktop()) {
    pv.classList.remove("is-entering", "is-open", "is-full", "from-grid");
    pv.hidden = false;
    requestAnimationFrame(() => pv.classList.add("in"));
    return;
  }
  const start = photoEl.getBoundingClientRect();
  pv.classList.remove("in", "is-open", "is-full", "from-grid");
  pv.hidden = false;
  pv.classList.add("is-entering");                 // page visible, bg transparent, content hidden
  selectOnMap(pid, photoEl);                        // pan the map to this project & spotlight it

  requestAnimationFrame(() => {
    const hero = pv.querySelector("[data-project-media] img");
    const target = hero.getBoundingClientRect();   // where the hero will sit on the page

    // a clone of the cover that morphs from the clicked rectangle to the hero box
    const clone = document.createElement("div");
    clone.className = "hero-clone";
    Object.assign(clone.style, {
      left: start.left + "px", top: start.top + "px",
      width: start.width + "px", height: start.height + "px",
      backgroundImage: `url("${PROJECTS[pid].img}")`,
    });
    document.body.appendChild(clone);
    clone.getBoundingClientRect();                  // reflow so the next change animates
    clone.classList.add("morph");
    clone.style.left = target.left + "px"; clone.style.top = target.top + "px";
    clone.style.width = target.width + "px"; clone.style.height = target.height + "px";

    let done = false;
    const finish = () => {
      if (done) return; done = true;
      pv.classList.remove("is-entering");
      pv.classList.add("is-open");                  // bg fills, then content fades up
      setTimeout(() => clone.remove(), 90);         // hand off to the real hero image
    };
    clone.addEventListener("transitionend", finish, { once: true });
    setTimeout(finish, 720);                         // fallback if transitionend doesn't fire
  });
}

function closeProject() {
  pv.classList.remove("in", "is-open", "is-entering", "is-full", "from-grid");
  clearSelection();
  clampTargets(); kick();                 // ease the map back into normal bounds
  setTimeout(() => { pv.hidden = true; }, 500);
}
// Two-column reading: text and images scroll independently under the cursor;
// when the hovered side reaches its end, the wheel continues the OTHER side.
(() => {
  const grid = pv.querySelector(".project__grid");
  const media = pv.querySelector("[data-project-media]");
  const meta = pv.querySelector(".project__meta");
  const canScroll = (el, dy) => dy > 0
    ? Math.ceil(el.scrollTop + el.clientHeight) < el.scrollHeight
    : el.scrollTop > 0;
  grid.addEventListener("wheel", (e) => {
    if (!isDesktop()) return;                      // phone scrolls as one stacked column
    const over = e.target.closest("[data-project-media]") ? media
               : (e.target.closest(".project__meta") ? meta : null);
    if (!over) return;
    const other = over === media ? meta : media;
    if (!canScroll(over, e.deltaY) && canScroll(other, e.deltaY)) {
      other.scrollTop += e.deltaY;                 // hand the scroll to the other side
      e.preventDefault();
    }
  }, { passive: false });
})();
document.querySelector("[data-project-close]").addEventListener("click", closeProject);
document.querySelector("[data-project-full]").addEventListener("click", () => pv.classList.toggle("is-full"));
document.querySelector("[data-project-prev]").addEventListener("click", () => navProject(-1));
document.querySelector("[data-project-next]").addEventListener("click", () => navProject(1));
document.addEventListener("keydown", (e) => {
  if (pv.hidden) return;
  if (e.key === "Escape") closeProject();
  else if (pv.classList.contains("from-grid")) {
    if (e.key === "ArrowLeft") navProject(-1);
    else if (e.key === "ArrowRight") navProject(1);
  }
});

// hub / brand → zoom back out to the overview
hubEl.addEventListener("click", () => { interacted(); centerOn(HUB.x, HUB.y, DEFAULT_SCALE); });
document.querySelector("[data-home]").addEventListener("click", (e) => { e.preventDefault(); interacted(); centerOn(HUB.x, HUB.y, DEFAULT_SCALE); });

// ── Grid view ─────────────────────────────────────────────────────
const gridInner = document.querySelector("[data-grid-inner]");
Object.entries(PROJECTS).reverse().forEach(([pid, p]) => {
  const cell = document.createElement("button");
  cell.type = "button"; cell.className = "cell"; cell.dataset.pid = pid;
  cell.innerHTML = `<img src="${p.img}" alt="${p.title}" loading="lazy"${p.coverPos ? ` style="object-position:${p.coverPos}"` : ""} /><span class="cell__name">${p.title}</span>`;
  cell.addEventListener("click", () => openProject(pid));
  gridInner.appendChild(cell);
});
const viewBtns = document.querySelectorAll("[data-viewtoggle] button");
function setView(v) {
  document.body.classList.toggle("view-grid", v === "grid");
  viewBtns.forEach((b) => b.classList.toggle("is-active", b.dataset.view === v));
  if (v === "grid") hint.classList.add("is-hidden");
}
viewBtns.forEach((b) => b.addEventListener("click", () => setView(b.dataset.view)));

// ── Top-right nav (Projects / About / Contact) ──
document.querySelectorAll("[data-topnav] button").forEach((b) => {
  b.addEventListener("click", () => {
    if (b.dataset.nav === "projects") { setView("map"); interacted(); centerOn(HUB.x, HUB.y, DEFAULT_SCALE); }
    else if (b.dataset.nav === "about") openAbout();
    // contact — placeholder
  });
});

// ── About overlay ──────────────────────────────────────────────────
const aboutEl = document.querySelector("[data-about]");
function openAbout() {
  aboutEl.hidden = false;
  aboutEl.scrollTop = 0;
  requestAnimationFrame(() => aboutEl.classList.add("in"));
}
function closeAbout() {
  aboutEl.classList.remove("in");
  setTimeout(() => { aboutEl.hidden = true; }, 450);
}
document.querySelector("[data-about-close]").addEventListener("click", closeAbout);
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !aboutEl.hidden) closeAbout(); });

// ═══════════════════════════════════════════════════════════════════
//  PAN + ZOOM  (drag to pan, wheel to zoom toward cursor; zoom drives the
//  stack separation via the --sep custom property)
// ═══════════════════════════════════════════════════════════════════
let panX = 0, panY = 0, targetX = 0, targetY = 0, scale = DEFAULT_SCALE, targetScale = DEFAULT_SCALE;
let velX = 0, velY = 0, dragging = false, moved = false, pointerDown = false;
let startX = 0, startY = 0, lastX = 0, lastY = 0, raf = null, tween = null;
let lastSep = -1;

const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
// Per-axis placement: if the (scaled) canvas is smaller than the screen, centre
// it; otherwise let it pan but never reveal past its edges. This keeps the map
// centred on any screen size instead of pinning it to the top-left corner.
function axisClamp(target, viewport, content) {
  if (content <= viewport) return (viewport - content) / 2;
  return clamp(target, viewport - content, 0);
}
// Horizontal clamp. While a project panel is open on desktop, the panel hides the
// right side of the screen, so the canvas may slide left underneath it — we only
// require the left map gutter to stay on-canvas (lets the selected project sit in
// the gutter even when it's near the canvas's right edge).
function clampX(target, s) {
  const vw = stage.clientWidth, contentW = CANVAS_W * s;
  if (contentW <= vw) return (vw - contentW) / 2;
  let lo = vw - contentW;
  if (canvas.classList.contains("is-projectview")) {     // desktop project panel open
    const panelLeft = vw * PANEL_GUTTER;                 // visible gutter is [0, panelLeft]
    lo = panelLeft - contentW;                           // keep canvas covering the gutter
  }
  return clamp(target, lo, 0);
}
function clampTargets() {
  targetX = clampX(targetX, targetScale);
  targetY = axisClamp(targetY, stage.clientHeight, CANVAS_H * targetScale);
}
function applyTransform() {
  canvas.style.transform = `translate(${panX.toFixed(2)}px, ${panY.toFixed(2)}px) scale(${scale.toFixed(4)})`;
  const sep = clamp((scale - SEP_LO) / (SEP_HI - SEP_LO), 0, 1);
  if (Math.abs(sep - lastSep) > 0.005) { canvas.style.setProperty("--sep", sep.toFixed(3)); lastSep = sep; }
}
function draw() {
  if (tween) {
    const t = Math.min((performance.now() - tween.t0) / tween.dur, 1);
    const e = reduceMotion ? 1 : easeInOut(t);
    panX = tween.fromX + (tween.toX - tween.fromX) * e;
    panY = tween.fromY + (tween.toY - tween.fromY) * e;
    scale = tween.fromS + (tween.toS - tween.fromS) * e;
    applyTransform();
    if (t >= 1) { targetX = tween.toX; targetY = tween.toY; targetScale = tween.toS; tween = null; raf = null; return; }
    raf = requestAnimationFrame(draw); return;
  }
  const k = reduceMotion ? 1 : 0.16;
  panX += (targetX - panX) * k; panY += (targetY - panY) * k; scale += (targetScale - scale) * k;
  applyTransform();
  if (Math.abs(targetX - panX) < 0.1 && Math.abs(targetY - panY) < 0.1 && Math.abs(targetScale - scale) < 0.001 && !dragging) { raf = null; return; }

  raf = requestAnimationFrame(draw);
}
function kick() { if (raf == null) raf = requestAnimationFrame(draw); }
// Glide so canvas point (cx,cy) lands at screen position (screenX,screenY).
function centerOnAt(cx, cy, s, screenX, screenY) {
  s = clamp(s, MIN_SCALE, MAX_SCALE);
  const toX = clampX(screenX - cx * s, s);
  const toY = axisClamp(screenY - cy * s, stage.clientHeight, CANVAS_H * s);
  const dist = Math.hypot(toX - panX, toY - panY) + Math.abs(s - scale) * 800;
  const dur = reduceMotion ? 1 : clamp(560 + dist * 0.32, 620, 1150);
  tween = { t0: performance.now(), dur, fromX: panX, fromY: panY, fromS: scale, toX, toY, toS: s };
  targetX = toX; targetY = toY; targetScale = s; kick();
}
function centerOn(cx, cy, s) {
  centerOnAt(cx, cy, s, stage.clientWidth / 2, stage.clientHeight / 2);
}

// ── Selected-project state on the map (desktop project view only) ──
// While a project page is open on desktop, pan the map to the selected project
// and spotlight it (full opacity, the rest dimmed) so it's always findable —
// no extra labels or lines, just position + emphasis.
const PANEL_GUTTER = 0.25;   // fraction of screen width left as the map gutter (panel is 75vw — keep in sync with CSS)
const isDesktop = () => window.matchMedia("(min-width: 761px)").matches;
function clearSelection() {
  canvas.classList.remove("is-projectview");
  canvas.querySelectorAll(".photo.is-selected").forEach((p) => p.classList.remove("is-selected"));
}
function selectOnMap(pid, photoEl) {
  clearSelection();
  if (!isDesktop()) return;                       // mobile keeps the plain full-screen page
  const matches = [...canvas.querySelectorAll(`.photo[data-pid="${pid}"]`)];
  matches.forEach((p) => p.classList.add("is-selected"));
  canvas.classList.add("is-projectview");
  const tgt = photoEl || matches[0];
  if (!tgt) return;
  const cx = +tgt.dataset.cx, cy = +tgt.dataset.cy;
  const vw = stage.clientWidth, vh = stage.clientHeight;
  const gutterCentreX = (vw * PANEL_GUTTER) / 2;  // centre of the visible map strip (left 1/4)
  centerOnAt(cx, cy, Math.max(targetScale, SEP_HI), gutterCentreX, vh / 2);
}

// ── Touch & mouse: 1 finger/mouse drags to pan, 2 fingers pinch-zoom (toward the
//    midpoint). After a zoom, the view glides to frame the nearest discipline's
//    projects — a guided "you zoomed near this category, here's its work". ──
const pointers = new Map();
let pinch = null, guideTimer = null;
const stageRect = () => stage.getBoundingClientRect();
function startPinch() {
  const [a, b] = [...pointers.values()];
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, r = stageRect();
  pinch = { d: Math.hypot(a.x - b.x, a.y - b.y),
    ax: (mx - r.left - targetX) / targetScale,        // canvas point under the midpoint
    ay: (my - r.top - targetY) / targetScale };
}

stage.addEventListener("pointerdown", (e) => {
  if (e.pointerType === "mouse" && e.button !== 0) return;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 1) {
    pointerDown = true; dragging = false; moved = false;
    startX = lastX = e.clientX; startY = lastY = e.clientY;
  } else if (pointers.size === 2) {
    pointerDown = false; moved = true;                 // swallow the next stray tap
    if (dragging) { dragging = false; stage.classList.remove("is-dragging"); }
    tween = null; interacted(); startPinch();
  }
});
window.addEventListener("pointermove", (e) => {
  const p = pointers.get(e.pointerId);
  if (!p) return;
  p.x = e.clientX; p.y = e.clientY;

  if (pinch && pointers.size >= 2) {                   // ── pinch zoom ──
    const [a, b] = [...pointers.values()];
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, r = stageRect();
    const d = Math.hypot(a.x - b.x, a.y - b.y) || pinch.d;
    targetScale = clamp(targetScale * (d / pinch.d), MIN_SCALE, MAX_SCALE);
    pinch.d = d;
    targetX = (mx - r.left) - pinch.ax * targetScale;  // keep anchor under the midpoint
    targetY = (my - r.top) - pinch.ay * targetScale;
    clampTargets(); kick();
    return;
  }

  if (!pointerDown) return;                            // ── drag pan ──
  const dx = e.clientX - lastX, dy = e.clientY - lastY;
  lastX = e.clientX; lastY = e.clientY;
  if (!dragging) {
    if (Math.hypot(e.clientX - startX, e.clientY - startY) <= 4) return;
    dragging = true; moved = true; tween = null; interacted();
    stage.classList.add("is-dragging");
  }
  velX = dx; velY = dy;
  targetX += dx; targetY += dy; panX += dx; panY += dy;
  clampTargets(); kick();
});
function endPointer(e) {
  if (!pointers.has(e.pointerId)) return;
  pointers.delete(e.pointerId);
  if (pinch && pointers.size < 2) {                    // pinch ended
    pinch = null; scheduleGuide();
    if (pointers.size === 1) {                         // a finger remains → resume panning from it
      const q = [...pointers.values()][0];
      pointerDown = true; dragging = false;
      startX = lastX = q.x; startY = lastY = q.y;
    } else pointerDown = false;
    return;
  }
  if (pointers.size === 0) {
    if (pointerDown && dragging) {
      dragging = false; stage.classList.remove("is-dragging");
      if (!reduceMotion) { targetX += velX * 6; targetY += velY * 6; clampTargets(); }
      kick();
    }
    pointerDown = false;
  }
}
window.addEventListener("pointerup", endPointer);
window.addEventListener("pointercancel", endPointer);
stage.addEventListener("click", (e) => { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } }, true);

stage.addEventListener("wheel", (e) => {
  e.preventDefault();
  interacted(); tween = null;
  const r = stageRect();
  const mx = e.clientX - r.left, my = e.clientY - r.top;
  const cxp = (mx - targetX) / targetScale, cyp = (my - targetY) / targetScale;
  targetScale = clamp(targetScale * Math.exp(-e.deltaY * 0.0015), MIN_SCALE, MAX_SCALE);
  targetX = mx - cxp * targetScale; targetY = my - cyp * targetScale;
  clampTargets(); kick();
  scheduleGuide();
}, { passive: false });

// glide to centre the nearest discipline's projects shortly after a zoom settles
function scheduleGuide() { clearTimeout(guideTimer); guideTimer = setTimeout(guideToProjects, 300); }
function guideToProjects() {
  if (pointers.size || targetScale < SEP_LO + 0.1) return;     // not mid-gesture; only once fans open
  if (!pv.hidden) return;                                       // don't fight the user while a project is open
  const ccx = (stage.clientWidth / 2 - targetX) / targetScale;
  const ccy = (stage.clientHeight / 2 - targetY) / targetScale;
  let best = null, bd = Infinity;
  topics.forEach((t) => { const d = Math.hypot(t.nx - ccx, t.ny - ccy); if (d < bd) { bd = d; best = t; } });
  if (best && Math.hypot(best.pcx - ccx, best.pcy - ccy) >= 90) centerOn(best.pcx, best.pcy, targetScale);
}

// On resize, keep whatever canvas point is currently centred in the middle of
// the new viewport (the hub for the overview, or the focused topic) — instantly,
// so the map never drifts off-centre when the window changes size.
let lastVW = stage.clientWidth, lastVH = stage.clientHeight;
window.addEventListener("resize", () => {
  const s = targetScale;
  const cX = (lastVW / 2 - targetX) / s;
  const cY = (lastVH / 2 - targetY) / s;
  lastVW = stage.clientWidth; lastVH = stage.clientHeight;
  tween = null;
  targetX = lastVW / 2 - cX * s;
  targetY = lastVH / 2 - cY * s;
  clampTargets();
  panX = targetX; panY = targetY; scale = s;
  applyTransform();
});

// ── Boot ──────────────────────────────────────────────────────────
centerOn(HUB.x, HUB.y, DEFAULT_SCALE);
