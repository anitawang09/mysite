/*
 * Smooth-corner (squircle / capsule) SVG paths.
 *
 * Ported from wenhaoqiasd/wasm-utils (squircle_svg.ts), the design toolkit
 * behind haoqi.design — same radius coefficients, same curve construction,
 * so shapes here match that site's corners exactly.
 */
window.Squircle = (() => {
  'use strict';

  function getRadiusValues(radius) {
    return {
      r160: radius * 1.6,
      r103: radius * 1.03995,
      r075: radius * 0.759921,
      r010: radius * 0.108993,
      r054: radius * 0.546009,
      r020: radius * 0.204867,
      r035: radius * 0.357847,
    };
  }

  function mr(i) {
    return Math.round(Number(i) * 1000) / 1000;
  }

  /* The ported source wraps long paths across lines; CSSOM rejects a
     clip-path: path() containing newlines, so collapse runs of whitespace. */
  function tidy(d) {
    return d.replace(/\s+/g, ' ').trim();
  }

  function getShapePath(shape, width, height, radius) {
    const { r160, r103, r075, r010, r054, r020, r035 } = getRadiusValues(radius);

    if (shape === 'squircle') {
      return tidy(`M0 ${mr(r160)} C0 ${mr(r103)} 0 ${mr(r075)} ${mr(r010)} ${mr(r054)} C ${mr(r020)} ${mr(r035)} ${mr(r035)} ${mr(r020)} ${mr(r054)} ${mr(r010)} ${mr(r075)} 0 ${mr(r103)} 0 ${mr(r160)} 0
      H ${mr(width - r160)} C ${mr(width - r103)} 0 ${mr(width - r075)} 0 ${mr(width - r054)} ${mr(r010)} C ${mr(width - r035)} ${mr(r020)} ${mr(width - r020)} ${mr(r035)} ${mr(width - r010)} ${mr(r054)} C ${mr(width)} ${mr(r075)} ${mr(width)} ${mr(r103)} ${mr(width)} ${mr(r160)}
      V ${mr(height - r160)} C ${mr(width)} ${mr(height - r103)} ${mr(width)} ${mr(height - r075)} ${mr(width - r010)} ${mr(height - r054)} C ${mr(width - r020)} ${mr(height - r035)} ${mr(width - r035)} ${mr(height - r020)} ${mr(width - r054)} ${mr(height - r010)} C ${mr(width - r075)} ${mr(height)} ${mr(width - r103)} ${mr(height)} ${mr(width - r160)} ${mr(height)}
      H ${mr(r160)} C ${mr(r103)} ${mr(height)} ${mr(r075)} ${mr(height)} ${mr(r054)} ${mr(height - r010)} C ${mr(r035)} ${mr(height - r020)} ${mr(r020)} ${mr(height - r035)} ${mr(r010)} ${mr(height - r054)} C 0 ${mr(height - r075)} 0 ${mr(height - r103)} 0 ${mr(height - r160)} V ${mr(r160)} Z`);
    }

    return tidy(`M ${mr(width - r160)} 0 H ${mr(r160)} C ${mr(r103)} 0 ${mr(r075)} 0 ${mr(r054)} ${mr(r010)} C ${mr(r035)} ${mr(r020)} ${mr(r020)} ${mr(r035)} ${mr(r010)} ${mr(r054)} C 0 ${mr(r075)} 0 ${mr(radius * 0.96)} 0 ${mr(radius)} C 0 ${mr(height - radius * 0.96)} 0 ${mr(height - r075)} ${mr(r010)} ${mr(height - r054)} C ${mr(r020)} ${mr(height - r035)} ${mr(r035)} ${mr(height - r020)} ${mr(r054)} ${mr(height - r010)} C ${mr(r075)} ${mr(height)} ${mr(r103)} ${mr(height)} ${mr(r160)} ${mr(height)} H ${mr(width - r160)} H ${mr(width - r160)} C ${mr(width - r103)} ${mr(height)} ${mr(width - r075)} ${mr(height)} ${mr(width - r054)} ${mr(height - r010)} C ${mr(width - r035)} ${mr(height - r020)} ${mr(width - r020)} ${mr(height - r035)} ${mr(width - r010)} ${mr(height - r054)} C ${mr(width)} ${mr(height - r075)} ${mr(width)} ${mr(height - radius * 0.96)} ${mr(width)} ${mr(radius)} C ${mr(width)} ${mr(radius * 0.96)} ${mr(width)} ${mr(r075)} ${mr(width - r010)} ${mr(r054)} C ${mr(width - r020)} ${mr(r035)} ${mr(width - r035)} ${mr(r020)} ${mr(width - r054)} ${mr(r010)} C ${mr(width - r075)} 0 ${mr(width - r103)} 0 ${mr(width - r160)} 0 Z`);
  }

  const supportsPathClip =
    typeof CSS !== 'undefined' && CSS.supports && CSS.supports('clip-path', 'path("M0 0")');

  /* Clips an element to a smooth-corner shape, keeping it in sync with size. */
  function apply(el, shape = 'squircle', radius = 12) {
    if (!supportsPathClip || !el) return;

    const paint = () => {
      const { width, height } = el.getBoundingClientRect();
      if (!width || !height) return;
      const r = Math.min(radius, width / 3.2, height / 3.2);
      el.style.clipPath = `path("${getShapePath(shape, width, height, r)}")`;
    };

    paint();

    if (typeof ResizeObserver !== 'undefined') {
      new ResizeObserver(paint).observe(el);
    }
  }

  return { getShapePath, apply, supportsPathClip };
})();
