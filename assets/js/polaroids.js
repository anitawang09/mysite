/*
 * The work-history strip.
 *
 * The strip scrolls sideways; the page keeps scrolling down past it. Sideways
 * gestures are handed to the browser by data-lenis-prevent-horizontal in the
 * markup, so this file only adds what the browser doesn't give for free:
 * click-and-drag with a mouse, the two arrow buttons, and the progress bar.
 *
 * Photos: drop files into assets/work/ and name them in photos.js there.
 * Until a card has one, it keeps the monogram panel it was built with.
 */
(() => {
  'use strict';

  const rail = document.getElementById('workRail');
  if (!rail) return;

  const wrap = rail.closest('.rail');
  const fill = wrap && wrap.querySelector('.rail-progress i');
  const buttons = wrap ? Array.from(wrap.querySelectorAll('.rail-btn')) : [];

  const maxScroll = () => Math.max(0, rail.scrollWidth - rail.clientWidth);

  /* ---- photos ---------------------------------------------------------- */

  /* The list lives in assets/work/photos.js, loaded as a script rather than
   * fetched — fetch() refuses file:// URLs, so a page opened straight from
   * disk would otherwise show every card on its monogram. */
  const photos = window.WORK_PHOTOS || {};
  rail.querySelectorAll('.polaroid').forEach((card) => {
    const entry = photos[card.dataset.photo];
    const spec = typeof entry === 'string' ? { file: entry } : entry || {};
    if (!spec.file) return;

    const well = card.querySelector('.polaroid-photo');
    const role = card.querySelector('.polaroid-role');
    const img = new Image();
    // described for a screen reader, or named by the job it illustrates
    img.alt = spec.alt || (role ? role.textContent.trim() : '');
    img.decoding = 'async';
    // It has to be in the document for loading="lazy" to ever fire, so it
    // goes in transparent and fades up over the monogram once it decodes;
    // a file that fails to load is removed and the monogram simply stays.
    img.loading = 'lazy';
    img.onload = () => img.classList.add('is-loaded');
    img.onerror = () => img.remove();
    img.src = 'assets/work/' + spec.file;
    well.appendChild(img);
  });

  /* ---- drag with a mouse ----------------------------------------------- */

  let down = false, moved = false, startX = 0, startScroll = 0;

  rail.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch') return; // the browser already does this well
    down = true;
    moved = false;
    startX = e.clientX;
    startScroll = rail.scrollLeft;
  });

  rail.addEventListener('pointermove', (e) => {
    if (!down) return;
    const dx = e.clientX - startX;
    if (!moved && Math.abs(dx) > 4) {
      moved = true;
      rail.classList.add('is-dragging');
    }
    if (moved) {
      e.preventDefault();
      rail.scrollLeft = startScroll - dx;
    }
  });

  function release() {
    if (moved) settle();
    down = false;
    rail.classList.remove('is-dragging');
  }

  /* Let go and the strip eases to the nearest card edge, rather than parking
     mid-photo. CSS scroll-snap can't do this here — it re-snaps on every
     frame of a scripted drag and fights the pointer. */
  function settle() {
    const cards = Array.from(rail.querySelectorAll('.polaroid'));
    if (!cards.length) return;
    const railLeft = rail.getBoundingClientRect().left;
    const pad = parseFloat(getComputedStyle(rail).scrollPaddingLeft) || 0;
    let best = rail.scrollLeft;
    let bestGap = Infinity;
    cards.forEach((card) => {
      const target = rail.scrollLeft + (card.getBoundingClientRect().left - railLeft) - pad;
      const gap = Math.abs(target - rail.scrollLeft);
      if (gap < bestGap) { bestGap = gap; best = target; }
    });
    rail.scrollTo({ left: Math.min(Math.max(best, 0), maxScroll()), behavior: 'smooth' });
  }
  rail.addEventListener('pointerup', release);
  rail.addEventListener('pointercancel', release);
  rail.addEventListener('pointerleave', release);
  // a drag that ends on a card shouldn't also count as a click on it
  rail.addEventListener('click', (e) => { if (moved) e.preventDefault(); }, true);

  /* ---- arrows ---------------------------------------------------------- */

  function step() {
    const card = rail.querySelector('.polaroid');
    if (!card) return rail.clientWidth * 0.8;
    const gap = parseFloat(getComputedStyle(rail).columnGap) || 0;
    return card.getBoundingClientRect().width + gap;
  }

  buttons.forEach((b) => {
    b.addEventListener('click', () => {
      rail.scrollBy({ left: step() * Number(b.dataset.dir), behavior: 'smooth' });
    });
  });

  /* ---- progress + arrow state ------------------------------------------ */

  function sync() {
    const max = maxScroll();
    if (fill) fill.style.width = (max > 0 ? (rail.scrollLeft / max) * 100 : 100) + '%';
    buttons.forEach((b) => {
      const back = Number(b.dataset.dir) < 0;
      b.disabled = max === 0 || (back ? rail.scrollLeft <= 1 : rail.scrollLeft >= max - 1);
    });
  }

  rail.addEventListener('scroll', sync, { passive: true });
  window.addEventListener('resize', sync);
  if ('ResizeObserver' in window) new ResizeObserver(sync).observe(rail);
  sync();
})();
