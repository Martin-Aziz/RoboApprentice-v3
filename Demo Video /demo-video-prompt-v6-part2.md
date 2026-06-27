━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## EFFECTS ARSENAL — 72 effects across 10 categories
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

All effects live in `public/fx.js` as the `FX` object. Call `FX.setBrand(hex,r,g,b)` once
at startup. Every method is async and safe to await or fire-and-forget.

### CATEGORY 1 — CURSOR EFFECTS (5 effects, unchanged from v5)

| # | Effect | API | When to use |
|---|--------|-----|-------------|
| 1 | Animated cursor dot | `FX.initCursor(page)` | Always — call once after every page.goto() |
| 2 | Click ripple | `FX.clickRipple(page, x, y)` | Wrap every iframeClick() call |
| 3 | Cursor spotlight | `FX.spotlight(page, on)` | Focus on a specific UI area |
| 4 | Cursor trail | `FX.cursorTrail(page, on)` | Full/Cinematic levels only |
| 5 | Click target rings | `FX.clickTargetRings(page, x, y)` | Button clicks that advance wizard steps |

---

### CATEGORY 2 — SCENE TRANSITIONS (10 effects, +4 new)

| # | Effect | API | When to use |
|---|--------|-----|-------------|
| 6 | Cross-fade dissolve | `FX.fadeToBlack(page, ms)` / `FX.fadeFromBlack(page, ms)` | Standard scene change |
| 7 | Zoom-out push | `FX.zoomOut(page, ms)` | End of a use-case segment |
| 8 | Glitch flash | `FX.glitchFlash(page)` | High-energy transition between sections |
| 9 | Blur transition | `FX.blurTransition(page, ms)` | Soft transition to title cards |
| 10 | White flash cut | `FX.whiteFlash(page, ms)` | Hard cut — punchy, Apple-style |
| 11 | Iris wipe | `FX.irisIn(page)` / `FX.irisOut(page)` | Use-case title card reveal |
| 12 | **NEW** Chromatic aberration flash | `FX.chromaticAberration(page, ms)` | Before AI-magic reveal scenes; Cinematic only |
| 13 | **NEW** Swipe push | `FX.swipePush(page, dir, ms)` | Before/after comparison transitions; dir='left'\|'right' |
| 14 | **NEW** Zoom-into-UI | `FX.zoomIntoUI(page, selector, ms)` | Snap to a specific UI component to detail it |
| 15 | **NEW** Particle explosion | `FX.particleExplode(page, x, y, count)` | Success moment between major sections |

```js
// Chromatic aberration flash — RGB channel separation for 1 frame burst
async function chromaticAberration(page, ms = 300) {
  await page.evaluate(ms => {
    let ov = document.getElementById('fx-chroma');
    if (!ov) {
      ov = document.createElement('div'); ov.id = 'fx-chroma';
      ov.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9999992;opacity:0;mix-blend-mode:screen;background:transparent';
      document.body.appendChild(ov);
    }
    const r = document.createElement('div');
    r.style.cssText = `position:fixed;inset:0;pointer-events:none;background:rgba(255,0,0,.25);transform:translateX(-4px);animation:fx-ca-r ${ms}ms ease forwards`;
    const b = document.createElement('div');
    b.style.cssText = `position:fixed;inset:0;pointer-events:none;background:rgba(0,0,255,.25);transform:translateX(4px);animation:fx-ca-b ${ms}ms ease forwards`;
    if (!document.getElementById('fx-ca-style')) {
      const s = document.createElement('style'); s.id = 'fx-ca-style';
      s.textContent = `
        @keyframes fx-ca-r{0%{opacity:0;transform:translateX(-6px)}20%{opacity:1;transform:translateX(-4px)}80%{opacity:.8;transform:translateX(-2px)}100%{opacity:0;transform:translateX(0)}}
        @keyframes fx-ca-b{0%{opacity:0;transform:translateX(6px)}20%{opacity:1;transform:translateX(4px)}80%{opacity:.8;transform:translateX(2px)}100%{opacity:0;transform:translateX(0)}}
      `;
      document.head.appendChild(s);
    }
    document.body.append(r, b);
    setTimeout(() => { r.remove(); b.remove(); }, ms + 50);
  }, ms);
  await page.waitForTimeout(ms + 50);
}

// Swipe push transition — slide direction for panel reveal
async function swipePush(page, dir = 'left', ms = 500) {
  await page.evaluate(({ dir, ms }) => {
    const ov = document.createElement('div'); ov.id = 'fx-swipe';
    const startX = dir === 'left' ? '100%' : '-100%';
    ov.style.cssText = `position:fixed;inset:0;background:#060d14;pointer-events:none;z-index:9999991;transform:translateX(${startX});transition:transform ${ms}ms cubic-bezier(.77,0,.18,1)`;
    document.body.appendChild(ov);
    requestAnimationFrame(() => requestAnimationFrame(() => { ov.style.transform = 'translateX(0)'; }));
    setTimeout(() => {
      ov.style.transition = `transform ${ms}ms cubic-bezier(.77,0,.18,1)`;
      ov.style.transform = dir === 'left' ? 'translateX(-100%)' : 'translateX(100%)';
      setTimeout(() => ov.remove(), ms + 50);
    }, ms + 100);
  }, { dir, ms });
  await page.waitForTimeout(ms * 2 + 200);
}

