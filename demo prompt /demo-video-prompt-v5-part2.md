━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## EFFECTS ARSENAL — 42 effects across 7 categories
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

All effects live in `public/fx.js` as the `FX` object. Call `FX.setBrand(hex,r,g,b)` once
at startup. Every method is async and safe to await or fire-and-forget.

### CATEGORY 1 — CURSOR EFFECTS

| # | Effect | API | When to use |
|---|--------|-----|-------------|
| 1 | Animated cursor dot | `FX.initCursor(page)` | Always — call once after every page.goto() |
| 2 | Click ripple | `FX.clickRipple(page, x, y)` | Wrap every iframeClick() call |
| 3 | Cursor spotlight | `FX.spotlight(page, on)` | Focus on a specific UI area (before pain scene) |
| 4 | Cursor trail | `FX.cursorTrail(page, on)` | Full/Cinematic effects levels only |
| 5 | Click target rings | `FX.clickTargetRings(page, x, y)` | Button clicks that advance wizard steps |

**initCursor implementation:**
```js
// Inject once after every goto() — registers a single mousemove listener
// that drives cursor dot, trail, and spotlight simultaneously.
async function initCursor(page) {
  await page.evaluate(({ hex, r, g, b }) => {
    if (document.getElementById('fx-cursor-style')) return; // dedupe
    const style = document.createElement('style');
    style.id = 'fx-cursor-style';
    style.textContent = `
      * { cursor: none !important; }
      #fx-cursor { position:fixed; width:12px; height:12px; border-radius:50%;
        background:${hex}; pointer-events:none; z-index:999999;
        box-shadow:0 0 8px 2px rgba(${r},${g},${b},.6);
        transform:translate(-50%,-50%); transition:transform .08s ease; }
      .fx-ghost { position:fixed; width:8px; height:8px; border-radius:50%;
        background:${hex}; pointer-events:none; z-index:999998;
        transform:translate(-50%,-50%); transition:left .06s ease,top .06s ease; }
      #fx-spotlight { position:fixed; inset:0; pointer-events:none; z-index:999997;
        background:radial-gradient(circle 180px at var(--sx,50%) var(--sy,50%),
          transparent 0%, rgba(0,0,0,.55) 100%); opacity:0; transition:opacity .3s; }
    `;
    document.head.appendChild(style);
    const dot = document.createElement('div'); dot.id = 'fx-cursor';
    const g1 = document.createElement('div'); g1.className = 'fx-ghost'; g1.style.transitionDelay = '.06s'; g1.style.opacity = '.35';
    const g2 = document.createElement('div'); g2.className = 'fx-ghost'; g2.style.transitionDelay = '.12s'; g2.style.opacity = '.18';
    const sp = document.createElement('div'); sp.id = 'fx-spotlight';
    document.body.append(dot, g1, g2, sp);
    document.addEventListener('mousemove', e => {
      const x = e.clientX, y = e.clientY;
      dot.style.left = x + 'px'; dot.style.top = y + 'px';
      [g1, g2].forEach(g => { g.style.left = x + 'px'; g.style.top = y + 'px'; });
      document.documentElement.style.setProperty('--sx', x + 'px');
      document.documentElement.style.setProperty('--sy', y + 'px');
    });
  }, { hex: BRAND_HEX, r: BR, g: BG, b: BB });
}
```

**clickRipple implementation:**
```js
async function clickRipple(page, x, y) {
  await page.evaluate(({ x, y, hex }) => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.style.cssText = `position:fixed;left:${x-40}px;top:${y-40}px;width:80px;height:80px;pointer-events:none;z-index:999999;overflow:visible`;
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', '40'); circle.setAttribute('cy', '40');
    circle.setAttribute('r', '0'); circle.setAttribute('fill', 'none');
    circle.setAttribute('stroke', hex); circle.setAttribute('stroke-width', '2');
    const anim = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
    anim.setAttribute('attributeName', 'r'); anim.setAttribute('from', '0'); anim.setAttribute('to', '40');
    anim.setAttribute('dur', '0.7s'); anim.setAttribute('fill', 'freeze');
    const animO = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
    animO.setAttribute('attributeName', 'opacity'); animO.setAttribute('from', '0.8'); animO.setAttribute('to', '0');
    animO.setAttribute('dur', '0.7s'); animO.setAttribute('fill', 'freeze');
    circle.append(anim, animO); svg.appendChild(circle); document.body.appendChild(svg);
    setTimeout(() => svg.remove(), 800);
  }, { x, y, hex: BRAND_HEX });
}
```

