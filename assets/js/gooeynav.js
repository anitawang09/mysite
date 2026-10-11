/*
 * Gooey header navigation.
 *
 * A port of React Bits' GooeyNav to vanilla JS — this site has no React and no
 * build step. The engine is theirs: the active pill is a signed-distance
 * field drawn by a WebGL2 fragment shader, and choosing another item breaks
 * the pill into droplets that fly along bezier paths and melt back together
 * in the new place. The text inside the pill is a second, duplicate list
 * clipped to the traced outline of the blob, so the label colour inverts
 * exactly where the pill is, however the blob is deformed.
 *
 * What is different here, for this page:
 *
 *  - The pill follows the reader. Selection is driven by scroll position as
 *    well as by clicks, so the blob flows to whichever section you are in.
 *    A click locks the follower until the page arrives, otherwise a smooth
 *    scroll past three sections would fire three transfers on the way.
 *  - There can be no selection. At the top of the page you are in the hero,
 *    which has no item, so the pill shrinks away and blooms back in place
 *    when you reach About, instead of pretending About is where you are.
 *  - Colours come from the page's CSS tokens, not props. The palette is
 *    authored in oklch, which a shader can't take, so each colour is painted
 *    to one pixel and read back as RGB.
 *  - The header is held in view while a click's transfer plays. The page
 *    hides its header on the way down, and a click scrolls down, so without
 *    this the droplets would fly while nobody could see them.
 *  - The links stay real anchors with real hrefs, and Lenis keeps scrolling
 *    to them. The markup works without any of this script.
 */
