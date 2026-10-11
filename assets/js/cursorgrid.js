/*
 * Cursor grid behind the contact band.
 *
 * A port of React Bits' CursorGrid to vanilla JS — this site has no React and
 * no build step. The mechanism is theirs: a lattice of cells, each holding an
 * alpha and the time it was last touched; the pointer lights every cell whose
 * centre falls inside a radius, with a falloff curve mapping distance to
 * brightness; cells hold, then fade; a click sends a ring outward that hands
 * its energy to cells as it passes. The loop sleeps as soon as nothing is lit.
 *
 * Four things are done differently here, for this page:
 *
 *  - The canvas never takes a pointer event. It sits behind the contact copy,
 *    and the original listens on its own container, which would have put a
 *    sheet over the email link and the LinkedIn link. The band listens
 *    instead and passes coordinates down.
 *  - The colour is read from CSS rather than passed as a hex prop, so it
 *    follows the palette along with everything else on the page.
 *  - The cells are small and the falloff is steep. A big cell makes the
 *    boundary of the lit patch a coarse staircase, and a falloff that is
 *    still visible at the radius draws a rim around it; both read as a cut.
 *    Here the cells at the boundary are close to invisible, and the click
 *    ring is a swell that fades with distance rather than an outline.
 *  - It only answers a real cursor. On a touch screen there is nothing
 *    hovering, and lighting cells under a finger mid-scroll is just noise.
 */
