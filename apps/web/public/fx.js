/**
 * fx.js — Visual Effects System for Playwright Screen Recorder
 *
 * Complete CSS animation + JavaScript effects for 1280x720 headless Chromium.
 * All CSS is injected via page.evaluate(). All functions are async.
 * Copy-paste into render-video.js or require('./fx') directly.
 *
 * Usage:
 *   const FX = require('./fx');
 *   FX.setBrand('#2563eb', 37, 99, 235);   // set brand color once
 *   await FX.initCursor(page);             // call after page load
 *   await FX.clickRipple(page, x, y);      // call around every click
 *
 * BRAND COLOR: call FX.setBrand(hex, r, g, b) before using any effect.
 * Default: #2563eb (Tailwind blue-600)  rgb(37, 99, 235)
 */

'use strict';

// ---------------------------------------------------------------------------
// Brand color — override via setBrand() before calling any effect
// ---------------------------------------------------------------------------
let BRAND_HEX = '#2563eb';
let BR = 37, BG = 99, BB = 235;

/**
 * Set the brand color used by all effects.
 * @param {string} hex - e.g. '#2563eb'
 * @param {number} r   - red   0-255
 * @param {number} g   - green 0-255
 * @param {number} b   - blue  0-255
 */
function setBrand(hex, r, g, b) {
  BRAND_HEX = hex;
  BR = r; BG = g; BB = b;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Inject a <style> block into the overlay page exactly once.
 * Uses a sentinel data attribute so repeated calls are no-ops.
 */
async function injectStyles(page, id, css) {
  await page.evaluate(({ styleId, cssText }) => {
    if (document.getElementById(styleId)) return;
    const s = document.createElement('style');
    s.id = styleId;
    s.textContent = cssText;
    document.head.appendChild(s);
  }, { styleId: id, cssText: css });
}

// ---------------------------------------------------------------------------
// CATEGORY 1: CURSOR EFFECTS
// ---------------------------------------------------------------------------

/**
 * Effect 1 — Animated Cursor Dot
 * Replaces the system cursor with a 12px glowing brand-color circle.
 * Also sets up the shared mousemove listener used by Effects 3 and 4.
 *
 * Effect 3 — Cursor Spotlight (injected here, toggled via spotlight())
 * Effect 4 — Cursor Trail     (injected here, toggled via cursorTrail())
 *
 * Call once after page.goto() / page load.
 */
async function initCursor(page) {
  const css = `
    /* Effect 1: Cursor Dot */
    #fx-cursor-dot {
      position: fixed;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: ${BRAND_HEX};
      pointer-events: none;
      z-index: 99999;
      box-shadow: 0 0 8px 2px rgba(${BR},${BG},${BB},.6);
      transform: translate(-50%, -50%);
      transition: transform 0.08s ease;
      will-change: left, top;
    }
    #fx-cursor-dot.clicking {
      transform: translate(-50%, -50%) scale(0.7);
    }

    /* Effect 3: Spotlight */
    #fx-spotlight {
      position: fixed;
      inset: 0;
      pointer-events: none;
      z-index: 99998;
      display: none;
      background: radial-gradient(
        circle 180px at var(--fx-mx, 640px) var(--fx-my, 360px),
        transparent 0%,
        rgba(0,0,0,.55) 100%
      );
    }
    #fx-spotlight.active { display: block; }

    /* Effect 4: Cursor Trail */
    .fx-cursor-ghost {
      position: fixed;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: ${BRAND_HEX};
      pointer-events: none;
      z-index: 99997;
      opacity: 0;
      transform: translate(-50%, -50%);
      transition: left 0.06s ease, top 0.06s ease, opacity 0.1s;
      will-change: left, top;
      display: none;
    }
    .fx-cursor-ghost.trail-active { display: block; }
    .fx-cursor-ghost:nth-child(1).trail-active { opacity: 0.40; transition-delay: 0.06s; }
    .fx-cursor-ghost:nth-child(2).trail-active { opacity: 0.25; transition-delay: 0.12s; }
    .fx-cursor-ghost:nth-child(3).trail-active { opacity: 0.12; transition-delay: 0.18s; }
  `;

  await injectStyles(page, 'fx-cursor-styles', css);

  await page.evaluate(({ brandHex }) => {
    if (document.getElementById('fx-cursor-dot')) return; // already inited

    // -- Cursor dot
    const dot = document.createElement('div');
    dot.id = 'fx-cursor-dot';
    document.body.appendChild(dot);

    // -- Spotlight div
    const spotlight = document.createElement('div');
    spotlight.id = 'fx-spotlight';
    document.body.appendChild(spotlight);

    // -- 3 ghost trail divs
    for (let i = 0; i < 3; i++) {
      const ghost = document.createElement('div');
      ghost.className = 'fx-cursor-ghost';
      document.body.appendChild(ghost);
    }

    // -- Shared mousemove handler
    document.addEventListener('mousemove', (e) => {
      const x = e.clientX, y = e.clientY;

      // Dot
      dot.style.left = x + 'px';
      dot.style.top  = y + 'px';

      // Spotlight CSS vars
      document.documentElement.style.setProperty('--fx-mx', x + 'px');
      document.documentElement.style.setProperty('--fx-my', y + 'px');
      spotlight.style.background = `radial-gradient(circle 180px at ${x}px ${y}px, transparent 0%, rgba(0,0,0,.55) 100%)`;

      // Trail ghosts
      const ghosts = document.querySelectorAll('.fx-cursor-ghost');
      ghosts.forEach((g) => {
        g.style.left = x + 'px';
        g.style.top  = y + 'px';
      });
    });

    // Click shrink feedback on dot
    document.addEventListener('mousedown', () => dot.classList.add('clicking'));
    document.addEventListener('mouseup',   () => dot.classList.remove('clicking'));

    // Hide system cursor on the body
    document.body.style.cursor = 'none';
  }, { brandHex: BRAND_HEX });
}

/**
 * Effect 2 — Click Ripple
 * SVG circle expands from click point and fades out in 800ms.
 * Call immediately around iframeClick() — pass the actual (x,y) of the click.
 */
async function clickRipple(page, x, y) {
  await page.evaluate(({ cx, cy, brandHex, br, bg, bb }) => {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.style.cssText = `
      position: fixed;
      left: ${cx - 50}px;
      top:  ${cy - 50}px;
      width: 100px;
      height: 100px;
      pointer-events: none;
      z-index: 99999;
      overflow: visible;
    `;

    const circle = document.createElementNS(ns, 'circle');
    circle.setAttribute('cx', '50');
    circle.setAttribute('cy', '50');
    circle.setAttribute('r', '0');
    circle.setAttribute('fill', 'none');
    circle.setAttribute('stroke', brandHex);
    circle.setAttribute('stroke-width', '2');

    const animR = document.createElementNS(ns, 'animate');
    animR.setAttribute('attributeName', 'r');
    animR.setAttribute('from', '0');
    animR.setAttribute('to', '40');
    animR.setAttribute('dur', '0.8s');
    animR.setAttribute('fill', 'freeze');

    const animO = document.createElementNS(ns, 'animate');
    animO.setAttribute('attributeName', 'opacity');
    animO.setAttribute('from', '0.8');
    animO.setAttribute('to', '0');
    animO.setAttribute('dur', '0.8s');
    animO.setAttribute('fill', 'freeze');

    circle.appendChild(animR);
    circle.appendChild(animO);
    svg.appendChild(circle);
    document.body.appendChild(svg);

    setTimeout(() => svg.remove(), 850);
  }, { cx: x, cy: y, brandHex: BRAND_HEX, br: BR, bg: BG, bb: BB });
}

/**
 * Effect 3 — Cursor Spotlight
 * Dims everything except a 180px radius around the cursor.
 * initCursor() must be called first.
 */
async function spotlight(page, on = true) {
  await page.evaluate((enable) => {
    const el = document.getElementById('fx-spotlight');
    if (!el) return;
    if (enable) el.classList.add('active');
    else        el.classList.remove('active');
  }, on);
}

/**
 * Effect 4 — Cursor Trail
 * 3 fading ghost dots follow the cursor.
 * initCursor() must be called first.
 */
async function cursorTrail(page, on = true) {
  await page.evaluate((enable) => {
    document.querySelectorAll('.fx-cursor-ghost').forEach((g) => {
      if (enable) g.classList.add('trail-active');
      else        g.classList.remove('trail-active');
    });
  }, on);
}

/**
 * Effect 5 — Click Target Rings
 * 3 concentric rings pulse outward from a click point.
 * Call around every significant click to draw the viewer's eye.
 */
async function clickTargetRings(page, x, y) {
  const css = `
    @keyframes fx-ring-expand {
      0%   { transform: translate(-50%, -50%) scale(0.2); opacity: 0.9; }
      100% { transform: translate(-50%, -50%) scale(1.8); opacity: 0; }
    }
    .fx-click-ring {
      position: fixed;
      width: 60px;
      height: 60px;
      border-radius: 50%;
      border: 2px solid ${BRAND_HEX};
      pointer-events: none;
      z-index: 99998;
      animation: fx-ring-expand 0.7s ease-out forwards;
    }
  `;
  await injectStyles(page, 'fx-ring-styles', css);

  await page.evaluate(({ cx, cy, brandHex }) => {
    const delays = [0, 120, 240];
    delays.forEach((delay) => {
      const ring = document.createElement('div');
      ring.className = 'fx-click-ring';
      ring.style.left = cx + 'px';
      ring.style.top  = cy + 'px';
      ring.style.animationDelay = delay + 'ms';
      ring.style.borderColor = brandHex;
      document.body.appendChild(ring);
      setTimeout(() => ring.remove(), 700 + delay + 100);
    });
  }, { cx: x, cy: y, brandHex: BRAND_HEX });
}

// ---------------------------------------------------------------------------
// CATEGORY 2: SCENE TRANSITIONS
// ---------------------------------------------------------------------------

/**
 * Internal: get or create the black overlay div used by transitions.
 */
async function ensureOverlay(page) {
  await page.evaluate(() => {
    if (document.getElementById('fx-transition-overlay')) return;
    const div = document.createElement('div');
    div.id = 'fx-transition-overlay';
    div.style.cssText = `
      position: fixed; inset: 0;
      background: #000;
      opacity: 0;
      pointer-events: none;
      z-index: 99995;
      transition: none;
    `;
    document.body.appendChild(div);
  });
}

/**
 * Effect 6 — Cross-Fade Dissolve
 * Screen fades to black over fadeDurationMs, calls midFn (your navigation
 * logic), then fades back in. Total time: fadeDurationMs * 2 + midFn time.
 *
 * @param {import('playwright').Page} page
 * @param {Function} [midFn] - async function to call while black
 * @param {number}   [fadeDurationMs=400]
 */
async function fadeToBlack(page, fadeDurationMs = 400) {
  await ensureOverlay(page);
  await page.evaluate((ms) => {
    const el = document.getElementById('fx-transition-overlay');
    el.style.transition = `opacity ${ms}ms ease`;
    el.style.opacity = '1';
  }, fadeDurationMs);
  await page.waitForTimeout(fadeDurationMs + 30);
}

async function fadeFromBlack(page, fadeDurationMs = 400) {
  await ensureOverlay(page);
  await page.evaluate((ms) => {
    const el = document.getElementById('fx-transition-overlay');
    el.style.transition = `opacity ${ms}ms ease`;
    el.style.opacity = '0';
  }, fadeDurationMs);
  await page.waitForTimeout(fadeDurationMs + 30);
}

/**
 * Effect 7 — Zoom-Out Push
 * The page content scales 1 → 1.06 and fades — feels like camera pulling back.
 * Wrap your transition content in #fx-scene-wrap or apply to document.body.
 */
async function zoomOut(page, durationMs = 500) {
  const css = `
    @keyframes fx-zoom-out {
      0%   { transform: scale(1);    opacity: 1; }
      100% { transform: scale(1.06); opacity: 0; }
    }
    .fx-zoom-out-active {
      animation: fx-zoom-out ${durationMs}ms ease forwards;
      transform-origin: center center;
    }
  `;
  await injectStyles(page, 'fx-zoom-styles', css);

  await page.evaluate((ms) => {
    document.body.classList.add('fx-zoom-out-active');
    setTimeout(() => document.body.classList.remove('fx-zoom-out-active'), ms + 50);
  }, durationMs);
  await page.waitForTimeout(durationMs);
}

/**
 * Effect 8 — Glitch Flash
 * 3 rapid white flashes with ±4px horizontal offset. 400ms total.
 * High-energy transition between scenes.
 */
async function glitchFlash(page) {
  const css = `
    @keyframes fx-glitch-flash {
      0%,100%   { opacity: 0;   transform: translateX(0);   }
      10%, 30%, 50% { opacity: 1;   transform: translateX(-4px); }
      20%, 40%, 60% { opacity: 0.8; transform: translateX(4px);  }
      70%, 90%  { opacity: 0;   transform: translateX(0);   }
    }
    #fx-glitch-overlay {
      position: fixed; inset: 0;
      background: #fff;
      pointer-events: none;
      z-index: 99996;
      animation: fx-glitch-flash 0.4s ease forwards;
    }
  `;
  await injectStyles(page, 'fx-glitch-styles', css);

  await page.evaluate(() => {
    const existing = document.getElementById('fx-glitch-overlay');
    if (existing) existing.remove();
    const el = document.createElement('div');
    el.id = 'fx-glitch-overlay';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 450);
  });
  await page.waitForTimeout(420);
}

