/*
 * Work history as a carousel on a circle.
 *
 * The cards sit on a ring in 3D: each one is turned to its own place around
 * the circle and pushed out to the radius, and spinning the ring brings one
 * after another to the front. The radius comes from the geometry rather than
 * a guess — for n cards of pitch p, the circle whose chord between
 * neighbours is p has radius p / (2·sin(π/n)) — so the cards sit edge to edge
 * however many there are.
 *
 * One departure from the usual version of this: the cards are billboarded,
 * counter-rotated so they always face the viewer square on. A card here is
 * mostly text, and text on a surface turned away from you is unreadable. The
 * ring still reads as a ring because the cards travel on it and recede with
 * depth; they just never turn edge-on.
 *
 * Photos: drop files into assets/work/ and name them in photos.js there.
 * Until a card has one, it keeps the monogram panel it was built with.
 */
(() => {
  'use strict';

  const ring = document.getElementById('workRing');
  if (!ring) return;

  const track = ring.querySelector('.ring-track');
  const stage = ring.querySelector('.ring-stage');
  const camera = ring.querySelector('.ring-camera');
  const live = ring.querySelector('.ring-live');
  const wrapEl = ring.closest('.rail');
  const fill = wrapEl && wrapEl.querySelector('.rail-progress i');
  const buttons = wrapEl ? Array.from(wrapEl.querySelectorAll('.rail-btn')) : [];
  const cards = Array.from(track.querySelectorAll('.polaroid'));
  const count = cards.length;
  if (!count) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* ---- geometry --------------------------------------------------------- */

  const STEP = 360 / count;
  const TO_RAD = Math.PI / 180;
  const SPRING = 118;          // settle stiffness
  const DRAG_THRESHOLD = 5;    // px before a press counts as a drag
  const TILT = -7;             // the ring leans back a little

  const clamp = (n, lo, hi) => (n < lo ? lo : n > hi ? hi : n);
  // nearest equivalent angle in (-180, 180]
  const wrapDeg = (d) => ((((d + 180) % 360) + 360) % 360) - 180;

  let cardW = 0;
  let radius = 0;
  let perPixel = 0.2;          // degrees of spin per pixel dragged

  function measure() {
    cardW = cards[0].offsetWidth || 300;
    const gap = Math.max(24, cardW * 0.12);
    const pitch = cardW + gap;

    // Billboarded cards stay flat on, so what has to clear its neighbour is
    // the card's own width, not the chord of the arc it sits on: the sideways
    // gap between neighbours is radius·sin(step). Solving that for one pitch
    // is what keeps the card beside the front one from sitting on top of it.
    radius = pitch / Math.sin(STEP * TO_RAD);
    perPixel = 180 / (Math.PI * radius);

    stage.style.perspective = Math.round(radius * 3) + 'px';
    camera.style.transform =
      `translate3d(0, 0, ${-Math.round(radius)}px) rotateX(${TILT}deg)`;

    // The box has to fit whichever card is tallest once it reaches the front,
    // or the one with the most text would hang into the section below. Layout
    // height ignores the transform, so it is the same whatever the ring is
    // doing; the margin covers the perspective scale at the front and the lean.
    let tallest = 0;
    for (const card of cards) tallest = Math.max(tallest, card.offsetHeight);
    ring.style.setProperty('--ring-h', Math.ceil(tallest * 1.12) + 'px');
  }

  /* ---- state ------------------------------------------------------------ */

  const state = {
    angle: 0,        // ring rotation, degrees
    velocity: 0,     // degrees per second
    target: 0,       // where it's settling to
    dragging: false,
    press: null,
    active: -1,
    last: 0,
    raf: 0,
    visible: true,
  };

  /* ---- paint ------------------------------------------------------------ */

  function paint() {
    track.style.transform = `rotateY(${state.angle}deg)`;

    for (let i = 0; i < count; i++) {
      const base = i * STEP;
      // billboard: turn the card to its seat, push it out, then turn it back
      cards[i].style.transform =
        `rotateY(${base}deg) translateZ(${radius}px) rotateY(${-(base + state.angle)}deg)`;

      // how far round the back this card is: 1 at the front, 0 behind.
      // Curved, because a plain cosine leaves the card beside the front one
      // nearly as loud as the front one and the group reads as a scrum.
      const facing = (Math.cos(wrapDeg(base + state.angle) * TO_RAD) + 1) / 2;
      cards[i].style.setProperty('--face', Math.pow(facing, 2.1).toFixed(3));
      // only the card at the front takes clicks; the rest are scenery
      cards[i].classList.toggle('is-front', facing > 0.97);
    }

    const index = ((Math.round(-state.angle / STEP) % count) + count) % count;
    if (index !== state.active) {
      state.active = index;
      const role = cards[index].querySelector('.polaroid-role');
      const org = cards[index].querySelector('.polaroid-org');
      if (live && role) {
        live.textContent =
          `${role.textContent.trim()}, ${org ? org.textContent.trim() + ', ' : ''}` +
          `${index + 1} of ${count}`;
      }
      if (fill) fill.style.width = ((index + 1) / count) * 100 + '%';
      buttons.forEach((b) => b.removeAttribute('disabled')); // a ring never ends
    }
  }

  /* ---- motion ----------------------------------------------------------- */

  function frame(now) {
    state.raf = 0;
    const dt = state.last ? Math.min((now - state.last) / 1000, 0.05) : 1 / 60;
    state.last = now;

    let busy = state.dragging;
    if (!state.dragging) {
      // critically damped spring onto the nearest card
      const damping = 2 * Math.sqrt(SPRING);
      let remaining = dt;
      while (remaining > 0) {
        const h = Math.min(remaining, 1 / 240);
        state.velocity += (SPRING * (state.target - state.angle) - damping * state.velocity) * h;
        state.angle += state.velocity * h;
        remaining -= h;
      }
      if (Math.abs(state.target - state.angle) < 0.01 && Math.abs(state.velocity) < 0.05) {
        state.angle = state.target;
        state.velocity = 0;
      } else {
        busy = true;
      }
    }

    paint();
    if (busy && state.visible && !document.hidden) state.raf = requestAnimationFrame(frame);
    else state.last = 0;
  }

  function wake() {
    if (!state.raf && state.visible && !document.hidden) state.raf = requestAnimationFrame(frame);
  }

  function settleTo(angle) {
    state.target = angle;
    if (reducedMotion) {
      state.angle = angle;
      state.velocity = 0;
      paint();
      return;
    }
    wake();
  }

  const nearest = (a) => Math.round(a / STEP) * STEP;

  function stepBy(n) { settleTo(nearest(state.target) - n * STEP); }

  function focusCard(i) {
    // spin whichever way is shorter rather than unwinding the long way round
    let want = -i * STEP;
    want += 360 * Math.round((state.angle - want) / 360);
    settleTo(want);
  }

  /* ---- drag ------------------------------------------------------------- */

  ring.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    state.press = {
      id: e.pointerId, x: e.clientX, y: e.clientY,
      angle: state.angle, moved: false, origin: 0,
      samples: [{ t: performance.now(), a: state.angle }],
    };
  });

  ring.addEventListener('pointermove', (e) => {
    const p = state.press;
    if (!p || p.id !== e.pointerId) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;

    if (!p.moved) {
      if (Math.abs(dx) < DRAG_THRESHOLD) return;
      // on a touch screen a mostly-vertical swipe belongs to the page, not the ring
      if (!finePointer && Math.abs(dy) > Math.abs(dx) * 1.2) { state.press = null; return; }
      p.moved = true;
      p.origin = dx;
      state.dragging = true;
      state.velocity = 0;
      ring.classList.add('is-dragging');
      try { ring.setPointerCapture(e.pointerId); } catch (err) { /* not capturable */ }
    }

    e.preventDefault();
    state.angle = p.angle + (dx - p.origin) * perPixel;
    const now = performance.now();
    p.samples.push({ t: now, a: state.angle });
    while (p.samples.length > 2 && now - p.samples[0].t > 110) p.samples.shift();
    wake();
  });

  function release(e) {
    const p = state.press;
    if (!p || (e && p.id !== e.pointerId)) return;
    state.press = null;
    if (!p.moved) return;
    state.dragging = false;
    ring.classList.remove('is-dragging');

    // carry the throw into the choice of card, so a flick travels
    const first = p.samples[0];
    const last = p.samples[p.samples.length - 1];
    const span = (last.t - first.t) / 1000;
    const velocity = span > 0.008 ? clamp((last.a - first.a) / span, -1400, 1400) : 0;
    state.velocity = velocity;
    settleTo(nearest(state.angle + velocity * 0.12));
  }
  ring.addEventListener('pointerup', release);
  ring.addEventListener('pointercancel', release);

  // a drag that ends on a card shouldn't also count as a click on it
  ring.addEventListener('click', (e) => {
    const card = e.target.closest('.polaroid');
    if (!card) return;
    const i = cards.indexOf(card);
    if (i >= 0 && i !== state.active) { e.preventDefault(); focusCard(i); }
  });

  /* ---- arrows, keys, sideways wheel -------------------------------------- */

  buttons.forEach((b) => {
    b.addEventListener('click', () => stepBy(Number(b.dataset.dir)));
  });

  ring.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') stepBy(1);
    else if (e.key === 'ArrowLeft') stepBy(-1);
    else if (e.key === 'Home') focusCard(0);
    else if (e.key === 'End') focusCard(count - 1);
    else return;
    e.preventDefault();
  });

  // a trackpad swipe sideways spins the ring; anything vertical is the page's
  let wheelTimer = 0;
  ring.addEventListener('wheel', (e) => {
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
    e.preventDefault();
    state.angle -= e.deltaX * perPixel;
    state.target = state.angle;
    paint();
    clearTimeout(wheelTimer);
    wheelTimer = setTimeout(() => settleTo(nearest(state.angle)), 140);
  }, { passive: false });

  /* ---- photos ------------------------------------------------------------ */

  /* The list lives in assets/work/photos.js, loaded as a script rather than
   * fetched — fetch() refuses file:// URLs, so a page opened straight from
   * disk would otherwise show every card on its monogram. */
  const photos = window.WORK_PHOTOS || {};
  cards.forEach((card) => {
    const entry = photos[card.dataset.photo];
    const spec = typeof entry === 'string' ? { file: entry } : entry || {};
    if (!spec.file) return;

    const well = card.querySelector('.polaroid-photo');
    const role = card.querySelector('.polaroid-role');
    const img = new Image();
    img.alt = spec.alt || (role ? role.textContent.trim() : '');
    img.decoding = 'async';
    // It has to be in the document for loading="lazy" to ever fire, so it goes
    // in transparent and fades up over the monogram once it decodes; a file
    // that fails to load is removed and the monogram simply stays.
    img.loading = 'lazy';
    img.onload = () => img.classList.add('is-loaded');
    img.onerror = () => img.remove();
    img.src = 'assets/work/' + spec.file;
    well.appendChild(img);
  });

  /* ---- go ---------------------------------------------------------------- */

  measure();
  paint();

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { measure(); paint(); }, 160);
  });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      state.visible = entry.isIntersecting;
      if (state.visible) wake();
      else { cancelAnimationFrame(state.raf); state.raf = 0; state.last = 0; }
    }).observe(ring);
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { cancelAnimationFrame(state.raf); state.raf = 0; state.last = 0; }
    else wake();
  });
})();