---

### CATEGORY 2 — SCENE TRANSITIONS

| # | Effect | API | When to use |
|---|--------|-----|-------------|
| 6 | Cross-fade dissolve | `FX.fadeToBlack(page, ms)` / `FX.fadeFromBlack(page, ms)` | Standard scene change |
| 7 | Zoom-out push | `FX.zoomOut(page, ms)` | End of a use-case segment |
| 8 | Glitch flash | `FX.glitchFlash(page)` | High-energy transition between sections |
| 9 | Blur transition | `FX.blurTransition(page, ms)` | Soft transition to title cards |
| 10 | White flash cut | `FX.whiteFlash(page, ms)` | Hard cut — punchy, Apple-style |
| 11 | Iris wipe | `FX.irisIn(page)` / `FX.irisOut(page)` | Use-case title card reveal |

```css
/* Transitions — injected via FX.initTransitions(page) */
@keyframes fx-fadeOut  { to { opacity: 0; } }
@keyframes fx-fadeIn   { from { opacity: 0; } }
@keyframes fx-zoomOut  { 0%{transform:scale(1);opacity:1} 100%{transform:scale(1.06);opacity:0} }
@keyframes fx-glitch   { 0%,100%{opacity:0;transform:translateX(0)} 15%,45%{opacity:1;transform:translateX(-4px)} 30%,60%{opacity:.8;transform:translateX(4px)} }
@keyframes fx-irisIn   { from{clip-path:circle(0% at 50% 50%)} to{clip-path:circle(75% at 50% 50%)} }
@keyframes fx-irisOut  { from{clip-path:circle(75% at 50% 50%)} to{clip-path:circle(0% at 50% 50%)} }
```

```js
async function fadeToBlack(page, ms = 400) {
  await page.evaluate(ms => {
    let ov = document.getElementById('fx-overlay');
    if (!ov) { ov = document.createElement('div'); ov.id = 'fx-overlay';
      ov.style.cssText = 'position:fixed;inset:0;background:#000;pointer-events:none;z-index:9999990;opacity:0;transition:opacity VAR_MSs ease';
      document.body.appendChild(ov); }
    ov.style.transition = `opacity ${ms}ms ease`; ov.style.opacity = '1';
  }, ms);
  await page.waitForTimeout(ms + 50);
}
async function fadeFromBlack(page, ms = 400) {
  await page.evaluate(ms => {
    const ov = document.getElementById('fx-overlay'); if (!ov) return;
    ov.style.transition = `opacity ${ms}ms ease`; ov.style.opacity = '0';
  }, ms);
  await page.waitForTimeout(ms + 50);
}
```

---

### CATEGORY 3 — AMBIENT BACKGROUND

| # | Effect | API | When to use |
|---|--------|-----|-------------|
| 12 | Floating particles | `FX.particles(page, on)` | Always on in full-video.html overlay |
| 13 | Aurora gradient | `FX.aurora(page, on)` | Title cards only |
| 14 | Animated grid | `FX.grid(page, on)` | Title cards, Cinematic level |
| 15 | Noise grain overlay | `FX.grain(page, on)` | Cinematic level — entire video |
| 16 | Scan lines | `FX.scanlines(page, on)` | Optional retro/tech look |

```css
/* Particles — 20 dots floating upward */
@keyframes fx-floatUp {
  0%   { transform:translateY(0) translateX(0); opacity:0; }
  10%  { opacity:0.5; }
  90%  { opacity:0.3; }
  100% { transform:translateY(-720px) translateX(var(--drift,20px)); opacity:0; }
}
.fx-particle { position:absolute; width:3px; height:3px; border-radius:50%;
  background:BRAND_HEX; animation:fx-floatUp var(--dur,12s) linear var(--delay,0s) infinite; }

/* Aurora */
@keyframes fx-aurora { 0%,100%{background-position:0% 50%} 50%{background-position:100% 50%} }
#fx-aurora { position:absolute;inset:0;opacity:.05;background-size:400% 400%;
  background:linear-gradient(135deg,BRAND_HEX,#0ea5e9,#8b5cf6,BRAND_HEX);
  animation:fx-aurora 12s ease infinite; }
```