/**
 * Effect 9 — Blur Transition
 * Current content blurs out, then blurs back in over blurDurationMs each.
 */
async function blurTransition(page, blurDurationMs = 400) {
  const css = `
    @keyframes fx-blur-out {
      from { filter: blur(0);   opacity: 1; }
      to   { filter: blur(12px); opacity: 0; }
    }
    @keyframes fx-blur-in {
      from { filter: blur(12px); opacity: 0; }
      to   { filter: blur(0);   opacity: 1; }
    }
    .fx-blur-out { animation: fx-blur-out ${blurDurationMs}ms ease forwards; }
    .fx-blur-in  { animation: fx-blur-in  ${blurDurationMs}ms ease forwards; }
  `;
  await injectStyles(page, 'fx-blur-styles', css);

  await page.evaluate((ms) => {
    document.body.classList.remove('fx-blur-in');
    document.body.classList.add('fx-blur-out');
    setTimeout(() => {
      document.body.classList.remove('fx-blur-out');
      document.body.classList.add('fx-blur-in');
      setTimeout(() => document.body.classList.remove('fx-blur-in'), ms + 50);
    }, ms);
  }, blurDurationMs);
  await page.waitForTimeout(blurDurationMs * 2 + 60);
}

/**
 * Effect 10 — White Flash Cut
 * Instant white overlay that fades to the next scene in 200ms.
 * Cinematic hard-cut feel.
 */
async function whiteFlash(page, durationMs = 200) {
  await page.evaluate((ms) => {
    const existing = document.getElementById('fx-white-flash');
    if (existing) existing.remove();
    const el = document.createElement('div');
    el.id = 'fx-white-flash';
    el.style.cssText = `
      position: fixed; inset: 0;
      background: #fff;
      opacity: 1;
      pointer-events: none;
      z-index: 99996;
      transition: opacity ${ms}ms ease;
    `;
    document.body.appendChild(el);
    // Trigger reflow then start fade
    void el.offsetHeight;
    requestAnimationFrame(() => {
      el.style.opacity = '0';
    });
    setTimeout(() => el.remove(), ms + 50);
  }, durationMs);
  await page.waitForTimeout(durationMs + 60);
}

/**
 * Effect 11 — Iris Wipe
 * Circle expands from center to fill screen (irisIn), then shrinks to reveal
 * new scene (irisOut). Call irisIn before navigation, irisOut after.
 */
