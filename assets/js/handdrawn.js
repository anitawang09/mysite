/*
 * Hand-drawn marks — original artwork, generated rather than traced.
 *
 * Every stroke here is built from scratch: points walked along a shape with a
 * little perpendicular wobble, smoothed into curves, with the jitter tapering
 * at the ends the way a real pen stroke settles. A seeded random keeps each
 * mark stable between redraws, so the page has consistent imperfections
 * instead of twitching ones.
 */
window.HandDrawn = (() => {
  'use strict';

  /* deterministic noise, so a mark redraws identically */
  function seeded(seed) {
    let s = (seed || 1) >>> 0;
    return () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  /* points -> smooth path (catmull-rom converted to cubic beziers) */
  function smooth(pts, close) {
    if (pts.length < 2) return '';
    const p = pts.slice();
    if (close) p.push(p[0], p[1]);
    let d = `M ${r(p[0][0])} ${r(p[0][1])}`;
    for (let i = 0; i < p.length - 1; i++) {
      const p0 = p[i - 1] || p[i];
      const p1 = p[i];
      const p2 = p[i + 1];
      const p3 = p[i + 2] || p2;
      const c1x = p1[0] + (p2[0] - p0[0]) / 6;
      const c1y = p1[1] + (p2[1] - p0[1]) / 6;
      const c2x = p2[0] - (p3[0] - p1[0]) / 6;
      const c2y = p2[1] - (p3[1] - p1[1]) / 6;
      d += ` C ${r(c1x)} ${r(c1y)} ${r(c2x)} ${r(c2y)} ${r(p2[0])} ${r(p2[1])}`;
    }
    return d;
  }

  const r = (n) => Math.round(n * 100) / 100;

  /* a line that wanders slightly off true */
  function line(x1, y1, x2, y2, opts = {}) {
    const { amp = 2.2, step = 26, rnd = Math.random } = opts;
    const len = Math.hypot(x2 - x1, y2 - y1) || 1;
    const n = Math.max(2, Math.round(len / step));
    const nx = -(y2 - y1) / len;
    const ny = (x2 - x1) / len;
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const taper = Math.sin(Math.PI * t) * 0.8 + 0.2;
      const off = (rnd() * 2 - 1) * amp * taper;
      pts.push([x1 + (x2 - x1) * t + nx * off, y1 + (y2 - y1) * t + ny * off]);
    }
    return smooth(pts);
  }

  /* the loop you draw around a word you want to come back to */
  function ellipse(cx, cy, rx, ry, opts = {}) {
    const { amp = 4, rnd = Math.random, overshoot = 0.42 } = opts;
    const start = -0.5 + (rnd() - 0.5) * 0.3;
    const end = start + Math.PI * 2 + overshoot;
    const steps = 34;
    const pts = [];
    for (let i = 0; i <= steps; i++) {
      const a = start + ((end - start) * i) / steps;
      const wob = 1 + (rnd() * 2 - 1) * (amp / 100);
      pts.push([cx + Math.cos(a) * rx * wob, cy + Math.sin(a) * ry * wob]);
    }
    return smooth(pts);
  }

  /* a wave, for underlining something with feeling */
  function squiggle(x1, y1, x2, opts = {}) {
    const { amp = 3, wave = 14, rnd = Math.random } = opts;
    const len = x2 - x1;
    const n = Math.max(4, Math.round(len / wave));
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const y = y1 + Math.sin(t * Math.PI * n * 0.9) * amp + (rnd() * 2 - 1) * 0.9;
      pts.push([x1 + len * t, y]);
    }
    return smooth(pts);
  }

  /* a box sketched in four strokes, corners overshooting like real pen work */
  function frame(w, h, opts = {}) {
    const { amp = 2.6, inset = 3, rnd = Math.random } = opts;
    const o = () => (rnd() * 2 - 1) * 6;
    const x1 = inset, y1 = inset, x2 = w - inset, y2 = h - inset;
    return [
      line(x1 + o(), y1, x2 + o(), y1, { amp, rnd }),
      line(x2, y1 + o(), x2, y2 + o(), { amp, rnd }),
      line(x2 + o(), y2, x1 + o(), y2, { amp, rnd }),
      line(x1, y2 + o(), x1, y1 + o(), { amp, rnd }),
    ];
  }

  /* an arrow that curves the way a hand curves it */
  function arrow(w, h, opts = {}) {
    const { rnd = Math.random } = opts;
    const pts = [];
    const steps = 16;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      pts.push([
        w * t + (rnd() * 2 - 1) * 1.2,
        h * (t * t * 0.9 + t * 0.08) + (rnd() * 2 - 1) * 1.2,
      ]);
    }
    const shaft = smooth(pts);
    const tip = pts[pts.length - 1];
    const head1 = line(tip[0], tip[1], tip[0] - w * 0.22, tip[1] - h * 0.10, { amp: 1, rnd });
    const head2 = line(tip[0], tip[1], tip[0] - w * 0.05, tip[1] - h * 0.26, { amp: 1, rnd });
    return [shaft, head1, head2];
  }

  const SVG = 'http://www.w3.org/2000/svg';

  function makeSvg(w, h, paths, cls, strokeWidth) {
    const svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('class', cls);
    svg.setAttribute('viewBox', `0 0 ${r(w)} ${r(h)}`);
    svg.setAttribute('width', w);
    svg.setAttribute('height', h);
    svg.setAttribute('fill', 'none');
    svg.setAttribute('aria-hidden', 'true');
    paths.forEach((d) => {
      const p = document.createElementNS(SVG, 'path');
      p.setAttribute('d', d);
      p.setAttribute('stroke', 'currentColor');
      p.setAttribute('stroke-width', strokeWidth || 1.6);
      p.setAttribute('stroke-linecap', 'round');
      p.setAttribute('stroke-linejoin', 'round');
      svg.appendChild(p);
    });
    return svg;
  }

  /* draw a mark into an element and keep it in step with the element's size */
  function decorate(el, kind, options = {}) {
    if (!el) return;
    const seed = hash((el.textContent || '') + kind + (options.seed || ''));

    const paint = () => {
      const { width, height } = el.getBoundingClientRect();
      if (!width || !height) return;
      const old = el.querySelector(':scope > .hd-mark');
      if (old) old.remove();

      const rnd = seeded(seed);
      let paths = [];
      let w = width;
      let h = height;

      if (kind === 'circle') {
        // A loop only works round a phrase that sits on one line. When the
        // text wraps, underline each line instead — same pen, different mark.
        const rects = Array.from(el.getClientRects());
        if (rects.length > 1) {
          const box = el.getBoundingClientRect();
          paths = rects.map((rc) =>
            squiggle(rc.left - box.left + 1, rc.bottom - box.top - 2, rc.right - box.left - 1, {
              rnd,
              amp: 2,
            })
          );
        } else {
          // the loop swings wider than the phrase; on a narrow screen that
          // swing has to fit the room left either side, or it runs off-page
          const box = el.getBoundingClientRect();
          const room = Math.max(4, Math.min(box.left, window.innerWidth - box.right) - 2);
          const padX = Math.min(width * 0.10 + 12, room);
          const padY = Math.min(height * 0.45 + 8, 26);
          w = width + padX * 2;
          h = height + padY * 2;
          paths = [ellipse(w / 2, h / 2, w / 2 - 3, h / 2 - 3, { rnd, amp: options.amp ?? 4 })];
        }
      } else if (kind === 'underline') {
        w = width;
        h = 12;
        // longer waves under bigger type, so the stroke stays relaxed
        paths = [squiggle(2, 6, width - 2, {
          rnd,
          amp: options.amp ?? 2.4,
          wave: Math.max(13, height * 0.5),
        })];
      } else if (kind === 'frame') {
        paths = frame(width, height, { rnd, amp: options.amp ?? 2.6 });
      } else if (kind === 'rule') {
        w = width;
        h = 14;
        paths = [line(2, 7, width - 2, 7, { rnd, amp: options.amp ?? 2.2, step: 34 })];
      } else if (kind === 'arrow') {
        paths = arrow(width, height, { rnd });
      }

      const svg = makeSvg(w, h, paths, 'hd-mark hd-' + kind, options.strokeWidth);
      if (kind === 'circle') {
        svg.style.left = `${-(w - width) / 2}px`;
        svg.style.top = `${-(h - height) / 2}px`;
      } else if (kind === 'underline') {
        // sit just under the text box, in px — an em offset would scale with
        // whatever font-size the mark happens to be inheriting
        svg.style.top = `${height - 5}px`;
        svg.style.bottom = 'auto';
        svg.style.right = 'auto';
      }
      el.appendChild(svg);

      if (options.draw) {
        svg.querySelectorAll('path').forEach((p, i) => {
          const len = p.getTotalLength();
          p.style.strokeDasharray = len;
          p.style.strokeDashoffset = len;
          p.style.animation = `hd-draw .7s ${0.15 + i * 0.12}s cubic-bezier(.4,.1,.3,1) forwards`;
        });
      }
    };

    paint();
    if (typeof ResizeObserver !== 'undefined') {
      let t;
      new ResizeObserver(() => {
        clearTimeout(t);
        t = setTimeout(paint, 120);
      }).observe(el);
    }
  }

  function init() {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.querySelectorAll('[data-hand]').forEach((el) => {
      const kind = el.dataset.hand;
      const draw = !reduce && el.hasAttribute('data-hand-draw');
      if (draw) {
        // only start drawing once it's actually on screen
        const io = new IntersectionObserver((entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting) {
              decorate(el, kind, { draw: true, strokeWidth: el.dataset.handWidth });
              io.disconnect();
            }
          });
        }, { threshold: 0.4 });
        io.observe(el);
      } else {
        decorate(el, kind, { strokeWidth: el.dataset.handWidth });
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return { decorate, line, ellipse, squiggle, frame, arrow };
})();