---

### CATEGORY 4 — CALLOUT & OVERLAY EFFECTS

| # | Effect | API | When to use |
|---|--------|-----|-------------|
| 17 | Confetti burst | `FX.confetti(page)` | After "data loaded" or "import complete" |
| 18 | Stat counter roll-up | `FX.animateCounter(page, id, target, suffix, ms)` | Impact summary section |
| 19 | Animated SVG checkmark | `FX.checkmark(page, containerId)` | After success states |
| 20 | Shimmer sweep | `FX.addShimmer(page, elementId)` | Active execution callout cards |
| 21 | Rotating gradient border | `FX.rotatingBorder(page, id, on)` | Result callout, Cinematic level |
| 22 | Bounce-in entry | `FX.bounceIn(page, elementId)` | All callout appears (Full/Cinematic) |
| 23 | Neon glow metric | `FX.neonStat(page, id, on)` | Hero stats in impact summary |
| 24 | Circular progress ring | `FX.progressRing(page, svgId, pct)` | Replace linear bar, Cinematic level |
| 25 | Success pulse ring | `FX.successPulse(page, x, y)` | After checkmark appears |

```css
@keyframes fx-bounceIn {
  0%   { transform:scale(.85) translateY(10px); opacity:0; }
  60%  { transform:scale(1.04) translateY(-3px); opacity:1; }
  80%  { transform:scale(.98); }
  100% { transform:scale(1) translateY(0); opacity:1; }
}
@keyframes fx-shimmer { 0%{background-position:-400px 0} 100%{background-position:400px 0} }
@keyframes fx-neon {
  0%,100%{text-shadow:0 0 10px BRAND_HEX,0 0 20px BRAND_HEX,0 0 40px BRAND_HEX}
  50%    {text-shadow:0 0 5px BRAND_HEX,0 0 10px BRAND_HEX}
}
@keyframes fx-successPulse {
  0%  {transform:translate(-50%,-50%) scale(.5);opacity:.8}
  100%{transform:translate(-50%,-50%) scale(2.5);opacity:0}
}
@keyframes fx-drawCircle { to{stroke-dashoffset:0} }
@keyframes fx-drawCheck  { to{stroke-dashoffset:0} }
```

```js
// Stat counter — fire-and-forget, easeOutCubic
async function animateCounter(page, elementId, target, suffix = '', durationMs = 1200) {
  await page.evaluate(({ id, target, suffix, dur }) => {
    const el = document.getElementById(id); if (!el) return;
    const start = performance.now();
    const tick = now => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = Math.round(eased * target) + suffix;
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, { id: elementId, target, suffix, dur: durationMs });
}

// Confetti burst — 50 rectangles
async function confetti(page) {
  await page.evaluate(() => {
    const colors = ['#10b981','#3b82f6','#f59e0b','#ec4899','#8b5cf6'];
    for (let i = 0; i < 50; i++) {
      const el = document.createElement('div');
      const angle = (Math.random() * 360) * Math.PI / 180;
      const dist = 150 + Math.random() * 200;
      const id = `cfx${i}${Date.now()}`;
      const style = document.createElement('style');
      style.textContent = `@keyframes ${id}{0%{transform:translate(-50%,-50%) rotate(0deg);opacity:1}100%{transform:translate(calc(-50% + ${Math.cos(angle)*dist}px),calc(-50% + ${Math.sin(angle)*dist}px)) rotate(${360+Math.random()*360}deg);opacity:0}}`;
      el.style.cssText = `position:fixed;width:${6+Math.random()*6}px;height:${3+Math.random()*4}px;background:${colors[i%colors.length]};border-radius:1px;left:50%;top:50%;z-index:9999990;pointer-events:none;animation:${id} 1.2s ease-out forwards`;
      document.head.appendChild(style); document.body.appendChild(el);
      setTimeout(() => { el.remove(); style.remove(); }, 1300);
    }
  });
}
```

---

### CATEGORY 5 — UI HIGHLIGHT EFFECTS