(() => {
  'use strict';

  const nav = document.getElementById('gooeyNav');
  const stage = nav && nav.querySelector('.gooey-nav__stage');
  const list = nav && nav.querySelector('.gooey-nav__list');
  if (!nav || !stage || !list) return;

  const items = Array.from(list.children);
  const anchors = items.map((li) => li.querySelector('a'));
  if (!items.length) return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- settings (the component's defaults) -------------------------------- */

  const OPTIONS = {
    animationTime: 600,   // ms, roughly, for the droplets to reach the new item
    particleCount: 15,
    timeVariance: 300,    // ms of random variation in each droplet's timing
    spread: 56,           // px the droplets scatter on the way
    gooeyness: 0.5,       // 0..1, how readily droplets and pills melt together
    wobble: 0.5,          // 0..1, how much the new pill wobbles as it forms
    hoverEffect: true,
  };

  const MAX_DROPS = 32;
  const MAX_PILLS = 4;
  const MARGIN = 72;      // the canvas runs this far past the nav, so droplets can leave it

  /* ---- shaders ------------------------------------------------------------ */

  const VERTEX = `#version 300 es
in vec2 aPosition;
void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

  const FRAGMENT = `#version 300 es
precision highp float;

uniform vec2 uSize;
uniform float uRatio;
uniform vec4 uPills[${MAX_PILLS}];
uniform vec4 uHover;
uniform vec4 uDrops[${MAX_DROPS}];
uniform vec2 uTails[${MAX_DROPS}];
uniform vec3 uTints[${MAX_DROPS}];
uniform int uCount;
uniform float uSmooth;
uniform vec3 uPill;
uniform vec4 uHoverColor;
uniform float uShadow;

out vec4 outColor;

float sdPill(vec2 p, vec4 box) {
  vec2 extent = max(box.zw, vec2(0.0));
  float r = min(extent.x, extent.y);
  vec2 q = abs(p - box.xy) - extent + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

float sdCapsule(vec2 p, vec2 a, vec2 b, float r) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 0.0001), 0.0, 1.0);
  return length(pa - ba * h) - r;
}

vec4 blend(vec4 a, vec4 b, float k) {
  float h = clamp(0.5 + 0.5 * (b.w - a.w) / k, 0.0, 1.0);
  return vec4(mix(b.rgb, a.rgb, h), mix(b.w, a.w, h) - k * h * (1.0 - h));
}

vec4 field(vec2 p) {
  vec4 shape = vec4(uPill, 1e5);
  for (int i = 0; i < ${MAX_PILLS}; i++) {
    vec4 pill = uPills[i];
    if (pill.z <= 0.0) continue;
    shape = blend(shape, vec4(uPill, sdPill(p, pill)), uSmooth);
  }
  for (int i = 0; i < ${MAX_DROPS}; i++) {
    if (i >= uCount) break;
    vec4 drop = uDrops[i];
    if (drop.z <= 0.0) continue;
    float d = sdCapsule(p, drop.xy, drop.xy - uTails[i], drop.z);
    if (d > shape.w + uSmooth) continue;
    shape = blend(shape, vec4(uTints[i], d), uSmooth);
  }
  return shape;
}

void main() {
  vec2 p = vec2(gl_FragCoord.x, uSize.y * uRatio - gl_FragCoord.y) / uRatio;
  vec4 shape = field(p);
  float d = shape.w;
  float aa = max(fwidth(d), 0.35);
  float body = clamp(0.5 - d / aa, 0.0, 1.0);

  vec2 grad = vec2(dFdx(d), -dFdy(d));
  vec2 n = length(grad) > 0.0001 ? normalize(grad) : vec2(0.0, 1.0);
  float rim = (1.0 - smoothstep(0.0, 1.6, -d)) * max(0.0, -n.y) * 0.3;
  vec3 fill = mix(shape.rgb, vec3(1.0), rim) * (1.0 - 0.06 * max(0.0, n.y) * (1.0 - smoothstep(0.0, 6.0, -d)));

  float lifted = field(p - vec2(0.0, 3.0)).w;
  float shadow = (1.0 - smoothstep(-3.0, 9.0, lifted)) * uShadow * (1.0 - body);

  float hover = clamp(0.5 - sdPill(p, uHover) / aa, 0.0, 1.0) * uHoverColor.a;

  vec4 color = vec4(0.0, 0.0, 0.0, shadow);
  color = vec4(uHoverColor.rgb * hover, hover) + color * (1.0 - hover);
  color = vec4(fill * body, body) + color * (1.0 - body);
  outColor = color;
}
`;

  /* ---- small helpers ------------------------------------------------------- */

  const clamp01 = (v) => Math.min(1, Math.max(0, v));

  const travelEase = (t) => {
    const x = clamp01(t);
    return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
  };

  const bezier = (a, b, c, d, t) => {
    const u = 1 - t;
    return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d;
  };

  const pillPath = (x, y, w, h) => {
    if (w <= 0.5 || h <= 0.5) return '';
    const r = Math.min(w, h) / 2;
    return `M${x + r},${y}H${x + w - r}A${r},${r} 0 0 1 ${x + w},${y + r}V${y + h - r}` +
      `A${r},${r} 0 0 1 ${x + w - r},${y + h}H${x + r}A${r},${r} 0 0 1 ${x},${y + h - r}` +
      `V${y + r}A${r},${r} 0 0 1 ${x + r},${y}Z`;
  };

  /* Any CSS colour → [r, g, b] in 0..1. The palette is authored in oklch and a
     shader can't take that, but a canvas can: paint one pixel, read it back. */
  const probe = document.createElement('canvas');
  probe.width = probe.height = 1;
  const probeCtx = probe.getContext('2d', { willReadFrequently: true });
  function resolveColour(css, fallback) {
    if (!probeCtx || !css) return fallback;
    probeCtx.clearRect(0, 0, 1, 1);
    probeCtx.fillStyle = '#000';
    probeCtx.fillStyle = css;
    probeCtx.fillRect(0, 0, 1, 1);
    const d = probeCtx.getImageData(0, 0, 1, 1).data;
    return [d[0] / 255, d[1] / 255, d[2] / 255];
  }

  /* ---- DOM the engine needs ------------------------------------------------ */

  // the duplicate list, clipped to the blob, whose text shows in the pill's ink
  const overlay = document.createElement('ul');
  overlay.className = 'gooey-nav__list gooey-nav__list--active';
  overlay.setAttribute('aria-hidden', 'true');
  anchors.forEach((a) => {
    const li = document.createElement('li');
    li.className = 'gooey-nav__item';
    const label = document.createElement('span');
    label.className = 'gooey-nav__link';
    label.textContent = a.textContent;
    li.appendChild(label);
    overlay.appendChild(li);
  });
  stage.appendChild(overlay);

  const canvas = document.createElement('canvas');
  canvas.className = 'gooey-nav__canvas';
  canvas.setAttribute('aria-hidden', 'true');
  const fallback = document.createElement('span');
  fallback.className = 'gooey-nav__fallback';
  fallback.setAttribute('aria-hidden', 'true');
  stage.prepend(canvas, fallback);

  /* ---- WebGL --------------------------------------------------------------- */

  const UNIFORMS = ['uSize', 'uRatio', 'uPills', 'uHover', 'uDrops', 'uTails', 'uTints',
    'uCount', 'uSmooth', 'uPill', 'uHoverColor', 'uShadow'];

  function compile(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    return shader;
  }

  function build(gl) {
    const program = gl.createProgram();
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX));
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program);
      return null;
    }
    const uniforms = Object.fromEntries(UNIFORMS.map((n) => [n, gl.getUniformLocation(program, n)]));
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    return { program, uniforms, buffer, position: gl.getAttribLocation(program, 'aPosition') };
  }

  const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false });
  const pipeline = gl ? build(gl) : null;
  // no WebGL2: a plain pill that slides, which is still a working nav
  fallback.style.display = pipeline ? 'none' : 'block';
  canvas.style.display = pipeline ? 'block' : 'none';

  /* ---- colours, from the page's own tokens ---------------------------------- */

  let pillRgb = [0.13, 0.14, 0.16];
  let hoverRgb = [0.13, 0.14, 0.16, 0.07];
  const SHADOW = 0.2;

  function readColours() {
    const cs = getComputedStyle(nav);
    pillRgb = resolveColour(cs.getPropertyValue('--gn-pill').trim(), pillRgb);
    hoverRgb = resolveColour(cs.getPropertyValue('--gn-ink').trim(), hoverRgb).concat(0.07);
  }

  /* ---- state ---------------------------------------------------------------- */

  const view = { width: 0, height: 0 };
  let rects = [];
  let target = -1;                       // -1: no item selected (the hero)
  const pills = new Map();
  const drops = [];
  const hover = { x: 0, y: 0, w: 0, h: 0, alpha: 0, index: -1 };
  const pillData = new Float32Array(MAX_PILLS * 4);
  const dropData = new Float32Array(MAX_DROPS * 4);
  const tailData = new Float32Array(MAX_DROPS * 2);
  const tintData = new Float32Array(MAX_DROPS * 3);
  let raf = 0;
  let last = 0;

  function measure() {
    const box = stage.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    view.width = box.width;
    view.height = box.height;
    const outerW = box.width + MARGIN * 2;
    const outerH = box.height + MARGIN * 2;
    Object.assign(canvas.style, {
      left: `${-MARGIN}px`, top: `${-MARGIN}px`, width: `${outerW}px`, height: `${outerH}px`,
    });
    const w = Math.max(1, Math.round(outerW * ratio));
    const h = Math.max(1, Math.round(outerH * ratio));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    rects = items.map((item) => {
      const r = item.getBoundingClientRect();
      return { x: r.left - box.left, y: r.top - box.top, w: r.width, h: r.height };
    });
  }

  /* The text overlay is clipped to the blob, so it needs the blob's outline as
     a path. The shader's field is rebuilt on the CPU and walked row by row. */
  function trace(boxes, blobs, smooth) {
    const field = (x, y) => {
      let d = 1e5;
      const merge = (value) => {
        const h = clamp01(0.5 + (0.5 * (value - d)) / smooth);
        d = value + (d - value) * h - smooth * h * (1 - h);
      };
      for (const b of boxes) {
        const r = Math.min(b.hw, b.hh);
        const qx = Math.abs(x - b.cx) - b.hw + r;
        const qy = Math.abs(y - b.cy) - b.hh + r;
        merge(Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r);
      }
      for (const blob of blobs) {
        const px = x - blob.x, py = y - blob.y;
        const bx = -blob.tx, by = -blob.ty;
        const span = bx * bx + by * by;
        const h = span > 0.0001 ? clamp01((px * bx + py * by) / span) : 0;
        const value = Math.hypot(px - bx * h, py - by * h) - blob.r;
        if (value > d + smooth) continue;
        merge(value);
      }
      return d;
    };
    const step = 2;
    const parts = [];
    for (let y = 0; y < view.height; y += 1) {
      const cy = y + 0.5;
      let previous = field(0, cy);
      let start = previous < 0 ? 0 : null;
      for (let x = step; x <= view.width + step; x += step) {
        const value = field(Math.min(x, view.width), cy);
        if (previous < 0 !== value < 0) {
          const cross = x - step + (step * previous) / (previous - value);
          if (value < 0) start = cross;
          else if (start !== null) {
            parts.push(`M${start.toFixed(1)},${y}H${cross.toFixed(1)}V${y + 1}H${start.toFixed(1)}Z`);
            start = null;
          }
        }
        previous = value;
      }
      if (start !== null) parts.push(`M${start.toFixed(1)},${y}H${view.width}V${y + 1}H${start.toFixed(1)}Z`);
    }
    return parts.join('');
  }

  const pill = (index) => {
    if (!pills.has(index)) pills.set(index, { mass: 0, scale: 0, velocity: 0, outgoing: 0 });
    return pills.get(index);
  };

  /* a pill's drawn size from how much of it there is: a thin squashed capsule
     when it's nearly gone, the full item when it's all there */
  function shape(index, amount) {
    const rect = rects[index];
    if (!rect || amount <= 0.002) return null;
    const h = rect.h * Math.min(1.08, 0.42 + 0.58 * Math.sqrt(Math.max(0, amount)));
    const w = Math.max(h, rect.w * Math.max(0, amount) ** 0.75);
    return { x: rect.x + rect.w / 2 - w / 2, y: rect.y + rect.h / 2 - h / 2, w, h };
  }

  /* ---- droplets ------------------------------------------------------------- */

  function plan(drop, index, now, fresh) {
    const rect = rects[index];
    if (!rect) return;
    const reach = Math.max(0, OPTIONS.spread);
    const ex = rect.x + rect.w / 2 + (Math.random() - 0.5) * rect.w * 0.45;
    const ey = rect.y + rect.h / 2 + (Math.random() - 0.5) * rect.h * 0.2;
    const base = Math.max(0.15, OPTIONS.animationTime / 1000);
    const variance = (Math.random() - 0.5) * (Math.max(0, OPTIONS.timeVariance) / 1000);
    const duration = Math.max(0.15, base * (0.62 + Math.random() * 0.32) + variance * 0.6);
    const out = Math.random() * Math.PI * 2;
    const into = Math.random() * Math.PI * 2;
    const burst = reach * (0.7 + Math.random() * 0.6);
    const swing = reach * (0.55 + Math.random() * 0.55);
    const carry = Math.min(duration / 3, 0.12);
    drop.index = index;
    drop.start = now;
    drop.duration = duration;
    drop.path = [
      drop.x, drop.y,
      fresh ? drop.x + Math.cos(out) * burst * 1.6 : drop.x + drop.vx * carry,
      fresh ? drop.y + Math.sin(out) * burst * 1.6 : drop.y + drop.vy * carry,
      ex + Math.cos(into) * swing * 1.5, ey + Math.sin(into) * swing * 1.5,
      ex, ey,
    ];
  }

  /* break a pill into droplets bound for another item; false if it had nothing to give */
  function emit(from, to, now) {
    const source = pills.get(from);
    const rect = rects[from];
    if (!source || !rect || !rects[to]) return false;
    const available = source.mass - source.outgoing;
    if (available <= 0.002) return false;
    const room = MAX_DROPS - drops.length;
    const count = Math.min(room, Math.max(1, Math.round(Math.max(1, OPTIONS.particleCount) * available)));
    if (count <= 0) return false;
    const window = Math.max(0.15, OPTIONS.animationTime / 1000) * 0.16;
    for (let i = 0; i < count; i++) {
      const mass = available / count;
      source.outgoing += mass;
      drops.push({
        x: rect.x + rect.w / 2 + (Math.random() - 0.5) * rect.w * 0.6,
        y: rect.y + rect.h / 2 + (Math.random() - 0.5) * rect.h * 0.3,
        vx: 0, vy: 0, mass,
        size: 0.8 + Math.random() * 0.4,
        given: 0, source: from, index: to,
        leave: now + Math.random() * window * 1000,
        emerged: 0, absorbed: 0, state: 'waiting',
        tint: null,
      });
    }
    return true;
  }

  /* ---- paint ---------------------------------------------------------------- */

  function render() {
    const height = rects[target]?.h ?? rects[0]?.h ?? 36;
    const smooth = height * (0.18 + 0.5 * clamp01(OPTIONS.gooeyness));
    const boxes = [];
    const blobs = [];
    for (const [index, state] of pills) {
      const b = shape(index, state.scale);
      if (b) boxes.push({ cx: b.x + b.w / 2, cy: b.y + b.h / 2, hw: b.w / 2, hh: b.h / 2 });
    }
    for (const drop of drops) {
      if (drop.state === 'waiting') continue;
      const radius = 0.26 * height * drop.size * Math.min(drop.emerged, 1 - drop.absorbed);
      if (radius <= 0.05) continue;
      const speed = Math.hypot(drop.vx, drop.vy);
      const length = Math.min(radius * 1.1, speed * 0.018);
      blobs.push({
        x: drop.x, y: drop.y, r: radius,
        tx: speed > 0.01 ? (drop.vx / speed) * length : 0,
        ty: speed > 0.01 ? (drop.vy / speed) * length : 0,
        tint: drop.tint,
      });
    }

    // a settled pill is a plain rounded rect; only a moving blob needs tracing
    if (boxes.length === 1 && !blobs.length) {
      const b = boxes[0];
      overlay.style.clipPath = `path('${pillPath(b.cx - b.hw, b.cy - b.hh, b.hw * 2, b.hh * 2)}')`;
    } else {
      overlay.style.clipPath = `path('${trace(boxes, blobs, smooth) || 'M0,0Z'}')`;
    }
    overlay.style.visibility = 'visible';

    if (!pipeline || !gl) {
      const b = shape(target, 1);
      if (b) {
        fallback.style.transform = `translate(${b.x.toFixed(2)}px, ${b.y.toFixed(2)}px)`;
        fallback.style.width = `${b.w}px`;
        fallback.style.height = `${b.h}px`;
      }
      fallback.style.opacity = b ? '1' : '0';
      return;
    }

    let slot = 0;
    for (const b of boxes) {
      if (slot >= MAX_PILLS) break;
      pillData[slot * 4] = b.cx + MARGIN;
      pillData[slot * 4 + 1] = b.cy + MARGIN;
      pillData[slot * 4 + 2] = b.hw;
      pillData[slot * 4 + 3] = b.hh;
      slot += 1;
    }
    pillData.fill(0, slot * 4);
    let count = 0;
    for (const blob of blobs) {
      if (count >= MAX_DROPS) break;
      dropData[count * 4] = blob.x + MARGIN;
      dropData[count * 4 + 1] = blob.y + MARGIN;
      dropData[count * 4 + 2] = blob.r;
      dropData[count * 4 + 3] = 0;
      tailData[count * 2] = blob.tx;
      tailData[count * 2 + 1] = blob.ty;
      const tint = blob.tint || pillRgb;
      tintData[count * 3] = tint[0];
      tintData[count * 3 + 1] = tint[1];
      tintData[count * 3 + 2] = tint[2];
      count += 1;
    }

    const { program, uniforms, buffer, position } = pipeline;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    gl.uniform2f(uniforms.uSize, view.width + MARGIN * 2, view.height + MARGIN * 2);
    gl.uniform1f(uniforms.uRatio, canvas.width / Math.max(1, view.width + MARGIN * 2));
    gl.uniform4fv(uniforms.uPills, pillData);
    gl.uniform4f(uniforms.uHover, hover.x + MARGIN, hover.y + MARGIN, hover.w / 2, hover.h / 2);
    gl.uniform4fv(uniforms.uDrops, dropData);
    gl.uniform2fv(uniforms.uTails, tailData);
    gl.uniform3fv(uniforms.uTints, tintData);
    gl.uniform1i(uniforms.uCount, count);
    gl.uniform1f(uniforms.uSmooth, smooth);
    gl.uniform3f(uniforms.uPill, pillRgb[0], pillRgb[1], pillRgb[2]);
    gl.uniform4f(uniforms.uHoverColor, hoverRgb[0], hoverRgb[1], hoverRgb[2], hoverRgb[3] * hover.alpha);
    gl.uniform1f(uniforms.uShadow, SHADOW);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  /* ---- the loop -------------------------------------------------------------- */

  function frame(now) {
    raf = 0;
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    const emergeTime = 0.09;
    const absorbTime = 0.12;

    for (let i = drops.length - 1; i >= 0; i--) {
      const drop = drops[i];
      if (drop.state === 'waiting') {
        if (now < drop.leave) continue;
        drop.state = 'flying';
        plan(drop, drop.index, now, true);
      }
      if (drop.state === 'flying') {
        drop.emerged = Math.min(1, drop.emerged + dt / emergeTime);
        const source = pills.get(drop.source);
        if (source && drop.given < drop.mass) {
          const step = Math.min(drop.mass * (dt / emergeTime), drop.mass - drop.given);
          source.mass = Math.max(0, source.mass - step);
          source.outgoing = Math.max(0, source.outgoing - step);
          drop.given += step;
        }
        const t = clamp01((now - drop.start) / 1000 / drop.duration);
        const eased = travelEase(t);
        const [x0, y0, x1, y1, x2, y2, x3, y3] = drop.path;
        const x = bezier(x0, x1, x2, x3, eased);
        const y = bezier(y0, y1, y2, y3, eased);
        if (dt > 0) { drop.vx = (x - drop.x) / dt; drop.vy = (y - drop.y) / dt; }
        drop.x = x;
        drop.y = y;
        if (t >= 1) drop.state = 'absorbing';
      }
      if (drop.state === 'absorbing') {
        const step = Math.min(1 - drop.absorbed, dt / absorbTime);
        drop.absorbed += step;
        drop.vx *= 0.8;
        drop.vy *= 0.8;
        const host = pill(drop.index);
        host.mass = Math.min(1, host.mass + drop.mass * step);
        if (drop.absorbed >= 1) drops.splice(i, 1);
      }
    }

    // each pill is a spring chasing the mass it holds; less damping, more wobble
    const zeta = reduced ? 1 : 1 - 0.72 * clamp01(OPTIONS.wobble);
    const omega = 26;
    const steps = Math.max(1, Math.ceil(dt / (1 / 240)));
    const h = dt / steps;
    for (const [index, state] of pills) {
      for (let n = 0; n < steps; n++) {
        state.velocity += (omega * omega * (state.mass - state.scale) - 2 * zeta * omega * state.velocity) * h;
        state.scale += state.velocity * h;
      }
      if (index !== target && state.mass <= 0.002 && state.outgoing <= 0.002 && Math.abs(state.scale) < 0.004) {
        pills.delete(index);
      }
    }

    if (hover.index >= 0 && rects[hover.index]) {
      const rect = rects[hover.index];
      const k = 1 - Math.exp(-dt / 0.06);
      hover.x += (rect.x + rect.w / 2 - hover.x) * k;
      hover.y += (rect.y + rect.h / 2 - hover.y) * k;
      hover.w += (rect.w - hover.w) * k;
      hover.h += (rect.h - hover.h) * k;
    }
    const hoverGoal = OPTIONS.hoverEffect && hover.index >= 0 && hover.index !== target ? 1 : 0;
    hover.alpha += (hoverGoal - hover.alpha) * (1 - Math.exp(-dt / 0.08));

    render();

    const host = pills.get(target);
    const resting = drops.length === 0 &&
      (target < 0
        ? pills.size === 0
        : pills.size === 1 && host && Math.abs(host.mass - host.scale) < 0.0008 && Math.abs(host.velocity) < 0.004);
    const hoverRect = rects[hover.index];
    const hovering = Math.abs(hoverGoal - hover.alpha) > 0.003 ||
      (hoverRect && Math.abs(hoverRect.x + hoverRect.w / 2 - hover.x) + Math.abs(hoverRect.w - hover.w) > 0.1);
    if (!resting || hovering) raf = requestAnimationFrame(frame);
    else {
      if (host) { host.mass = 1; host.scale = 1; host.velocity = 0; }
      hover.alpha = hoverGoal;
      render();
    }
  }

  function wake() {
    if (raf || document.hidden) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  /* jump to an item with no animation */
  function settle(index) {
    pills.clear();
    drops.length = 0;
    target = index;
    if (index >= 0) {
      const state = pill(index);
      state.mass = 1; state.scale = 1; state.velocity = 0;
    }
    render();
  }

  function go(index) {
    if (index === target) return;
    if (reduced || !rects[index >= 0 ? index : 0]) { settle(index); return; }
    const now = performance.now();

    // leaving for the hero: the pill squashes away where it stands
    if (index < 0) {
      target = -1;
      drops.length = 0;
      for (const state of pills.values()) { state.mass = 0; state.outgoing = 0; }
      wake();
      return;
    }

    target = index;
    const arriving = pill(index);
    // droplets already in the air change course rather than finishing a trip nobody wants
    for (const drop of drops) {
      drop.index = index;
      if (drop.state === 'flying') plan(drop, index, now, false);
      if (drop.state === 'absorbing') {
        drop.state = 'flying';
        drop.mass *= 1 - drop.absorbed;
        drop.absorbed = 0;
        plan(drop, index, now, false);
      }
    }
    let flowed = drops.length > 0;
    for (const from of [...pills.keys()]) {
      if (from !== index && emit(from, index, now)) flowed = true;
    }
    // nothing to flow from (coming down from the hero): it blooms in place
    if (!flowed) arriving.mass = 1;
    wake();
  }

  /* ---- hover ------------------------------------------------------------------ */

  list.addEventListener('pointerover', (e) => {
    const item = e.target.closest('.gooey-nav__item');
    if (!item || !list.contains(item)) return;
    const index = items.indexOf(item);
    const rect = rects[index];
    if (!rect) return;
    if (hover.alpha < 0.01) {
      hover.x = rect.x + rect.w / 2; hover.y = rect.y + rect.h / 2;
      hover.w = rect.w; hover.h = rect.h;
    }
    hover.index = index;
    wake();
  });
  list.addEventListener('pointerleave', () => { hover.index = -1; wake(); });

  /* ---- selection: scroll position and clicks ------------------------------------ */

  const sections = anchors.map((a) => document.getElementById((a.getAttribute('href') || '').slice(1)));
  let current = -2;                      // -2: nothing painted yet
  let lock = null;                       // a click's destination, until the page arrives

  function setCurrent(index) {
    current = index;
    items.forEach((item, i) => {
      if (i === index) item.setAttribute('data-active', ''); else item.removeAttribute('data-active');
      if (i === index) anchors[i].setAttribute('aria-current', 'location');
      else anchors[i].removeAttribute('aria-current');
    });
  }

  /* the last section whose top has passed 40% of the way down the window */
  function fromScroll() {
    const line = window.innerHeight * 0.4;
    let found = -1;
    sections.forEach((s, i) => { if (s && s.getBoundingClientRect().top <= line) found = i; });
    // at the very bottom the last section wins even if its top never reaches the line
    const doc = document.documentElement;
    if (window.innerHeight + window.scrollY >= doc.scrollHeight - 4) found = sections.length - 1;
    return found;
  }

  function follow() {
    const index = fromScroll();
    if (lock) {
      if (index === lock.index || performance.now() > lock.until) lock = null;
      else return;
    }
    if (index !== current) { setCurrent(index); go(index); }
  }

  /* A click scrolls the page down, and the header hides itself on the way
     down — which would play the droplet transfer, the whole point of this,
     off-screen. So the header is pinned for as long as the trip takes. */
  const header = nav.closest('.nav');
  let pinTimer = 0;
  function pinHeader() {
    if (!header) return;
    header.classList.add('is-travelling');
    clearTimeout(pinTimer);
    pinTimer = setTimeout(() => header.classList.remove('is-travelling'),
      OPTIONS.animationTime + OPTIONS.timeVariance + 600);
  }

  anchors.forEach((a, i) => {
    a.addEventListener('click', () => {
      lock = { index: i, until: performance.now() + 1800 };
      if (i !== current) { pinHeader(); setCurrent(i); go(i); }
    });
  });

  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { ticking = false; follow(); });
  }, { passive: true });

  /* ---- go ------------------------------------------------------------------------ */

  const resizeObserver = new ResizeObserver(() => {
    measure();
    if (!drops.length) settle(target); else render();
  });
  resizeObserver.observe(stage);
  resizeObserver.observe(list);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else wake();
  });

  readColours();
  measure();
  const initial = fromScroll();
  setCurrent(initial);
  settle(initial);
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => { measure(); if (!drops.length) settle(target); });
  }
})();
