/**
 * fx.js v6 — Visual Effects System (72 effects across 10 categories)
 *
 * Playwright-based screen-recorder effects for 1280×720 headless Chromium.
 * All CSS is injected via page.evaluate(). All functions are async.
 *
 * QUICK START:
 *   const FX = require('./fx');
 *   FX.setBrand('#2563eb', 37, 99, 235);   // set once
 *   await FX.initCursor(page);             // after every page.goto()
 *   await FX.clickRipple(page, x, y);
 *
 * EFFECTS LEVEL GUIDE:
 *   essential  → initCursor, clickRipple, particles, bounceIn, sceneLabel,
 *                recIndicator, timelineBar, subtitle, wordReveal
 *   full       → essential + fadeToBlack/From, shimmer, animateCounter, arrow,
 *                annotate, regionFocus, zoomLens, spotlight, confetti, checkmark,
 *                emojiBurst, statFlip, mgBeforeAfter, mgProcess, decimalCounter,
 *                swipePush, particleExplode
 *   cinematic  → full + letterbox, scramble, tilt3d, glitchText, grain,
 *                chromaticAberration, dataStream, radialBurst, splitStagger,
 *                blurIn, grades.warmHollywood or coolTech
 */

'use strict';

// ---------------------------------------------------------------------------
// Brand color — override via setBrand() before calling any effect
// ---------------------------------------------------------------------------
let BRAND_HEX = '#2563eb';
let BR = 37, BG = 99, BB = 235;