| # | Effect | API | When to use |
|---|--------|-----|-------------|
| 26 | Element highlight box | `FX.highlight(page, selector, ms, iframeMode)` | Draw attention to a specific button/field |
| 27 | Animated arrow pointer | `FX.arrow(page, x, y, dir)` + `FX.hideArrow(page)` | Point to upload zones, CTA buttons |
| 28 | Zoom lens | `FX.zoomLens(page, x, y, scale)` + `FX.hideZoomLens(page)` | Show fine UI detail (badge counts, status) |
| 29 | Scroll indicator | `FX.scrollHint(page, on)` | Before first scrollIframe call |

```js
// Element highlight — animated dashed border around iframe element
async function highlight(page, selector, durationMs = 2000, iframeMode = true) {
  await page.evaluate(({ sel, dur, iframe, hex }) => {
    const doc = iframe
      ? document.getElementById('app')?.contentDocument
      : document;
    if (!doc) return;
    const el = doc.querySelector(sel); if (!el) return;
    const rect = el.getBoundingClientRect();
    const iframeRect = iframe
      ? document.getElementById('app').getBoundingClientRect()
      : { left: 0, top: 0 };
    const box = document.createElement('div');
    box.id = 'fx-highlight';
    box.style.cssText = `
      position:fixed; pointer-events:none; z-index:9999990;
      left:${iframeRect.left + rect.left - 4}px;
      top:${iframeRect.top  + rect.top  - 4}px;
      width:${rect.width + 8}px; height:${rect.height + 8}px;
      border:2px dashed ${hex}; border-radius:6px;
      box-shadow:0 0 12px rgba(0,0,0,.3);
      animation:fx-dashSpin 1s linear infinite;
    `;
    if (!document.getElementById('fx-hl-style')) {
      const s = document.createElement('style'); s.id = 'fx-hl-style';
      s.textContent = '@keyframes fx-dashSpin{to{outline-offset:4px;filter:brightness(1.2)}}';
      document.head.appendChild(s);
    }
    document.body.appendChild(box);
    setTimeout(() => box.remove(), dur);
  }, { sel: selector, dur: durationMs, iframe: iframeMode, hex: BRAND_HEX });
}

// Animated bounce arrow
async function arrow(page, x, y, dir = 'down') {
  await page.evaluate(({ x, y, dir, hex }) => {
    document.getElementById('fx-arrow')?.remove();
    const glyphs = { down:'↓', up:'↑', left:'←', right:'→' };
    const el = document.createElement('div'); el.id = 'fx-arrow';
    el.style.cssText = `position:fixed;left:${x}px;top:${y}px;font-size:28px;color:${hex};
      pointer-events:none;z-index:9999990;text-shadow:0 0 10px ${hex};
      animation:fx-arrowBounce .6s ease-in-out infinite;transform:translate(-50%,-50%)`;
    el.textContent = glyphs[dir] || '↓';
    if (!document.getElementById('fx-arrow-style')) {
      const s = document.createElement('style'); s.id = 'fx-arrow-style';
      s.textContent = '@keyframes fx-arrowBounce{0%,100%{transform:translate(-50%,-50%)}50%{transform:translate(-50%,calc(-50% + 8px))}}';
      document.head.appendChild(s);
    }
    document.body.appendChild(el);
  }, { x, y, dir, hex: BRAND_HEX });
}
async function hideArrow(page) {
  await page.evaluate(() => document.getElementById('fx-arrow')?.remove());
}
```

---

### CATEGORY 6 — TITLE CARD EFFECTS

| # | Effect | API | When to use |
|---|--------|-----|-------------|
| 30 | Scramble text reveal | `FX.scramble(page, id, text, ms)` | App name on product title card |
| 31 | Glitch text intro | `FX.glitchText(page, id)` | Use-case numbers, Cinematic level |
| 32 | Wave counter row | `FX.waveCounterRow(page, containerId)` | Stats row on title cards |
| 33 | 3D perspective tilt | `FX.tilt3d(page, id, on)` | Product title card, Cinematic level |
| 34 | Line draw logo | `FX.drawLogo(page, svgId, ms)` | If app has SVG logo |
| 35 | Cinematic letterbox | `FX.letterbox(page, on)` | Full video, Cinematic level |

