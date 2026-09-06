/*
 * Hero puzzle background.
 *
 * The cut is generated here — four edges per piece, each one either a tab, a
 * blank or a flat border, drawn from my own bezier coordinates rather than
 * traced from any existing set. Pieces drift against the cursor at their own
 * depth, and any of them can be picked up and thrown.
 */
(() => {
  'use strict';

  const hero = document.getElementById('hero');
  const inner = hero && hero.querySelector('.hero-inner');
  if (!hero) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // On a touch screen a drag that starts on a piece would swallow the swipe
  // that was meant to scroll the page, so there the pieces are scenery only.
  const canDrag = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* ---- geometry -------------------------------------------------------- */

  /* One edge, normalised: it runs from u=0 to u=1 along the edge, and bulges
     `w` outward. The knob is four curves — shoulder, neck, head, shoulder. */
  const EDGE = [
    [0.20,  0.00, 0.32, -0.02, 0.38, -0.02],
    [0.28,  0.10, 0.28,  0.26, 0.50,  0.26],
    [0.72,  0.26, 0.72,  0.10, 0.62, -0.02],
    [0.68, -0.02, 0.80,  0.00, 1.00,  0.00],
  ];

  /* map (along, outward) on one edge into piece coordinates */
  function mapper(ax, ay, ex, ey, nx, ny) {
    return (u, w) => [
      round(ax + ex * u + nx * w),
      round(ay + ey * u + ny * w),
    ];
  }

  const round = (n) => Math.round(n * 100) / 100;

  function edgePath(at, dir) {
    if (!dir) {
      const [x, y] = at(1, 0);
      return `L${x} ${y}`;
    }
    return EDGE.map((c) => {
      const [x1, y1] = at(c[0], c[1] * dir);
      const [x2, y2] = at(c[2], c[3] * dir);
      const [x3, y3] = at(c[4], c[5] * dir);
      return `C${x1} ${y1} ${x2} ${y2} ${x3} ${y3}`;
    }).join('');
  }

  /* a whole piece: square of side s, padded so the knobs stay inside the box */
  function piecePath(s, edges) {
    const p = s * 0.3;
    const a = p, b = p + s;
    const sides = [
      mapper(a, a,  s,  0,  0, -s), // top
      mapper(b, a,  0,  s,  s,  0), // right
      mapper(b, b, -s,  0,  0,  s), // bottom
      mapper(a, b,  0, -s, -s,  0), // left
    ];
    return `M${a} ${a}` + sides.map((at, i) => edgePath(at, edges[i])).join('') + 'Z';
  }

  /* ---- the pieces ------------------------------------------------------ */

  const layer = document.createElement('div');
  layer.className = 'hero-puzzle';
  layer.setAttribute('aria-hidden', 'true');
  hero.appendChild(layer);

  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  const TONES = [
    { fill: 'none',                accent: null },
    { fill: 'none',                accent: null },
    { fill: 'var(--puzzle-fill)',  accent: null },
    { fill: 'var(--puzzle-red)',   accent: 'red' },
    { fill: 'var(--puzzle-gold)',  accent: 'gold' },
    { fill: 'var(--puzzle-blue)',  accent: 'blue' },
    { fill: 'var(--puzzle-green)', accent: 'green' },
  ];

  const pieces = [];

  function build(count) {
    layer.textContent = '';
    pieces.length = 0;

    for (let i = 0; i < count; i++) {
      const size = Math.round(rand(54, 112) * (window.innerWidth < 640 ? 0.72 : 1));
      const box = Math.round(size * 1.6);
      // a border piece now and then, so the scatter reads as a broken-up puzzle
      const edges = [0, 1, 2, 3].map(() => (Math.random() < 0.16 ? 0 : (Math.random() < 0.5 ? 1 : -1)));
      const tone = pick(TONES);

      const el = document.createElement('div');
      el.className = 'puzzle-piece';
      if (tone.accent) el.dataset.accent = tone.accent;
      el.style.width = box + 'px';
      el.style.height = box + 'px';
      el.innerHTML =
        `<svg viewBox="0 0 ${box} ${box}" width="${box}" height="${box}" ` +
        `xmlns="http://www.w3.org/2000/svg" focusable="false">` +
        `<path d="${piecePath(size, edges)}" style="fill:${tone.fill}"/></svg>`;

      layer.appendChild(el);
      pieces.push({
        el,
        box,
        // filled in by layout()
        hx: 0, hy: 0, x: 0, y: 0, vx: 0, vy: 0, dx: 0, dy: 0, lean: 0, scale: 1,
        rot: rand(-24, 24),
        depth: rand(0.35, 1.15),
        held: false,
      });
    }
  }

  /* ---- placement ------------------------------------------------------- */

  /* Candidate anchors on a loose grid, minus anything sitting on the copy —
     the pieces are background, they shouldn't crowd the words. */
  function layout() {
    const w = hero.clientWidth;
    const h = hero.clientHeight;
    if (!w || !h) return;

    const heroRect = hero.getBoundingClientRect();
    let avoid = null;
    if (inner) {
      const r = inner.getBoundingClientRect();
      avoid = {
        l: r.left - heroRect.left - 40,
        t: r.top - heroRect.top - 40,
        r: r.right - heroRect.left + 40,
        b: r.bottom - heroRect.top + 40,
      };
    }

    const cols = Math.max(3, Math.round(w / 190));
    const rows = Math.max(3, Math.round(h / 190));
    const spots = [];
    for (let cx = 0; cx < cols; cx++) {
      for (let cy = 0; cy < rows; cy++) {
        const x = ((cx + 0.5) / cols) * w + rand(-42, 42);
        const y = ((cy + 0.5) / rows) * h + rand(-42, 42);
        const deep = !!(avoid && x > avoid.l && x < avoid.r && y > avoid.t && y < avoid.b);
        spots.push([x, y, deep]);
      }
    }
    for (let i = spots.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [spots[i], spots[j]] = [spots[j], spots[i]];
    }

    // near pieces paint over far ones
    pieces.sort((a, b) => a.depth - b.depth);
    pieces.forEach((p, i) => {
      const spot = spots[i % Math.max(1, spots.length)] || [w / 2, h / 2, false];
      p.scale = spot[2] ? 0.58 : 1;
      p.hx = clamp(spot[0] - p.box / 2, -p.box * 0.25, w - p.box * 0.75);
      p.hy = clamp(spot[1] - p.box / 2, -p.box * 0.25, h - p.box * 0.75);
      p.x = p.hx;
      p.y = p.hy;
      p.vx = p.vy = 0;
      p.el.style.opacity = spot[2] ? '0.4' : '';
      draw(p);
    });
  }

  const clamp = (n, lo, hi) => (n < lo ? lo : n > hi ? hi : n);

  function draw(p) {
    p.el.style.transform =
      `translate3d(${Math.round((p.x + p.dx) * 10) / 10}px, ${Math.round((p.y + p.dy) * 10) / 10}px, 0) ` +
      `rotate(${Math.round((p.rot + p.lean) * 10) / 10}deg) scale(${p.scale})`;
  }

  /* ---- cursor drift ---------------------------------------------------- */

  const aim = { x: 0, y: 0 };   // where the pointer wants the pieces
  const now = { x: 0, y: 0 };   // where they actually are
  const AMP = 30;

  if (!reducedMotion) {
    window.addEventListener('pointermove', (e) => {
      const r = hero.getBoundingClientRect();
      if (r.bottom < 0) return; // hero has scrolled away
      aim.x = (e.clientX - r.left) / r.width - 0.5;
      aim.y = (e.clientY - r.top) / r.height - 0.5;
    }, { passive: true });
  }

  /* ---- pick up and throw ----------------------------------------------- */

  let dragging = null;

  layer.addEventListener('pointerdown', (e) => {
    if (!canDrag) return;
    const el = e.target.closest('.puzzle-piece');
    if (!el) return;
    const p = pieces.find((q) => q.el === el);
    if (!p) return;

    e.preventDefault();
    el.classList.add('is-held');
    layer.appendChild(el); // whatever you're holding comes to the front

    // Fold the drift the piece was carrying into its own position first, so it
    // doesn't jump out from under the cursor the moment you take hold of it.
    const r = hero.getBoundingClientRect();
    p.x += p.dx; p.y += p.dy; p.dx = p.dy = 0;
    p.rot += p.lean; p.lean = 0;

    p.held = true;
    p.grabX = e.clientX - r.left - p.x;
    p.grabY = e.clientY - r.top - p.y;
    p.lastX = e.clientX;
    p.lastY = e.clientY;
    p.vx = p.vy = 0;
    dragging = p;

    // on window, not on the piece: the cursor is free to run ahead of it
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', drop);
    window.addEventListener('pointercancel', drop);
  });

  function move(e) {
    const p = dragging;
    if (!p) return;
    const r = hero.getBoundingClientRect();
    p.x = e.clientX - r.left - p.grabX;
    p.y = e.clientY - r.top - p.grabY;
    p.vx = e.clientX - p.lastX;
    p.vy = e.clientY - p.lastY;
    p.lastX = e.clientX;
    p.lastY = e.clientY;
    p.hx = p.x;
    p.hy = p.y;
  }

  function drop() {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', drop);
    window.removeEventListener('pointercancel', drop);
    const p = dragging;
    if (!p) return;
    p.held = false;
    p.el.classList.remove('is-held');
    if (reducedMotion) p.vx = p.vy = 0;
    dragging = null;
  }

  /* ---- the loop -------------------------------------------------------- */

  let visible = true;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((es) => {
      visible = es[0].isIntersecting;
      if (visible) requestAnimationFrame(frame);
    }).observe(hero);
  }

  function frame() {
    if (!visible && !dragging) return;
    now.x += (aim.x - now.x) * 0.055;
    now.y += (aim.y - now.y) * 0.055;

    const w = hero.clientWidth;
    const h = hero.clientHeight;

    for (let i = 0; i < pieces.length; i++) {
      const p = pieces[i];

      // a thrown piece keeps going for a moment, then gives up
      if (!p.held && (Math.abs(p.vx) > 0.05 || Math.abs(p.vy) > 0.05)) {
        p.vx *= 0.94;
        p.vy *= 0.94;
        p.hx = clamp(p.hx + p.vx, -p.box * 0.35, w - p.box * 0.65);
        p.hy = clamp(p.hy + p.vy, -p.box * 0.35, h - p.box * 0.65);
        p.x = p.hx;
        p.y = p.hy;
      } else if (!p.held) {
        p.x += (p.hx - p.x) * 0.12;
        p.y += (p.hy - p.y) * 0.12;
      }

      // depth: the small, faint ones lag furthest behind the cursor
      p.dx = p.held ? 0 : -now.x * AMP * p.depth;
      p.dy = p.held ? 0 : -now.y * AMP * p.depth;
      p.lean = p.held ? 0 : now.x * 4 * p.depth;
      draw(p);
    }
    requestAnimationFrame(frame);
  }

  /* ---- go -------------------------------------------------------------- */

  function count() {
    const w = window.innerWidth;
    if (w < 640) return 6;
    if (w < 1100) return 9;
    return 13;
  }

  let built = count();
  build(built);
  layout();
  requestAnimationFrame(frame);

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const next = count();
      if (next !== built) { built = next; build(built); }
      layout();
    }, 180);
  });
})();