function setBrand(hex, r, g, b) {
  BRAND_HEX = hex; BR = r; BG = g; BB = b;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------
async function injectStyles(page, id, css) {
  await page.evaluate(({ styleId, cssText }) => {
    if (document.getElementById(styleId)) return;
    const s = document.createElement('style');
    s.id = styleId; s.textContent = cssText;
    document.head.appendChild(s);
  }, { styleId: id, cssText: css });
}

// ---------------------------------------------------------------------------
// CATEGORY 1 — CURSOR EFFECTS (5 effects)
// ---------------------------------------------------------------------------

async function initCursor(page) {
  const css = `
    * { cursor: none !important; }
    #fx-cursor-dot {
      position:fixed; width:12px; height:12px; border-radius:50%;
      background:${BRAND_HEX}; pointer-events:none; z-index:999999;
      box-shadow:0 0 8px 2px rgba(${BR},${BG},${BB},.6);
      transform:translate(-50%,-50%); transition:transform .08s ease; will-change:left,top;
    }
    #fx-cursor-dot.clicking { transform:translate(-50%,-50%) scale(0.7); }
    #fx-spotlight {
      position:fixed; inset:0; pointer-events:none; z-index:999998; display:none;
      background:radial-gradient(circle 180px at var(--fx-mx,640px) var(--fx-my,360px),transparent 0%,rgba(0,0,0,.55) 100%);
    }
    #fx-spotlight.active { display:block; }
    .fx-cursor-ghost {
      position:fixed; width:8px; height:8px; border-radius:50%; background:${BRAND_HEX};
      pointer-events:none; z-index:999997; opacity:0; transform:translate(-50%,-50%);
      transition:left .06s ease,top .06s ease,opacity .1s; will-change:left,top; display:none;
    }
    .fx-cursor-ghost.trail-active { display:block; }
    .fx-cursor-ghost:nth-child(1).trail-active { opacity:.40; transition-delay:.06s; }
    .fx-cursor-ghost:nth-child(2).trail-active { opacity:.25; transition-delay:.12s; }
    .fx-cursor-ghost:nth-child(3).trail-active { opacity:.12; transition-delay:.18s; }
  `;
  await injectStyles(page, 'fx-cursor-styles', css);
  await page.evaluate(({ hex }) => {
    if (document.getElementById('fx-cursor-dot')) return;
    const dot = document.createElement('div'); dot.id = 'fx-cursor-dot';
    const sp  = document.createElement('div'); sp.id  = 'fx-spotlight';
    document.body.appendChild(dot); document.body.appendChild(sp);
    for (let i = 0; i < 3; i++) {
      const g = document.createElement('div'); g.className = 'fx-cursor-ghost';
      document.body.appendChild(g);
    }
    document.addEventListener('mousemove', (e) => {
      const x = e.clientX, y = e.clientY;
      dot.style.left = x + 'px'; dot.style.top = y + 'px';
      document.documentElement.style.setProperty('--fx-mx', x + 'px');
      document.documentElement.style.setProperty('--fx-my', y + 'px');
      sp.style.background = `radial-gradient(circle 180px at ${x}px ${y}px,transparent 0%,rgba(0,0,0,.55) 100%)`;
      document.querySelectorAll('.fx-cursor-ghost').forEach(g => { g.style.left = x+'px'; g.style.top = y+'px'; });
    });
    document.addEventListener('mousedown', () => dot.classList.add('clicking'));
    document.addEventListener('mouseup',   () => dot.classList.remove('clicking'));
  }, { hex: BRAND_HEX });
}

async function clickRipple(page, x, y) {
  await page.evaluate(({ cx, cy, hex }) => {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.style.cssText = `position:fixed;left:${cx-50}px;top:${cy-50}px;width:100px;height:100px;pointer-events:none;z-index:999999;overflow:visible`;
    const c = document.createElementNS(ns, 'circle');
    c.setAttribute('cx','50'); c.setAttribute('cy','50'); c.setAttribute('r','0');
    c.setAttribute('fill','none'); c.setAttribute('stroke',hex); c.setAttribute('stroke-width','2');
    const ar = document.createElementNS(ns,'animate'); ar.setAttribute('attributeName','r'); ar.setAttribute('from','0'); ar.setAttribute('to','40'); ar.setAttribute('dur','0.8s'); ar.setAttribute('fill','freeze');
    const ao = document.createElementNS(ns,'animate'); ao.setAttribute('attributeName','opacity'); ao.setAttribute('from','0.8'); ao.setAttribute('to','0'); ao.setAttribute('dur','0.8s'); ao.setAttribute('fill','freeze');
    c.append(ar,ao); svg.appendChild(c); document.body.appendChild(svg);
    setTimeout(() => svg.remove(), 850);
  }, { cx: x, cy: y, hex: BRAND_HEX });
}

async function spotlight(page, on = true) {
  await page.evaluate((enable) => {
    const el = document.getElementById('fx-spotlight'); if (!el) return;
    if (enable) el.classList.add('active'); else el.classList.remove('active');
  }, on);
}

async function cursorTrail(page, on = true) {
  await page.evaluate((enable) => {
    document.querySelectorAll('.fx-cursor-ghost').forEach(g => {
      if (enable) g.classList.add('trail-active'); else g.classList.remove('trail-active');
    });
  }, on);
}

async function clickTargetRings(page, x, y) {
  const css = `
    @keyframes fx-ring-expand { 0%{transform:translate(-50%,-50%) scale(.2);opacity:.9} 100%{transform:translate(-50%,-50%) scale(1.8);opacity:0} }
    .fx-click-ring { position:fixed;width:60px;height:60px;border-radius:50%;border:2px solid ${BRAND_HEX};pointer-events:none;z-index:999998;animation:fx-ring-expand .7s ease-out forwards; }
  `;
  await injectStyles(page, 'fx-ring-styles', css);
  await page.evaluate(({ cx, cy, hex }) => {
    [0,120,240].forEach(delay => {
      const r = document.createElement('div'); r.className = 'fx-click-ring';
      r.style.left = cx+'px'; r.style.top = cy+'px'; r.style.animationDelay = delay+'ms'; r.style.borderColor = hex;
      document.body.appendChild(r); setTimeout(() => r.remove(), 800+delay);
    });
  }, { cx: x, cy: y, hex: BRAND_HEX });
}

// ---------------------------------------------------------------------------
// CATEGORY 2 — SCENE TRANSITIONS (11 effects; +4 new vs v5)
// ---------------------------------------------------------------------------

async function ensureOverlay(page) {
  await page.evaluate(() => {
    if (document.getElementById('fx-transition-overlay')) return;
    const div = document.createElement('div'); div.id = 'fx-transition-overlay';
    div.style.cssText = 'position:fixed;inset:0;background:#000;opacity:0;pointer-events:none;z-index:999995;transition:none';
    document.body.appendChild(div);
  });
}

async function fadeToBlack(page, ms = 400) {
  await ensureOverlay(page);
  await page.evaluate(ms => {
    const el = document.getElementById('fx-transition-overlay');
    el.style.transition = `opacity ${ms}ms ease`; el.style.opacity = '1';
  }, ms);
  await page.waitForTimeout(ms + 30);
}

async function fadeFromBlack(page, ms = 400) {
  await ensureOverlay(page);
  await page.evaluate(ms => {
    const el = document.getElementById('fx-transition-overlay');
    el.style.transition = `opacity ${ms}ms ease`; el.style.opacity = '0';
  }, ms);
  await page.waitForTimeout(ms + 30);
}

async function zoomOut(page, ms = 500) {
  const css = `@keyframes fx-zoom-out{0%{transform:scale(1);opacity:1}100%{transform:scale(1.06);opacity:0}}.fx-zoom-out-active{animation:fx-zoom-out ${ms}ms ease forwards;transform-origin:center}`;
  await injectStyles(page, 'fx-zoom-styles', css);
  await page.evaluate(ms => {
    document.body.classList.add('fx-zoom-out-active');
    setTimeout(() => document.body.classList.remove('fx-zoom-out-active'), ms+50);
  }, ms);
  await page.waitForTimeout(ms);
}

async function glitchFlash(page) {
  const css = `@keyframes fx-glitch-flash{0%,100%{opacity:0;transform:translateX(0)}10%,30%,50%{opacity:1;transform:translateX(-4px)}20%,40%,60%{opacity:.8;transform:translateX(4px)}70%,90%{opacity:0;transform:translateX(0)}}#fx-glitch-overlay{position:fixed;inset:0;background:#fff;pointer-events:none;z-index:999996;animation:fx-glitch-flash .4s ease forwards}`;
  await injectStyles(page, 'fx-glitch-styles', css);
  await page.evaluate(() => {
    const e = document.getElementById('fx-glitch-overlay'); if (e) e.remove();
    const el = document.createElement('div'); el.id = 'fx-glitch-overlay';
    document.body.appendChild(el); setTimeout(() => el.remove(), 450);
  });
  await page.waitForTimeout(420);
}

async function blurTransition(page, ms = 400) {
  const css = `@keyframes fx-blur-out{from{filter:blur(0);opacity:1}to{filter:blur(12px);opacity:0}}@keyframes fx-blur-in{from{filter:blur(12px);opacity:0}to{filter:blur(0);opacity:1}}.fx-blur-out{animation:fx-blur-out ${ms}ms ease forwards}.fx-blur-in{animation:fx-blur-in ${ms}ms ease forwards}`;
  await injectStyles(page, 'fx-blur-styles', css);
  await page.evaluate(ms => {
    document.body.classList.remove('fx-blur-in'); document.body.classList.add('fx-blur-out');
    setTimeout(() => {
      document.body.classList.remove('fx-blur-out'); document.body.classList.add('fx-blur-in');
      setTimeout(() => document.body.classList.remove('fx-blur-in'), ms+50);
    }, ms);
  }, ms);
  await page.waitForTimeout(ms*2+60);
}

async function whiteFlash(page, ms = 200) {
  await page.evaluate(ms => {
    const e = document.getElementById('fx-white-flash'); if (e) e.remove();
    const el = document.createElement('div'); el.id = 'fx-white-flash';
    el.style.cssText = `position:fixed;inset:0;background:#fff;opacity:1;pointer-events:none;z-index:999996;transition:opacity ${ms}ms ease`;
    document.body.appendChild(el); void el.offsetHeight;
    requestAnimationFrame(() => { el.style.opacity = '0'; });
    setTimeout(() => el.remove(), ms+50);
  }, ms);
  await page.waitForTimeout(ms+60);
}

async function irisIn(page, ms = 500) {
  const css = `@keyframes fx-iris-expand{0%{clip-path:circle(0% at 50% 50%)}100%{clip-path:circle(75% at 50% 50%)}}#fx-iris{position:fixed;inset:0;background:#000;pointer-events:none;z-index:999995}#fx-iris.iris-in{animation:fx-iris-expand ${ms}ms ease forwards}`;
  await injectStyles(page, 'fx-iris-styles', css);
  await page.evaluate(ms => {
    let el = document.getElementById('fx-iris');
    if (!el) { el = document.createElement('div'); el.id = 'fx-iris'; document.body.appendChild(el); }
    el.className = ''; void el.offsetHeight; el.classList.add('iris-in');
    setTimeout(() => el.classList.remove('iris-in'), ms+50);
  }, ms);
  await page.waitForTimeout(ms);
}

async function irisOut(page, ms = 500) {
  await page.evaluate(ms => {
    let el = document.getElementById('fx-iris');
    if (!el) { el = document.createElement('div'); el.id = 'fx-iris'; el.style.cssText = 'position:fixed;inset:0;background:#000;pointer-events:none;z-index:999995'; document.body.appendChild(el); }
    el.style.clipPath = 'circle(75% at 50% 50%)'; el.style.transition = `clip-path ${ms}ms ease`;
    requestAnimationFrame(() => { el.style.clipPath = 'circle(0% at 50% 50%)'; });
    setTimeout(() => el.remove(), ms+100);
  }, ms);
  await page.waitForTimeout(ms+110);
}

// NEW — Chromatic Aberration Flash
async function chromaticAberration(page, ms = 300) {
  const css = `
    @keyframes fx-ca-r{0%{opacity:0;transform:translateX(-6px)}20%{opacity:1;transform:translateX(-4px)}80%{opacity:.8;transform:translateX(-2px)}100%{opacity:0;transform:translateX(0)}}
    @keyframes fx-ca-b{0%{opacity:0;transform:translateX(6px)}20%{opacity:1;transform:translateX(4px)}80%{opacity:.8;transform:translateX(2px)}100%{opacity:0;transform:translateX(0)}}
  `;
  await injectStyles(page, 'fx-ca-styles', css);
  await page.evaluate(ms => {
    const r = document.createElement('div'), b = document.createElement('div');
    r.style.cssText = `position:fixed;inset:0;pointer-events:none;background:rgba(255,0,0,.22);mix-blend-mode:screen;z-index:999992;animation:fx-ca-r ${ms}ms ease forwards`;
    b.style.cssText = `position:fixed;inset:0;pointer-events:none;background:rgba(0,0,255,.22);mix-blend-mode:screen;z-index:999992;animation:fx-ca-b ${ms}ms ease forwards`;
    document.body.append(r, b); setTimeout(() => { r.remove(); b.remove(); }, ms+50);
  }, ms);
  await page.waitForTimeout(ms+60);
}

// NEW — Swipe Push Transition
async function swipePush(page, dir = 'left', ms = 500) {
  await page.evaluate(({ dir, ms }) => {
    const ov = document.createElement('div'); ov.id = 'fx-swipe-push';
    const startX = dir === 'left' ? '100%' : '-100%';
    ov.style.cssText = `position:fixed;inset:0;background:#060d14;pointer-events:none;z-index:999991;transform:translateX(${startX});transition:transform ${ms}ms cubic-bezier(.77,0,.18,1)`;
    document.body.appendChild(ov);
    requestAnimationFrame(() => requestAnimationFrame(() => { ov.style.transform = 'translateX(0)'; }));
    setTimeout(() => {
      ov.style.transform = dir === 'left' ? 'translateX(-100%)' : 'translateX(100%)';
      setTimeout(() => ov.remove(), ms+50);
    }, ms+100);
  }, { dir, ms });
  await page.waitForTimeout(ms*2+200);
}

// NEW — Particle Explosion
async function particleExplode(page, x, y, count = 80) {
  await page.evaluate(({ x, y, count, hex }) => {
    const colors = [hex,'#10b981','#3b82f6','#f59e0b','#ec4899','#8b5cf6','#fff'];
    for (let i = 0; i < count; i++) {
      const el = document.createElement('div');
      const angle = Math.random() * Math.PI * 2;
      const dist  = 80 + Math.random() * 280;
      const size  = 3 + Math.random() * 8;
      const id = `pex_${i}_${Date.now()}`;
      const style = document.createElement('style');
      const isCircle = Math.random() > 0.5;
      style.textContent = `@keyframes ${id}{0%{transform:translate(-50%,-50%) scale(1);opacity:1}100%{transform:translate(calc(-50% + ${Math.cos(angle)*dist}px),calc(-50% + ${Math.sin(angle)*dist}px)) scale(0);opacity:0}}`;
      el.style.cssText = `position:fixed;width:${size}px;height:${size}px;border-radius:${isCircle?'50%':'2px'};background:${colors[i%colors.length]};left:${x}px;top:${y}px;z-index:999993;pointer-events:none;animation:${id} ${.8+Math.random()*.6}s ease-out forwards`;
      document.head.appendChild(style); document.body.appendChild(el);
      setTimeout(() => { el.remove(); style.remove(); }, 1600);
    }
  }, { x, y, count, hex: BRAND_HEX });
}

// ---------------------------------------------------------------------------
// CATEGORY 3 — AMBIENT BACKGROUND (7 effects; +2 new vs v5)
// ---------------------------------------------------------------------------

async function particles(page, on = true) {
  if (!on) { await page.evaluate(() => document.getElementById('fx-particles-container')?.remove()); return; }
  const css = `@keyframes fx-float-up{0%{transform:translateY(0) translateX(0);opacity:0}10%{opacity:.6}90%{opacity:.4}100%{transform:translateY(-740px) translateX(var(--fx-drift));opacity:0}}.fx-particle{position:absolute;width:3px;height:3px;border-radius:50%;background:${BRAND_HEX};animation:fx-float-up var(--fx-dur) linear var(--fx-delay) infinite;pointer-events:none}#fx-particles-container{position:fixed;inset:0;pointer-events:none;z-index:99985;overflow:hidden}`;
  await injectStyles(page, 'fx-particles-styles', css);
  await page.evaluate(() => {
    if (document.getElementById('fx-particles-container')) return;
    const c = document.createElement('div'); c.id = 'fx-particles-container';
    for (let i = 0; i < 20; i++) {
      const p = document.createElement('div'); p.className = 'fx-particle';
      p.style.cssText = `left:${Math.random()*1280}px;bottom:-10px;--fx-dur:${(8+Math.random()*8).toFixed(2)}s;--fx-delay:-${(Math.random()*8).toFixed(2)}s;--fx-drift:${((Math.random()-.5)*60).toFixed(1)}px`;
      c.appendChild(p);
    }
    document.body.appendChild(c);
  });
}

async function aurora(page, on = true) {
  if (!on) { await page.evaluate(() => document.getElementById('fx-aurora')?.remove()); return; }
  const css = `@keyframes fx-aurora{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}#fx-aurora{position:fixed;inset:0;opacity:.05;pointer-events:none;z-index:99984;background-size:400% 400%;background:linear-gradient(135deg,${BRAND_HEX},#0ea5e9,#8b5cf6,${BRAND_HEX});animation:fx-aurora 12s ease infinite}`;
  await injectStyles(page, 'fx-aurora-styles', css);
  await page.evaluate(() => { if (document.getElementById('fx-aurora')) return; const el=document.createElement('div');el.id='fx-aurora';document.body.appendChild(el); });
}

async function grid(page, on = true) {
  if (!on) { await page.evaluate(() => document.getElementById('fx-perspgrid')?.remove()); return; }
  const css = `@keyframes fx-grid-forward{from{background-position:0 0}to{background-position:0 60px}}#fx-perspgrid{position:fixed;inset:0;pointer-events:none;z-index:99983;background-image:linear-gradient(rgba(${BR},${BG},${BB},.08) 1px,transparent 1px),linear-gradient(90deg,rgba(${BR},${BG},${BB},.08) 1px,transparent 1px);background-size:60px 60px;animation:fx-grid-forward 2s linear infinite}`;
  await injectStyles(page, 'fx-grid-styles', css);
  await page.evaluate(() => { if (document.getElementById('fx-perspgrid')) return; const el=document.createElement('div');el.id='fx-perspgrid';document.body.appendChild(el); });
}

async function grain(page, on = true) {
  if (!on) { await page.evaluate(() => document.getElementById('fx-grain-svg')?.remove()); return; }
  await page.evaluate(() => {
    if (document.getElementById('fx-grain-svg')) return;
    const svg = document.createElementNS('http://www.w3.org/2000/svg','svg'); svg.id='fx-grain-svg';
    svg.style.cssText='position:fixed;inset:0;width:100%;height:100%;opacity:.035;pointer-events:none;z-index:999990';
    svg.innerHTML=`<filter id="fx-grain-filter"><feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch"><animate attributeName="seed" values="0;100" dur="0.5s" repeatCount="indefinite"/></feTurbulence><feColorMatrix type="saturate" values="0"/></filter><rect width="100%" height="100%" filter="url(#fx-grain-filter)"/>`;
    document.body.appendChild(svg);
  });
}

async function scanlines(page, on = true) {
  if (!on) { await page.evaluate(() => document.getElementById('fx-scanlines')?.remove()); return; }
  await page.evaluate(() => {
    if (document.getElementById('fx-scanlines')) return;
    const el = document.createElement('div'); el.id='fx-scanlines';
    el.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:99989;background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,.03) 2px,rgba(0,0,0,.03) 4px)';
    document.body.appendChild(el);
  });
}