```css
@keyframes fx-glitchText {
  0%,100%{transform:translateX(0);clip-path:none}
  15%{transform:translateX(-4px);clip-path:inset(10% 0 85% 0)}
  30%{transform:translateX(4px);clip-path:inset(40% 0 40% 0)}
  45%{transform:translateX(-2px);clip-path:inset(75% 0 10% 0)}
  60%{transform:translateX(2px)}
}
@keyframes fx-tilt3d {
  0%,100%{transform:perspective(800px) rotateX(2deg) rotateY(-2deg)}
  25%{transform:perspective(800px) rotateX(-1deg) rotateY(2deg)}
  50%{transform:perspective(800px) rotateX(2deg) rotateY(2deg)}
  75%{transform:perspective(800px) rotateX(-2deg) rotateY(-1deg)}
}
```

```js
// Scramble text reveal — Matrix style, 800ms
async function scramble(page, elementId, finalText, durationMs = 800) {
  await page.evaluate(({ id, text, dur }) => {
    const el = document.getElementById(id); if (!el) return;
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%';
    const steps = Math.ceil(dur / 50); let step = 0;
    const iv = setInterval(() => {
      const progress = step / steps;
      el.textContent = text.split('').map((ch, i) => {
        if (i < Math.floor(progress * text.length)) return ch;
        return chars[Math.floor(Math.random() * chars.length)];
      }).join('');
      if (++step > steps) { el.textContent = text; clearInterval(iv); }
    }, 50);
  }, { id: elementId, text: finalText, dur: durationMs });
}

// Letterbox bars — black bars at top+bottom for 2.35:1 ratio
async function letterbox(page, on = true) {
  await page.evaluate(on => {
    ['fx-lb-top','fx-lb-bot'].forEach(id => document.getElementById(id)?.remove());
    if (!on) return;
    if (!document.getElementById('fx-lb-style')) {
      const s = document.createElement('style'); s.id = 'fx-lb-style';
      s.textContent = `#fx-lb-top,#fx-lb-bot{position:fixed;left:0;right:0;height:78px;background:#000;z-index:9999985;pointer-events:none;animation:fx-lbIn .4s ease forwards}@keyframes fx-lbIn{from{opacity:0}to{opacity:1}}`;
      document.head.appendChild(s);
    }
    const top = document.createElement('div'); top.id = 'fx-lb-top'; top.style.top = '0';
    const bot = document.createElement('div'); bot.id = 'fx-lb-bot'; bot.style.bottom = '0';
    document.body.append(top, bot);
  }, on);
}
```

---

### CATEGORY 7 — FFMPEG COLOR GRADING

Apply as the `-vf` chain in the ffmpeg encoder step. Choose ONE grade based on Q7 answer.

```js
const grades = {
  // Essential / Full levels — no color grade, just sharpen
  none: 'unsharp=5:5:0.8:3:3:0.4',

  // Cinematic level — warm Hollywood grade (Netflix/Apple product video look)
  warmHollywood: [
    'colorchannelmixer=.90:.10:0:0:.10:.85:.10:0:0:.10:.80:0',
    'eq=contrast=1.05:saturation=1.10',
    'unsharp=5:5:0.8:3:3:0.4',
    'vignette=PI/4',
    'noise=c0s=6:allf=t+u',
  ].join(','),

  // Alternative: cool fintech grade (Stripe/Linear aesthetic)
  coolTech: [
    'colorchannelmixer=.85:.05:.10:0:.05:.90:.05:0:.05:.10:.95:0',
    'eq=contrast=1.06:brightness=-0.02:saturation=1.05',
    'unsharp=5:5:0.6:3:3:0.3',
    'vignette=PI/4.5',
    'noise=c0s=5:allf=t+u',
  ].join(','),

  // Vibrance only (minimal, safe choice)
  vibrance: 'eq=saturation=1.15:contrast=1.05:gamma=0.96,unsharp=5:5:0.6:3:3:0.3',
};