async function irisIn(page, durationMs = 500) {
  const css = `
    @keyframes fx-iris-expand {
      0%   { clip-path: circle(0%   at 50% 50%); opacity: 1; }
      100% { clip-path: circle(75%  at 50% 50%); opacity: 1; }
    }
    @keyframes fx-iris-shrink {
      0%   { clip-path: circle(75%  at 50% 50%); }
      100% { clip-path: circle(0%   at 50% 50%); }
    }
    #fx-iris {
      position: fixed; inset: 0;
      background: #000;
      pointer-events: none;
      z-index: 99995;
    }
    #fx-iris.iris-in  { animation: fx-iris-expand ${durationMs}ms ease forwards; }
    #fx-iris.iris-out { animation: fx-iris-shrink ${durationMs}ms ease forwards; }
  `;
  await injectStyles(page, 'fx-iris-styles', css);

  await page.evaluate((ms) => {
    let el = document.getElementById('fx-iris');
    if (!el) {
      el = document.createElement('div');
      el.id = 'fx-iris';
      document.body.appendChild(el);
    }
    el.className = '';
    void el.offsetHeight;
    el.classList.add('iris-in');
    setTimeout(() => el.classList.remove('iris-in'), ms + 50);
  }, durationMs);
  await page.waitForTimeout(durationMs);
}

async function irisOut(page, durationMs = 500) {
  const css = `
    @keyframes fx-iris-shrink {
      0%   { clip-path: circle(75% at 50% 50%); }
      100% { clip-path: circle(0%  at 50% 50%); }
    }
  `;
  await injectStyles(page, 'fx-iris-out-styles', css);

  await page.evaluate((ms) => {
    let el = document.getElementById('fx-iris');
    if (!el) {
      el = document.createElement('div');
      el.id = 'fx-iris';
      el.style.cssText = 'position:fixed;inset:0;background:#000;pointer-events:none;z-index:99995;';
      document.body.appendChild(el);
    }
    el.className = '';
    void el.offsetHeight;
    el.style.clipPath = 'circle(75% at 50% 50%)';
    el.style.transition = `clip-path ${ms}ms ease`;
    requestAnimationFrame(() => {
      el.style.clipPath = 'circle(0% at 50% 50%)';
    });
    setTimeout(() => el.remove(), ms + 100);
  }, durationMs);
  await page.waitForTimeout(durationMs + 110);
}

// ---------------------------------------------------------------------------
// CATEGORY 3: AMBIENT BACKGROUND EFFECTS
// ---------------------------------------------------------------------------

/**
 * Effect 12 — Floating Particles
 * 20 small dots float upward, CSS-only. Brand color at ~8% opacity.
 * Pass on=true to create, on=false to remove.
 */
async function particles(page, on = true) {
  if (!on) {
    await page.evaluate(() => {
      const c = document.getElementById('fx-particles-container');
      if (c) c.remove();
    });
    return;
  }

  const css = `
    @keyframes fx-float-up {
      0%   { transform: translateY(0)      translateX(0px);           opacity: 0;   }
      10%  { opacity: 0.6; }
      90%  { opacity: 0.4; }
      100% { transform: translateY(-740px) translateX(var(--fx-drift)); opacity: 0; }
    }
    .fx-particle {
      position: absolute;
      width: 3px; height: 3px;
      border-radius: 50%;
      background: ${BRAND_HEX};
      animation: fx-float-up var(--fx-dur) linear var(--fx-delay) infinite;
      pointer-events: none;
    }
    #fx-particles-container {
      position: fixed; inset: 0;
      pointer-events: none;
      z-index: 99985;
      overflow: hidden;
    }
  `;
  await injectStyles(page, 'fx-particles-styles', css);

  await page.evaluate(({ brandHex }) => {
    if (document.getElementById('fx-particles-container')) return;
    const container = document.createElement('div');
    container.id = 'fx-particles-container';

    for (let i = 0; i < 20; i++) {
      const p = document.createElement('div');
      p.className = 'fx-particle';
      const x    = Math.random() * 1280;
      const dur  = (8 + Math.random() * 8).toFixed(2) + 's';
      const del  = (Math.random() * 8).toFixed(2) + 's';
      const drift = ((Math.random() - 0.5) * 60).toFixed(1) + 'px';
      p.style.cssText = `
        left: ${x}px;
        bottom: -10px;
        --fx-dur: ${dur};
        --fx-delay: -${del};
        --fx-drift: ${drift};
      `;
      container.appendChild(p);
    }
    document.body.appendChild(container);
  }, { brandHex: BRAND_HEX });
}

/**
 * Effect 13 — Aurora Gradient
 * Slow-shifting multi-color background. 5% opacity — very subtle.
 */
async function aurora(page, on = true) {
  if (!on) {
    await page.evaluate(() => {
      const el = document.getElementById('fx-aurora');
      if (el) el.remove();
    });
    return;
  }

  const css = `
    @keyframes fx-aurora {
      0%,100% { background-position: 0%   50%; }
      50%     { background-position: 100% 50%; }
    }
    #fx-aurora {
      position: fixed; inset: 0;
      opacity: 0.05;
      pointer-events: none;
      z-index: 99984;
      background-size: 400% 400%;
      background: linear-gradient(135deg, ${BRAND_HEX}, #0ea5e9, #8b5cf6, ${BRAND_HEX});
      animation: fx-aurora 12s ease infinite;
    }
  `;
  await injectStyles(page, 'fx-aurora-styles', css);

  await page.evaluate(() => {
    if (document.getElementById('fx-aurora')) return;
    const el = document.createElement('div');
    el.id = 'fx-aurora';
    document.body.appendChild(el);
  });
}

/**
 * Effect 14 — Animated Grid
 * Perspective grid receding to horizon with slow forward movement.
 */
async function grid(page, on = true) {
  if (!on) {
    await page.evaluate(() => {
      const el = document.getElementById('fx-perspgrid');
      if (el) el.remove();
    });
    return;
  }

  const css = `
    @keyframes fx-grid-forward {
      from { background-position: 0 0; }
      to   { background-position: 0 60px; }
    }
    #fx-perspgrid {
      position: fixed; inset: 0;
      pointer-events: none;
      z-index: 99983;
      background-image:
        linear-gradient(rgba(${BR},${BG},${BB},.08) 1px, transparent 1px),
        linear-gradient(90deg, rgba(${BR},${BG},${BB},.08) 1px, transparent 1px);
      background-size: 60px 60px;
      animation: fx-grid-forward 2s linear infinite;
    }
  `;
  await injectStyles(page, 'fx-grid-styles', css);

  await page.evaluate(() => {
    if (document.getElementById('fx-perspgrid')) return;
    const el = document.createElement('div');
    el.id = 'fx-perspgrid';
    document.body.appendChild(el);
  });
}

/**
 * Effect 15 — Noise Grain Overlay
 * Animated SVG feTurbulence film grain. Cinematic texture.
 * Opacity: 3.5% — barely visible but felt.
 */
async function grain(page, on = true) {
  if (!on) {
    await page.evaluate(() => {
      const el = document.getElementById('fx-grain-svg');
      if (el) el.remove();
    });
    return;
  }

  await page.evaluate(() => {
    if (document.getElementById('fx-grain-svg')) return;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.id = 'fx-grain-svg';
    svg.style.cssText = `
      position: fixed; inset: 0;
      width: 100%; height: 100%;
      opacity: .035;
      pointer-events: none;
      z-index: 99990;
    `;
    svg.innerHTML = `
      <filter id="fx-grain-filter">
        <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch">
          <animate attributeName="seed" values="0;100" dur="0.5s" repeatCount="indefinite"/>
        </feTurbulence>
        <feColorMatrix type="saturate" values="0"/>
      </filter>
      <rect width="100%" height="100%" filter="url(#fx-grain-filter)"/>
    `;
    document.body.appendChild(svg);
  });
}

/**
 * Effect 16 — Scan Line Effect
 * Horizontal CRT-style scan lines for retro/tech feel.
 */
async function scanlines(page, on = true) {
  if (!on) {
    await page.evaluate(() => {
      const el = document.getElementById('fx-scanlines');
      if (el) el.remove();
    });
    return;
  }

  await page.evaluate(() => {
    if (document.getElementById('fx-scanlines')) return;
    const el = document.createElement('div');
    el.id = 'fx-scanlines';
    el.style.cssText = `
      position: fixed; inset: 0;
      pointer-events: none;
      z-index: 99989;
      background: repeating-linear-gradient(
        0deg,
        transparent,
        transparent 2px,
        rgba(0,0,0,.03) 2px,
        rgba(0,0,0,.03) 4px
      );
    `;
    document.body.appendChild(el);
  });
}

