(() => {
  'use strict';

  const pile = document.getElementById('stickerPile');
  if (!pile || typeof Matter === 'undefined') return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canDrag = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  if (reducedMotion) {
    pile.classList.add('static');
    return;
  }

  let started = false;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting && !started) {
        started = true;
        // art stickers must be in the DOM before anything is measured
        Promise.resolve(addArtStickers()).then(start);
        observer.disconnect();
      }
    });
  }, { threshold: 0.25 });

  observer.observe(pile);

  /* Drop the drawn stickers in alongside the word tags.
     To use your own artwork instead, put files in assets/stickers/ and list
     them in assets/stickers/stickers.js; anything there is added to the pile
     as well. */
  function addArtStickers() {
    if (!window.StickerArt) return;
    const set = [
      ['face', 78], ['eyes', 82], ['bolt', 66],
      ['pixelFace', 72], ['star', 62], ['year', 70],
    ];
    set.forEach(([kind, size]) => {
      const el = window.StickerArt.make(kind, size);
      if (el) pile.appendChild(el);
    });

    return loadOwnStickers();
  }

  /* Your own artwork, listed in assets/stickers/stickers.js — a script rather
   * than a fetched JSON file, so the pile also fills in when index.html is
   * opened straight from disk. */
  function loadOwnStickers() {
    const list = window.OWN_STICKERS || [];
    return Promise.all(list.map(addOneOwnSticker));
  }

  function addOneOwnSticker(entry) {
    const spec = typeof entry === 'string' ? { file: entry } : entry || {};
    if (!spec.file) return Promise.resolve();

    const max = spec.size || 84;
    const src = 'assets/stickers/' + spec.file;

    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const nw = img.naturalWidth || max;
        const nh = img.naturalHeight || max;
        const scale = max / Math.max(nw, nh);
        const w = Math.round(nw * scale);
        const h = Math.round(nh * scale);

        const el = document.createElement('div');
        el.className = 'sticker sticker-art' + (spec.shape === 'circle' ? ' is-round' : '');
        el.dataset.shape = spec.shape === 'circle' ? 'circle' : 'rect';
        el.style.width = w + 'px';
        el.style.height = h + 'px';
        img.alt = '';
        img.width = w;
        img.height = h;
        el.appendChild(img);
        pile.appendChild(el);
        resolve();
      };
      img.onerror = () => resolve(); // a missing file shouldn't stop the pile
      img.src = src;
    });
  }

  function start() {
    const { Engine, World, Bodies, Body, Runner, Mouse, MouseConstraint } = Matter;

    const width = pile.clientWidth;
    const height = pile.clientHeight;
    const stickers = Array.from(pile.querySelectorAll('.sticker'));

    const engine = Engine.create();
    engine.gravity.y = 1;

    const wallThickness = 60;
    const walls = [
      Bodies.rectangle(width / 2, height + wallThickness / 2, width * 2, wallThickness, { isStatic: true }),
      Bodies.rectangle(-wallThickness / 2, height / 2, wallThickness, height * 4, { isStatic: true }),
      Bodies.rectangle(width + wallThickness / 2, height / 2, wallThickness, height * 4, { isStatic: true }),
    ];
    World.add(engine.world, walls);

    const bodies = stickers.map((el, i) => {
      const rect = el.getBoundingClientRect();
      const w = rect.width || 100;
      const h = rect.height || 36;
      const x = Math.random() * (width - w) + w / 2;
      const y = -60 - i * 70;
      const angle = (Math.random() - 0.5) * 0.8;

      el.style.width = w + 'px';
      el.style.height = h + 'px';
      el.style.display = 'flex';
      el.style.alignItems = 'center';
      el.style.justifyContent = 'center';

      // smooth (squircle) corners, same geometry as haoqi.design's toolkit —
      // skipped on outlined stickers, where a clip would cut the border
      if (window.Squircle && el.dataset.tone !== 'outline' && !el.classList.contains('sticker-art')) {
        window.Squircle.apply(el, 'squircle', 14);
      }

      const round = el.dataset.shape === 'circle';
      const body = round
        ? Bodies.circle(x, y, Math.min(w, h) / 2, {
            restitution: 0.5,
            friction: 0.3,
            frictionAir: 0.012,
            angle,
          })
        : Bodies.rectangle(x, y, w, h, {
            restitution: 0.4,
            friction: 0.35,
            frictionAir: 0.012,
            angle,
            chamfer: { radius: 8 },
          });
      body.stickerEl = el;
      body.stickerSize = { w, h };
      return body;
    });

    World.add(engine.world, bodies);

    if (canDrag) {
      const mouse = Mouse.create(pile);
      mouse.pixelRatio = window.devicePixelRatio || 1;
      const mouseConstraint = MouseConstraint.create(engine, {
        mouse,
        constraint: { stiffness: 0.25, render: { visible: false } },
      });
      World.add(engine.world, mouseConstraint);
      pile.addEventListener('wheel', () => {}, { passive: true });
    }

    const runner = Runner.create();
    Runner.run(runner, engine);

    function sync() {
      bodies.forEach((body) => {
        const { x, y } = body.position;
        const { w, h } = body.stickerSize;
        body.stickerEl.style.opacity = 1;
        body.stickerEl.style.transform =
          `translate(${x - w / 2}px, ${y - h / 2}px) rotate(${body.angle}rad)`;
      });
      requestAnimationFrame(sync);
    }
    requestAnimationFrame(sync);
  }
})();