// Usage in render-video.js encoder step:
// const grade = grades.warmHollywood;  // or grades.coolTech / grades.none
// execSync(`ffmpeg -y -i "${webm}" -vf "scale=${W}:${H},fps=30,${grade}" \
//   -c:v libx264 -preset slow -crf 16 -pix_fmt yuv420p "${OUT}"`);
```

---

### FULL FX OBJECT (copy into render-video.js)

```js
// ─── Brand color — set once at startup ───────────────────────────────────────
let BRAND_HEX = '#0ea5e9', BR = 14, BG = 165, BB = 233;
const FX = {
  setBrand(hex, r, g, b) { BRAND_HEX = hex; BR = r; BG = g; BB = b; },

  // Cursor
  initCursor:      (page) => { /* implementation above */ },
  clickRipple:     (page, x, y) => { /* implementation above */ },
  spotlight:       (page, on = true) => page.evaluate(on => { const el = document.getElementById('fx-spotlight'); if (el) el.style.opacity = on ? '1' : '0'; }, on),
  cursorTrail:     (page, on = true) => page.evaluate(on => { document.querySelectorAll('.fx-ghost').forEach(g => g.style.opacity = on ? null : '0'); }, on),
  clickTargetRings:(page, x, y) => { /* 3 concentric rings at x,y */ },

  // Transitions
  fadeToBlack:     (page, ms = 400) => { /* implementation above */ },
  fadeFromBlack:   (page, ms = 400) => { /* implementation above */ },
  zoomOut:         (page, ms = 600) => { /* zoom + fade overlay */ },
  glitchFlash:     (page) => { /* 3 white flashes + translateX */ },
  blurTransition:  (page, ms = 600) => { /* gaussianBlur via filter */ },
  whiteFlash:      (page, ms = 200) => { /* white overlay flash */ },
  irisIn:          (page) => { /* clip-path circle expand */ },
  irisOut:         (page) => { /* clip-path circle shrink */ },

  // Ambient
  particles:       (page, on = true) => { /* 20 floating dots */ },
  aurora:          (page, on = true) => { /* shifting gradient */ },
  grid:            (page, on = true) => { /* animated grid */ },
  grain:           (page, on = true) => { /* SVG feTurbulence */ },
  scanlines:       (page, on = true) => { /* repeating-gradient */ },

  // Callouts
  confetti:        (page) => { /* implementation above */ },
  animateCounter:  (page, id, target, suffix, ms) => { /* implementation above */ },
  checkmark:       (page, containerId) => { /* inject SVG + drawCircle/drawCheck anims */ },
  addShimmer:      (page, elementId) => { /* add shimmer class + CSS */ },
  rotatingBorder:  (page, id, on) => { /* conic-gradient @property */ },
  bounceIn:        (page, elementId) => { /* fx-bounceIn animation */ },
  neonStat:        (page, id, on) => { /* fx-neon text-shadow */ },
  progressRing:    (page, svgId, pct) => { /* stroke-dashoffset update */ },
  successPulse:    (page, x, y) => { /* expanding ring at x,y */ },

  // UI Highlight
  highlight:       (page, selector, ms, iframeMode) => { /* implementation above */ },
  arrow:           (page, x, y, dir) => { /* implementation above */ },
  hideArrow:       (page) => { /* implementation above */ },
  zoomLens:        (page, x, y, scale) => { /* magnify iframe region */ },
  hideZoomLens:    (page) => page.evaluate(() => document.getElementById('fx-zoom-lens')?.remove()),
  scrollHint:      (page, on) => { /* bouncing scroll arrow */ },

  // Title Cards
  scramble:        (page, id, text, ms) => { /* implementation above */ },
  glitchText:      (page, id) => { /* fx-glitchText CSS class */ },
  waveCounterRow:  (page, containerId) => { /* staggered waveIn on children */ },
  tilt3d:          (page, id, on) => { /* fx-tilt3d on element */ },
  drawLogo:        (page, svgId, ms) => { /* stroke-dashoffset draw */ },
  letterbox:       (page, on) => { /* implementation above */ },

  // ffmpeg grades
  grades,
};

module.exports = { FX };
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## PACING SYSTEM — PACE constants + helpers
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

These are the minimum timing values — add slow-down modifiers for complex scenes.