// ---------------------------------------------------------------------------
// CATEGORY 4: CALLOUT & OVERLAY EFFECTS
// ---------------------------------------------------------------------------

/**
 * Effect 17 — Confetti Burst
 * 50 colored rectangles shoot from center on a success event.
 */
async function confetti(page) {
  await page.evaluate(() => {
    const colors = ['#10b981', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6'];
    for (let i = 0; i < 50; i++) {
      const el = document.createElement('div');
      const angle    = Math.random() * 2 * Math.PI;
      const distance = 150 + Math.random() * 200;
      const dx = Math.cos(angle) * distance;
      const dy = Math.sin(angle) * distance;
      const w  = 6  + Math.random() * 6;
      const h  = 4  + Math.random() * 4;
      const rot = Math.random() * 720;

      const keyframes = `@keyframes fx-confetti-${i} {
        0%   { transform: translate(-50%,-50%) rotate(0deg);       opacity: 1; }
        100% { transform: translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) rotate(${rot}deg); opacity: 0; }
      }`;
      const styleEl = document.createElement('style');
      styleEl.textContent = keyframes;
      document.head.appendChild(styleEl);

      el.style.cssText = `
        position: fixed;
        width: ${w}px; height: ${h}px;
        background: ${colors[i % colors.length]};
        border-radius: 1px;
        left: 50%; top: 50%;
        z-index: 99999;
        pointer-events: none;
        animation: fx-confetti-${i} 1.2s ease-out forwards;
      `;
      document.body.appendChild(el);
      setTimeout(() => { el.remove(); styleEl.remove(); }, 1350);
    }
  });
}

/**
 * Effect 18 — Stat Counter Roll-Up
 * Number animates 0 → target over durationMs with easeOutCubic.
 * Element must exist in the DOM with the given id.
 */
async function animateCounter(page, elementId, target, suffix = '', durationMs = 1200) {
  await page.evaluate(({ id, tgt, sfx, dur }) => {
    const el = document.getElementById(id);
    if (!el) return;
    const start = performance.now();
    const tick = (now) => {
      const t      = Math.min(1, (now - start) / dur);
      const eased  = 1 - Math.pow(1 - t, 3); // easeOutCubic
      el.textContent = Math.round(eased * tgt) + sfx;
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, { id: elementId, tgt: target, sfx: suffix, dur: durationMs });
}

/**
 * Effect 19 — Animated SVG Checkmark
 * Inserts a self-drawing SVG checkmark inside the element with containerId.
 * Circle draws in 0.4s, checkmark strokes in 0.3s after 0.5s delay.
 */
async function checkmark(page, containerId) {
  await page.evaluate((cid) => {
    const container = document.getElementById(cid);
    if (!container) return;
    if (container.querySelector('#fx-check-svg')) return;

    const styleEl = document.createElement('style');
    styleEl.textContent = `
      @keyframes fx-draw-circle { to { stroke-dashoffset: 0; } }
      @keyframes fx-draw-check  { to { stroke-dashoffset: 0; } }
    `;
    document.head.appendChild(styleEl);

    const ns  = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.id = 'fx-check-svg';
    svg.setAttribute('viewBox', '0 0 52 52');
    svg.setAttribute('width', '52');
    svg.setAttribute('height', '52');
    svg.style.display = 'block';

    // Circle
    const circle = document.createElementNS(ns, 'circle');
    circle.setAttribute('cx', '26');
    circle.setAttribute('cy', '26');
    circle.setAttribute('r', '25');
    circle.setAttribute('fill', 'none');
    circle.setAttribute('stroke', '#10b981');
    circle.setAttribute('stroke-width', '2');
    circle.style.cssText = `
      stroke-dasharray: 157;
      stroke-dashoffset: 157;
      animation: fx-draw-circle 0.4s 0.1s ease forwards;
    `;

    // Check path
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', '#10b981');
    path.setAttribute('stroke-width', '3');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    path.setAttribute('d', 'M14 27 l9 9 l16 -16');
    path.style.cssText = `
      stroke-dasharray: 34;
      stroke-dashoffset: 34;
      animation: fx-draw-check 0.3s 0.5s ease forwards;
    `;

    svg.appendChild(circle);
    svg.appendChild(path);
    container.appendChild(svg);
  }, containerId);
}

/**
 * Effect 20 — Shimmer Sweep
 * Adds a light sweep left-to-right across an element. 2s loop.
 * Pass the element's id (must be in the DOM).
 */
async function addShimmer(page, elementId) {
  const css = `
    @keyframes fx-shimmer {
      0%   { background-position: -400px 0; }
      100% { background-position:  400px 0; }
    }
    .fx-shimmer {
      background: linear-gradient(90deg,
        transparent 0%,
        rgba(255,255,255,.04) 40%,
        rgba(255,255,255,.07) 50%,
        rgba(255,255,255,.04) 60%,
        transparent 100%
      );
      background-size: 800px 100%;
      animation: fx-shimmer 2s linear infinite;
    }
  `;
  await injectStyles(page, 'fx-shimmer-styles', css);

  await page.evaluate((id) => {
    const el = document.getElementById(id);
    if (el) el.classList.add('fx-shimmer');
  }, elementId);
}

/**
 * Effect 21 — Rotating Gradient Border
 * Conic-gradient rotates around an element — premium animated border.
 * Requires @property support (Chromium 85+, fully supported in headless).
 */
async function rotatingBorder(page, elementId, on = true) {
  const css = `
    @property --fx-angle {
      syntax: '<angle>';
      inherits: false;
      initial-value: 0deg;
    }
    @keyframes fx-rotate-border { to { --fx-angle: 360deg; } }
    .fx-rotating-border {
      border: 2px solid transparent;
      background:
        linear-gradient(#0f172a, #0f172a) padding-box,
        conic-gradient(from var(--fx-angle), ${BRAND_HEX}, #8b5cf6, ${BRAND_HEX}) border-box;
      animation: fx-rotate-border 3s linear infinite;
    }
  `;
  await injectStyles(page, 'fx-rotating-border-styles', css);

  await page.evaluate(({ id, enable }) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (enable) el.classList.add('fx-rotating-border');
    else        el.classList.remove('fx-rotating-border');
  }, { id: elementId, enable: on });
}

/**
 * Effect 22 — Bounce-In Entry
 * Spring cubic-bezier entry animation for callout appear.
 * Adds the animation class; removes it after completion.
 */
async function bounceIn(page, elementId) {
  const css = `
    @keyframes fx-bounce-in {
      0%   { transform: scale(0.85) translateY(10px); opacity: 0; }
      60%  { transform: scale(1.04) translateY(-3px); opacity: 1; }
      80%  { transform: scale(0.98) translateY(0);    opacity: 1; }
      100% { transform: scale(1)    translateY(0);    opacity: 1; }
    }
    .fx-bounce-in {
      animation: fx-bounce-in 0.5s cubic-bezier(.34,1.56,.64,1) forwards;
    }
  `;
  await injectStyles(page, 'fx-bounce-styles', css);

  await page.evaluate((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('fx-bounce-in');
    void el.offsetHeight; // reflow to restart animation
    el.classList.add('fx-bounce-in');
    setTimeout(() => el.classList.remove('fx-bounce-in'), 600);
  }, elementId);
}

/**
 * Effect 23 — Neon Glow Metric
 * Large number with pulsing colored text-shadow glow.
 */
async function neonStat(page, elementId, on = true) {
  const css = `
    @keyframes fx-neon-pulse {
      0%,100% {
        text-shadow:
          0 0 10px ${BRAND_HEX},
          0 0 20px ${BRAND_HEX},
          0 0 40px ${BRAND_HEX};
      }
      50% {
        text-shadow:
          0 0 5px  ${BRAND_HEX},
          0 0 10px ${BRAND_HEX};
      }
    }
    .fx-neon-stat { animation: fx-neon-pulse 2s ease-in-out infinite; }
  `;
  await injectStyles(page, 'fx-neon-styles', css);

  await page.evaluate(({ id, enable }) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (enable) el.classList.add('fx-neon-stat');
    else        el.classList.remove('fx-neon-stat');
  }, { id: elementId, enable: on });
}

/**
 * Effect 24 — Progress Ring (Circular)
 * Sets the stroke-dashoffset on an SVG ring to show pct% complete.
 * The SVG must be rendered in the page; use injectProgressRing() to create it.
 *
 * @param {import('playwright').Page} page
 * @param {string} svgId  - id of the <svg> element
 * @param {number} pct    - 0–100
 */
async function progressRing(page, svgId, pct) {
  await page.evaluate(({ id, percent }) => {
    const svg  = document.getElementById(id);
    if (!svg) return;
    const fill = svg.getElementById
      ? svg.getElementById('fx-ring-fill')
      : svg.querySelector('#fx-ring-fill');
    if (!fill) return;
    const circumference = 2 * Math.PI * 34; // r=34
    fill.style.strokeDashoffset = circumference * (1 - percent / 100);
  }, { id: svgId, percent: pct });
}

/**
 * Inject a circular progress ring SVG into a container element.
 * Call once; then update with progressRing(page, svgId, pct).
 */
async function injectProgressRing(page, containerId, svgId = 'fx-progress-ring') {
  await page.evaluate(({ cid, sid, brandHex }) => {
    const container = document.getElementById(cid);
    if (!container || document.getElementById(sid)) return;
    const ns  = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.id = sid;
    svg.setAttribute('viewBox', '0 0 80 80');
    svg.setAttribute('width', '80');
    svg.setAttribute('height', '80');

    const trackCircle = document.createElementNS(ns, 'circle');
    trackCircle.setAttribute('cx', '40');
    trackCircle.setAttribute('cy', '40');
    trackCircle.setAttribute('r', '34');
    trackCircle.setAttribute('fill', 'none');
    trackCircle.setAttribute('stroke', 'rgba(255,255,255,.1)');
    trackCircle.setAttribute('stroke-width', '6');

    const fillCircle = document.createElementNS(ns, 'circle');
    fillCircle.id = 'fx-ring-fill';
    fillCircle.setAttribute('cx', '40');
    fillCircle.setAttribute('cy', '40');
    fillCircle.setAttribute('r', '34');
    fillCircle.setAttribute('fill', 'none');
    fillCircle.setAttribute('stroke', brandHex);
    fillCircle.setAttribute('stroke-width', '6');
    fillCircle.setAttribute('stroke-linecap', 'round');
    const circ = 2 * Math.PI * 34;
    fillCircle.style.cssText = `
      stroke-dasharray: ${circ};
      stroke-dashoffset: ${circ};
      transform: rotate(-90deg);
      transform-origin: 40px 40px;
      transition: stroke-dashoffset 0.3s ease;
    `;

    svg.appendChild(trackCircle);
    svg.appendChild(fillCircle);
    container.appendChild(svg);
  }, { cid: containerId, sid: svgId, brandHex: BRAND_HEX });
}

/**
 * Effect 25 — Success Pulse Ring
 * Green ring expands and fades outward from a position — "done" celebration.
 */
async function successPulse(page, x, y) {
  const css = `
    @keyframes fx-success-pulse {
      0%   { transform: translate(-50%,-50%) scale(0.5); opacity: 0.8; }
      100% { transform: translate(-50%,-50%) scale(2.5); opacity: 0;   }
    }
    .fx-success-ring {
      position: fixed;
      width: 60px; height: 60px;
      border-radius: 50%;
      border: 2px solid #10b981;
      pointer-events: none;
      z-index: 99998;
      animation: fx-success-pulse 0.8s ease-out forwards;
    }
  `;
  await injectStyles(page, 'fx-success-styles', css);

  await page.evaluate(({ cx, cy }) => {
    const ring = document.createElement('div');
    ring.className = 'fx-success-ring';
    ring.style.left = cx + 'px';
    ring.style.top  = cy + 'px';
    document.body.appendChild(ring);
    setTimeout(() => ring.remove(), 900);
  }, { cx: x, cy: y });
}

// ---------------------------------------------------------------------------
// CATEGORY 5: UI HIGHLIGHT EFFECTS
// ---------------------------------------------------------------------------

/**
 * Effect 26 — Element Highlight Box
 * Animated dashed border appears around a specific DOM element.
 * selector is evaluated inside the iframe#app contentDocument when iframeMode=true.
 *
 * @param {import('playwright').Page} page
 * @param {string}  selector     - CSS selector for the target element
 * @param {number}  [durationMs=2000]
 * @param {boolean} [iframeMode=true]  - true = query inside iframe#app
 */
async function highlight(page, selector, durationMs = 2000, iframeMode = true) {
  const css = `
    @keyframes fx-dash-march {
      to { background-position: 20px 0, -20px 0, 0 -20px, 0 20px; }
    }
    .fx-highlight-box {
      position: fixed;
      pointer-events: none;
      z-index: 99998;
      border-radius: 6px;
      box-shadow: 0 0 12px rgba(${BR},${BG},${BB},.4);
    }
    .fx-highlight-box::before {
      content: '';
      position: absolute;
      inset: -2px;
      border-radius: 8px;
      background:
        repeating-linear-gradient(90deg,  ${BRAND_HEX} 0, ${BRAND_HEX} 8px, transparent 8px, transparent 16px) top    / 100% 2px no-repeat,
        repeating-linear-gradient(90deg,  ${BRAND_HEX} 0, ${BRAND_HEX} 8px, transparent 8px, transparent 16px) bottom / 100% 2px no-repeat,
        repeating-linear-gradient(180deg, ${BRAND_HEX} 0, ${BRAND_HEX} 8px, transparent 8px, transparent 16px) left   / 2px 100% no-repeat,
        repeating-linear-gradient(180deg, ${BRAND_HEX} 0, ${BRAND_HEX} 8px, transparent 8px, transparent 16px) right  / 2px 100% no-repeat;
      animation: fx-dash-march 0.5s linear infinite;
    }
  `;
  await injectStyles(page, 'fx-highlight-styles', css);

  await page.evaluate(({ sel, dur, iframe }) => {
    let el;
    if (iframe) {
      const f = document.getElementById('app');
      el = f && f.contentDocument && f.contentDocument.querySelector(sel);
    } else {
      el = document.querySelector(sel);
    }
    if (!el) return;

    const rect = el.getBoundingClientRect();
    // If inside iframe, getBoundingClientRect is relative to iframe's viewport;
    // we need to offset by the iframe's own position on the outer page.
    let offsetLeft = 0, offsetTop = 0;
    if (iframe) {
      const f = document.getElementById('app');
      if (f) {
        const fr = f.getBoundingClientRect();
        offsetLeft = fr.left;
        offsetTop  = fr.top;
      }
    }

    const box = document.createElement('div');
    box.className = 'fx-highlight-box';
    box.style.left   = (rect.left   + offsetLeft - 4) + 'px';
    box.style.top    = (rect.top    + offsetTop  - 4) + 'px';
    box.style.width  = (rect.width  + 8) + 'px';
    box.style.height = (rect.height + 8) + 'px';
    document.body.appendChild(box);
    setTimeout(() => box.remove(), dur);
  }, { sel: selector, dur: durationMs, iframe: iframeMode });
}

/**
 * Effect 27 — Animated Arrow Pointer
 * SVG unicode arrow bounces toward a screen coordinate.
 *
 * @param {import('playwright').Page} page
 * @param {number} targetX
 * @param {number} targetY
 * @param {'down'|'up'|'left'|'right'} [direction='down']
 */
async function arrow(page, targetX, targetY, direction = 'down') {
  const css = `
    @keyframes fx-arrow-bounce-down  { 0%,100%{transform:translateY(0)}  50%{transform:translateY(8px)}  }
    @keyframes fx-arrow-bounce-up    { 0%,100%{transform:translateY(0)}  50%{transform:translateY(-8px)} }
    @keyframes fx-arrow-bounce-left  { 0%,100%{transform:translateX(0)}  50%{transform:translateX(-8px)} }
    @keyframes fx-arrow-bounce-right { 0%,100%{transform:translateX(0)}  50%{transform:translateX(8px)}  }
  `;
  await injectStyles(page, 'fx-arrow-styles', css);

  await page.evaluate(({ x, y, dir, brandHex, br, bg, bb }) => {
    const existing = document.getElementById('fx-demo-arrow');
    if (existing) existing.remove();

    const arrows   = { down: '↓', right: '→', left: '←', up: '↑' };
    const animMap  = {
      down:  'fx-arrow-bounce-down',
      up:    'fx-arrow-bounce-up',
      left:  'fx-arrow-bounce-left',
      right: 'fx-arrow-bounce-right',
    };
    const offsets  = { down: -40, up: 10, left: 10, right: -40 };

    const el = document.createElement('div');
    el.id = 'fx-demo-arrow';
    el.textContent = arrows[dir] || '↓';

    const posY = dir === 'down' ? y + offsets.down : y + (offsets[dir] || 0);
    const posX = x;

    el.style.cssText = `
      position: fixed;
      left: ${posX}px;
      top:  ${posY}px;
      font-size: 28px;
      color: ${brandHex};
      pointer-events: none;
      z-index: 99999;
      text-shadow: 0 0 10px rgba(${br},${bg},${bb},.8);
      animation: ${animMap[dir] || 'fx-arrow-bounce-down'} 0.6s ease-in-out infinite;
      line-height: 1;
    `;
    document.body.appendChild(el);
  }, { x: targetX, y: targetY, dir: direction, brandHex: BRAND_HEX, br: BR, bg: BG, bb: BB });
}

async function hideArrow(page) {
  await page.evaluate(() => {
    const el = document.getElementById('fx-demo-arrow');
    if (el) el.remove();
  });
}

/**
 * Effect 28 — Spotlight Zoom Bubble
 * Magnifies a specific region in a floating 200x150px lens.
 * Clones the iframe#app body, offsets it so the target region is visible.
 *
 * Note: Due to cross-origin iframe restrictions in headless Chromium,
 * cloning works only when the iframe is same-origin. For cross-origin
 * iframes use screenshotRegion() approach instead (see comment below).
 */
async function zoomLens(page, regionX, regionY, scale = 2.5) {
  await page.evaluate(({ x, y, s, brandHex, br, bg, bb }) => {
    const existing = document.getElementById('fx-zoom-lens');
    if (existing) existing.remove();

    const lens = document.createElement('div');
    lens.id = 'fx-zoom-lens';
    lens.style.cssText = `
      position: fixed;
      left: ${x + 20}px;
      top:  ${Math.max(10, y - 120)}px;
      width: 200px; height: 150px;
      border-radius: 12px;
      overflow: hidden;
      border: 2px solid ${brandHex};
      z-index: 99999;
      pointer-events: none;
      box-shadow:
        0 8px 40px rgba(0,0,0,.6),
        0 0 0 1px rgba(${br},${bg},${bb},.3);
    `;

    const inner = document.createElement('div');
    inner.style.cssText = `
      width: ${200 / s}px;
      height: ${150 / s}px;
      transform: scale(${s});
      transform-origin: 0 0;
      overflow: hidden;
    `;

    // Attempt to clone iframe content (same-origin only)
    try {
      const f = document.getElementById('app');
      if (f && f.contentDocument && f.contentDocument.body) {
        const clone = f.contentDocument.body.cloneNode(true);
        clone.style.cssText = `
          margin: 0; padding: 0;
          transform: translate(-${x}px, -${y}px);
          transform-origin: 0 0;
          width: ${f.contentDocument.body.scrollWidth}px;
          height: ${f.contentDocument.body.scrollHeight}px;
        `;
        inner.appendChild(clone);
      }
    } catch (e) {
      // Cross-origin: show a label instead
      inner.style.display = 'flex';
      inner.style.alignItems = 'center';
      inner.style.justifyContent = 'center';
      inner.style.color = brandHex;
      inner.style.fontSize = '11px';
      inner.textContent = `[zoom @ ${x},${y}]`;
    }

    lens.appendChild(inner);
    document.body.appendChild(lens);
  }, { x: regionX, y: regionY, s: scale, brandHex: BRAND_HEX, br: BR, bg: BG, bb: BB });
}

async function hideZoomLens(page) {
  await page.evaluate(() => {
    const el = document.getElementById('fx-zoom-lens');
    if (el) el.remove();
  });
}

/**
 * Effect 29 — Scroll Indicator
 * Small bouncing "↓ scroll" arrow at the bottom center of the screen.
 */
async function scrollHint(page, on = true) {
  if (!on) {
    await page.evaluate(() => {
      const el = document.getElementById('fx-scroll-hint');
      if (el) el.remove();
    });
    return;
  }

  const css = `
    @keyframes fx-scroll-bounce {
      0%,100% { transform: translateX(-50%) translateY(0);  opacity: 1;   }
      50%     { transform: translateX(-50%) translateY(8px); opacity: 0.6; }
    }
    #fx-scroll-hint {
      position: fixed;
      bottom: 30px; left: 50%;
      transform: translateX(-50%);
      color: rgba(255,255,255,.5);
      font-size: 12px;
      letter-spacing: 2px;
      text-transform: uppercase;
      pointer-events: none;
      z-index: 99998;
      font-family: system-ui, sans-serif;
      animation: fx-scroll-bounce 1.2s ease-in-out infinite;
    }
  `;
  await injectStyles(page, 'fx-scroll-hint-styles', css);

  await page.evaluate(() => {
    if (document.getElementById('fx-scroll-hint')) return;
    const el = document.createElement('div');
    el.id = 'fx-scroll-hint';
    el.textContent = '↓  scroll';
    document.body.appendChild(el);
  });
}

// ---------------------------------------------------------------------------
// CATEGORY 6: TITLE CARD EFFECTS
// ---------------------------------------------------------------------------

/**
 * Effect 30 — Scramble Text Reveal
 * Random characters resolve to real text, Matrix-style, over durationMs.
 */
async function scramble(page, elementId, finalText, durationMs = 800) {
  await page.evaluate(({ id, text, dur }) => {
    const el = document.getElementById(id);
    if (!el) return;
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    const steps = Math.ceil(dur / 50);
    let step = 0;
    const iv = setInterval(() => {
      const progress = step / steps;
      const revealedCount = Math.floor(progress * text.length);
      el.textContent = text.split('').map((ch, i) => {
        if (ch === ' ') return ' ';
        if (i < revealedCount) return ch;
        return chars[Math.floor(Math.random() * chars.length)];
      }).join('');
      if (++step > steps) {
        el.textContent = text;
        clearInterval(iv);
      }
    }, 50);
  }, { id: elementId, text: finalText, dur: durationMs });
}

/**
 * Effect 31 — Glitch Text Intro
 * Text horizontally jitters 3x before settling. Cyberpunk feel. 600ms.
 */
async function glitchText(page, elementId) {
  const css = `
    @keyframes fx-glitch-text {
      0%,100% { transform: translateX(0);   clip-path: none; }
      15%     { transform: translateX(-4px); clip-path: inset(10% 0 85% 0); }
      30%     { transform: translateX(4px);  clip-path: inset(40% 0 40% 0); }
      45%     { transform: translateX(-2px); clip-path: inset(75% 0 10% 0); }
      60%     { transform: translateX(2px);  clip-path: none; }
      75%,90% { transform: translateX(0);   clip-path: none; }
    }
    .fx-glitch-text {
      animation: fx-glitch-text 0.6s ease forwards;
    }
  `;
  await injectStyles(page, 'fx-glitch-text-styles', css);

  await page.evaluate((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('fx-glitch-text');
    void el.offsetHeight;
    el.classList.add('fx-glitch-text');
    setTimeout(() => el.classList.remove('fx-glitch-text'), 700);
  }, elementId);
}

/**
 * Effect 32 — Wave Counter Row
 * Injects waveIn animation on .fx-stat children of a container.
 * Children wave in with 150ms stagger. Call after inserting stat elements.
 */
async function waveCounterRow(page, containerId) {
  const css = `
    @keyframes fx-wave-in {
      from { transform: translateY(20px) scale(0.9); opacity: 0; }
      to   { transform: translateY(0)    scale(1);   opacity: 1; }
    }
    .fx-wave-row .fx-stat {
      opacity: 0;
      animation: fx-wave-in 0.5s ease both;
    }
    .fx-wave-row .fx-stat:nth-child(1) { animation-delay: 0.80s; }
    .fx-wave-row .fx-stat:nth-child(2) { animation-delay: 0.95s; }
    .fx-wave-row .fx-stat:nth-child(3) { animation-delay: 1.10s; }
    .fx-wave-row .fx-stat:nth-child(4) { animation-delay: 1.25s; }
  `;
  await injectStyles(page, 'fx-wave-styles', css);

  await page.evaluate((cid) => {
    const container = document.getElementById(cid);
    if (!container) return;
    container.classList.add('fx-wave-row');
    // Force reflow to restart animations if already played
    container.querySelectorAll('.fx-stat').forEach((s) => {
      s.style.animation = 'none';
      void s.offsetHeight;
      s.style.animation = '';
    });
  }, containerId);
}

/**
 * Effect 33 — 3D Perspective Tilt
 * Element auto-oscillates with subtle 3D tilt — floating hologram feel.
 */
async function tilt3d(page, elementId, on = true) {
  const css = `
    @keyframes fx-tilt-3d {
      0%,100% { transform: perspective(800px) rotateX(2deg)  rotateY(-2deg); }
      25%     { transform: perspective(800px) rotateX(-1deg) rotateY(2deg);  }
      50%     { transform: perspective(800px) rotateX(2deg)  rotateY(2deg);  }
      75%     { transform: perspective(800px) rotateX(-2deg) rotateY(-1deg); }
    }
    .fx-tilt-3d {
      animation: fx-tilt-3d 8s ease-in-out infinite;
      transform-style: preserve-3d;
    }
  `;
  await injectStyles(page, 'fx-tilt-styles', css);

  await page.evaluate(({ id, enable }) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (enable) el.classList.add('fx-tilt-3d');
    else        el.classList.remove('fx-tilt-3d');
  }, { id: elementId, enable: on });
}

