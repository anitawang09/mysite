(() => {
  'use strict';

  document.getElementById('year').textContent = new Date().getFullYear();

  /* ---------- Scroll progress bar ---------- */
  const progressBar = document.getElementById('progressBar');
  const nav = document.getElementById('nav');
  let lastScroll = 0;

  function onScroll() {
    const doc = document.documentElement;
    const scrollTop = doc.scrollTop || document.body.scrollTop;
    const height = doc.scrollHeight - doc.clientHeight;
    const pct = height > 0 ? (scrollTop / height) * 100 : 0;
    progressBar.style.width = pct + '%';

    nav.classList.toggle('scrolled', scrollTop > 40);
    if (scrollTop > lastScroll && scrollTop > 200) {
      nav.classList.add('hide');
    } else {
      nav.classList.remove('hide');
    }
    lastScroll = scrollTop;

    updateParallax(scrollTop);
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

  /* ---------- Mobile menu ---------- */
  const navToggle = document.getElementById('navToggle');
  const mobileMenu = document.getElementById('mobileMenu');
  navToggle.addEventListener('click', () => {
    mobileMenu.classList.toggle('open');
  });
  mobileMenu.querySelectorAll('a').forEach((a) => {
    a.addEventListener('click', () => mobileMenu.classList.remove('open'));
  });

  /* ---------- Scroll listener (rAF throttled) ---------- */
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
  onScroll();
})();