```js
const PACE = {
  // Title cards
  productTitleCard: 7000,   // logo + tagline + 4 stats need 7s to breathe
  useCaseTitleCard: 4500,   // 4-6 word title at 200wpm = 1.5s + 1s animation + 2s margin

  // Transitions
  sceneTransition:  800,    // 600ms CSS fade + 200ms blank frame
  modalKillWait:    700,    // React flush + Playwright DOM stabilize
  navLoad:          2000,   // Next.js router + hydration + font paint
  iframeReady:      600,    // readyState=complete + React hydration

  // Callout timing (reading speed at 200wpm + resonance dwell)
  calloutEntry:     500,    // animation duration before text visible
  beforePainRead:   5200,   // SLOW intentionally — viewer must feel the pain
  executionRead:    2800,   // faster — viewer is engaged, skims
  resultRead:       4800,   // metric needs 800ms extra for numeric processing
  boardView:        2500,   // 1.5s scan + 500ms count + 500ms margin
  drawerOpen:       2500,   // 400ms slide + 600ms header + 1500ms content

  // Interaction pacing
  clickDelay:       600,    // hover→click→response perception threshold
  fileInjectDelay:  1200,   // CSV parse + column mapping + row count render
  wizardStepDelay:  1500,   // step close + transition + render + orient
  progressBarDur:   4500,   // "fast computer" psychological window (4-5s)
  scrollStep:       80,     // ~60fps, easeInOutCubic smooth

  // Final scenes
  impactMetricCard: 3200,   // 1s counter + 1s label read + 1.2s dwell
  outroDelay:       2500,   // CTA/URL must be readable
};

// ── Slow-down modifiers — add on top of PACE defaults ────────────────────────
const SLOWDOWN = {
  novelUiPattern:       2000,  // first wizard/kanban/drawer — viewer has no mental model
  statCounterSettle:     500,  // wait for CSS counter animation to land
  chartVisible:         1500,  // eye-tracking: charts take 2.3x longer than text
  badgeChange:           800,  // peripheral vision needs time to catch badge updates
  dollarOrPercentResult: 1000, // numeric cognition: $2.4M needs a full beat
};

function withSlowdown(baseSleep, conditions = []) {
  return conditions.reduce((t, key) => t + (SLOWDOWN[key] ?? 0), baseSleep);
}

// ── Speed-up modifiers — cut time on repeated/familiar patterns ──────────────
const SPEEDUP = {
  repeatedPattern:    0.80,   // 3rd+ same UI pattern — 20% reduction
  familiarNav:        1200,   // different board, same layout — override navLoad
  afterProgressBar:    500,   // bar was the wait — only a beat needed after
  repeatScrollWait:   1000,   // subsequent scrolls after the first
};

function withSpeedup(baseSleep, rule) {
  const mod = SPEEDUP[rule];
  return typeof mod === 'number' && mod < 1 ? Math.round(baseSleep * mod) : mod;
}

// ── Pattern tracker — auto speed-up on 3rd+ repetition ───────────────────────
function makePatternTracker() {
  const counts = {};
  return {
    sleep(key, baseSleep) {
      counts[key] = (counts[key] ?? 0) + 1;
      return counts[key] >= 3 ? withSpeedup(baseSleep, 'repeatedPattern') : baseSleep;
    },
  };
}
const PT = makePatternTracker(); // Use: await sleep(PT.sleep('wizard', PACE.wizardStepDelay))

// ── THE 3-BEAT RULE ───────────────────────────────────────────────────────────
// Every use-case must hit Setup → Action → Payoff. Ratios:
//   Setup  30% — viewer feels the pain ("ugh, yes, I have this problem")
//   Action 45% — product earns its keep ("wow, it just handled that")
//   Payoff 25% — hero metric lands ("that's what I need")
//
// Setup ends the moment the first iframeClick() fires.
// Action ends the moment the result callout appears.
// Payoff ends when you navigate to the board.

// ── SMOOTH SCROLL — always use this instead of raw scrollIframe ──────────────
async function smoothScroll(page, totalDy, totalMs) {
  const frames = Math.max(2, Math.ceil(totalMs / PACE.scrollStep));
  let prev = 0;
  for (let i = 1; i <= frames; i++) {
    const t = i / frames;
    // easeInOutCubic
    const eased = t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2,3)/2;
    const dy = (eased - prev) * totalDy;
    await page.evaluate(d => {
      const f = document.getElementById('app');
      if (f?.contentDocument) (f.contentDocument.scrollingElement || f.contentDocument.body).scrollBy({ top: d, behavior: 'instant' });
    }, dy);
    prev = eased;
    await sleep(PACE.scrollStep);
  }
}

// ── PAUSE BEFORE CLICK ────────────────────────────────────────────────────────
// Always call before iframeClick() — viewer anticipates the click, ripple lands clean.
async function pauseBeforeClick(page, ms = 400) {
  await sleep(ms);
}
```