/**
 * Effect 34 — Line Draw Logo (SVG)
 * Triggers stroke-dashoffset draw animation on all .fx-logo-path elements
 * inside an SVG with the given id.
 */
async function drawLogo(page, svgId, durationMs = 1500) {
  const css = `
    @keyframes fx-draw-logo { to { stroke-dashoffset: 0; } }
    .fx-logo-path {
      stroke-dasharray: 1000;
      stroke-dashoffset: 1000;
      animation: fx-draw-logo ${durationMs}ms ease forwards;
      fill: none;
      stroke: ${BRAND_HEX};
      stroke-width: 2;
    }
  `;
  await injectStyles(page, 'fx-logo-styles', css);

  await page.evaluate(({ id }) => {
    const svg = document.getElementById(id);
    if (!svg) return;
    svg.querySelectorAll('.fx-logo-path').forEach((path) => {
      // Restart animation by cloning
      const clone = path.cloneNode(true);
      path.parentNode.replaceChild(clone, path);
    });
  }, { id: svgId });
}

/**
 * Effect 35 — Cinematic Letterbox Bars
 * Black bars at top + bottom (78px each) for 2.35:1 aspect ratio feel.
 */
async function letterbox(page, on = true) {
  if (!on) {
    await page.evaluate(() => {
      ['fx-letterbox-top', 'fx-letterbox-bottom'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.remove();
      });
    });
    return;
  }

  const css = `
    @keyframes fx-letterbox-in  { from { opacity: 0; } to { opacity: 1; } }
    @keyframes fx-letterbox-out { from { opacity: 1; } to { opacity: 0; } }
    #fx-letterbox-top, #fx-letterbox-bottom {
      position: fixed; left: 0; right: 0;
      height: 78px;
      background: #000;
      z-index: 99997;
      pointer-events: none;
    }
    #fx-letterbox-top    { top: 0;    animation: fx-letterbox-in 0.4s ease forwards; }
    #fx-letterbox-bottom { bottom: 0; animation: fx-letterbox-in 0.4s ease forwards; }
  `;
  await injectStyles(page, 'fx-letterbox-styles', css);

  await page.evaluate(() => {
    ['fx-letterbox-top', 'fx-letterbox-bottom'].forEach((id) => {
      if (document.getElementById(id)) return;
      const el = document.createElement('div');
      el.id = id;
      document.body.appendChild(el);
    });
  });
}