// NEW — Radial Burst Rings
async function radialBurst(page, on = true) {
  if (!on) { await page.evaluate(() => document.getElementById('fx-radial-burst')?.remove()); return; }
  const css = `
    #fx-radial-burst{position:fixed;inset:0;pointer-events:none;z-index:1;overflow:hidden}
    .fx-ring{position:absolute;border-radius:50%;border:1px solid rgba(${BR},${BG},${BB},.12);top:50%;left:50%;transform:translate(-50%,-50%);animation:fx-ringExpand 3.8s linear infinite}
    @keyframes fx-ringExpand{from{width:0;height:0;opacity:.5}to{width:1800px;height:1800px;opacity:0}}
  `;
  await injectStyles(page, 'fx-rb-styles', css);
  await page.evaluate(() => {
    if (document.getElementById('fx-radial-burst')) return;
    const w = document.createElement('div'); w.id = 'fx-radial-burst';
    for (let i = 0; i < 5; i++) {
      const r = document.createElement('div'); r.className = 'fx-ring'; r.style.animationDelay = `${i*0.76}s`; w.appendChild(r);
    }
    document.body.appendChild(w);
  });
}

// NEW — Data Stream Rain (Matrix-style)
async function dataStream(page, on = true) {
  if (!on) {
    await page.evaluate(() => {
      const c = document.getElementById('fx-data-stream');
      if (c && c._interval) clearInterval(c._interval);
      c?.remove();
    });
    return;
  }
  await page.evaluate(({ hex }) => {
    if (document.getElementById('fx-data-stream')) return;
    const canvas = document.createElement('canvas'); canvas.id = 'fx-data-stream';
    canvas.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2;opacity:.12';
    canvas.width = 1280; canvas.height = 720;
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    const cols = Math.floor(1280/14);
    const drops = Array(cols).fill(1).map(() => Math.random()*720);
    const chars = '01アイウエオカキクケコサシスセソタチツ01010101';
    const draw = () => {
      ctx.fillStyle = 'rgba(0,0,0,.05)'; ctx.fillRect(0,0,1280,720);
      ctx.fillStyle = hex; ctx.font = '12px monospace';
      drops.forEach((y, i) => {
        ctx.fillText(chars[Math.floor(Math.random()*chars.length)], i*14, y);
        if (y > 720 && Math.random() > .975) drops[i] = 0;
        drops[i] += 14;
      });
    };
    canvas._interval = setInterval(draw, 50);
  }, { hex: BRAND_HEX });
}

// ---------------------------------------------------------------------------
// CATEGORY 4 — CALLOUT & OVERLAY EFFECTS (11 effects; +2 new vs v5)
// ---------------------------------------------------------------------------

async function confetti(page) {
  await page.evaluate(() => {
    const colors = ['#10b981','#3b82f6','#f59e0b','#ec4899','#8b5cf6'];
    for (let i = 0; i < 50; i++) {
      const el = document.createElement('div');
      const angle = Math.random()*Math.PI*2, dist = 150+Math.random()*200;
      const dx = Math.cos(angle)*dist, dy = Math.sin(angle)*dist;
      const w = 6+Math.random()*6, h = 4+Math.random()*4, rot = Math.random()*720;
      const id = `fx-conf-${i}`; const s = document.createElement('style');
      s.textContent = `@keyframes ${id}{0%{transform:translate(-50%,-50%) rotate(0deg);opacity:1}100%{transform:translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) rotate(${rot}deg);opacity:0}}`;
      el.style.cssText = `position:fixed;width:${w}px;height:${h}px;background:${colors[i%5]};border-radius:1px;left:50%;top:50%;z-index:999999;pointer-events:none;animation:${id} 1.2s ease-out forwards`;
      document.head.appendChild(s); document.body.appendChild(el);
      setTimeout(() => { el.remove(); s.remove(); }, 1350);
    }
  });
}