// Particle explosion — burst at x,y with mix of sizes and brand + accent colors
async function particleExplode(page, x, y, count = 80) {
  await page.evaluate(({ x, y, count, hex }) => {
    const colors = [hex, '#10b981', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6', '#ffffff'];
    for (let i = 0; i < count; i++) {
      const el = document.createElement('div');
      const angle = (Math.random() * 360) * Math.PI / 180;
      const dist = 80 + Math.random() * 280;
      const size = 3 + Math.random() * 8;
      const id = `pex${i}${Date.now()}`;
      const style = document.createElement('style');
      style.textContent = `@keyframes ${id}{0%{transform:translate(-50%,-50%) scale(1);opacity:1}100%{transform:translate(calc(-50% + ${Math.cos(angle)*dist}px),calc(-50% + ${Math.sin(angle)*dist}px)) scale(0);opacity:0}}`;
      el.style.cssText = `position:fixed;width:${size}px;height:${size}px;border-radius:${Math.random()>.5?'50%':'2px'};background:${colors[Math.floor(Math.random()*colors.length)]};left:${x}px;top:${y}px;z-index:9999993;pointer-events:none;animation:${id} ${0.8+Math.random()*0.6}s ease-out forwards`;
      document.head.appendChild(style); document.body.appendChild(el);
      setTimeout(() => { el.remove(); style.remove(); }, 1600);
    }
  }, { x, y, count, hex: BRAND_HEX });
}
```

---

### CATEGORY 3 — AMBIENT BACKGROUND (7 effects, +2 new)

| # | Effect | API | When to use |
|---|--------|-----|-------------|
| 16 | Floating particles | `FX.particles(page, on)` | Always on in full-video.html overlay |
| 17 | Aurora gradient | `FX.aurora(page, on)` | Title cards only |
| 18 | Animated grid | `FX.grid(page, on)` | Title cards, Cinematic level |
| 19 | Noise grain overlay | `FX.grain(page, on)` | Cinematic level — entire video |
| 20 | Scan lines | `FX.scanlines(page, on)` | Optional retro/tech look |
| 21 | **NEW** Radial burst background | `FX.radialBurst(page, on)` | Motion graphic interlude scenes |
| 22 | **NEW** Data stream rain | `FX.dataStream(page, on)` | AI processing scenes — Matrix-style column stream |

```js
// Radial burst — expanding rings from center (like Apple keynote backgrounds)
async function radialBurst(page, on = true) {
  await page.evaluate(({ on, hex, r, g, b }) => {
    document.getElementById('fx-radial-burst')?.remove();
    if (!on) return;
    if (!document.getElementById('fx-rb-style')) {
      const s = document.createElement('style'); s.id = 'fx-rb-style';
      s.textContent = `
        #fx-radial-burst{position:fixed;inset:0;pointer-events:none;z-index:1;overflow:hidden}
        .fx-ring{position:absolute;border-radius:50%;border:1px solid rgba(${r},${g},${b},.12);
          top:50%;left:50%;transform:translate(-50%,-50%);
          animation:fx-ringExpand 3.5s linear infinite}
        @keyframes fx-ringExpand{from{width:0;height:0;opacity:.6}to{width:1800px;height:1800px;opacity:0}}
      `;
      document.head.appendChild(s);
    }
    const wrap = document.createElement('div'); wrap.id = 'fx-radial-burst';
    for (let i = 0; i < 5; i++) {
      const ring = document.createElement('div'); ring.className = 'fx-ring';
      ring.style.animationDelay = `${i * 0.7}s`;
      wrap.appendChild(ring);
    }
    document.body.appendChild(wrap);
  }, { on, hex: BRAND_HEX, r: BR, g: BG, b: BB });
}

// Data stream rain — vertical columns of falling characters (AI processing feel)
async function dataStream(page, on = true) {
  await page.evaluate(({ on, hex }) => {
    document.getElementById('fx-data-stream')?.remove();
    document.getElementById('fx-ds-style')?.remove();
    if (!on) return;
    const canvas = document.createElement('canvas');
    canvas.id = 'fx-data-stream';
    canvas.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2;opacity:0.12';
    canvas.width = 1280; canvas.height = 720;
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    const cols = Math.floor(1280 / 14);
    const drops = Array(cols).fill(1).map(() => Math.random() * 720);
    const chars = '01アイウエオカキクケコサシスセソ';
    function draw() {
      ctx.fillStyle = 'rgba(0,0,0,0.05)'; ctx.fillRect(0,0,1280,720);
      ctx.fillStyle = hex; ctx.font = '12px monospace';
      drops.forEach((y, i) => {
        ctx.fillText(chars[Math.floor(Math.random()*chars.length)], i*14, y);
        if (y > 720 && Math.random() > 0.975) drops[i] = 0;
        drops[i] += 14;
      });
    }
    const interval = setInterval(draw, 50);
    canvas._interval = interval;
  }, { on, hex: BRAND_HEX });
}
```

---

### CATEGORY 4 — CALLOUT & OVERLAY EFFECTS (11 effects, +2 new)

| # | Effect | API | When to use |
|---|--------|-----|-------------|
| 23 | Confetti burst | `FX.confetti(page)` | After "data loaded" or "import complete" |
| 24 | Stat counter roll-up | `FX.animateCounter(page, id, target, suffix, ms)` | Impact summary section |
| 25 | Animated SVG checkmark | `FX.checkmark(page, containerId)` | After success states |
| 26 | Shimmer sweep | `FX.addShimmer(page, elementId)` | Active execution callout cards |
| 27 | Rotating gradient border | `FX.rotatingBorder(page, id, on)` | Result callout, Cinematic level |
| 28 | Bounce-in entry | `FX.bounceIn(page, elementId)` | All callout appearances (Full/Cinematic) |
| 29 | Neon glow metric | `FX.neonStat(page, id, on)` | Hero stats in impact summary |
| 30 | Circular progress ring | `FX.progressRing(page, svgId, pct)` | Replace linear bar, Cinematic level |
| 31 | Success pulse ring | `FX.successPulse(page, x, y)` | After checkmark appears |
| 32 | **NEW** Before/After stat flip | `FX.statFlip(page, id, fromVal, toVal, ms)` | Metric callout that shows old→new value |
| 33 | **NEW** Emoji burst label | `FX.emojiBurst(page, x, y, emoji, count)` | Celebration / success moments |

```js
// Stat flip — animated number transition showing before→after
async function statFlip(page, elementId, fromVal, toVal, ms = 800) {
  await page.evaluate(({ id, from, to, ms }) => {
    const el = document.getElementById(id); if (!el) return;
    el.style.cssText += 'transition:none;perspective:400px;display:inline-block';
    el.textContent = from;
    requestAnimationFrame(() => {
      el.style.transition = `transform ${ms/2}ms ease-in, opacity ${ms/2}ms ease-in`;
      el.style.transform = 'rotateX(-90deg)'; el.style.opacity = '0';
      setTimeout(() => {
        el.style.transition = 'none'; el.textContent = to;
        el.style.transform = 'rotateX(90deg)'; el.style.opacity = '0';
        requestAnimationFrame(() => {
          el.style.transition = `transform ${ms/2}ms ease-out, opacity ${ms/2}ms ease-out`;
          el.style.transform = 'rotateX(0deg)'; el.style.opacity = '1';
        });
      }, ms/2 + 50);
    });
  }, { id: elementId, from: fromVal, to: toVal, ms });
  await page.waitForTimeout(ms + 100);
}

// Emoji burst — floating emojis from a point (🎉 ✅ 🚀 etc)
async function emojiBurst(page, x, y, emoji = '🎉', count = 12) {
  await page.evaluate(({ x, y, emoji, count }) => {
    for (let i = 0; i < count; i++) {
      const el = document.createElement('div');
      const angle = (Math.random() * 360) * Math.PI / 180;
      const dist = 60 + Math.random() * 140;
      const id = `emj${i}${Date.now()}`;
      const style = document.createElement('style');
      style.textContent = `@keyframes ${id}{0%{transform:translate(-50%,-50%) scale(0) rotate(0deg);opacity:1}50%{opacity:1}100%{transform:translate(calc(-50% + ${Math.cos(angle)*dist}px),calc(-50% + ${Math.sin(angle)*dist}px)) scale(1.2) rotate(${Math.random()>0.5?'':'-'}${180+Math.random()*180}deg);opacity:0}}`;
      el.style.cssText = `position:fixed;font-size:${18+Math.random()*14}px;left:${x}px;top:${y}px;z-index:9999994;pointer-events:none;animation:${id} 1.1s cubic-bezier(.17,.67,.55,1.2) forwards`;
      el.textContent = emoji;
      document.head.appendChild(style); document.body.appendChild(el);
      setTimeout(() => { el.remove(); style.remove(); }, 1200);
    }
  }, { x, y, emoji, count });
}
```

---

### CATEGORY 5 — UI HIGHLIGHT EFFECTS (6 effects, +2 new)

| # | Effect | API | When to use |
|---|--------|-----|-------------|
| 34 | Element highlight box | `FX.highlight(page, selector, ms, iframeMode)` | Draw attention to a specific button/field |
| 35 | Animated arrow pointer | `FX.arrow(page, x, y, dir)` + `FX.hideArrow(page)` | Point to upload zones, CTA buttons |
| 36 | Zoom lens | `FX.zoomLens(page, x, y, scale)` + `FX.hideZoomLens(page)` | Show fine UI detail |
| 37 | Scroll indicator | `FX.scrollHint(page, on)` | Before first scrollIframe call |
| 38 | **NEW** Annotation label | `FX.annotate(page, x, y, text, dir)` + `FX.hideAnnotate(page)` | Label-and-pointer overlay for specific UI elements |
| 39 | **NEW** UI Region focus | `FX.regionFocus(page, x, y, w, h, ms)` | Vignette everything EXCEPT a specific region |

```js
// Annotation label — floating label with connecting line to a UI element
async function annotate(page, x, y, text, dir = 'right') {
  await page.evaluate(({ x, y, text, dir, hex, r, g, b }) => {
    document.getElementById('fx-annotate')?.remove();
    const wrap = document.createElement('div'); wrap.id = 'fx-annotate';
    wrap.style.cssText = 'position:fixed;pointer-events:none;z-index:9999992';
    const dotX = x, dotY = y;
    const labelX = dir === 'right' ? x + 30 : x - 30;
    const labelY = y - 14;
    wrap.innerHTML = `
      <svg style="position:fixed;left:0;top:0;width:1280px;height:720px;pointer-events:none;overflow:visible">
        <circle cx="${dotX}" cy="${dotY}" r="5" fill="${hex}" opacity="0.9"/>
        <circle cx="${dotX}" cy="${dotY}" r="10" fill="none" stroke="${hex}" stroke-width="1.5" opacity="0.5">
          <animate attributeName="r" from="5" to="20" dur="1.2s" repeatCount="indefinite"/>
          <animate attributeName="opacity" from="0.5" to="0" dur="1.2s" repeatCount="indefinite"/>
        </circle>
        <line x1="${dotX}" y1="${dotY}" x2="${labelX + (dir==='right'?0:-90)}" y2="${labelY+14}" stroke="${hex}" stroke-width="1.5" stroke-dasharray="4 3" opacity="0.7"/>
      </svg>
      <div style="position:fixed;left:${dir==='right'?labelX:labelX-90}px;top:${labelY}px;
        background:rgba(${r},${g},${b},0.15);border:1px solid rgba(${r},${g},${b},0.5);
        color:white;font-size:11px;font-weight:600;letter-spacing:0.5px;
        padding:5px 10px;border-radius:6px;backdrop-filter:blur(8px);
        white-space:nowrap;animation:fx-annotateIn .3s ease forwards">
        ${text}
      </div>`;
    if (!document.getElementById('fx-ann-style')) {
      const s = document.createElement('style'); s.id = 'fx-ann-style';
      s.textContent = '@keyframes fx-annotateIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}';
      document.head.appendChild(s);
    }
    document.body.appendChild(wrap);
  }, { x, y, text, dir, hex: BRAND_HEX, r: BR, g: BG, b: BB });
}
async function hideAnnotate(page) {
  await page.evaluate(() => document.getElementById('fx-annotate')?.remove());
}

// Region focus — spotlight ONLY the specified rectangle, darken everything else
async function regionFocus(page, x, y, w, h, ms = 3000) {
  await page.evaluate(({ x, y, w, h, ms }) => {
    document.getElementById('fx-region-focus')?.remove();
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.id = 'fx-region-focus';
    svg.style.cssText = 'position:fixed;inset:0;width:1280px;height:720px;pointer-events:none;z-index:9999990';
    svg.innerHTML = `
      <defs>
        <mask id="rfmask">
          <rect width="1280" height="720" fill="white"/>
          <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="black"/>
        </mask>
      </defs>
      <rect width="1280" height="720" fill="rgba(0,0,0,0.65)" mask="url(#rfmask)"/>
      <rect x="${x-2}" y="${y-2}" width="${w+4}" height="${h+4}" rx="7" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="1.5"/>`;
    document.body.appendChild(svg);
    if (ms > 0) setTimeout(() => svg.remove(), ms);
  }, { x, y, w, h, ms });
}
```

---

### CATEGORY 6 — KINETIC TYPOGRAPHY (12 effects — 6 new)

| # | Effect | API | When to use |
|---|--------|-----|-------------|
| 40 | Scramble text reveal | `FX.scramble(page, id, text, ms)` | App name on product title card |
| 41 | Glitch text intro | `FX.glitchText(page, id)` | Use-case numbers, Cinematic level |
| 42 | Wave counter row | `FX.waveCounterRow(page, containerId)` | Stats row on title cards |
| 43 | 3D perspective tilt | `FX.tilt3d(page, id, on)` | Product title card, Cinematic level |
| 44 | Line draw logo | `FX.drawLogo(page, svgId, ms)` | If app has SVG logo |
| 45 | Cinematic letterbox | `FX.letterbox(page, on)` | Full video, Cinematic level |
| 46 | **NEW** Word-by-word reveal | `FX.wordReveal(page, id, text, ms)` | Hero tagline on title card — each word slides up |
| 47 | **NEW** Blur-in text | `FX.blurIn(page, id, ms)` | Subtitle text appears from blur |
| 48 | **NEW** Split letter stagger | `FX.splitStagger(page, id, text, ms)` | Metric labels — letters fan in |
| 49 | **NEW** Typewriter with cursor | `FX.typewriterCursor(page, id, text, wpm)` | Live "AI thinking" / processing text |
| 50 | **NEW** Highlight word | `FX.highlightWord(page, id, word, color)` | Emphasize ONE word in a subtitle |
| 51 | **NEW** Counter decimal roll | `FX.decimalCounter(page, id, from, to, decimals, suffix, ms)` | Precise metric like "$2.4M" or "98.7%" |

```css
/* Word-by-word reveal */
@keyframes fx-wordUp {
  from { transform: translateY(120%); opacity: 0; }
  to   { transform: translateY(0);    opacity: 1; }
}
.fx-word-wrap { overflow: hidden; display: inline-block; }
.fx-word      { display: inline-block; animation: fx-wordUp .5s cubic-bezier(.16,1,.3,1) both; }

/* Blur-in */
@keyframes fx-blurIn {
  from { filter: blur(12px); opacity: 0; }
  to   { filter: blur(0);    opacity: 1; }
}

/* Split letter stagger */
@keyframes fx-letterIn {
  from { transform: translateY(20px) rotateX(-90deg); opacity: 0; }
  to   { transform: translateY(0)    rotateX(0deg);   opacity: 1; }
}
```

```js
// Word-by-word reveal
async function wordReveal(page, elementId, text, totalMs = 800) {
  await page.evaluate(({ id, text, ms }) => {
    const el = document.getElementById(id); if (!el) return;
    const words = text.split(' ');
    const delay = ms / words.length;
    if (!document.getElementById('fx-wr-style')) {
      const s = document.createElement('style'); s.id = 'fx-wr-style';
      s.textContent = '.fx-word-wrap{overflow:hidden;display:inline-block;vertical-align:bottom}.fx-word{display:inline-block;animation:fx-wordUp .5s cubic-bezier(.16,1,.3,1) both}@keyframes fx-wordUp{from{transform:translateY(120%);opacity:0}to{transform:translateY(0);opacity:1}}';
      document.head.appendChild(s);
    }
    el.innerHTML = words.map((w, i) =>
      `<span class="fx-word-wrap"><span class="fx-word" style="animation-delay:${i*delay}ms">${w}</span></span>`
    ).join(' ');
  }, { id: elementId, text, ms: totalMs });
  await page.waitForTimeout(totalMs + 600);
}

// Decimal counter — high-precision metric roll-up (for $2.4M, 98.7% etc)
async function decimalCounter(page, elementId, from, to, decimals = 1, suffix = '', durationMs = 1500) {
  await page.evaluate(({ id, from, to, dec, suffix, dur }) => {
    const el = document.getElementById(id); if (!el) return;
    const start = performance.now();
    const tick = now => {
      const t = Math.min(1, (now - start) / dur);
      const eased = t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2,3)/2;
      const val = from + (to - from) * eased;
      el.textContent = val.toFixed(dec) + suffix;
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, { id: elementId, from, to, dec: decimals, suffix, dur: durationMs });
}

// Highlight word — wrap one word in a colored span
async function highlightWord(page, elementId, word, color = null) {
  await page.evaluate(({ id, word, color, hex }) => {
    const el = document.getElementById(id); if (!el) return;
    const c = color || hex;
    el.innerHTML = el.textContent.replace(
      new RegExp(`(${word})`, 'gi'),
      `<span style="color:${c};font-weight:800;animation:fx-wordUp .4s ease both">${'$1'}</span>`
    );
  }, { id: elementId, word, color, hex: BRAND_HEX });
}
```

---

### CATEGORY 7 — TITLE CARD EFFECTS (preserved from v5, 6 effects)

See v5 Part 2 — scramble, glitchText, waveCounterRow, tilt3d, drawLogo, letterbox.
These are unchanged. Use them for title cards as in v5.

---

### CATEGORY 8 — MOTION GRAPHIC INTERLUDES (NEW CATEGORY, 8 effects)

These are full-screen non-UI scenes that play BETWEEN workflow demos.
Use when: voiceover is explaining context, not showing UI. Replace dead-air with motion.

| # | Effect | API | When to use |
|---|--------|-----|-------------|
| 52 | Problem statement card | `FX.mgProblem(page, headline, body, stat)` | Opens every use-case BEFORE showing UI |
| 53 | Feature spotlight card | `FX.mgFeature(page, icon, title, bullets)` | AI/smart features explanation |
| 54 | Before/After split screen | `FX.mgBeforeAfter(page, beforeText, afterText, metric)` | Problem→solution reveal |
| 55 | Process flow diagram | `FX.mgProcess(page, steps)` | Show multi-step workflow overview |
| 56 | Data visualization card | `FX.mgDataViz(page, label, value, unit, subtext)` | Single dramatic metric |
| 57 | Comparison grid | `FX.mgCompare(page, rows)` | Old way vs new way table |
| 58 | Quote callout | `FX.mgQuote(page, quote, attribution)` | Customer pain point in their words |
| 59 | Timeline reveal | `FX.mgTimeline(page, items)` | Onboarding steps, implementation path |

```html
<!-- mgProblem card template — inject into a full-screen dark container -->
<!--
Layout: centered, dark background #060d14, animated grid
Top: "THE PROBLEM" label in brand color
Middle: Large headline (40-52px), animated word-by-word reveal
Bottom: Supporting detail text, then stat number punches in big
Duration: 5-7 seconds
-->
```

```js
// Before/After split screen — left=red tinted before, right=green tinted after
async function mgBeforeAfter(page, beforeText, afterText, metric) {
  await page.evaluate(({ bt, at, m, hex, r, g, b }) => {
    let wrap = document.getElementById('fx-ba-split');
    if (!wrap) {
      wrap = document.createElement('div'); wrap.id = 'fx-ba-split';
      wrap.style.cssText = 'position:fixed;inset:0;display:flex;pointer-events:none;z-index:9999980;font-family:"Helvetica Neue",sans-serif';
      document.body.appendChild(wrap);
    }
    wrap.innerHTML = `
      <div style="flex:1;background:rgba(220,50,50,.08);border-right:1px solid rgba(220,50,50,.3);
        display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;
        animation:fx-baLeft .6s ease both">
        <div style="font-size:10px;font-weight:700;letter-spacing:3px;color:rgba(220,70,70,.8)">BEFORE</div>
        <div style="font-size:22px;font-weight:700;color:white;text-align:center;max-width:400px;line-height:1.3;padding:0 24px">${bt}</div>
        <div style="font-size:13px;color:rgba(255,255,255,.4);text-align:center;padding:0 24px;line-height:1.5">${m.before}</div>
      </div>
      <div style="flex:1;background:rgba(20,190,110,.08);
        display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;
        animation:fx-baRight .6s .3s ease both">
        <div style="font-size:10px;font-weight:700;letter-spacing:3px;color:rgba(20,190,110,.8)">AFTER</div>
        <div style="font-size:22px;font-weight:700;color:white;text-align:center;max-width:400px;line-height:1.3;padding:0 24px">${at}</div>
        <div style="font-size:32px;font-weight:900;color:#50e09a;text-align:center">${m.after}</div>
        <div style="font-size:11px;color:rgba(255,255,255,.4)">${m.unit}</div>
      </div>`;
    if (!document.getElementById('fx-ba-style')) {
      const s = document.createElement('style'); s.id = 'fx-ba-style';
      s.textContent = '@keyframes fx-baLeft{from{transform:translateX(-30px);opacity:0}to{transform:translateX(0);opacity:1}}@keyframes fx-baRight{from{transform:translateX(30px);opacity:0}to{transform:translateX(0);opacity:1}}';
      document.head.appendChild(s);
    }
  }, { bt: beforeText, at: afterText, m: metric, hex: BRAND_HEX, r: BR, g: BG, b: BB });
}
async function hideMgBeforeAfter(page) {
  await page.evaluate(() => document.getElementById('fx-ba-split')?.remove());
}

// Process flow diagram — horizontal step chain with icons
async function mgProcess(page, steps) {
  // steps = [{icon, label, detail}]
  await page.evaluate(({ steps, hex, r, g, b }) => {
    document.getElementById('fx-mg-process')?.remove();
    const wrap = document.createElement('div'); wrap.id = 'fx-mg-process';
    wrap.style.cssText = 'position:fixed;inset:0;background:rgba(6,13,20,.92);display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:9999980;font-family:"Helvetica Neue",sans-serif';
    wrap.innerHTML = `
      <div style="display:flex;align-items:center;gap:0">
        ${steps.map((s, i) => `
          <div style="display:flex;flex-direction:column;align-items:center;gap:10px;animation:fx-wordUp .5s ${i*0.12}s ease both;opacity:0">
            <div style="width:52px;height:52px;border-radius:14px;background:rgba(${r},${g},${b},.12);border:1px solid rgba(${r},${g},${b},.35);display:flex;align-items:center;justify-content:center;font-size:22px">${s.icon}</div>
            <div style="font-size:11px;font-weight:700;color:white;letter-spacing:.5px;text-align:center;max-width:90px">${s.label}</div>
            ${s.detail ? `<div style="font-size:10px;color:rgba(255,255,255,.35);text-align:center;max-width:90px;line-height:1.4">${s.detail}</div>` : ''}
          </div>
          ${i < steps.length-1 ? `<div style="width:40px;height:1px;background:rgba(${r},${g},${b},.3);flex-shrink:0;margin:0 4px;margin-bottom:28px"></div>` : ''}
        `).join('')}
      </div>`;
    if (!document.getElementById('fx-proc-style')) {
      const s = document.createElement('style'); s.id = 'fx-proc-style';
      s.textContent = '@keyframes fx-wordUp{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}';
      document.head.appendChild(s);
    }
    document.body.appendChild(wrap);
  }, { steps, hex: BRAND_HEX, r: BR, g: BG, b: BB });
}
async function hideMgProcess(page) { await page.evaluate(() => document.getElementById('fx-mg-process')?.remove()); }
```

---

### CATEGORY 9 — SUBTITLE / CAPTION SYSTEM (NEW CATEGORY, 4 effects)

Synchronized captions that appear with voiceover. Only at Full/Cinematic levels.

| # | Effect | API | When to use |
|---|--------|-----|-------------|
| 60 | Subtitle caption pop-in | `FX.subtitle(page, text, durationMs)` | Every major voiceover line |
| 61 | Scene label badge | `FX.sceneLabel(page, text, subtext)` | Scene start identification |
| 62 | Progress timeline bar | `FX.timelineBar(page, pct, on)` | Always-on at bottom — shows video progress |
| 63 | Live REC indicator | `FX.recIndicator(page, on)` | Title cards and opening scene only |

```js
// Subtitle caption — bottom-center, glass card, auto-dismiss
async function subtitle(page, text, durationMs = 3000) {
  await page.evaluate(({ text, dur }) => {
    document.getElementById('fx-subtitle')?.remove();
    const el = document.createElement('div'); el.id = 'fx-subtitle';
    el.style.cssText = `
      position:fixed;bottom:32px;left:50%;transform:translateX(-50%);
      background:rgba(4,14,28,.88);border:1px solid rgba(255,255,255,.12);
      backdrop-filter:blur(12px);border-radius:8px;
      padding:10px 22px;max-width:860px;
      font-family:'Helvetica Neue',sans-serif;font-size:14px;color:rgba(255,255,255,.88);
      line-height:1.5;text-align:center;letter-spacing:.2px;
      pointer-events:none;z-index:9999995;
      animation:fx-subIn .25s ease both`;
    el.textContent = text;
    if (!document.getElementById('fx-sub-style')) {
      const s = document.createElement('style'); s.id = 'fx-sub-style';
      s.textContent = '@keyframes fx-subIn{from{opacity:0;transform:translateX(-50%) translateY(8px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}@keyframes fx-subOut{to{opacity:0;transform:translateX(-50%) translateY(8px)}}';
      document.head.appendChild(s);
    }
    document.body.appendChild(el);
    setTimeout(() => {
      el.style.animation = 'fx-subOut .25s ease forwards';
      setTimeout(() => el.remove(), 300);
    }, dur - 300);
  }, { text, dur: durationMs });
}

// Scene label badge — top-left label that identifies the current scene
async function sceneLabel(page, text, subtext = '') {
  await page.evaluate(({ text, sub, hex, r, g, b }) => {
    document.getElementById('fx-scene-label')?.remove();
    const el = document.createElement('div'); el.id = 'fx-scene-label';
    el.style.cssText = `
      position:fixed;top:22px;left:22px;
      background:rgba(4,14,28,.88);border:1px solid rgba(${r},${g},${b},.35);
      backdrop-filter:blur(12px);border-radius:8px;padding:8px 14px;
      pointer-events:none;z-index:9999995;
      animation:fx-sLabelIn .3s ease both`;
    el.innerHTML = `
      <div style="font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${hex}">${text}</div>
      ${sub ? `<div style="font-size:11px;color:rgba(255,255,255,.45);margin-top:2px">${sub}</div>` : ''}`;
    if (!document.getElementById('fx-sl-style')) {
      const s = document.createElement('style'); s.id = 'fx-sl-style';
      s.textContent = '@keyframes fx-sLabelIn{from{opacity:0;transform:translateX(-8px)}to{opacity:1;transform:translateX(0)}}';
      document.head.appendChild(s);
    }
    document.body.appendChild(el);
  }, { text, sub: subtext, hex: BRAND_HEX, r: BR, g: BG, b: BB });
}
async function hideSceneLabel(page) { await page.evaluate(() => document.getElementById('fx-scene-label')?.remove()); }

// Progress timeline bar — always at very bottom, shows overall video progress
async function timelineBar(page, pct, on = true) {
  await page.evaluate(({ pct, on, hex }) => {
    if (!on) { document.getElementById('fx-timeline')?.remove(); return; }
    let bar = document.getElementById('fx-timeline');
    if (!bar) {
      bar = document.createElement('div'); bar.id = 'fx-timeline';
      bar.style.cssText = 'position:fixed;bottom:0;left:0;right:0;height:2px;background:rgba(255,255,255,.08);pointer-events:none;z-index:9999999';
      const fill = document.createElement('div'); fill.id = 'fx-timeline-fill';
      fill.style.cssText = `height:100%;background:${hex};transition:width .8s linear;width:0%`;
      bar.appendChild(fill); document.body.appendChild(bar);
    }
    document.getElementById('fx-timeline-fill').style.width = pct + '%';
  }, { pct, on, hex: BRAND_HEX });
}

// REC indicator
async function recIndicator(page, on = true) {
  await page.evaluate(on => {
    document.getElementById('fx-rec')?.remove();
    if (!on) return;
    const el = document.createElement('div'); el.id = 'fx-rec';
    el.style.cssText = 'position:fixed;top:22px;right:22px;display:flex;align-items:center;gap:6px;pointer-events:none;z-index:9999996;font-family:"Helvetica Neue",sans-serif';
    el.innerHTML = `
      <div style="width:8px;height:8px;border-radius:50%;background:#ef4444;animation:blink .8s ease-in-out infinite"></div>
      <span style="font-size:11px;font-weight:700;letter-spacing:2px;color:rgba(255,255,255,.6)">REC</span>`;
    if (!document.getElementById('fx-rec-style')) {
      const s = document.createElement('style'); s.id = 'fx-rec-style';
      s.textContent = '@keyframes blink{0%,100%{opacity:1}50%{opacity:.2}}';
      document.head.appendChild(s);
    }
    document.body.appendChild(el);
  }, on);
}
```

---

### CATEGORY 10 — FFMPEG COLOR GRADES (5 looks, +2 new)

```js
const grades = {
  // Essential / Full — sharpen only
  none: 'unsharp=5:5:0.8:3:3:0.4',

  // Cinematic — warm Hollywood (Netflix/Apple product video look)
  warmHollywood: [
    'colorchannelmixer=.90:.10:0:0:.10:.85:.10:0:0:.10:.80:0',
    'eq=contrast=1.05:saturation=1.10',
    'unsharp=5:5:0.8:3:3:0.4',
    'vignette=PI/4',
    'noise=c0s=6:allf=t+u',
  ].join(','),

  // Cool fintech (Stripe / Linear / Vercel aesthetic)
  coolTech: [
    'colorchannelmixer=.85:.05:.10:0:.05:.90:.05:0:.05:.10:.95:0',
    'eq=contrast=1.06:brightness=-0.02:saturation=1.05',
    'unsharp=5:5:0.6:3:3:0.3',
    'vignette=PI/4.5',
    'noise=c0s=5:allf=t+u',
  ].join(','),

  // Vibrance only (safe, minimal)
  vibrance: 'eq=saturation=1.15:contrast=1.05:gamma=0.96,unsharp=5:5:0.6:3:3:0.3',

  // NEW — Dark premium (deep blacks, slight blue tint — Arc / Raycast aesthetic)
  darkPremium: [
    'colorchannelmixer=.88:.02:.10:0:.02:.88:.10:0:.02:.08:.90:0',
    'eq=contrast=1.08:brightness=-0.04:saturation=0.95:gamma=0.92',
    'unsharp=5:5:0.7:3:3:0.3',
    'vignette=PI/3.5',
    'noise=c0s=4:allf=t+u',
  ].join(','),

  // NEW — Vibrant gradient (electric, startup-launch energy)
  vibrantGradient: [
    'eq=contrast=1.04:saturation=1.25:gamma=1.02',
    'unsharp=5:5:0.9:3:3:0.4',
    'vignette=PI/5',
  ].join(','),
};

// Usage in render-video.js:
// const GRADE = { essential:'none', full:'vibrance', cinematic:'warmHollywood' }[EFFECTS_LEVEL];
// ffmpeg -vf "scale=W:H,fps=30,${grades[GRADE]}" ...
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## PACING SYSTEM v6 — Extended PACE constants
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

```js
const PACE = {
  // Title cards
  productTitleCard:  7000,
  useCaseTitleCard:  4500,
  mgInterlude:       4000,  // NEW — motion graphic interlude (before/after, problem card)
  mgProcessDiagram:  5000,  // NEW — process flow diagram (viewers trace each step)
  beforeAfterSplit:  5500,  // NEW — before/after comparison (need time to read both sides)

  // Transitions
  sceneTransition:   800,
  modalKillWait:     700,
  navLoad:           2000,
  iframeReady:       600,

  // Callout timing
  calloutEntry:      500,
  beforePainRead:    5200,
  executionRead:     2800,
  resultRead:        4800,
  boardView:         2500,
  drawerOpen:        2500,

  // Subtitle timing
  subtitleShort:     2500,   // NEW — 5-8 word captions
  subtitleMedium:    3500,   // NEW — 9-15 word captions
  subtitleLong:      4500,   // NEW — 16+ word captions

  // Interaction pacing
  clickDelay:        600,
  fileInjectDelay:   1200,
  wizardStepDelay:   1500,
  progressBarDur:    4500,
  scrollStep:        80,
  aiMagicReveal:     2500,   // NEW — AI processing animation (longer = more impressive)
  microInteraction:  1000,   // NEW — hover state, focus pulse, loading spinner

  // Final scenes
  impactMetricCard:  3200,
  outroDelay:        2500,
};

const SLOWDOWN = {
  novelUiPattern:      2000,
  statCounterSettle:   500,
  chartVisible:        1500,
  badgeChange:         800,
  dollarOrPercentResult: 1000,
  beforeAfterRead:     1500,  // NEW — extra time when both sides are complex
  aiFeatureFirst:      1500,  // NEW — first time AI feature is shown — viewer is surprised
};

const SPEEDUP = {
  repeatedPattern:   0.80,
  familiarNav:       1200,
  afterProgressBar:  500,
  repeatScrollWait:  1000,
};
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## UI-SYNC PROTOCOL (NEW in v6)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Every use-case must follow this UI-Sync mapping:

| Voiceover phrase type | Required visual | Effect to use |
|---|---|---|
| "Today, teams struggle with..." | UI showing the problem state (pending items, errors, manual items) | `FX.regionFocus` on the problem area + red callout |
| "With [AppName], you can..." | The feature being described is visible and in action | `FX.annotate` on the relevant button/panel |
| "[X] is automatically processed" | Progress bar or spinner animating | `progressBar()` + exec callout |
| "The result: [metric]" | Board showing green completed items OR result callout | `FX.statFlip` showing before→after |
| "[Feature] detects / suggests / classifies" | AI interaction in progress | `FX.dataStream` + orange "AI Processing" chip |
| "Here's the [board name]" | Board visible with real cards | `openCard()` + green result callout |
| Transition between use-cases | Nothing showing UI | `FX.mgBeforeAfter` OR `FX.mgProcess` interlude |
| Metric stat in outro | Impact summary dashboard | `FX.decimalCounter` + `FX.emojiBurst` |

**The UI-Sync Protocol means:**
1. Before navigating to a page: show a 3-4 second problem card (`FX.mgProblem`) explaining what's broken today
2. When showing a feature: use `FX.annotate` on the relevant control so viewers know WHERE to look
3. After a success: show `FX.emojiBurst` at the center of the board (640, 360)
4. When voiceover mentions a metric: `FX.statFlip` to make the number change feel dramatic
5. Progress timeline bar (`FX.timelineBar`) updates every scene to orient the viewer