// ---------------------------------------------------------------------------
// CATEGORY 7: FFMPEG COLOR GRADING STRINGS
// (Apply as the -vf filter chain in your ffmpeg encoder step)
// ---------------------------------------------------------------------------

const grades = {
  /**
   * Effect 36 — Cinematic Warm Hollywood Grade
   * Warm golden highlights, pulled-back shadows. Netflix original look.
   */
  warmHollywood: [
    'colorchannelmixer=.90:.10:0:0:.10:.85:.10:0:0:.10:.80:0',
    'eq=contrast=1.05:saturation=1.10',
  ].join(','),

  /**
   * Effect 37 — Cool Tech / Fintech Grade
   * Cool blue-tinted, crisp. Stripe / Linear aesthetic.
   */
  coolTech: [
    'colorchannelmixer=.85:.05:.10:0:.05:.90:.05:0:.05:.10:.95:0',
    'eq=contrast=1.06:brightness=-0.02',
  ].join(','),

  /**
   * Effect 38 — Vignette
   * Darkens edges, draws eye to center.
   */
  vignette: 'vignette=PI/4',

  /**
   * Effect 39 — Film Grain
   * Subtle analog grain. Prevents "screen recording" look.
   */
  grain: 'noise=c0s=8:allf=t+u',

  /**
   * Effect 40 — Sharpen
   * Makes UI text and edges crisp. Compensates for H.264 encoding softness.
   */
  sharpen: 'unsharp=5:5:0.8:3:3:0.4',

  /**
   * Effect 41 — Vibrance Boost
   * Makes brand colors pop. Essential for finance dashboards.
   */
  vibrance: 'eq=saturation=1.15:contrast=1.05:gamma=0.96',

  /**
   * Effect 42 — Full Cinematic Stack (recommended combo)
   * Apply as the ffmpeg -vf chain:
   *   ffmpeg -i input.mp4 -vf "<fullCinematic>" -c:v libx264 -crf 18 output.mp4
   */
  fullCinematic: [
    'colorchannelmixer=.88:.08:.04:0:.04:.87:.09:0:.02:.08:.90:0',
    'eq=contrast=1.05:saturation=1.12:brightness=-0.01',
    'vignette=PI/4.5',
    'noise=c0s=6:allf=t+u',
    'unsharp=5:5:0.6:3:3:0.3',
  ].join(','),
};

