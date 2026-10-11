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
 * Three things are done differently here, for this page:
 *
 *  - The canvas never takes a pointer event. It sits behind the contact copy,
 *    and the original listens on its own container, which would have put a
 *    sheet over the email link and the LinkedIn link. The band listens
 *    instead and passes coordinates down.
 *  - The colour is read from CSS rather than passed as a hex prop, so it
 *    follows the palette along with everything else on the page.
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

  const CELL = 64;
  const RADIUS = 150;
  const HOLD = 380;          // ms a cell stays lit before it starts fading
  const FADE = 900;          // ms a fully lit cell takes to fade out
  const LINE_WIDTH = 1.1;
  const MAX_OPACITY = 0.5;   // it sits behind text, so it never goes full strength
  const FILL_OPACITY = 0.07;
  const LATTICE = 0.05;      // the faint always-there grid, echoing the page's own
  const CELL_RADIUS = 3;
  const PULSE_SPEED = 620;   // px per second

  const smooth = (t) => t * t * (3 - 2 * t);

  /* ---- state ------------------------------------------------------------- */

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let cols = 0, rows = 0, offX = 0, offY = 0, w = 0, h = 0;
  let alphas = new Float32Array(0);
  let touched = new Float64Array(0);
  const pulses = [];
  let raf = 0, running = false, lastFrame = 0, visible = true;
  let ink = [33, 35, 40];

  /* The palette is authored in oklch, and that is exactly what computed style
     hands back — parsing numbers out of it would read 0.585 as a red channel.
     Painting one pixel and reading it back resolves any colour syntax the
     browser understands, which is the point of keeping it in CSS. */
  function readInk() {
    const css = getComputedStyle(canvas).color;
    try {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = css;
      ctx.fillRect(0, 0, 1, 1);
      const d = ctx.getImageData(0, 0, 1, 1).data;
      if (d[3] > 0) ink = [d[0], d[1], d[2]];
      ctx.clearRect(0, 0, 1, 1);
      ctx.restore();
    } catch (err) {
      const m = css.match(/\d+(\.\d+)?/g);          // rgb() fallback
      if (m && m.length >= 3) ink = [+m[0], +m[1], +m[2]];
    }
  }

  function rebuild() {
    w = band.offsetWidth;
    h = band.offsetHeight;
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cols = Math.ceil(w / CELL) + 1;
    rows = Math.ceil(h / CELL) + 1;
    // centre the lattice so the edge cells crop evenly on both sides
    offX = (w - cols * CELL) / 2;
    offY = (h - rows * CELL) / 2;
    alphas = new Float32Array(cols * rows);
    touched = new Float64Array(cols * rows);
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

  function lattice(r, g, b) {
    if (LATTICE <= 0) return;
    ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${LATTICE})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let c = 0; c <= cols; c++) {
      const x = Math.round(offX + c * CELL) + 0.5;
      ctx.moveTo(x, 0); ctx.lineTo(x, h);
    }
    for (let r2 = 0; r2 <= rows; r2++) {
      const y = Math.round(offY + r2 * CELL) + 0.5;
      ctx.moveTo(0, y); ctx.lineTo(w, y);
    }
    ctx.stroke();
  }

  function draw(now) {
    const dt = Math.min(now - lastFrame, 50);
    lastFrame = now;
    const [r, g, b] = ink;
    ctx.clearRect(0, 0, w, h);
    lattice(r, g, b);

    // expanding click rings hand their energy to cells as they pass
    const reach = Math.hypot(w, h);
    for (let pi = pulses.length - 1; pi >= 0; pi--) {
      const p = pulses[pi];
      const ringR = ((now - p.t0) / 1000) * PULSE_SPEED;
      if (ringR > reach) { pulses.splice(pi, 1); continue; }
      const band2 = CELL;
      const minCol = Math.max(0, Math.floor((p.x - ringR - band2 - offX) / CELL));
      const maxCol = Math.min(cols - 1, Math.floor((p.x + ringR + band2 - offX) / CELL));
      const minRow = Math.max(0, Math.floor((p.y - ringR - band2 - offY) / CELL));
      const maxRow = Math.min(rows - 1, Math.floor((p.y + ringR + band2 - offY) / CELL));
      for (let cr = minRow; cr <= maxRow; cr++) {
        for (let cc = minCol; cc <= maxCol; cc++) {
          const i = cr * cols + cc;
          const d = Math.hypot(centreX(i) - p.x, centreY(i) - p.y);
          if (Math.abs(d - ringR) < band2 / 2 && MAX_OPACITY > alphas[i]) {
            alphas[i] = MAX_OPACITY; touched[i] = now;
          }
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

      const cx = centreX(i), cy = centreY(i);
      const grad = ctx.createRadialGradient(cx, cy, half * 0.1, cx, cy, CELL);
      grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${a})`);
      grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

      ctx.beginPath();
      ctx.roundRect(cx - half + 0.5, cy - half + 0.5, CELL - 1, CELL - 1, CELL_RADIUS);
      if (FILL_OPACITY > 0) {
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${a * FILL_OPACITY})`;
        ctx.fill();
      }
      ctx.strokeStyle = grad;
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
    lattice(ink[0], ink[1], ink[2]);
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