(() => {
  'use strict';

  const canvas = document.getElementById('cursorGrid');
  const band = canvas && canvas.closest('.contact-band');
  if (!canvas || !band) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* ---- settings ---------------------------------------------------------- */

  /* The page's background grid runs columns every --grid-step and rows every
     twice that. The cells here are a third of a column, aligned to the same
     origin, so every third line here lands exactly on a line of the page's
     grid and the band reads as that grid continuing, subdivided — not as a
     second lattice laid over the first. */
  const STEP = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--grid-step')) || 104;
  const DIV = 3;
  const CELL = STEP / DIV;   // ~35px: small, so the lit patch's edge steps finely
  const RADIUS = 190;
  const HOLD = 320;          // ms a cell stays lit before it starts fading
  const FADE = 1100;         // ms a fully lit cell takes to fade out
  const LINE_WIDTH = 1;
  const MAX_OPACITY = 0.42;  // it sits behind text, so it never goes full strength
  const FILL_OPACITY = 0.05;
  const MINOR = 0.035;       // the subdividing lines, barely there
  const MAJOR_COL = 0.10;    // the page grid's own lines, at the page's own strengths
  const MAJOR_ROW = 0.06;
  const CELL_RADIUS = 2;
  const PULSE_SPEED = 560;   // px per second
  const PULSE_BAND = 4;      // cells wide: the click ring is a soft swell, not a hard outline

  /* smoothstep, squared: zero slope at both ends, and at the radius so close to
     nothing that the cells on the boundary are invisible — which is the point.
     The plain smoothstep left them at a visible 10-20% and drew a rim. */
  const smooth = (t) => { const s = t * t * (3 - 2 * t); return s * s; };

  /* ---- state ------------------------------------------------------------- */

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let cols = 0, rows = 0, offX = 0, offY = 0, w = 0, h = 0;
  let alphas = new Float32Array(0);
  let edge = new Float32Array(0);   // per-cell fade toward the band's edges
  let touched = new Float64Array(0);
  const pulses = [];
  let raf = 0, running = false, lastFrame = 0, visible = true;
  let ink = [33, 35, 40];       // lit cells
  let rule = [33, 35, 40];      // the lattice: the page grid's colour

  /* The palette is authored in oklch, and that is exactly what computed style
     hands back — parsing numbers out of it would read 0.585 as a red channel.
     Painting one pixel and reading it back resolves any colour syntax the
     browser understands, which is the point of keeping it in CSS. */
  /* Colours are read from CSS so they follow the palette. The palette is
     authored in oklch, so each is painted to a scratch pixel and read back. */
  function resolve(css, fallback) {
    const probe = document.createElement('canvas');
    probe.width = probe.height = 1;
    const p = probe.getContext('2d', { willReadFrequently: true });
    if (!p || !css) return fallback;
    p.fillStyle = css;
    p.fillRect(0, 0, 1, 1);
    const d = p.getImageData(0, 0, 1, 1).data;
    return d[3] > 0 ? [d[0], d[1], d[2]] : fallback;
  }
  function readInk() {
    const cs = getComputedStyle(canvas);
    ink = resolve(cs.color, ink);
    rule = resolve(cs.getPropertyValue('--lattice').trim(), rule);
  }

  function rebuild() {
    w = band.offsetWidth;
    h = band.offsetHeight;
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // the page grid is anchored to the window's left edge; so is this
    const left = band.getBoundingClientRect().left;
    offX = -(((left % CELL) + CELL) % CELL);
    offY = 0;
    cols = Math.ceil((w - offX) / CELL) + 1;
    rows = Math.ceil(h / CELL) + 1;
    alphas = new Float32Array(cols * rows);
    touched = new Float64Array(cols * rows);
    // Lit cells fade out toward the band's edges, so they dissolve before the
    // boundary instead of being sliced off by it. This used to be a CSS mask
    // on the whole canvas, which also faded the lattice — and the lattice has
    // to run right to the edge to meet the page's grid above it.
    edge = new Float32Array(cols * rows);
    const ramp = (d, span) => { const t = Math.min(1, Math.max(0, d / span)); return t * t * (3 - 2 * t); };
    for (let i = 0; i < edge.length; i++) {
      const x = centreX(i), y = centreY(i);
      edge[i] = ramp(Math.min(x, w - x), w * 0.16) * ramp(Math.min(y, h - y), h * 0.22);
    }
    readInk();
  }

  const centreX = (i) => offX + (i % cols) * CELL + CELL / 2;
  const centreY = (i) => offY + Math.floor(i / cols) * CELL + CELL / 2;

  /* light every cell whose centre falls inside the radius */
  function energize(x, y) {
    const now = performance.now();
    const minCol = Math.max(0, Math.floor((x - RADIUS - offX) / CELL));
    const maxCol = Math.min(cols - 1, Math.floor((x + RADIUS - offX) / CELL));
    const minRow = Math.max(0, Math.floor((y - RADIUS - offY) / CELL));
    const maxRow = Math.min(rows - 1, Math.floor((y + RADIUS - offY) / CELL));
    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        const i = r * cols + c;
        const d = Math.hypot(centreX(i) - x, centreY(i) - y);
        if (d > RADIUS) continue;
        const level = smooth(1 - d / RADIUS) * MAX_OPACITY;
        if (level > alphas[i]) { alphas[i] = level; touched[i] = now; }
        else if (level > 0) { touched[i] = now; }
      }
    }
  }

  /* ---- paint ------------------------------------------------------------- */

  function lattice() {
    const [r, g, b] = rule;
    const line = (alpha, vertical, test) => {
      ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      if (vertical) {
        for (let c = 0; c <= cols; c++) {
          if (!test(c)) continue;
          const x = Math.round(offX + c * CELL) + 0.5;
          ctx.moveTo(x, 0); ctx.lineTo(x, h);
        }
      } else {
        for (let r2 = 0; r2 <= rows; r2++) {
          if (!test(r2)) continue;
          const y = Math.round(offY + r2 * CELL) + 0.5;
          ctx.moveTo(0, y); ctx.lineTo(w, y);
        }
      }
      ctx.stroke();
    };
    // a column of the page grid is DIV cells wide, a row of it 2·DIV cells tall
    const colIndex = (c) => Math.round((offX + c * CELL) / CELL);
    line(MINOR, true, (c) => colIndex(c) % DIV !== 0);
    line(MINOR, false, (r2) => r2 % (2 * DIV) !== 0);
    line(MAJOR_COL, true, (c) => colIndex(c) % DIV === 0);
    line(MAJOR_ROW, false, (r2) => r2 % (2 * DIV) === 0);
  }

  function draw(now) {
    const dt = Math.min(now - lastFrame, 50);
    lastFrame = now;
    const [r, g, b] = ink;
    ctx.clearRect(0, 0, w, h);
    lattice();

    // expanding click rings hand their energy to cells as they pass: strongest
    // at the ring's crest, falling off either side of it, and weaker the
    // further out it has travelled — so it dissolves rather than hitting a wall
    const reach = Math.hypot(w, h);
    const halfBand = (PULSE_BAND * CELL) / 2;
    for (let pi = pulses.length - 1; pi >= 0; pi--) {
      const p = pulses[pi];
      const ringR = ((now - p.t0) / 1000) * PULSE_SPEED;
      if (ringR > reach) { pulses.splice(pi, 1); continue; }
      const vigour = Math.pow(1 - ringR / reach, 1.4);
      const minCol = Math.max(0, Math.floor((p.x - ringR - halfBand - offX) / CELL));
      const maxCol = Math.min(cols - 1, Math.floor((p.x + ringR + halfBand - offX) / CELL));
      const minRow = Math.max(0, Math.floor((p.y - ringR - halfBand - offY) / CELL));
      const maxRow = Math.min(rows - 1, Math.floor((p.y + ringR + halfBand - offY) / CELL));
      for (let cr = minRow; cr <= maxRow; cr++) {
        for (let cc = minCol; cc <= maxCol; cc++) {
          const i = cr * cols + cc;
          const off = Math.abs(Math.hypot(centreX(i) - p.x, centreY(i) - p.y) - ringR);
          if (off >= halfBand) continue;
          const level = smooth(1 - off / halfBand) * MAX_OPACITY * vigour;
          if (level > alphas[i]) { alphas[i] = level; touched[i] = now; }
        }
      }
    }

    let anyVisible = pulses.length > 0;
    const fadeStep = dt / FADE;
    const half = CELL / 2;

    for (let i = 0; i < alphas.length; i++) {
      let a = alphas[i];
      if (a <= 0) continue;
      if (now - touched[i] > HOLD) {
        a = Math.max(0, a - fadeStep);
        alphas[i] = a;
        if (a <= 0) continue;
      }
      anyVisible = true;

      const shown = a * edge[i];
      if (shown < 0.004) continue;
      const cx = centreX(i), cy = centreY(i);
      ctx.beginPath();
      ctx.roundRect(cx - half + 0.5, cy - half + 0.5, CELL - 1, CELL - 1, CELL_RADIUS);
      if (FILL_OPACITY > 0) {
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${shown * FILL_OPACITY})`;
        ctx.fill();
      }
      ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${shown})`;
      ctx.lineWidth = LINE_WIDTH;
      ctx.stroke();
    }

    if (anyVisible && visible && !document.hidden) raf = requestAnimationFrame(draw);
    else { running = false; raf = 0; }
  }

  function wake() {
    if (running || !visible || document.hidden) return;
    running = true;
    lastFrame = performance.now();
    raf = requestAnimationFrame(draw);
  }

  function paintStatic() {
    ctx.clearRect(0, 0, w, h);
    lattice();
  }

  /* ---- input -------------------------------------------------------------- */

  // the band listens, not the canvas: the canvas must never sit between the
  // reader and the email link underneath it
  if (finePointer && !reducedMotion) {
    band.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      const rect = canvas.getBoundingClientRect();
      energize(e.clientX - rect.left, e.clientY - rect.top);
      wake();
    }, { passive: true });

    band.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse') return;
      const rect = canvas.getBoundingClientRect();
      pulses.push({ x: e.clientX - rect.left, y: e.clientY - rect.top, t0: performance.now() });
      wake();
    }, { passive: true });
  }

  /* ---- go ----------------------------------------------------------------- */

  rebuild();
  paintStatic();

  if ('ResizeObserver' in window) {
    let t = 0;
    new ResizeObserver(() => {
      clearTimeout(t);
      t = setTimeout(() => { rebuild(); running ? wake() : paintStatic(); }, 120);
    }).observe(band);
  }

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (!visible && raf) { cancelAnimationFrame(raf); raf = 0; running = false; }
    }).observe(band);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && raf) { cancelAnimationFrame(raf); raf = 0; running = false; }
  });
})();