// ---------------------------------------------------------------------------
// RENDERER API OBJECT — the single export used by render-video.js
// ---------------------------------------------------------------------------

const FX = {
  // ---- Configuration ----
  setBrand,

  // ---- Category 1: Cursor ----

  /** Initialize cursor dot, spotlight, and trail infrastructure. Call once after page load. */
  async initCursor(page) {
    return initCursor(page);
  },

  /** Effect 2: Ripple SVG expands from (x,y). Call around iframeClick(). */
  async clickRipple(page, x, y) {
    return clickRipple(page, x, y);
  },

  /** Effect 3: Dim everything except 180px radius around cursor. */
  async spotlight(page, on = true) {
    return spotlight(page, on);
  },

  /** Effect 4: 3 ghost dots trail the cursor. */
  async cursorTrail(page, on = true) {
    return cursorTrail(page, on);
  },

  /** Effect 5: 3 concentric rings pulse from click point. */
  async clickTargetRings(page, x, y) {
    return clickTargetRings(page, x, y);
  },

  // ---- Category 2: Transitions ----

  /** Effect 6a: Fade screen to black over ms. */
  async fadeToBlack(page, ms = 400) {
    return fadeToBlack(page, ms);
  },

  /** Effect 6b: Fade screen from black over ms. */
  async fadeFromBlack(page, ms = 400) {
    return fadeFromBlack(page, ms);
  },

  /** Effect 7: Scale 1→1.06 and fade out. */
  async zoomOut(page, ms = 500) {
    return zoomOut(page, ms);
  },

  /** Effect 8: 3 rapid white flashes with ±4px jitter. 400ms. */
  async glitchFlash(page) {
    return glitchFlash(page);
  },

  /** Effect 9: Blur out then blur in. 800ms total. */
  async blurTransition(page, ms = 400) {
    return blurTransition(page, ms);
  },

  /** Effect 10: White flash cut. 200ms. */
  async whiteFlash(page, ms = 200) {
    return whiteFlash(page, ms);
  },

  /** Effect 11a: Iris circle expands from center to fill screen. */
  async irisIn(page, ms = 500) {
    return irisIn(page, ms);
  },

  /** Effect 11b: Iris circle shrinks to reveal next scene. */
  async irisOut(page, ms = 500) {
    return irisOut(page, ms);
  },

  // ---- Category 3: Ambient ----

  /** Effect 12: 20 floating brand-color particles. */
  async particles(page, on = true) {
    return particles(page, on);
  },

  /** Effect 13: Slow-shifting aurora gradient at 5% opacity. */
  async aurora(page, on = true) {
    return aurora(page, on);
  },

  /** Effect 14: Animated perspective grid. */
  async grid(page, on = true) {
    return grid(page, on);
  },

  /** Effect 15: SVG feTurbulence film grain. */
  async grain(page, on = true) {
    return grain(page, on);
  },

  /** Effect 16: CRT-style horizontal scan lines. */
  async scanlines(page, on = true) {
    return scanlines(page, on);
  },

  // ---- Category 4: Callouts ----

  /** Effect 17: 50 confetti rectangles burst from center. */
  async confetti(page) {
    return confetti(page);
  },

  /** Effect 18: Number rolls up from 0 to target over durationMs. */
  async animateCounter(page, elementId, target, suffix = '', durationMs = 1200) {
    return animateCounter(page, elementId, target, suffix, durationMs);
  },

  /** Effect 19: Self-drawing SVG checkmark inside containerId. */
  async checkmark(page, containerId) {
    return checkmark(page, containerId);
  },

  /** Effect 20: Light sweep shimmer on an element. */
  async addShimmer(page, elementId) {
    return addShimmer(page, elementId);
  },

  /** Effect 21: Rotating conic-gradient border on an element. */
  async rotatingBorder(page, elementId, on = true) {
    return rotatingBorder(page, elementId, on);
  },

  /** Effect 22: Spring bounce-in entry animation. */
  async bounceIn(page, elementId) {
    return bounceIn(page, elementId);
  },

  /** Effect 23: Pulsing neon text-shadow glow. */
  async neonStat(page, elementId, on = true) {
    return neonStat(page, elementId, on);
  },

  /** Effect 24a: Inject a circular progress ring SVG into containerId. */
  async injectProgressRing(page, containerId, svgId = 'fx-progress-ring') {
    return injectProgressRing(page, containerId, svgId);
  },

  /** Effect 24b: Set progress ring to pct% (0-100). */
  async progressRing(page, svgId, pct) {
    return progressRing(page, svgId, pct);
  },

  /** Effect 25: Green pulse ring expands from (x,y). */
  async successPulse(page, x, y) {
    return successPulse(page, x, y);
  },

  // ---- Category 5: UI Highlight ----

  /** Effect 26: Animated dashed border around a DOM element. */
  async highlight(page, selector, durationMs = 2000, iframeMode = true) {
    return highlight(page, selector, durationMs, iframeMode);
  },

  /** Effect 27: Bouncing arrow at (x,y) pointing in direction. */
  async arrow(page, x, y, dir = 'down') {
    return arrow(page, x, y, dir);
  },

  /** Effect 27b: Remove the arrow. */
  async hideArrow(page) {
    return hideArrow(page);
  },

  /** Effect 28: Floating magnifying lens over region (x,y). */
  async zoomLens(page, x, y, scale = 2.5) {
    return zoomLens(page, x, y, scale);
  },

  /** Effect 28b: Remove the zoom lens. */
  async hideZoomLens(page) {
    return hideZoomLens(page);
  },

  /** Effect 29: Bouncing scroll indicator at bottom center. */
  async scrollHint(page, on = true) {
    return scrollHint(page, on);
  },

  // ---- Category 6: Title Cards ----

  /** Effect 30: Matrix-style character scramble reveal on an element. */
  async scramble(page, elementId, finalText, durationMs = 800) {
    return scramble(page, elementId, finalText, durationMs);
  },

  /** Effect 31: Horizontal glitch jitter on text. 600ms. */
  async glitchText(page, elementId) {
    return glitchText(page, elementId);
  },

  /** Effect 32: Wave-in stagger on .fx-stat children inside container. */
  async waveCounterRow(page, containerId) {
    return waveCounterRow(page, containerId);
  },

  /** Effect 33: 3D perspective tilt oscillation on an element. */
  async tilt3d(page, elementId, on = true) {
    return tilt3d(page, elementId, on);
  },

  /** Effect 34: SVG logo draws itself via stroke-dashoffset. */
  async drawLogo(page, svgId, durationMs = 1500) {
    return drawLogo(page, svgId, durationMs);
  },

  /** Effect 35: Cinematic letterbox bars (78px top + bottom). */
  async letterbox(page, on = true) {
    return letterbox(page, on);
  },

  // ---- Category 7: ffmpeg color grade strings ----
  grades,
};

