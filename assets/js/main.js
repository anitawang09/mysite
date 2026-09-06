(() => {
  'use strict';

  document.getElementById('year').textContent = new Date().getFullYear();

  /* ---------- Smooth inertia scrolling (Lenis, with native fallback) ---------- */
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let lenis = null;
  if (!reducedMotion && typeof Lenis !== 'undefined') {
    lenis = new Lenis({
      duration: 1.2,
      easing: (t) => 1 - Math.pow(1 - t, 3),
      autoRaf: true,
      anchors: true,
    });
  }

  function getScrollTop() {
    if (lenis) return lenis.scroll;
    const doc = document.documentElement;
    return doc.scrollTop || document.body.scrollTop;
  }

  function getScrollProgress() {
    if (lenis) return lenis.progress * 100;
    const doc = document.documentElement;
    const height = doc.scrollHeight - doc.clientHeight;
    return height > 0 ? (getScrollTop() / height) * 100 : 0;
  }

  /* ---------- Scroll progress bar ---------- */
  const progressBar = document.getElementById('progressBar');
  const nav = document.getElementById('nav');
  const bgGrid = document.getElementById('bgGrid');
  let lastScroll = 0;

  function onScroll() {
    const scrollTop = getScrollTop();
    progressBar.style.width = getScrollProgress() + '%';

    nav.classList.toggle('scrolled', scrollTop > 40);
    if (scrollTop > lastScroll && scrollTop > 200) {
      nav.classList.add('hide');
    } else {
      nav.classList.remove('hide');
    }
    lastScroll = scrollTop;

    updateParallax(scrollTop);
    updateGrid(scrollTop);
    updateTimeline();
  }

  /* ---------- Parallax on hero background word ---------- */
  const parallaxEls = document.querySelectorAll('[data-speed]');
  function updateParallax(scrollTop) {
    parallaxEls.forEach((el) => {
      const speed = parseFloat(el.dataset.speed) || 0.2;
      el.style.transform = `translate(-50%, calc(-50% + ${scrollTop * speed * -0.15}px))`;
    });
  }

  /* ---------- Parallax on the ambient dot-grid backdrop ---------- */
  function updateGrid(scrollTop) {
    if (!bgGrid) return;
    bgGrid.style.transform = `translateY(${scrollTop * 0.08}px)`;
  }

  /* ---------- Reveal on scroll ---------- */
  const revealEls = document.querySelectorAll('.reveal');
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });

  revealEls.forEach((el) => revealObserver.observe(el));

  /* ---------- Timeline fill tied to scroll progress through section ---------- */
  const timelineSection = document.getElementById('experience');
  const timelineFill = document.getElementById('timelineFill');

  function updateTimeline() {
    if (!timelineSection || !timelineFill) return;
    const rect = timelineSection.getBoundingClientRect();
    const vh = window.innerHeight;
    const total = rect.height + vh * 0.4;
    const progressed = Math.min(Math.max(vh * 0.75 - rect.top, 0), total);
    const pct = total > 0 ? (progressed / total) * 100 : 0;
    timelineFill.style.height = pct + '%';
  }

  /* ---------- Custom cursor ---------- */
  const cursorDot = document.getElementById('cursorDot');
  const cursorRing = document.getElementById('cursorRing');
  const supportsHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  if (supportsHover) {
    let ringX = 0, ringY = 0, mouseX = 0, mouseY = 0;
    window.addEventListener('mousemove', (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      cursorDot.style.opacity = 1;
      cursorRing.style.opacity = 1;
      cursorDot.style.left = mouseX + 'px';
      cursorDot.style.top = mouseY + 'px';
    });

    function animateRing() {
      ringX += (mouseX - ringX) * 0.15;
      ringY += (mouseY - ringY) * 0.15;
      cursorRing.style.left = ringX + 'px';
      cursorRing.style.top = ringY + 'px';
      requestAnimationFrame(animateRing);
    }
    animateRing();

    document.querySelectorAll('.magnetic').forEach((el) => {
      el.addEventListener('mouseenter', () => cursorRing.classList.add('active'));
      el.addEventListener('mouseleave', () => cursorRing.classList.remove('active'));
    });
  }

  /* ---------- Palette chooser ----------
     Temporary, for picking a palette. Remove this block, #paletteBar, and
     the .palette-bar styles once one is chosen. */
  const paletteBar = document.getElementById('paletteBar');
  if (paletteBar) {
    // ground + accent of each palette, mirroring the light tokens in style.css
    const palettes = ['ink', 'butter', 'periwinkle', 'sage', 'apricot', 'blush'];
    const preview = {
      ink:        ['oklch(0.305 0.055 258)', 'oklch(0.825 0.14 80)'],
      butter:     ['oklch(0.945 0.055 92)',  'oklch(0.575 0.19 28)'],
      periwinkle: ['oklch(0.925 0.048 268)', 'oklch(0.635 0.18 32)'],
      sage:       ['oklch(0.925 0.042 148)', 'oklch(0.585 0.16 42)'],
      apricot:    ['oklch(0.915 0.062 62)',  'oklch(0.455 0.14 258)'],
      blush:      ['oklch(0.928 0.045 18)',  'oklch(0.575 0.185 15)'],
    };
    let active = 'ink';
    try {
      active = localStorage.getItem('palette') || 'ink';
    } catch (e) { /* private mode */ }
    if (!palettes.includes(active)) active = 'ink';
    document.documentElement.dataset.palette = active;

    const swatches = palettes.map((name) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'palette-swatch';
      b.title = name;
      b.setAttribute('aria-label', name);
      b.setAttribute('aria-pressed', String(name === active));
      const [ground, accent] = preview[name];
      b.style.background = `linear-gradient(135deg, ${ground} 55%, ${accent} 55%)`;

      b.addEventListener('click', () => {
        document.documentElement.dataset.palette = name;
        try { localStorage.setItem('palette', name); } catch (e) { /* ignore */ }
        swatches.forEach((s) => s.setAttribute('aria-pressed', String(s === b)));
      });
      paletteBar.appendChild(b);
      return b;
    });
  }

  /* ---------- Smooth corners ----------
     Clipping cuts through a border, so only solid-filled elements get the
     squircle path; outlined ones keep their border-radius. */
  if (window.Squircle) {
    document.querySelectorAll('.btn-primary').forEach((el) => {
      window.Squircle.apply(el, 'capsule', 12);
    });
  }

  /* ---------- Mobile menu ---------- */
  const navToggle = document.getElementById('navToggle');
  const mobileMenu = document.getElementById('mobileMenu');
  navToggle.addEventListener('click', () => {
    mobileMenu.classList.toggle('open');
  });
  mobileMenu.querySelectorAll('a').forEach((a) => {
    a.addEventListener('click', () => mobileMenu.classList.remove('open'));
  });

  /* ---------- Scroll listener ---------- */
  if (lenis) {
    lenis.on('scroll', onScroll);
  } else {
    let ticking = false;
    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          onScroll();
          ticking = false;
        });
        ticking = true;
      }
    });
  }
  onScroll();
})();