async function animateCounter(page, elementId, target, suffix = '', durationMs = 1200) {
  await page.evaluate(({ id, tgt, sfx, dur }) => {
    const el = document.getElementById(id); if (!el) return;
    const start = performance.now();
    const tick = now => {
      const t = Math.min(1,(now-start)/dur), eased = 1-Math.pow(1-t,3);
      el.textContent = Math.round(eased*tgt)+sfx; if (t<1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, { id: elementId, tgt: target, sfx: suffix, dur: durationMs });
}

async function checkmark(page, containerId) {
  await page.evaluate(cid => {
    const container = document.getElementById(cid); if (!container||container.querySelector('#fx-check-svg')) return;
    const s = document.createElement('style');
    s.textContent = '@keyframes fx-draw-circle{to{stroke-dashoffset:0}}@keyframes fx-draw-check{to{stroke-dashoffset:0}}';
    document.head.appendChild(s);
    const ns='http://www.w3.org/2000/svg', svg=document.createElementNS(ns,'svg'); svg.id='fx-check-svg';
    svg.setAttribute('viewBox','0 0 52 52'); svg.setAttribute('width','52'); svg.setAttribute('height','52'); svg.style.display='block';
    const circle=document.createElementNS(ns,'circle'); circle.setAttribute('cx','26'); circle.setAttribute('cy','26'); circle.setAttribute('r','25'); circle.setAttribute('fill','none'); circle.setAttribute('stroke','#10b981'); circle.setAttribute('stroke-width','2');
    circle.style.cssText='stroke-dasharray:157;stroke-dashoffset:157;animation:fx-draw-circle .4s .1s ease forwards';
    const path=document.createElementNS(ns,'path'); path.setAttribute('fill','none'); path.setAttribute('stroke','#10b981'); path.setAttribute('stroke-width','3'); path.setAttribute('stroke-linecap','round'); path.setAttribute('d','M14 27 l9 9 l16 -16');
    path.style.cssText='stroke-dasharray:34;stroke-dashoffset:34;animation:fx-draw-check .3s .5s ease forwards';
    svg.append(circle,path); container.appendChild(svg);
  }, containerId);
}

async function addShimmer(page, elementId) {
  const css = `@keyframes fx-shimmer{0%{background-position:-400px 0}100%{background-position:400px 0}}.fx-shimmer{background:linear-gradient(90deg,transparent 0%,rgba(255,255,255,.04) 40%,rgba(255,255,255,.07) 50%,rgba(255,255,255,.04) 60%,transparent 100%);background-size:800px 100%;animation:fx-shimmer 2s linear infinite}`;
  await injectStyles(page, 'fx-shimmer-styles', css);
  await page.evaluate(id => { const el=document.getElementById(id); if(el) el.classList.add('fx-shimmer'); }, elementId);
}

async function rotatingBorder(page, elementId, on = true) {
  const css = `@property --fx-angle{syntax:'<angle>';inherits:false;initial-value:0deg}@keyframes fx-rotate-border{to{--fx-angle:360deg}}.fx-rotating-border{border:2px solid transparent;background:linear-gradient(#0f172a,#0f172a) padding-box,conic-gradient(from var(--fx-angle),${BRAND_HEX},#8b5cf6,${BRAND_HEX}) border-box;animation:fx-rotate-border 3s linear infinite}`;
  await injectStyles(page, 'fx-rotating-border-styles', css);
  await page.evaluate(({ id, enable }) => { const el=document.getElementById(id); if(!el) return; if(enable) el.classList.add('fx-rotating-border'); else el.classList.remove('fx-rotating-border'); }, { id: elementId, enable: on });
}

async function bounceIn(page, elementId) {
  const css = `@keyframes fx-bounce-in{0%{transform:scale(.85) translateY(10px);opacity:0}60%{transform:scale(1.04) translateY(-3px);opacity:1}80%{transform:scale(.98) translateY(0);opacity:1}100%{transform:scale(1) translateY(0);opacity:1}}.fx-bounce-in{animation:fx-bounce-in .5s cubic-bezier(.34,1.56,.64,1) forwards}`;
  await injectStyles(page, 'fx-bounce-styles', css);
  await page.evaluate(id => { const el=document.getElementById(id); if(!el) return; el.classList.remove('fx-bounce-in'); void el.offsetHeight; el.classList.add('fx-bounce-in'); setTimeout(()=>el.classList.remove('fx-bounce-in'),600); }, elementId);
}

async function neonStat(page, elementId, on = true) {
  const css = `@keyframes fx-neon-pulse{0%,100%{text-shadow:0 0 10px ${BRAND_HEX},0 0 20px ${BRAND_HEX},0 0 40px ${BRAND_HEX}}50%{text-shadow:0 0 5px ${BRAND_HEX},0 0 10px ${BRAND_HEX}}}.fx-neon-stat{animation:fx-neon-pulse 2s ease-in-out infinite}`;
  await injectStyles(page, 'fx-neon-styles', css);
  await page.evaluate(({ id, enable }) => { const el=document.getElementById(id); if(!el) return; if(enable) el.classList.add('fx-neon-stat'); else el.classList.remove('fx-neon-stat'); }, { id: elementId, enable: on });
}

async function injectProgressRing(page, containerId, svgId = 'fx-progress-ring') {
  await page.evaluate(({ cid, sid, hex }) => {
    const c=document.getElementById(cid); if(!c||document.getElementById(sid)) return;
    const ns='http://www.w3.org/2000/svg', svg=document.createElementNS(ns,'svg'); svg.id=sid;
    svg.setAttribute('viewBox','0 0 80 80'); svg.setAttribute('width','80'); svg.setAttribute('height','80');
    const track=document.createElementNS(ns,'circle'); track.setAttribute('cx','40'); track.setAttribute('cy','40'); track.setAttribute('r','34'); track.setAttribute('fill','none'); track.setAttribute('stroke','rgba(255,255,255,.1)'); track.setAttribute('stroke-width','6');
    const fill=document.createElementNS(ns,'circle'); fill.id='fx-ring-fill'; fill.setAttribute('cx','40'); fill.setAttribute('cy','40'); fill.setAttribute('r','34'); fill.setAttribute('fill','none'); fill.setAttribute('stroke',hex); fill.setAttribute('stroke-width','6'); fill.setAttribute('stroke-linecap','round');
    const circ=2*Math.PI*34; fill.style.cssText=`stroke-dasharray:${circ};stroke-dashoffset:${circ};transform:rotate(-90deg);transform-origin:40px 40px;transition:stroke-dashoffset .3s ease`;
    svg.append(track,fill); c.appendChild(svg);
  }, { cid: containerId, sid: svgId, hex: BRAND_HEX });
}

async function progressRing(page, svgId, pct) {
  await page.evaluate(({ id, percent }) => {
    const svg=document.getElementById(id); if(!svg) return;
    const fill=svg.querySelector('#fx-ring-fill'); if(!fill) return;
    fill.style.strokeDashoffset = 2*Math.PI*34*(1-percent/100);
  }, { id: svgId, percent: pct });
}

async function successPulse(page, x, y) {
  const css = `@keyframes fx-success-pulse{0%{transform:translate(-50%,-50%) scale(.5);opacity:.8}100%{transform:translate(-50%,-50%) scale(2.5);opacity:0}}.fx-success-ring{position:fixed;width:60px;height:60px;border-radius:50%;border:2px solid #10b981;pointer-events:none;z-index:999998;animation:fx-success-pulse .8s ease-out forwards}`;
  await injectStyles(page, 'fx-success-styles', css);
  await page.evaluate(({ cx, cy }) => {
    const r=document.createElement('div'); r.className='fx-success-ring'; r.style.left=cx+'px'; r.style.top=cy+'px';
    document.body.appendChild(r); setTimeout(()=>r.remove(),900);
  }, { cx: x, cy: y });
}

// NEW — Stat Flip (3D card rotation showing before→after value)
async function statFlip(page, elementId, fromVal, toVal, ms = 800) {
  await page.evaluate(({ id, from, to, ms }) => {
    const el = document.getElementById(id); if (!el) return;
    el.style.display = 'inline-block'; el.style.perspective = '400px'; el.textContent = from;
    requestAnimationFrame(() => {
      el.style.transition = `transform ${ms/2}ms ease-in, opacity ${ms/2}ms ease-in`;
      el.style.transform = 'rotateX(-90deg)'; el.style.opacity = '0';
      setTimeout(() => {
        el.style.transition = 'none'; el.textContent = to; el.style.transform = 'rotateX(90deg)'; el.style.opacity = '0';
        requestAnimationFrame(() => {
          el.style.transition = `transform ${ms/2}ms ease-out, opacity ${ms/2}ms ease-out`;
          el.style.transform = 'rotateX(0deg)'; el.style.opacity = '1';
        });
      }, ms/2+50);
    });
  }, { id: elementId, from: fromVal, to: toVal, ms });
  await page.waitForTimeout(ms+100);
}

// NEW — Emoji Burst
async function emojiBurst(page, x, y, emoji = '🎉', count = 12) {
  await page.evaluate(({ x, y, emoji, count }) => {
    for (let i = 0; i < count; i++) {
      const el = document.createElement('div');
      const angle = Math.random()*Math.PI*2, dist = 60+Math.random()*140;
      const id = `emj_${i}_${Date.now()}`, s = document.createElement('style');
      s.textContent = `@keyframes ${id}{0%{transform:translate(-50%,-50%) scale(0) rotate(0deg);opacity:1}50%{opacity:1}100%{transform:translate(calc(-50% + ${Math.cos(angle)*dist}px),calc(-50% + ${Math.sin(angle)*dist}px)) scale(1.2) rotate(${(Math.random()>.5?1:-1)*(180+Math.random()*180)}deg);opacity:0}}`;
      el.style.cssText = `position:fixed;font-size:${18+Math.random()*14}px;left:${x}px;top:${y}px;z-index:999994;pointer-events:none;animation:${id} 1.1s cubic-bezier(.17,.67,.55,1.2) forwards`;
      el.textContent = emoji;
      document.head.appendChild(s); document.body.appendChild(el);
      setTimeout(() => { el.remove(); s.remove(); }, 1200);
    }
  }, { x, y, emoji, count });
}

// ---------------------------------------------------------------------------
// CATEGORY 5 — UI HIGHLIGHT EFFECTS (6 effects; +2 new vs v5)
// ---------------------------------------------------------------------------

async function highlight(page, selector, durationMs = 2000, iframeMode = true) {
  const css = `@keyframes fx-dash-march{to{background-position:20px 0,-20px 0,0 -20px,0 20px}}.fx-highlight-box{position:fixed;pointer-events:none;z-index:999998;border-radius:6px;box-shadow:0 0 12px rgba(${BR},${BG},${BB},.4)}.fx-highlight-box::before{content:'';position:absolute;inset:-2px;border-radius:8px;background:repeating-linear-gradient(90deg,${BRAND_HEX} 0,${BRAND_HEX} 8px,transparent 8px,transparent 16px) top/100% 2px no-repeat,repeating-linear-gradient(90deg,${BRAND_HEX} 0,${BRAND_HEX} 8px,transparent 8px,transparent 16px) bottom/100% 2px no-repeat,repeating-linear-gradient(180deg,${BRAND_HEX} 0,${BRAND_HEX} 8px,transparent 8px,transparent 16px) left/2px 100% no-repeat,repeating-linear-gradient(180deg,${BRAND_HEX} 0,${BRAND_HEX} 8px,transparent 8px,transparent 16px) right/2px 100% no-repeat;animation:fx-dash-march .5s linear infinite}`;
  await injectStyles(page, 'fx-highlight-styles', css);
  await page.evaluate(({ sel, dur, iframe }) => {
    let el, oL=0, oT=0;
    if (iframe) { const f=document.getElementById('app'); el=f&&f.contentDocument&&f.contentDocument.querySelector(sel); if(f){const fr=f.getBoundingClientRect();oL=fr.left;oT=fr.top;} }
    else el=document.querySelector(sel);
    if (!el) return;
    const rect=el.getBoundingClientRect(), box=document.createElement('div'); box.className='fx-highlight-box';
    box.style.left=(rect.left+oL-4)+'px'; box.style.top=(rect.top+oT-4)+'px'; box.style.width=(rect.width+8)+'px'; box.style.height=(rect.height+8)+'px';
    document.body.appendChild(box); setTimeout(()=>box.remove(), dur);
  }, { sel: selector, dur: durationMs, iframe: iframeMode });
}

async function arrow(page, targetX, targetY, direction = 'down') {
  const css = `@keyframes fx-arrow-bounce-down{0%,100%{transform:translateY(0)}50%{transform:translateY(8px)}}@keyframes fx-arrow-bounce-up{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}@keyframes fx-arrow-bounce-left{0%,100%{transform:translateX(0)}50%{transform:translateX(-8px)}}@keyframes fx-arrow-bounce-right{0%,100%{transform:translateX(0)}50%{transform:translateX(8px)}}`;
  await injectStyles(page, 'fx-arrow-styles', css);
  await page.evaluate(({ x, y, dir, hex, br, bg, bb }) => {
    document.getElementById('fx-demo-arrow')?.remove();
    const glyphs={down:'↓',up:'↑',left:'←',right:'→'};
    const anims={down:'fx-arrow-bounce-down',up:'fx-arrow-bounce-up',left:'fx-arrow-bounce-left',right:'fx-arrow-bounce-right'};
    const el=document.createElement('div'); el.id='fx-demo-arrow'; el.textContent=glyphs[dir]||'↓';
    el.style.cssText=`position:fixed;left:${x}px;top:${dir==='down'?y-40:y+10}px;font-size:28px;color:${hex};pointer-events:none;z-index:999999;text-shadow:0 0 10px rgba(${br},${bg},${bb},.8);animation:${anims[dir]||'fx-arrow-bounce-down'} .6s ease-in-out infinite;line-height:1`;
    document.body.appendChild(el);
  }, { x: targetX, y: targetY, dir: direction, hex: BRAND_HEX, br: BR, bg: BG, bb: BB });
}
async function hideArrow(page) { await page.evaluate(() => document.getElementById('fx-demo-arrow')?.remove()); }

async function zoomLens(page, regionX, regionY, scale = 2.5) {
  await page.evaluate(({ x, y, s, hex, br, bg, bb }) => {
    document.getElementById('fx-zoom-lens')?.remove();
    const lens=document.createElement('div'); lens.id='fx-zoom-lens';
    lens.style.cssText=`position:fixed;left:${x+20}px;top:${Math.max(10,y-120)}px;width:200px;height:150px;border-radius:12px;overflow:hidden;border:2px solid ${hex};z-index:999999;pointer-events:none;box-shadow:0 8px 40px rgba(0,0,0,.6),0 0 0 1px rgba(${br},${bg},${bb},.3)`;
    const inner=document.createElement('div'); inner.style.cssText=`width:${200/s}px;height:${150/s}px;transform:scale(${s});transform-origin:0 0;overflow:hidden`;
    try { const f=document.getElementById('app'); if(f&&f.contentDocument&&f.contentDocument.body){const clone=f.contentDocument.body.cloneNode(true);clone.style.cssText=`margin:0;padding:0;transform:translate(-${x}px,-${y}px);transform-origin:0 0;width:${f.contentDocument.body.scrollWidth}px`;inner.appendChild(clone);} }
    catch(e) { inner.textContent=`[zoom@${x},${y}]`; inner.style.color=hex; inner.style.fontSize='11px'; }
    lens.appendChild(inner); document.body.appendChild(lens);
  }, { x: regionX, y: regionY, s: scale, hex: BRAND_HEX, br: BR, bg: BG, bb: BB });
}
async function hideZoomLens(page) { await page.evaluate(() => document.getElementById('fx-zoom-lens')?.remove()); }

async function scrollHint(page, on = true) {
  if (!on) { await page.evaluate(() => document.getElementById('fx-scroll-hint')?.remove()); return; }
  const css = `@keyframes fx-scroll-bounce{0%,100%{transform:translateX(-50%) translateY(0);opacity:1}50%{transform:translateX(-50%) translateY(8px);opacity:.6}}#fx-scroll-hint{position:fixed;bottom:30px;left:50%;transform:translateX(-50%);color:rgba(255,255,255,.5);font-size:12px;letter-spacing:2px;text-transform:uppercase;pointer-events:none;z-index:999998;font-family:system-ui,sans-serif;animation:fx-scroll-bounce 1.2s ease-in-out infinite}`;
  await injectStyles(page, 'fx-scroll-hint-styles', css);
  await page.evaluate(() => { if(document.getElementById('fx-scroll-hint')) return; const el=document.createElement('div');el.id='fx-scroll-hint';el.textContent='↓  scroll';document.body.appendChild(el); });
}

// NEW — Annotation Label with SVG connector
async function annotate(page, x, y, text, dir = 'right') {
  await page.evaluate(({ x, y, text, dir, hex, r, g, b }) => {
    document.getElementById('fx-annotate')?.remove();
    const lx = dir==='right' ? x+32 : x-32;
    const wrap = document.createElement('div'); wrap.id = 'fx-annotate';
    wrap.style.cssText = 'position:fixed;top:0;left:0;pointer-events:none;z-index:999992';
    wrap.innerHTML = `
      <svg style="position:fixed;left:0;top:0;width:1280px;height:720px;pointer-events:none;overflow:visible">
        <circle cx="${x}" cy="${y}" r="5" fill="${hex}" opacity=".9"/>
        <circle cx="${x}" cy="${y}" r="10" fill="none" stroke="${hex}" stroke-width="1.5" opacity=".5">
          <animate attributeName="r" from="5" to="22" dur="1.2s" repeatCount="indefinite"/>
          <animate attributeName="opacity" from=".5" to="0" dur="1.2s" repeatCount="indefinite"/>
        </circle>
        <line x1="${x}" y1="${y}" x2="${dir==='right'?lx:lx-80}" y2="${y}" stroke="${hex}" stroke-width="1.5" stroke-dasharray="4 3" opacity=".7"/>
      </svg>
      <div style="position:fixed;left:${dir==='right'?lx:lx-90}px;top:${y-14}px;background:rgba(${r},${g},${b},.15);border:1px solid rgba(${r},${g},${b},.5);color:white;font-family:'Helvetica Neue',sans-serif;font-size:11px;font-weight:600;letter-spacing:.5px;padding:5px 10px;border-radius:6px;backdrop-filter:blur(8px);white-space:nowrap;animation:fx-ann-in .3s ease forwards">${text}</div>`;
    if (!document.getElementById('fx-ann-style')) {
      const s=document.createElement('style');s.id='fx-ann-style';s.textContent='@keyframes fx-ann-in{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}';document.head.appendChild(s);
    }
    document.body.appendChild(wrap);
  }, { x, y, text, dir, hex: BRAND_HEX, r: BR, g: BG, b: BB });
}
async function hideAnnotate(page) { await page.evaluate(() => document.getElementById('fx-annotate')?.remove()); }

// NEW — Region Focus (vignette everything except a rectangle)
async function regionFocus(page, x, y, w, h, ms = 3000) {
  await page.evaluate(({ x, y, w, h, ms }) => {
    document.getElementById('fx-region-focus')?.remove();
    const svg = document.createElementNS('http://www.w3.org/2000/svg','svg'); svg.id='fx-region-focus';
    svg.style.cssText='position:fixed;inset:0;width:1280px;height:720px;pointer-events:none;z-index:999990';
    svg.innerHTML=`<defs><mask id="rfm"><rect width="1280" height="720" fill="white"/><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="black"/></mask></defs><rect width="1280" height="720" fill="rgba(0,0,0,.65)" mask="url(#rfm)"/><rect x="${x-2}" y="${y-2}" width="${w+4}" height="${h+4}" rx="7" fill="none" stroke="rgba(255,255,255,.28)" stroke-width="1.5"/>`;
    document.body.appendChild(svg);
    if (ms > 0) setTimeout(() => svg.remove(), ms);
  }, { x, y, w, h, ms });
}

// ---------------------------------------------------------------------------
// CATEGORY 6 — KINETIC TYPOGRAPHY (12 effects; +6 new vs v5)
// ---------------------------------------------------------------------------

async function scramble(page, elementId, finalText, durationMs = 800) {
  await page.evaluate(({ id, text, dur }) => {
    const el=document.getElementById(id); if(!el) return;
    const chars='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    const steps=Math.ceil(dur/50); let step=0;
    const iv=setInterval(()=>{
      const progress=step/steps, revealed=Math.floor(progress*text.length);
      el.textContent=text.split('').map((ch,i)=>{ if(ch===' ') return ' '; if(i<revealed) return ch; return chars[Math.floor(Math.random()*chars.length)]; }).join('');
      if(++step>steps){el.textContent=text;clearInterval(iv);}
    },50);
  }, { id: elementId, text: finalText, dur: durationMs });
}

async function glitchText(page, elementId) {
  const css = `@keyframes fx-glitch-text{0%,100%{transform:translateX(0);clip-path:none}15%{transform:translateX(-4px);clip-path:inset(10% 0 85% 0)}30%{transform:translateX(4px);clip-path:inset(40% 0 40% 0)}45%{transform:translateX(-2px);clip-path:inset(75% 0 10% 0)}60%{transform:translateX(2px);clip-path:none}75%,90%{transform:translateX(0);clip-path:none}}.fx-glitch-text{animation:fx-glitch-text .6s ease forwards}`;
  await injectStyles(page, 'fx-glitch-text-styles', css);
  await page.evaluate(id => { const el=document.getElementById(id); if(!el) return; el.classList.remove('fx-glitch-text'); void el.offsetHeight; el.classList.add('fx-glitch-text'); setTimeout(()=>el.classList.remove('fx-glitch-text'),700); }, elementId);
}

async function waveCounterRow(page, containerId) {
  const css = `@keyframes fx-wave-in{from{transform:translateY(20px) scale(.9);opacity:0}to{transform:translateY(0) scale(1);opacity:1}}.fx-wave-row .fx-stat{opacity:0;animation:fx-wave-in .5s ease both}.fx-wave-row .fx-stat:nth-child(1){animation-delay:.80s}.fx-wave-row .fx-stat:nth-child(2){animation-delay:.95s}.fx-wave-row .fx-stat:nth-child(3){animation-delay:1.10s}.fx-wave-row .fx-stat:nth-child(4){animation-delay:1.25s}`;
  await injectStyles(page, 'fx-wave-styles', css);
  await page.evaluate(cid => {
    const c=document.getElementById(cid); if(!c) return; c.classList.add('fx-wave-row');
    c.querySelectorAll('.fx-stat').forEach(s=>{s.style.animation='none';void s.offsetHeight;s.style.animation='';});
  }, containerId);
}

async function tilt3d(page, elementId, on = true) {
  const css = `@keyframes fx-tilt-3d{0%,100%{transform:perspective(800px) rotateX(2deg) rotateY(-2deg)}25%{transform:perspective(800px) rotateX(-1deg) rotateY(2deg)}50%{transform:perspective(800px) rotateX(2deg) rotateY(2deg)}75%{transform:perspective(800px) rotateX(-2deg) rotateY(-1deg)}}.fx-tilt-3d{animation:fx-tilt-3d 8s ease-in-out infinite;transform-style:preserve-3d}`;
  await injectStyles(page, 'fx-tilt-styles', css);
  await page.evaluate(({ id, enable }) => { const el=document.getElementById(id); if(!el) return; if(enable) el.classList.add('fx-tilt-3d'); else el.classList.remove('fx-tilt-3d'); }, { id: elementId, enable: on });
}

async function drawLogo(page, svgId, durationMs = 1500) {
  const css = `@keyframes fx-draw-logo{to{stroke-dashoffset:0}}.fx-logo-path{stroke-dasharray:1000;stroke-dashoffset:1000;animation:fx-draw-logo ${durationMs}ms ease forwards;fill:none;stroke:${BRAND_HEX};stroke-width:2}`;
  await injectStyles(page, 'fx-logo-styles', css);
  await page.evaluate(id => { const svg=document.getElementById(id); if(!svg) return; svg.querySelectorAll('.fx-logo-path').forEach(p=>{const c=p.cloneNode(true);p.parentNode.replaceChild(c,p);}); }, svgId);
}

async function letterbox(page, on = true) {
  if (!on) { await page.evaluate(() => ['fx-letterbox-top','fx-letterbox-bottom'].forEach(id=>document.getElementById(id)?.remove())); return; }
  const css = `@keyframes fx-letterbox-in{from{opacity:0}to{opacity:1}}#fx-letterbox-top,#fx-letterbox-bottom{position:fixed;left:0;right:0;height:78px;background:#000;z-index:999997;pointer-events:none}#fx-letterbox-top{top:0;animation:fx-letterbox-in .4s ease forwards}#fx-letterbox-bottom{bottom:0;animation:fx-letterbox-in .4s ease forwards}`;
  await injectStyles(page, 'fx-letterbox-styles', css);
  await page.evaluate(() => { ['fx-letterbox-top','fx-letterbox-bottom'].forEach(id=>{if(document.getElementById(id)) return; const el=document.createElement('div');el.id=id;document.body.appendChild(el);}); });
}

// NEW — Word-by-word reveal (mask lift)
async function wordReveal(page, elementId, text, totalMs = 800) {
  const css = `@keyframes fx-word-up{from{transform:translateY(120%);opacity:0}to{transform:translateY(0);opacity:1}}.fx-word-wrap{overflow:hidden;display:inline-block;vertical-align:bottom}.fx-word{display:inline-block;animation:fx-word-up .5s cubic-bezier(.16,1,.3,1) both;will-change:transform}`;
  await injectStyles(page, 'fx-word-reveal-styles', css);
  await page.evaluate(({ id, text, ms }) => {
    const el=document.getElementById(id); if(!el) return;
    const words=text.split(' '), delay=ms/words.length;
    el.innerHTML = words.map((w,i)=>`<span class="fx-word-wrap"><span class="fx-word" style="animation-delay:${i*delay}ms">${w}</span></span>`).join(' ');
  }, { id: elementId, text, ms: totalMs });
  await page.waitForTimeout(totalMs+600);
}

// NEW — Blur-in text reveal
async function blurIn(page, elementId, ms = 600) {
  const css = `@keyframes fx-blur-in-text{from{filter:blur(12px);opacity:0;transform:scale(1.05)}to{filter:blur(0);opacity:1;transform:scale(1)}}.fx-blur-in{animation:fx-blur-in-text ${ms}ms cubic-bezier(.16,1,.3,1) forwards}`;
  await injectStyles(page, 'fx-blur-in-styles', css);
  await page.evaluate(({ id, ms }) => { const el=document.getElementById(id); if(!el) return; el.classList.remove('fx-blur-in'); void el.offsetHeight; el.classList.add('fx-blur-in'); setTimeout(()=>el.classList.remove('fx-blur-in'),ms+100); }, { id: elementId, ms });
  await page.waitForTimeout(ms+120);
}

// NEW — Split letter stagger (per-character fan-in)
async function splitStagger(page, elementId, text, totalMs = 700) {
  const css = `@keyframes fx-letter-in{from{transform:translateY(20px) rotateX(-90deg);opacity:0}to{transform:translateY(0) rotateX(0deg);opacity:1}}.fx-letter{display:inline-block;animation:fx-letter-in .4s ease both;will-change:transform;perspective:600px}`;
  await injectStyles(page, 'fx-split-stagger-styles', css);
  await page.evaluate(({ id, text, ms }) => {
    const el=document.getElementById(id); if(!el) return;
    const chars=[...text], delay=ms/chars.length;
    el.innerHTML=chars.map((ch,i)=>ch===' '?'<span style="display:inline-block;width:.25em">&nbsp;</span>':`<span class="fx-letter" style="animation-delay:${i*delay}ms">${ch}</span>`).join('');
  }, { id: elementId, text, ms: totalMs });
  await page.waitForTimeout(totalMs+500);
}

// NEW — Highlight a single word in an element
async function highlightWord(page, elementId, word, color = null) {
  await page.evaluate(({ id, word, color, hex }) => {
    const el=document.getElementById(id); if(!el) return;
    const c=color||hex;
    el.innerHTML=el.textContent.replace(new RegExp(`(${word})`,'gi'),`<span style="color:${c};font-weight:800">${'$1'}</span>`);
  }, { id: elementId, word, color, hex: BRAND_HEX });
}

// NEW — Decimal counter (high-precision: $2.4M, 98.7%)
async function decimalCounter(page, elementId, from, to, decimals = 1, suffix = '', durationMs = 1500) {
  await page.evaluate(({ id, from, to, dec, sfx, dur }) => {
    const el=document.getElementById(id); if(!el) return;
    const start=performance.now();
    const tick=now=>{
      const t=Math.min(1,(now-start)/dur);
      const eased=t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
      el.textContent=(from+(to-from)*eased).toFixed(dec)+sfx;
      if(t<1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, { id: elementId, from, to, dec: decimals, sfx: suffix, dur: durationMs });
}

// ---------------------------------------------------------------------------
// CATEGORY 8 — MOTION GRAPHIC INTERLUDES (8 effects — all new in v6)
// ---------------------------------------------------------------------------

// Before/After split screen
async function mgBeforeAfter(page, beforeText, afterText, metric) {
  await page.evaluate(({ bt, at, m, hex, r, g, b }) => {
    document.getElementById('fx-ba-split')?.remove();
    const wrap=document.createElement('div'); wrap.id='fx-ba-split';
    wrap.style.cssText='position:fixed;inset:0;display:flex;pointer-events:none;z-index:9999980;font-family:"Helvetica Neue",Arial,sans-serif';
    wrap.innerHTML=`
      <div style="flex:1;background:rgba(220,50,50,.08);border-right:1px solid rgba(220,50,50,.3);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;animation:fx-baLeft .6s ease both">
        <div style="font-size:10px;font-weight:700;letter-spacing:3px;color:rgba(220,70,70,.8)">BEFORE</div>
        <div style="font-size:22px;font-weight:700;color:white;text-align:center;max-width:400px;line-height:1.3;padding:0 24px">${bt}</div>
        <div style="font-size:16px;color:rgba(255,255,255,.45);text-align:center;padding:0 24px">${m.before}</div>
      </div>
      <div style="flex:1;background:rgba(20,190,110,.08);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;animation:fx-baRight .6s .3s ease both">
        <div style="font-size:10px;font-weight:700;letter-spacing:3px;color:rgba(20,190,110,.8)">AFTER</div>
        <div style="font-size:22px;font-weight:700;color:white;text-align:center;max-width:400px;line-height:1.3;padding:0 24px">${at}</div>
        <div style="font-size:36px;font-weight:900;color:#50e09a;text-align:center">${m.after}</div>
        <div style="font-size:11px;color:rgba(255,255,255,.4)">${m.unit||''}</div>
      </div>`;
    if (!document.getElementById('fx-ba-style')) {
      const s=document.createElement('style');s.id='fx-ba-style';s.textContent='@keyframes fx-baLeft{from{transform:translateX(-30px);opacity:0}to{transform:translateX(0);opacity:1}}@keyframes fx-baRight{from{transform:translateX(30px);opacity:0}to{transform:translateX(0);opacity:1}}';document.head.appendChild(s);
    }
    document.body.appendChild(wrap);
  }, { bt: beforeText, at: afterText, m: metric, hex: BRAND_HEX, r: BR, g: BG, b: BB });
}
async function hideMgBeforeAfter(page) { await page.evaluate(() => document.getElementById('fx-ba-split')?.remove()); }

// Process flow diagram
async function mgProcess(page, steps) {
  await page.evaluate(({ steps, hex, r, g, b }) => {
    document.getElementById('fx-mg-process')?.remove();
    if (!document.getElementById('fx-proc-style')) {
      const s=document.createElement('style');s.id='fx-proc-style';s.textContent='@keyframes fx-proc-in{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}';document.head.appendChild(s);
    }
    const wrap=document.createElement('div'); wrap.id='fx-mg-process';
    wrap.style.cssText='position:fixed;inset:0;background:rgba(6,13,20,.92);display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:9999980;font-family:"Helvetica Neue",Arial,sans-serif';
    wrap.innerHTML=`<div style="display:flex;align-items:center;gap:0">
      ${steps.map((s,i)=>`
        <div style="display:flex;flex-direction:column;align-items:center;gap:10px;animation:fx-proc-in .5s ${i*.12}s ease both;opacity:0">
          <div style="width:52px;height:52px;border-radius:14px;background:rgba(${r},${g},${b},.12);border:1px solid rgba(${r},${g},${b},.35);display:flex;align-items:center;justify-content:center;font-size:22px">${s.icon}</div>
          <div style="font-size:11px;font-weight:700;color:white;letter-spacing:.5px;text-align:center;max-width:90px">${s.label}</div>
          ${s.detail?`<div style="font-size:10px;color:rgba(255,255,255,.35);text-align:center;max-width:90px;line-height:1.4">${s.detail}</div>`:''}
        </div>
        ${i<steps.length-1?`<div style="width:40px;height:1px;background:rgba(${r},${g},${b},.3);flex-shrink:0;margin:0 4px;margin-bottom:28px"></div>`:''}
      `).join('')}
    </div>`;
    document.body.appendChild(wrap);
  }, { steps, hex: BRAND_HEX, r: BR, g: BG, b: BB });
}
async function hideMgProcess(page) { await page.evaluate(() => document.getElementById('fx-mg-process')?.remove()); }

// Problem statement card
async function mgProblem(page, headline, body, stat) {
  await page.evaluate(({ hl, body, stat, hex, r, g, b }) => {
    document.getElementById('fx-mg-problem')?.remove();
    const wrap=document.createElement('div'); wrap.id='fx-mg-problem';
    wrap.style.cssText='position:fixed;inset:0;background:#060d14;display:flex;flex-direction:column;align-items:center;justify-content:center;pointer-events:none;z-index:9999980;font-family:"Helvetica Neue",Arial,sans-serif';
    wrap.innerHTML=`
      <div style="position:absolute;inset:0;background-image:linear-gradient(rgba(220,50,50,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(220,50,50,.05) 1px,transparent 1px);background-size:60px 60px"></div>
      <div style="position:relative;text-align:center;max-width:700px;padding:0 48px">
        <div style="font-size:10px;font-weight:700;letter-spacing:4px;color:rgba(220,70,70,.8);margin-bottom:24px;animation:fx-prob-in .5s ease both">THE PROBLEM</div>
        <div style="font-size:46px;font-weight:800;color:white;line-height:1.1;letter-spacing:-1px;margin-bottom:20px;animation:fx-prob-in .5s .1s ease both">${hl}</div>
        ${body?`<div style="font-size:16px;color:rgba(255,255,255,.5);line-height:1.6;margin-bottom:28px;animation:fx-prob-in .5s .2s ease both">${body}</div>`:''}
        ${stat?`<div style="font-size:52px;font-weight:900;color:rgba(220,70,70,.9);animation:fx-prob-in .5s .3s ease both">${stat}</div>`:''}
      </div>`;
    if (!document.getElementById('fx-prob-style')) {
      const s=document.createElement('style');s.id='fx-prob-style';s.textContent='@keyframes fx-prob-in{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}';document.head.appendChild(s);
    }
    document.body.appendChild(wrap);
  }, { hl: headline, body, stat, hex: BRAND_HEX, r: BR, g: BG, b: BB });
}
async function hideMgProblem(page) { await page.evaluate(() => document.getElementById('fx-mg-problem')?.remove()); }

// Data visualization card (single dramatic metric)
async function mgDataViz(page, label, value, unit, subtext) {
  await page.evaluate(({ label, value, unit, subtext, hex, r, g, b }) => {
    document.getElementById('fx-mg-dataviz')?.remove();
    const wrap=document.createElement('div'); wrap.id='fx-mg-dataviz';
    wrap.style.cssText='position:fixed;inset:0;background:rgba(6,13,20,.94);display:flex;flex-direction:column;align-items:center;justify-content:center;pointer-events:none;z-index:9999980;font-family:"Helvetica Neue",Arial,sans-serif';
    wrap.innerHTML=`<div style="text-align:center;animation:fx-prob-in .5s ease both">
      <div style="font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:rgba(${r},${g},${b},.7);margin-bottom:16px">${label}</div>
      <div style="font-size:96px;font-weight:900;color:${hex};line-height:1;letter-spacing:-3px">${value}</div>
      ${unit?`<div style="font-size:22px;color:rgba(255,255,255,.5);margin-top:8px">${unit}</div>`:''}
      ${subtext?`<div style="font-size:14px;color:rgba(255,255,255,.35);margin-top:16px;max-width:480px">${subtext}</div>`:''}
    </div>`;
    document.body.appendChild(wrap);
  }, { label, value, unit, subtext, hex: BRAND_HEX, r: BR, g: BG, b: BB });
}
async function hideMgDataViz(page) { await page.evaluate(() => document.getElementById('fx-mg-dataviz')?.remove()); }

// ---------------------------------------------------------------------------
// CATEGORY 9 — SUBTITLE / CAPTION SYSTEM (4 effects — all new in v6)
// ---------------------------------------------------------------------------

async function subtitle(page, text, durationMs = 3000) {
  await page.evaluate(({ text, dur }) => {
    document.getElementById('fx-subtitle')?.remove();
    if (!document.getElementById('fx-sub-style')) {
      const s=document.createElement('style');s.id='fx-sub-style';s.textContent='@keyframes fx-sub-in{from{opacity:0;transform:translateX(-50%) translateY(8px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}@keyframes fx-sub-out{to{opacity:0;transform:translateX(-50%) translateY(8px)}}';document.head.appendChild(s);
    }
    const el=document.createElement('div'); el.id='fx-subtitle';
    el.style.cssText='position:fixed;bottom:32px;left:50%;transform:translateX(-50%);background:rgba(4,14,28,.88);border:1px solid rgba(255,255,255,.12);backdrop-filter:blur(12px);border-radius:8px;padding:10px 22px;max-width:860px;font-family:"Helvetica Neue",sans-serif;font-size:14px;color:rgba(255,255,255,.88);line-height:1.5;text-align:center;letter-spacing:.2px;pointer-events:none;z-index:9999995;animation:fx-sub-in .25s ease both';
    el.textContent=text; document.body.appendChild(el);
    setTimeout(()=>{el.style.animation='fx-sub-out .25s ease forwards';setTimeout(()=>el.remove(),300);}, dur-300);
  }, { text, dur: durationMs });
}

async function sceneLabel(page, text, subtext = '') {
  await page.evaluate(({ text, sub, hex, r, g, b }) => {
    document.getElementById('fx-scene-label')?.remove();
    if (!document.getElementById('fx-sl-style')) {
      const s=document.createElement('style');s.id='fx-sl-style';s.textContent='@keyframes fx-sl-in{from{opacity:0;transform:translateX(-8px)}to{opacity:1;transform:translateX(0)}}';document.head.appendChild(s);
    }
    const el=document.createElement('div'); el.id='fx-scene-label';
    el.style.cssText='position:fixed;top:22px;left:22px;background:rgba(4,14,28,.88);border:1px solid rgba('+r+','+g+','+b+',.35);backdrop-filter:blur(12px);border-radius:8px;padding:8px 14px;pointer-events:none;z-index:9999995;font-family:"Helvetica Neue",sans-serif;animation:fx-sl-in .3s ease both';
    el.innerHTML=`<div style="font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${hex}">${text}</div>${sub?`<div style="font-size:11px;color:rgba(255,255,255,.45);margin-top:2px">${sub}</div>`:''}`;
    document.body.appendChild(el);
  }, { text, sub: subtext, hex: BRAND_HEX, r: BR, g: BG, b: BB });
}
async function hideSceneLabel(page) { await page.evaluate(() => document.getElementById('fx-scene-label')?.remove()); }

async function timelineBar(page, pct, on = true) {
  await page.evaluate(({ pct, on, hex }) => {
    if (!on) { document.getElementById('fx-timeline')?.remove(); return; }
    let bar=document.getElementById('fx-timeline');
    if (!bar) {
      bar=document.createElement('div'); bar.id='fx-timeline';
      bar.style.cssText='position:fixed;bottom:0;left:0;right:0;height:2px;background:rgba(255,255,255,.08);pointer-events:none;z-index:9999999';
      const fill=document.createElement('div'); fill.id='fx-timeline-fill';
      fill.style.cssText=`height:100%;background:${hex};transition:width .8s linear;width:0%`;
      bar.appendChild(fill); document.body.appendChild(bar);
    }
    const fill=document.getElementById('fx-timeline-fill'); if(fill) fill.style.width=pct+'%';
  }, { pct, on, hex: BRAND_HEX });
}

async function recIndicator(page, on = true) {
  await page.evaluate(on => {
    document.getElementById('fx-rec')?.remove(); if (!on) return;
    if (!document.getElementById('fx-rec-style')) {
      const s=document.createElement('style');s.id='fx-rec-style';s.textContent='@keyframes fx-rec-blink{0%,100%{opacity:1}50%{opacity:.2}}';document.head.appendChild(s);
    }
    const el=document.createElement('div'); el.id='fx-rec';
    el.style.cssText='position:fixed;top:22px;right:22px;display:flex;align-items:center;gap:6px;pointer-events:none;z-index:9999996;font-family:"Helvetica Neue",sans-serif';
    el.innerHTML=`<div style="width:8px;height:8px;border-radius:50%;background:#ef4444;animation:fx-rec-blink .8s ease-in-out infinite"></div><span style="font-size:11px;font-weight:700;letter-spacing:2px;color:rgba(255,255,255,.6)">REC</span>`;
    document.body.appendChild(el);
  }, on);
}

// ---------------------------------------------------------------------------
// CATEGORY 10 — FFMPEG COLOR GRADES (5 looks)
// ---------------------------------------------------------------------------
const grades = {
  // Essential/Full: sharpen only
  none: 'unsharp=5:5:0.8:3:3:0.4',

  // Vibrance (Full level default)
  vibrance: 'eq=saturation=1.15:contrast=1.05:gamma=0.96,unsharp=5:5:0.6:3:3:0.3',

  // Warm Hollywood — Netflix/Apple product video (Cinematic default)
  warmHollywood: [
    'colorchannelmixer=.90:.10:0:0:.10:.85:.10:0:0:.10:.80:0',
    'eq=contrast=1.05:saturation=1.10',
    'unsharp=5:5:0.8:3:3:0.4',
    'vignette=PI/4',
    'noise=c0s=6:allf=t+u',
  ].join(','),

  // Cool Tech — Stripe/Linear/Vercel aesthetic
  coolTech: [
    'colorchannelmixer=.85:.05:.10:0:.05:.90:.05:0:.05:.10:.95:0',
    'eq=contrast=1.06:brightness=-0.02:saturation=1.05',
    'unsharp=5:5:0.6:3:3:0.3',
    'vignette=PI/4.5',
    'noise=c0s=5:allf=t+u',
  ].join(','),

  // Dark Premium — Arc/Raycast/deep-blacks aesthetic
  darkPremium: [
    'colorchannelmixer=.88:.02:.10:0:.02:.88:.10:0:.02:.08:.90:0',
    'eq=contrast=1.08:brightness=-0.04:saturation=0.95:gamma=0.92',
    'unsharp=5:5:0.7:3:3:0.3',
    'vignette=PI/3.5',
    'noise=c0s=4:allf=t+u',
  ].join(','),

  // Full cinematic stack (combined recommended preset)
  fullCinematic: [
    'colorchannelmixer=.88:.08:.04:0:.04:.87:.09:0:.02:.08:.90:0',
    'eq=contrast=1.05:saturation=1.12:brightness=-0.01',
    'vignette=PI/4.5',
    'noise=c0s=6:allf=t+u',
    'unsharp=5:5:0.6:3:3:0.3',
  ].join(','),
};

// ---------------------------------------------------------------------------
// FX EXPORT OBJECT
// ---------------------------------------------------------------------------
const FX = {
  setBrand,

  // Cat 1 — Cursor
  initCursor:          (page)            => initCursor(page),
  clickRipple:         (page,x,y)        => clickRipple(page,x,y),
  spotlight:           (page,on=true)    => spotlight(page,on),
  cursorTrail:         (page,on=true)    => cursorTrail(page,on),
  clickTargetRings:    (page,x,y)        => clickTargetRings(page,x,y),

  // Cat 2 — Transitions
  fadeToBlack:         (page,ms=400)     => fadeToBlack(page,ms),
  fadeFromBlack:       (page,ms=400)     => fadeFromBlack(page,ms),
  zoomOut:             (page,ms=500)     => zoomOut(page,ms),
  glitchFlash:         (page)            => glitchFlash(page),
  blurTransition:      (page,ms=400)     => blurTransition(page,ms),
  whiteFlash:          (page,ms=200)     => whiteFlash(page,ms),
  irisIn:              (page,ms=500)     => irisIn(page,ms),
  irisOut:             (page,ms=500)     => irisOut(page,ms),
  chromaticAberration: (page,ms=300)     => chromaticAberration(page,ms),    // NEW v6
  swipePush:           (page,dir,ms)     => swipePush(page,dir,ms),           // NEW v6
  particleExplode:     (page,x,y,n)     => particleExplode(page,x,y,n),      // NEW v6

  // Cat 3 — Ambient
  particles:           (page,on=true)    => particles(page,on),
  aurora:              (page,on=true)    => aurora(page,on),
  grid:                (page,on=true)    => grid(page,on),
  grain:               (page,on=true)    => grain(page,on),
  scanlines:           (page,on=true)    => scanlines(page,on),
  radialBurst:         (page,on=true)    => radialBurst(page,on),             // NEW v6
  dataStream:          (page,on=true)    => dataStream(page,on),              // NEW v6

  // Cat 4 — Callouts
  confetti:            (page)            => confetti(page),
  animateCounter:      (page,id,t,s,ms) => animateCounter(page,id,t,s,ms),
  checkmark:           (page,id)        => checkmark(page,id),
  addShimmer:          (page,id)        => addShimmer(page,id),
  rotatingBorder:      (page,id,on)     => rotatingBorder(page,id,on),
  bounceIn:            (page,id)        => bounceIn(page,id),
  neonStat:            (page,id,on)     => neonStat(page,id,on),
  injectProgressRing:  (page,cid,sid)   => injectProgressRing(page,cid,sid),
  progressRing:        (page,sid,pct)   => progressRing(page,sid,pct),
  successPulse:        (page,x,y)       => successPulse(page,x,y),
  statFlip:            (page,id,f,t,ms) => statFlip(page,id,f,t,ms),         // NEW v6
  emojiBurst:          (page,x,y,e,n)   => emojiBurst(page,x,y,e,n),         // NEW v6

  // Cat 5 — UI Highlight
  highlight:           (page,sel,ms,i)  => highlight(page,sel,ms,i),
  arrow:               (page,x,y,dir)   => arrow(page,x,y,dir),
  hideArrow:           (page)           => hideArrow(page),
  zoomLens:            (page,x,y,s)     => zoomLens(page,x,y,s),
  hideZoomLens:        (page)           => hideZoomLens(page),
  scrollHint:          (page,on)        => scrollHint(page,on),
  annotate:            (page,x,y,t,d)   => annotate(page,x,y,t,d),           // NEW v6
  hideAnnotate:        (page)           => hideAnnotate(page),                // NEW v6
  regionFocus:         (page,x,y,w,h,ms)=> regionFocus(page,x,y,w,h,ms),    // NEW v6

  // Cat 6 — Kinetic Typography
  scramble:            (page,id,t,ms)   => scramble(page,id,t,ms),
  glitchText:          (page,id)        => glitchText(page,id),
  waveCounterRow:      (page,id)        => waveCounterRow(page,id),
  tilt3d:              (page,id,on)     => tilt3d(page,id,on),
  drawLogo:            (page,id,ms)     => drawLogo(page,id,ms),
  letterbox:           (page,on)        => letterbox(page,on),
  wordReveal:          (page,id,t,ms)   => wordReveal(page,id,t,ms),          // NEW v6
  blurIn:              (page,id,ms)     => blurIn(page,id,ms),                // NEW v6
  splitStagger:        (page,id,t,ms)   => splitStagger(page,id,t,ms),        // NEW v6
  highlightWord:       (page,id,w,c)    => highlightWord(page,id,w,c),        // NEW v6
  decimalCounter:      (page,id,f,t,d,s,ms)=>decimalCounter(page,id,f,t,d,s,ms), // NEW v6

  // Cat 8 — Motion Graphic Interludes (all NEW v6)
  mgBeforeAfter:       (page,bt,at,m)   => mgBeforeAfter(page,bt,at,m),
  hideMgBeforeAfter:   (page)           => hideMgBeforeAfter(page),
  mgProcess:           (page,steps)     => mgProcess(page,steps),
  hideMgProcess:       (page)           => hideMgProcess(page),
  mgProblem:           (page,hl,b,s)    => mgProblem(page,hl,b,s),
  hideMgProblem:       (page)           => hideMgProblem(page),
  mgDataViz:           (page,l,v,u,s)   => mgDataViz(page,l,v,u,s),
  hideMgDataViz:       (page)           => hideMgDataViz(page),

  // Cat 9 — Subtitle / Caption (all NEW v6)
  subtitle:            (page,t,ms)      => subtitle(page,t,ms),
  sceneLabel:          (page,t,sub)     => sceneLabel(page,t,sub),
  hideSceneLabel:      (page)           => hideSceneLabel(page),
  timelineBar:         (page,pct,on)    => timelineBar(page,pct,on),
  recIndicator:        (page,on)        => recIndicator(page,on),

  // Cat 10 — ffmpeg grades
  grades,
};

module.exports = FX;