module.exports = FX;

// ---------------------------------------------------------------------------
// USAGE REFERENCE
// ---------------------------------------------------------------------------
//
// SETUP (call once per page, right after navigation):
//
//   FX.setBrand('#2563eb', 37, 99, 235);          // set brand color
//   await FX.initCursor(page);                    // cursor + spotlight + trail
//   await FX.grain(page, true);                   // film grain overlay
//   await FX.scanlines(page, true);               // CRT scan lines
//
// SCENE OPEN (title card):
//
//   await FX.letterbox(page, true);
//   await FX.aurora(page, true);
//   await FX.particles(page, true);
//   await FX.tilt3d(page, 'title-card', true);
//   await FX.scramble(page, 'title-text', 'My Product Demo');
//   await FX.waveCounterRow(page, 'stats-row');
//
// DURING INTERACTION:
//
//   await FX.arrow(page, 640, 300, 'down');        // point at something
//   await FX.highlight(page, '#submit-btn');       // dashed border highlight
//   await FX.clickRipple(page, x, y);             // before click
//   await FX.clickTargetRings(page, x, y);        // more prominent rings
//   await FX.spotlight(page, true);               // dim background
//
// SCENE TRANSITION:
//
//   await FX.fadeToBlack(page, 400);
//   // ... navigate / change scene ...
//   await FX.fadeFromBlack(page, 400);
//   // OR
//   await FX.glitchFlash(page);                   // high-energy cut
//
// SUCCESS / COMPLETION:
//
//   await FX.confetti(page);
//   await FX.checkmark(page, 'result-container');
//   await FX.successPulse(page, 640, 360);
//   await FX.animateCounter(page, 'metric-1', 247, '%');
//   await FX.neonStat(page, 'metric-1', true);
//
// FFMPEG POST-PROCESS:
//
//   const { execSync } = require('child_process');
//   execSync(`ffmpeg -i raw.mp4 -vf "${FX.grades.fullCinematic}" -c:v libx264 -crf 18 output.mp4`);
//
// INDIVIDUAL GRADE CHAINS:
//
//   FX.grades.warmHollywood  → warm golden Netflix look
//   FX.grades.coolTech       → cool blue Stripe/Linear look
//   FX.grades.vignette       → darken edges
//   FX.grades.grain          → film grain texture
//   FX.grades.sharpen        → crisp UI text
//   FX.grades.vibrance       → brand color pop
//   FX.grades.fullCinematic  → recommended full stack
