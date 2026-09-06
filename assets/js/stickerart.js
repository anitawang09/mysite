/*
 * Sticker artwork — drawn here, in original geometry.
 *
 * Die-cut look: every motif is stroked once in the paper color underneath
 * (thick, round joins) and filled on top, which is how a real vinyl sticker's
 * white border reads. Shapes are generic — a face, a bolt, a pair of eyes, a
 * year — built from my own coordinates, not traced from any existing set.
 */
window.StickerArt = (() => {
  'use strict';

  const PAPER = 'var(--sticker-paper)';

  /* one path drawn twice: die-cut border, then fill */
  function cut(d, fill, stroke) {
    return (
      `<path d="${d}" style="fill:${PAPER};stroke:${PAPER};stroke-width:13;` +
      `stroke-linejoin:round;stroke-linecap:round"/>` +
      `<path d="${d}" style="fill:${fill}${stroke ? `;stroke:${stroke};stroke-width:6;stroke-linejoin:round` : ''}"/>`
    );
  }

  function svg(inner, size) {
    return (
      `<svg viewBox="0 0 100 100" width="${size}" height="${size}" ` +
      `xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${inner}</svg>`
    );
  }

  /* ---- motifs ---------------------------------------------------------- */

  /* a face: round, off-centre smile, eyes that don't quite match */
  function face(size) {
    const body =
      `<circle cx="50" cy="50" r="45" style="fill:${PAPER}"/>` +
      `<circle cx="50" cy="50" r="41" style="fill:var(--gold)"/>` +
      `<ellipse cx="37" cy="41" rx="6" ry="10" style="fill:var(--ink-deep)"/>` +
      `<ellipse cx="64" cy="40" rx="6" ry="11" style="fill:var(--ink-deep)"/>` +
      `<path d="M30 60 Q50 79 71 58" style="fill:none;stroke:var(--ink-deep);` +
      `stroke-width:7;stroke-linecap:round"/>`;
    return { html: svg(body, size), shape: 'circle' };
  }

  /* the same face, resampled onto a coarse grid */
  function pixelFace(size) {
    const px = [
      [32, 30], [32, 38], [32, 46], [40, 38],
      [60, 30], [60, 38], [60, 46], [52, 38],
      [28, 60], [36, 66], [44, 70], [52, 70], [60, 66], [68, 60],
    ];
    const cells = px
      .map(([x, y]) => `<rect x="${x}" y="${y}" width="8" height="8" style="fill:var(--ink-deep)"/>`)
      .join('');
    const body =
      `<circle cx="50" cy="50" r="45" style="fill:${PAPER}"/>` +
      `<circle cx="50" cy="50" r="41" style="fill:var(--blue)"/>` +
      cells;
    return { html: svg(body, size), shape: 'circle' };
  }

  /* two eyes, mid-blink, looking slightly off to one side */
  function eyes(size) {
    const eye = (cx, tilt) =>
      `<ellipse cx="${cx}" cy="52" rx="21" ry="27" style="fill:${PAPER}"/>` +
      `<ellipse cx="${cx}" cy="52" rx="17" ry="23" style="fill:var(--green)"/>` +
      `<path d="M${cx - 17} 52 a17 23 0 0 0 34 0 z" style="fill:var(--ink-deep)"/>` +
      `<circle cx="${cx + tilt}" cy="46" r="5" style="fill:var(--ink-deep)"/>`;
    return { html: svg(eye(30, 2) + eye(71, -1), size), shape: 'rect' };
  }

  /* a bolt — angular, hand-cut, leaning right */
  function bolt(size) {
    const d = 'M60 8 L26 55 L45 55 L36 92 L74 43 L53 43 Z';
    return { html: svg(cut(d, 'var(--red)'), size), shape: 'rect' };
  }

  /* a five-point star with uneven arms */
  function star(size) {
    const d =
      'M50 10 L60 38 L90 40 L66 58 L75 88 L50 70 L24 87 L33 57 L10 39 L40 37 Z';
    return { html: svg(cut(d, 'var(--gold)'), size), shape: 'rect' };
  }

  /* the year, stacked two by two, in the site's own mono face */
  function year(size, text) {
    const t = (text || '2026').padEnd(4, ' ');
    const body =
      `<rect x="6" y="6" width="88" height="88" rx="16" style="fill:${PAPER}"/>` +
      `<rect x="11" y="11" width="78" height="78" rx="12" style="fill:var(--pink)"/>` +
      `<text x="50" y="46" text-anchor="middle" ` +
      `style="font:700 34px var(--font-mono);fill:var(--ink-deep)">${t.slice(0, 2)}</text>` +
      `<text x="50" y="80" text-anchor="middle" ` +
      `style="font:700 34px var(--font-mono);fill:var(--ink-deep)">${t.slice(2, 4)}</text>`;
    return { html: svg(body, size), shape: 'rect' };
  }

  const motifs = { face, pixelFace, eyes, bolt, star, year };

  /* build the DOM node the physics pile drops in */
  function make(kind, size = 74, label) {
    const build = motifs[kind];
    if (!build) return null;
    const art = build(size, label);
    const el = document.createElement('div');
    el.className = 'sticker sticker-art' + (art.shape === 'circle' ? ' is-round' : '');
    el.dataset.shape = art.shape;
    el.style.width = size + 'px';
    el.style.height = size + 'px';
    el.innerHTML = art.html;
    return el;
  }

  return { make, motifs: Object.keys(motifs) };
})();
