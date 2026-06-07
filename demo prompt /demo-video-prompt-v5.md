# Universal Product Demo Video Generator v5
# Apple / Stripe launch film style. Real UI. Real interactions. Real voiceover.
# Shows ALL use-cases EXECUTED live — file uploads, wizard steps, processing, board results.
# NEW in v5: Pre-flight verification · 42 visual effects · Voiceover audio pipeline ·
#            Cinematic pacing system · macOS say / ElevenLabs · ffmpeg color grading
# Paste everything BELOW the === line into Claude Code from your project directory.
# ─────────────────────────────────────────────────────────────────────────────────────────

===

You are producing a professional product launch video for this web application.
Style: Apple / Stripe launch film. The REAL application UI is the hero.
Every use-case is EXECUTED — not explained. You upload real files, advance through
wizard steps, show processing progress, click "Launch Board", and open a card
to show the result state. Glass-morphism overlay cards with live-typing text explain
each step. A professional voiceover narrates concurrently. This is a sales video:
viewers must believe the software actually works.

Work through four phases: Pre-flight → Discovery → User Interview → Code Generation.
Do NOT skip phases. Do NOT ask questions before completing Pre-flight and Discovery.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## PHASE 0 — PRE-FLIGHT VERIFICATION (runs before anything else)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### 0a. Find and start the server (auto-start if not running)
```bash
# Check if already running
for port in 3000 3001 3031 4000 5173 8080 8000; do
  code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$port/ 2>/dev/null)
  [[ "$code" =~ ^(200|307|308)$ ]] && echo "FOUND: $port" && break
done

# If not found, start it:
# npm run dev &   OR   npm start &
# Then poll for 200: for i in {1..30}; do sleep 2; curl -sf http://localhost:3000/ && break; done
```

### 0b. Verify dependencies
```bash
# ffmpeg
ffmpeg -version 2>&1 | head -1 || echo "MISSING: brew install ffmpeg"

# Playwright
node -e "require('@playwright/test')" 2>/dev/null && echo "playwright OK" || \
  find . -path "*/node_modules/@playwright/test/package.json" 2>/dev/null | head -3

# Disk space (need >500 MB for video temp files)
df -h . | awk 'NR==2{print "Free:", $4}'

# sox (for ambient music generation — optional)
sox --version 2>/dev/null || echo "OPTIONAL: brew install sox"
```

### 0c. Verify full-screen capture (no clipping, no scrollbars)
Before generating any code, confirm the app renders correctly at 1280px wide.
If `document.documentElement.scrollWidth > 1280`, the iframe needs a scale override.
```bash
# Quick check — screenshot the homepage and read it
# If horizontal scrollbars appear, compute: scale = 1280 / scrollWidth
# Inject in full-video.html: iframe { transform: scale(SCALE); transform-origin: 0 0; }
```

### 0d. Pre-flight summary (print before proceeding)
```
✓ Server: http://localhost:PORT
✓ ffmpeg: installed
✓ Playwright: PATH
✓ Disk: N GB free
✓ Viewport: 1280px fits (no horizontal scroll)  OR  Scale needed: 0.XX
```
If any check FAILS, stop and report. Do not proceed to Discovery.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## PHASE 1 — AUTONOMOUS DISCOVERY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### 1a. App name
Read `<title>` tag, `package.json → name`, `README.md → H1`. Use most human-readable.

### 1b. Server port (already found in Phase 0)
Record as SERVER_URL for all subsequent steps.

### 1c. Zustand persist store keys — CRITICAL for modal suppression
```bash
grep -rn "name:" src/store/ --include="*.ts" --include="*.tsx" | grep -i "persist\|name:"
```
Record ALL store names. You need them for localStorage injection on every nav.

### 1d. Welcome modal dismiss keys
```bash
grep -rn "hasSeenWelcome\|northgate_guide_dismissed\|modalSeen\|localStorage.setItem" \
  src/ --include="*.ts" --include="*.tsx" | grep -v "zustand\|persist" | head -10
```

### 1e. Screenshot every page WITH modal suppression
Before any screenshot, inject localStorage to suppress modals:
```js
await p.evaluate(() => {
  localStorage.setItem('DEMO_STORE_KEY', JSON.stringify({state:{hasSeenWelcome:true},version:0}));
  localStorage.setItem('AUTH_STORE_KEY', JSON.stringify({state:{isAuthenticated:true,user:{firstName:'Demo',role:'ADMIN'}},version:0}));
  localStorage.setItem('GUIDE_KEY', 'true');
});
```
Screenshot: dashboard, ALL workflow pages, ALL board/kanban pages, compliance, analytics.
READ every screenshot — callout copy uses real numbers from the actual UI.

### 1f. Find ALL interactive elements per use-case page
For each workflow page, read the source:
```bash
cat src/app/workflows/WORKFLOW/page.tsx
```
Look for:
- **File inputs** (highest demo value) — drag-drop zones, `<input type="file">`
- **Multi-step wizards** — step indicators, "Next", "Preview", "Import" buttons
- **Stepper components** — numbered workflow steps that scroll
- **WorkflowCta / "Try it on your data"** — "Launch Board" + "Connect your ERP" buttons
- **Board cards** — draggable, clickable to open analysis/detail drawers
- **Any processing state** — progress bars, loading spinners, status badges

### 1g. Check if WorkflowCta has local file upload
```bash
cat src/components/workflows/workflow-cta.tsx
```
**If WorkflowCta only has "Launch Board" and "Connect your ERP" with no file upload:**
Add a drag-drop upload zone + processing animation to WorkflowCta BEFORE generating
the renderer. Every workflow must have a local upload option. The upload zone must:
- Accept CSV/XLS/XLSX
- Show a processing animation (progress bar 0→100%) when a file is dropped
- Show a green "✓ data loaded to board" state when done
- Keep the "Launch Board" and "Connect your ERP" buttons

### 1h. Find CSV sample files
```bash
find . -name "*.csv" | grep -v node_modules | grep "public\|test-data\|sample\|mock" | head -20
```
If not enough, generate realistic CSV matching each workflow.

### 1i. Playwright path
```bash
node -e "require('@playwright/test')" 2>/dev/null && echo "root OK" || \
  find . -path "*/node_modules/@playwright/test/package.json" 2>/dev/null | head -3
find . -path "*/node_modules/playwright/package.json" 2>/dev/null | head -3
```

### 1j. Brand color + iframe scale
```bash
grep '\-\-primary\b' src/app/globals.css -h | head -3
grep -r "max-w\|1280\|1400\|1440\|1920" src/app/layout.tsx 2>/dev/null | head -5
```
iframe scale formula: `scale = 1280 / APP_NATURAL_WIDTH`

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## PHASE 2 — USER INTERVIEW (one message, all 8 questions)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

---
**Scanned your project. Here's what I found:**
- App name: [DETECTED]
- Server: [URL:PORT]
- Store keys (modal suppression): [AUTH_KEY, DEMO_KEY, GUIDE_KEY]
- Use-cases detected: [LIST — route + one-line description + real stats from screenshots]
- Interactive elements per use-case: [LIST — file inputs, wizard steps, CTA buttons, board cards]
- WorkflowCta status: [Has upload zone / Needs upload zone added]
- CSV sample files: [LIST or "will generate"]
- Brand color: [HEX]
- iframe scale: [SCALE] (for 1280px output from [WIDTH]px app)
- Playwright path: [PATH]
- Pre-flight: [all green / issues found]

**8 questions:**

**Q1 — Video scope:**
a) All use-cases executed live (recommended, ~6 min) — shows every workflow fully
b) Top use-cases only (~3 min) — faster to produce, less complete
c) Custom selection

**Q2 — Which use-cases to include?**
[Show detected list. "Reply with numbers or 'all'"]

**Q3 — Overlay accent color:** [DETECTED HEX] or paste another.

**Q4 — Before/after metrics:** I found these real stats: [LIST from screenshots].
Use these, or provide overrides.

**Q5 — Output filename + duration target:**
Default: `[AppName]_Demo_Video.mp4`. Duration depends on use-case count (~45s each).

**Q6 — Voiceover audio?**
a) macOS `say` (free, built-in, zero setup) — I'll ask which voice:
   Samantha (warm/natural), Alex (clear/confident), Daniel (British/polished),
   Karen (Australian/friendly), Moira (Irish/distinctive)
b) ElevenLabs API (neural, highest quality) — paste your API key after answering
   Best voices: Rachel (warm professional), Adam (authoritative), Josh (deep/confident)
c) No audio — video only

**Q7 — Visual effects level?**
a) Essential — animated cursor dot + click ripples + floating particles + callout bounce-ins
b) Full — Essential + scene transitions (fade/glitch) + shimmer callouts + stat counters + zoom lens
c) Cinematic — Full + letterbox bars + 3D title tilt + scramble text reveal + color LUT + film grain
   (most professional, closest to an Apple product video)

**Q8 — Background music?**
a) Ambient tech drone (procedural via `sox`, always available, no download needed)
b) Royalty-free corporate (download from Pixabay/Mixkit — I'll provide the exact command)
c) No music
---
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
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## PHASE 3 — CODE GENERATION (fully autonomous after Q&A)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Generate SEVEN files in order. Zero additional questions.

### STEP 0 — Add local upload to WorkflowCta (if missing)

If WorkflowCta doesn't have a local file upload zone, add it now BEFORE generating
any renderer files. See Phase 1g for the full implementation spec.

---

### FILE 1: public/title-card.html — Product intro (7s)

Dark animated card with teal grid, pulsing orb, scramble-text name, tagline,
4 key metrics row, "Month YEAR" date stamp, cinematic letterbox if Cinematic level.
Colors: `background:#060d14`, `brand: BRAND_HEX`.

```html
<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
* { margin:0; padding:0; box-sizing:border-box; }
html, body { width:1280px; height:720px; overflow:hidden;
  background:#060d14; font-family:'Helvetica Neue',Arial,sans-serif; }
.grid { position:absolute; inset:0;
  background-image:linear-gradient(rgba(BR,BG,BB,.07) 1px,transparent 1px),
    linear-gradient(90deg,rgba(BR,BG,BB,.07) 1px,transparent 1px);
  background-size:60px 60px; animation:gIn 5s ease-out forwards; }
@keyframes gIn { 0%{opacity:0} 25%{opacity:1} 100%{opacity:.35} }
/* Cinematic level: floating particles */
@keyframes fx-floatUp {
  0%{transform:translateY(0) translateX(var(--drift,20px));opacity:0}
  10%{opacity:.5} 90%{opacity:.3}
  100%{transform:translateY(-720px) translateX(var(--drift,20px));opacity:0}
}
.particle { position:absolute; width:3px; height:3px; border-radius:50%;
  background:BRAND_HEX; animation:fx-floatUp var(--dur,12s) linear var(--delay,0s) infinite; }
.orb { position:absolute; width:580px; height:580px; border-radius:50%;
  background:radial-gradient(circle,rgba(BR,BG,BB,.14) 0%,transparent 70%);
  top:50%; left:50%; transform:translate(-50%,-50%);
  animation:pulse 3.5s ease-in-out infinite; }
@keyframes pulse { 0%,100%{transform:translate(-50%,-50%) scale(1)} 50%{transform:translate(-50%,-50%) scale(1.12)} }
/* Cinematic level: 3D tilt */
@keyframes fx-tilt3d {
  0%,100%{transform:perspective(800px) rotateX(2deg) rotateY(-2deg)}
  25%{transform:perspective(800px) rotateX(-1deg) rotateY(2deg)}
  50%{transform:perspective(800px) rotateX(2deg) rotateY(2deg)}
  75%{transform:perspective(800px) rotateX(-2deg) rotateY(-1deg)}
}
.bar { position:absolute; top:0; left:0; right:0; height:3px;
  background:linear-gradient(90deg,BRAND_HEX,BRAND_HEX_LIGHT,BRAND_HEX); }
.content { position:absolute; inset:0; display:flex; flex-direction:column;
  align-items:center; justify-content:center; }
.badge { font-size:11px; font-weight:700; letter-spacing:3px; text-transform:uppercase;
  color:BRAND_HEX; border:1px solid rgba(BR,BG,BB,.35); padding:5px 16px; border-radius:20px;
  margin-bottom:24px; background:rgba(BR,BG,BB,.07); animation:fu .8s .2s ease both; }
/* Scramble target — renderer calls FX.scramble(page,'app-name','APP NAME') */
.name { font-size:64px; font-weight:800; color:white; letter-spacing:-2px; margin-bottom:18px;
  animation:fu .8s .4s ease both; }
.tag { font-size:21px; color:rgba(255,255,255,.48); max-width:620px; text-align:center;
  line-height:1.5; animation:fu .8s .65s ease both; }
.sub { margin-top:12px; font-size:13px; color:rgba(BR,BG,BB,.68); letter-spacing:1px;
  animation:fu .8s .85s ease both; }
/* Wave counter row */
.stats { position:absolute; bottom:60px; display:flex; gap:48px; }
.stat { text-align:center; }
.stat:nth-child(1) { animation:waveIn .5s .9s  ease both; }
.stat:nth-child(2) { animation:waveIn .5s 1.05s ease both; }
.stat:nth-child(3) { animation:waveIn .5s 1.2s  ease both; }
.stat:nth-child(4) { animation:waveIn .5s 1.35s ease both; }
@keyframes waveIn { from{transform:translateY(20px) scale(.9);opacity:0} to{transform:translateY(0) scale(1);opacity:1} }
.sv { font-size:28px; font-weight:800; color:BRAND_HEX; }
.sl { font-size:10px; color:rgba(255,255,255,.30); letter-spacing:2px; text-transform:uppercase; margin-top:3px; }
.date { position:absolute; bottom:26px; right:38px; font-size:12px; color:rgba(255,255,255,.20); letter-spacing:2px; }
@keyframes fu { from{transform:translateY(22px);opacity:0} to{transform:translateY(0);opacity:1} }
/* Cinematic letterbox */
#lb-top,#lb-bot { position:absolute; left:0; right:0; height:78px; background:#000; z-index:10; }
#lb-top { top:0; } #lb-bot { bottom:0; }
</style></head><body>
<div class="grid"></div>
<!-- Particles injected by renderer: FX.particles(page, true) -->
<div class="orb"></div>
<div class="bar"></div>
<div class="content">
  <div class="badge">Product Launch</div>
  <div class="name" id="app-name">[APP NAME]</div>
  <div class="tag">[ONE-LINE TAGLINE]</div>
  <div class="sub">[WORKFLOW CATEGORIES — e.g. AP · AR · Payroll · Compliance]</div>
</div>
<div class="stats">
  <div class="stat"><div class="sv" id="stat0">[N]</div><div class="sl">[label]</div></div>
  <div class="stat"><div class="sv" id="stat1">[N%]</div><div class="sl">[label]</div></div>
  <div class="stat"><div class="sv" id="stat2">[Nh]</div><div class="sl">[label]</div></div>
  <div class="stat"><div class="sv" id="stat3">[KEY]</div><div class="sl">[label]</div></div>
</div>
<div class="date">[MONTH YEAR]</div>
<!-- Cinematic level only: -->
<!-- <div id="lb-top"></div><div id="lb-bot"></div> -->
</body></html>
```
Replace `BR,BG,BB` with decimal R,G,B of BRAND_HEX.

---

### FILE 2: public/use-case-title.html — Per-use-case intro (4.5s each)

Content injected by renderer via JS at render time. Restart animations on each call.

```html
<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
* { margin:0; padding:0; box-sizing:border-box; }
html, body { width:1280px; height:720px; overflow:hidden;
  background:#050c14; font-family:'Helvetica Neue',Arial,sans-serif; }
.grid { position:absolute; inset:0;
  background-image:linear-gradient(rgba(BR,BG,BB,.06) 1px,transparent 1px),
    linear-gradient(90deg,rgba(BR,BG,BB,.06) 1px,transparent 1px);
  background-size:60px 60px; opacity:0; animation:gIn 1s .1s ease forwards; }
@keyframes gIn { to{opacity:1} }
.bar { position:absolute; top:0; left:0; right:0; height:3px;
  background:linear-gradient(90deg,BRAND_HEX,BRAND_HEX_LIGHT,BRAND_HEX); }
.orb1 { position:absolute; width:500px; height:500px; border-radius:50%;
  background:radial-gradient(circle,rgba(BR,BG,BB,.17) 0%,transparent 65%);
  top:-100px; left:-80px; animation:ob 8s ease-in-out infinite; }
.orb2 { position:absolute; width:340px; height:340px; border-radius:50%;
  background:radial-gradient(circle,rgba(BR,BG,BB,.12) 0%,transparent 65%);
  bottom:-60px; right:-40px; animation:ob 10s 1s ease-in-out infinite; }
@keyframes ob { 0%,100%{transform:scale(1)} 50%{transform:scale(1.15)} }
.pill { position:absolute; top:22px; right:24px; display:flex; align-items:center; gap:7px;
  font-size:11px; font-weight:700; letter-spacing:1.5px; text-transform:uppercase;
  color:#50e09a; padding:5px 14px; border-radius:20px;
  border:1px solid rgba(30,200,120,.35); background:rgba(30,200,120,.07);
  opacity:0; animation:fu .5s 1.1s ease forwards; }
.dot { width:7px; height:7px; border-radius:50%; background:#50e09a;
  animation:blink .8s ease-in-out infinite; }
@keyframes blink { 0%,100%{opacity:1} 50%{opacity:.3} }
.content { position:absolute; inset:0; display:flex; flex-direction:column;
  align-items:center; justify-content:center; }
.num { font-size:11px; font-weight:700; letter-spacing:4px; text-transform:uppercase;
  color:BRAND_HEX; border:1px solid rgba(BR,BG,BB,.35); padding:5px 18px; border-radius:20px;
  margin-bottom:20px; background:rgba(BR,BG,BB,.07);
  opacity:0; animation:fu .7s .3s ease forwards; }
/* Cinematic: glitch text on title — renderer calls FX.glitchText(page,'ucTitle') */
.title { font-size:62px; font-weight:800; color:#fff; letter-spacing:-2px;
  text-align:center; line-height:1.05; margin-bottom:16px;
  opacity:0; animation:fu .7s .5s ease forwards; }
.sub { font-size:20px; color:rgba(255,255,255,.46); text-align:center;
  max-width:700px; line-height:1.55; opacity:0; animation:fu .7s .7s ease forwards; }
.stats { display:flex; gap:48px; margin-top:28px;
  opacity:0; animation:fu .7s .9s ease forwards; }
.stat { text-align:center; }
.sv { font-size:25px; font-weight:800; color:BRAND_HEX; }
.sl { font-size:10px; color:rgba(255,255,255,.30); letter-spacing:2px; text-transform:uppercase; margin-top:3px; }
@keyframes fu { from{transform:translateY(18px);opacity:0} to{transform:translateY(0);opacity:1} }
</style></head><body>
<div class="bar"></div><div class="grid"></div>
<div class="orb1"></div><div class="orb2"></div>
<div class="pill"><span class="dot"></span>Live Demo</div>
<div class="content">
  <div class="num" id="ucNum"></div>
  <div class="title" id="ucTitle"></div>
  <div class="sub" id="ucSub"></div>
  <div class="stats" id="ucStats"></div>
</div>
</body></html>
```

---

### FILE 3: public/full-video.html — App wrapper + overlay layer

The iframe loads the app (scaled to 1280px). All callouts, chip, and cursor dot are
overlaid on top. The renderer drives everything via page.evaluate().

**iframe scale:** `transform:scale(COMPUTED_SCALE); width:APP_WIDTHpx; height:APP_HEIGHTpx;`

**Callout design system (preserved from v4, enhanced with bounce-in + shimmer):**
- `.ci.red`    = "Before / Today's Pain" — always bottom-LEFT
- `.ci.orange` = "Live Execution / Processing" — always TOP-RIGHT
- `.ci.green`  = "Result / After" — always bottom-RIGHT
- `.ci` (blue) = Neutral context

```html
<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
* { margin:0; padding:0; box-sizing:border-box; }
html, body { width:1280px; height:720px; overflow:hidden; background:#000;
  font-family:'Helvetica Neue',Arial,sans-serif; }

/* Iframe wrapper */
.app-wrap { position:absolute; top:0; left:0;
  width:APP_WIDTHpx; height:APP_HEIGHTpx;
  transform:scale(COMPUTED_SCALE); transform-origin:0 0; overflow:hidden; }
#app { width:100%; height:100%; border:none; }

/* Overlay layer — everything above the iframe */
.overlay { position:absolute; inset:0; pointer-events:none; }

/* Status chip */
#chip { position:absolute; top:22px; left:50%; transform:translateX(-50%);
  font-size:11px; font-weight:700; letter-spacing:2px; text-transform:uppercase;
  padding:6px 18px; border-radius:20px; opacity:0; transition:opacity .4s;
  color:#fff; background:rgba(14,165,233,.18); border:1px solid rgba(14,165,233,.4); }
#chip.exec { background:rgba(240,130,20,.18); border-color:rgba(240,130,20,.4); }
#chip.live { background:rgba(20,190,110,.18); border-color:rgba(20,190,110,.4); }

/* Callout cards */
.callout { position:absolute; max-width:340px; opacity:0; pointer-events:none; }
.callout.show { animation:fromBottom .5s ease forwards; }
.callout.fromRight { animation:fromRight .5s ease forwards !important; }
.callout.fromLeft  { animation:fromLeft  .5s ease forwards !important; }
/* Full/Cinematic: bounce-in */
.callout.bounce { animation:fx-bounceIn .5s cubic-bezier(.34,1.56,.64,1) forwards !important; }
@keyframes fromBottom { from{transform:translateY(20px);opacity:0} to{transform:translateY(0);opacity:1} }
@keyframes fromRight  { from{transform:translateX(20px);opacity:0} to{transform:translateX(0);opacity:1} }
@keyframes fromLeft   { from{transform:translateX(-20px);opacity:0} to{transform:translateX(0);opacity:1} }
@keyframes fx-bounceIn {
  0%{transform:scale(.85) translateY(10px);opacity:0}
  60%{transform:scale(1.04) translateY(-3px);opacity:1}
  80%{transform:scale(.98)}
  100%{transform:scale(1) translateY(0);opacity:1}
}

/* Glass-morphism callout body */
.ci { background:rgba(4,14,28,.94); border:1px solid rgba(0,110,220,.38);
  backdrop-filter:blur(18px); border-radius:13px; padding:20px 22px;
  box-shadow:0 8px 40px rgba(0,0,0,.5); }
.ci.green  { border-color:rgba(20,190,110,.50); }
.ci.orange { border-color:rgba(240,130,20,.50); }
.ci.red    { border-color:rgba(210,50,50,.50);  }

/* Shimmer (Full/Cinematic on active callouts) */
@keyframes fx-shimmer { 0%{background-position:-400px 0} 100%{background-position:400px 0} }
.ci.shimmer {
  background-image:linear-gradient(90deg,transparent 0%,rgba(255,255,255,.04) 40%,rgba(255,255,255,.07) 50%,rgba(255,255,255,.04) 60%,transparent 100%);
  background-size:800px 100%; animation:fx-shimmer 2s linear infinite; }

.label { font-size:10px; font-weight:700; letter-spacing:2px; text-transform:uppercase;
  margin-bottom:8px; }
.label.red    { color:rgba(220,70,70,.9);   }
.label.orange { color:rgba(240,150,30,.9);  }
.label.green  { color:rgba(20,190,110,.9);  }
.title { font-size:15px; font-weight:700; color:#fff; line-height:1.4; margin-bottom:10px; }
.typed { font-size:12px; color:rgba(255,255,255,.50); line-height:1.70; min-height:2.5em; }
.typed .cursor { display:inline-block; width:2px; height:12px; background:BRAND_HEX;
  vertical-align:text-bottom; animation:blink .7s step-end infinite; }
@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }

/* Stats */
.stat-row { display:flex; align-items:baseline; gap:8px; margin-top:12px; }
.s-before { font-size:13px; color:rgba(210,60,60,.85); text-decoration:line-through; }
.s-after  { font-size:23px; font-weight:800; color:#50e09a; }
.s-unit   { font-size:11px; color:rgba(255,255,255,.26); }

/* Progress bar */
.prog-wrap { margin-top:12px; }
.prog-label { font-size:9px; letter-spacing:2px; color:rgba(255,255,255,.35); margin-bottom:6px; }
.prog-bar { height:4px; background:rgba(255,255,255,.1); border-radius:2px; overflow:hidden; }
.prog-fill { height:100%; width:0%; border-radius:2px;
  background:linear-gradient(90deg,BRAND_HEX,BRAND_HEX_LIGHT); transition:width .3s ease; }
.prog-pct { font-size:11px; color:BRAND_HEX; margin-top:4px; text-align:right; }

/* Step indicators */
.steps { margin-top:10px; display:flex; flex-direction:column; gap:6px; }
.step-row { display:flex; align-items:center; gap:8px; }
.step-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; transition:background .3s; }
.step-dot.done   { background:#50e09a; }
.step-dot.active { background:BRAND_HEX_LIGHT; animation:pulse .8s ease-in-out infinite; }
.step-dot.pending{ background:rgba(255,255,255,.18); }
.step-txt        { font-size:11px; color:rgba(255,255,255,.45); }
.step-txt.done   { color:#50e09a; }
.step-txt.active { color:rgba(255,255,255,.85); }
@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
</style></head><body>
<div class="app-wrap">
  <iframe id="app" src="SERVER_URL"></iframe>
</div>
<div class="overlay">
  <div id="chip"></div>

  <!-- ════════════════════════════════════════════════════════════════════
       PER-USE-CASE CALLOUT SETS — one trio per UC, unique IDs
       UC1 example — copy and increment numbers for each use-case
       ════════════════════════════════════════════════════════════════════ -->

  <!-- UC1 — [Name] -->
  <div class="callout" id="uc1L" style="bottom:54px;left:26px">
    <div class="ci red">
      <div class="label red">Before — [Pain Label]</div>
      <div class="title">[Pain Line 1]<br>[Pain Line 2]</div>
      <div class="typed" id="uc1Lt"></div>
      <div class="stat-row">
        <span class="s-before">[OLD]</span>
        <span class="s-after">[NEW]</span>
        <span class="s-unit">[unit]</span>
      </div>
    </div>
  </div>
  <div class="callout" id="uc1R" style="top:110px;right:26px">
    <div class="ci orange">
      <div class="label orange">Live — [Execution Label]</div>
      <div class="title">[Action Line 1]<br>[Action Line 2]</div>
      <div class="typed" id="uc1Rt"></div>
      <div class="prog-wrap">
        <div class="prog-label">PROCESSING...</div>
        <div class="prog-bar"><div class="prog-fill" id="uc1prog"></div></div>
        <div class="prog-pct" id="uc1pct">0%</div>
      </div>
      <!-- OR: step indicators for wizard workflows
      <div class="steps">
        <div class="step-row"><span class="step-dot pending"></span><span class="step-txt">Upload CSV</span></div>
        <div class="step-row"><span class="step-dot pending"></span><span class="step-txt">Map columns</span></div>
        <div class="step-row"><span class="step-dot pending"></span><span class="step-txt">Preview rows</span></div>
        <div class="step-row"><span class="step-dot pending"></span><span class="step-txt">Import to board</span></div>
      </div>
      -->
    </div>
  </div>
  <div class="callout" id="uc1Res" style="bottom:54px;right:26px">
    <div class="ci green">
      <div class="label green">Result — [Result Label]</div>
      <div class="title">[Result Line 1]<br>[Result Line 2]</div>
      <div class="typed" id="uc1Rest"></div>
      <div class="stat-row">
        <span class="s-after">[METRIC]</span>
        <span class="s-unit">[unit]</span>
      </div>
    </div>
  </div>

  <!-- IMPACT SUMMARY CALLOUTS (final scene) -->
  <div class="callout" id="sumA" style="bottom:54px;left:26px">
    <div class="ci green">
      <div class="label green">Time Saved</div>
      <div class="title">[Metric 1 title]</div>
      <div class="stat-row"><span class="s-after" id="sumAval">0</span><span class="s-unit">[unit]</span></div>
    </div>
  </div>
  <div class="callout" id="sumB" style="bottom:54px;right:26px">
    <div class="ci green">
      <div class="label green">Accuracy</div>
      <div class="title">[Metric 2 title]</div>
      <div class="stat-row"><span class="s-after" id="sumBval">0</span><span class="s-unit">[unit]</span></div>
    </div>
  </div>
  <div class="callout" id="sumC" style="top:110px;left:26px">
    <div class="ci green">
      <div class="label green">Volume Handled</div>
      <div class="title">[Metric 3 title]</div>
      <div class="stat-row"><span class="s-after" id="sumCval">0</span><span class="s-unit">[unit]</span></div>
    </div>
  </div>
  <div class="callout" id="sumD" style="top:110px;right:26px">
    <div class="ci green">
      <div class="label green">Cost Reduction</div>
      <div class="title">[Metric 4 title]</div>
      <div class="stat-row"><span class="s-after" id="sumDval">0</span><span class="s-unit">[unit]</span></div>
    </div>
  </div>
</div>
</body></html>
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
### FILE 4: public/fx.js — Effects module (copy from Effects Arsenal in Part 2)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Copy the full FX object from the Effects Arsenal section (Part 2) into public/fx.js.
Call `FX.setBrand(hex, r, g, b)` at the top of render-video.js once the brand color is known.
Activate effects based on Q7 answer:
- Essential: initCursor, clickRipple, particles, bounceIn callouts
- Full:      Essential + fadeToBlack/fadeFromBlack, shimmer, animateCounter, arrow
- Cinematic: Full + letterbox, scramble, tilt3d, glitchText, grain, color grade

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
### FILE 5: render-video.js — Main renderer
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

```js
const { chromium } = require('PLAYWRIGHT_PATH');
const { execSync }  = require('child_process');
const path = require('path'), fs = require('fs');
const { FX }        = require('./public/fx');

const W = 1280, H = 720, SRV = 'SERVER_URL';
const OUT = path.join(__dirname, 'OUTPUT.mp4');
const TMP = path.join(__dirname, 'video-tmp-raw');
const EFFECTS_LEVEL = 'EFFECTS_LEVEL'; // 'essential' | 'full' | 'cinematic'

// ── Brand ────────────────────────────────────────────────────────────────────
FX.setBrand('BRAND_HEX', BR, BG, BB);

// ── Store keys (from Phase 1c discovery) ─────────────────────────────────────
const DEMO_LS = JSON.stringify({ state:{ hasSeenWelcome:true, demoModeEnabled:false }, version:0 });
const AUTH_LS = JSON.stringify({
  state:{ user:{ id:'demo', firstName:'Demo', lastName:'User', role:'ADMIN', email:'demo@app.com' },
          accessToken:'demo-token', isAuthenticated:true }, version:0
});
const LS = { demo:'DEMO_STORE_KEY', auth:'AUTH_STORE_KEY', guide:'GUIDE_DISMISS_KEY' };

// ── Pacing (from Part 2) ──────────────────────────────────────────────────────
const PACE = {
  productTitleCard:7000, useCaseTitleCard:4500, sceneTransition:800,
  modalKillWait:700, navLoad:2000, iframeReady:600, calloutEntry:500,
  beforePainRead:5200, executionRead:2800, resultRead:4800,
  boardView:2500, drawerOpen:2500, clickDelay:600, fileInjectDelay:1200,
  wizardStepDelay:1500, progressBarDur:4500, scrollStep:80,
  impactMetricCard:3200, outroDelay:2500,
};
const sleep = ms => new Promise(r => setTimeout(r, ms));
const PT = makePatternTracker(); // defined in pacing section

// ── MANDATORY: 3-layer modal suppression ──────────────────────────────────────
async function killModal(page) {
  await page.evaluate(({ ls, d, a }) => {
    try {
      localStorage.setItem(ls.demo, d);
      localStorage.setItem(ls.auth, a);
      localStorage.setItem(ls.guide, 'true');
    } catch(e) {}
    document.querySelectorAll('[role="dialog"] button').forEach(btn => {
      const t = (btn.textContent || btn.getAttribute('aria-label') || '').toLowerCase();
      if (t.includes('know') || t.includes('skip') || t.includes('close') ||
          t.includes('dismiss') || t.includes('platform')) btn.click();
    });
  }, { ls:LS, d:DEMO_LS, a:AUTH_LS });
}

// Navigate iframe — injects LS before+after, kills modal in iframe
async function nav(page, url) {
  await page.evaluate(({ url, ls, d, a }) => {
    try {
      localStorage.setItem(ls.demo, d);
      localStorage.setItem(ls.auth, a);
      localStorage.setItem(ls.guide, 'true');
    } catch(e) {}
    const f = document.getElementById('app');
    if (f) f.src = url;
  }, { url, ls:LS, d:DEMO_LS, a:AUTH_LS });
  for (let i = 0; i < 30; i++) {
    const ok = await page.evaluate(() =>
      document.getElementById('app')?.contentDocument?.readyState === 'complete'
    ).catch(() => false);
    if (ok) break;
    await sleep(350);
  }
  await sleep(PACE.iframeReady);
  await page.evaluate(({ ls, d, a }) => {
    const f = document.getElementById('app');
    if (!f?.contentDocument) return;
    try {
      f.contentWindow.localStorage.setItem(ls.demo, d);
      f.contentWindow.localStorage.setItem(ls.auth, a);
      f.contentWindow.localStorage.setItem(ls.guide, 'true');
    } catch(e) {}
    f.contentDocument.querySelectorAll('button').forEach(btn => {
      const t = (btn.textContent || '').toLowerCase();
      if (t.includes('know the platform') || t.includes('dismiss') ||
          t.includes('skip') || t.includes('i know')) btn.click();
    });
  }, { ls:LS, d:DEMO_LS, a:AUTH_LS }).catch(() => {});
  await sleep(400);
}

// Smooth scroll (easeInOutCubic) — replaces raw scrollIframe
async function smoothScroll(page, totalDy, totalMs) {
  const frames = Math.max(2, Math.ceil(totalMs / PACE.scrollStep));
  let prev = 0;
  for (let i = 1; i <= frames; i++) {
    const t = i / frames;
    const eased = t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3)/2;
    const dy = (eased - prev) * totalDy;
    await page.evaluate(d => {
      const f = document.getElementById('app');
      if (f?.contentDocument)
        (f.contentDocument.scrollingElement || f.contentDocument.body).scrollBy({ top: d, behavior:'instant' });
    }, dy);
    prev = eased;
    await sleep(PACE.scrollStep);
  }
}

// Click inside iframe by partial text
async function iframeClick(page, text) {
  await page.evaluate(({ t, d, a }) => {
    const f = document.getElementById('app'); if (!f?.contentDocument) return;
    try { f.contentWindow.localStorage.setItem('demo', d); } catch(e) {}
    for (const el of f.contentDocument.querySelectorAll('button,a[href],[role="button"]')) {
      if ((el.textContent || '').includes(t)) { el.click(); return; }
    }
  }, { t:text, d:DEMO_LS, a:AUTH_LS });
  await sleep(PACE.clickDelay);
}

// Inject CSV to wizard file input
async function injectFileToIframe(page, csvContent, filename) {
  await page.evaluate(({ csv, fn }) => {
    const f = document.getElementById('app'); if (!f?.contentDocument) return;
    const input = f.contentDocument.querySelector('input[type="file"]');
    if (!input) return;
    const file = new File([new Blob([csv], { type:'text/csv' })], fn, { type:'text/csv' });
    const dt = new DataTransfer(); dt.items.add(file);
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles:true }));
  }, { csv:csvContent, fn:filename });
  await sleep(PACE.fileInjectDelay);
}

// Inject CSV to WorkflowCta upload zone (last file input on page)
async function injectFileToWorkflowCta(page, csvContent, filename) {
  await page.evaluate(({ csv, fn }) => {
    const f = document.getElementById('app'); if (!f?.contentDocument) return;
    const inputs = f.contentDocument.querySelectorAll('input[type="file"]');
    const input = inputs[inputs.length - 1];
    if (!input) return;
    const file = new File([new Blob([csv], { type:'text/csv' })], fn, { type:'text/csv' });
    const dt = new DataTransfer(); dt.items.add(file);
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles:true }));
  }, { csv:csvContent, fn:filename });
  await sleep(800);
}

// Open a kanban card drawer by text
async function openCard(page, searchText) {
  await page.evaluate(({ t, d }) => {
    const f = document.getElementById('app'); if (!f?.contentDocument) return;
    try { f.contentWindow.localStorage.setItem('demo', d); } catch(e) {}
    for (const el of f.contentDocument.querySelectorAll('*')) {
      if ((el.textContent || '').includes(t) && el.offsetHeight > 0 && el.offsetHeight < 60) {
        el.click(); return;
      }
    }
  }, { t:searchText, d:DEMO_LS });
  await sleep(PACE.drawerOpen);
}

// ── Overlay helpers ───────────────────────────────────────────────────────────
async function chip(page, text, cls = '') {
  await page.evaluate(({ t, c }) => {
    const el = document.getElementById('chip'); if (!el) return;
    el.textContent = t; el.className = 'chip ' + c; el.style.opacity = '1';
  }, { t:text, c:cls });
}
async function hideChip(page) {
  await page.evaluate(() => { const c = document.getElementById('chip'); if (c) c.style.opacity = '0'; });
}
async function show(page, id, dir) {
  const cls = EFFECTS_LEVEL !== 'essential' ? 'bounce' : ({ right:'fromRight', left:'fromLeft', up:'fromBottom' }[dir] || 'fromBottom');
  await page.evaluate(({ id, cls }) => {
    const el = document.getElementById(id); if (!el) return;
    el.style.animation = `${cls} .5s ease forwards`;
    el.classList.add('show');
  }, { id, cls });
  if (EFFECTS_LEVEL !== 'essential') await FX.addShimmer(page, id);
}
async function hide(page, id) {
  await page.evaluate(id => {
    const el = document.getElementById(id); if (!el) return;
    el.classList.remove('show');
    setTimeout(() => { if (el) el.style.animation = 'none'; }, 500);
  }, id);
}

// type() is ALWAYS fire-and-forget — NEVER await it
function type(page, elId, text, wpm = 260) {
  const ms = Math.round(60000 / (wpm * 5));
  page.evaluate(id => {
    const el = document.getElementById(id); if (!el) return;
    el.innerHTML = '<span class="cursor"></span>';
  }, elId).then(() => {
    let i = 0;
    const tick = () => {
      if (i >= text.length) {
        page.evaluate(id => document.getElementById(id)?.querySelector('.cursor')?.remove(), elId).catch(() => {});
        return;
      }
      page.evaluate(({ id, ch }) => {
        const el = document.getElementById(id); if (!el) return;
        const cur = el.querySelector('.cursor');
        const sp = document.createElement('span'); sp.textContent = ch;
        el.insertBefore(sp, cur);
      }, { id:elId, ch:text[i++] }).then(() => setTimeout(tick, ms + (Math.random() > .85 ? 55 : 0))).catch(() => {});
    };
    tick();
  }).catch(() => {});
}

// Progress bar — run in parallel with smoothScroll via Promise.all()
async function progressBar(page, fillId, pctId, target, durationMs) {
  const steps = 30, delay = durationMs / steps;
  for (let i = 1; i <= steps; i++) {
    const pct = Math.round((target * i) / steps);
    await page.evaluate(({ f, p, pct }) => {
      const fe = document.getElementById(f); if (fe) fe.style.width = pct + '%';
      const pe = document.getElementById(p);  if (pe) pe.textContent = pct + '%';
    }, { f:fillId, p:pctId, pct });
    await sleep(delay);
  }
}

// Advance step indicator
async function activateStep(page, calloutId, stepIndex) {
  await page.evaluate(({ cid, si }) => {
    const c = document.getElementById(cid); if (!c) return;
    c.querySelectorAll('.step-dot').forEach((d, i) => {
      d.className = 'step-dot' + (i < si ? ' done' : i === si ? ' active' : ' pending');
    });
    c.querySelectorAll('.step-txt').forEach((t, i) => {
      t.className = 'step-txt' + (i < si ? ' done' : i === si ? ' active' : '');
    });
  }, { cid:calloutId, si:stepIndex });
}

// Show use-case title card (4.5s), return to video wrapper
async function ucTitle(page, num, total, title, sub, stats) {
  if (EFFECTS_LEVEL !== 'essential') await FX.fadeToBlack(page, 300);
  await page.goto(`${SRV}/use-case-title.html`, { waitUntil:'load' });
  await page.evaluate(({ num, total, title, sub, stats }) => {
    document.getElementById('ucNum').textContent   = `Use Case ${num} of ${total}`;
    document.getElementById('ucTitle').textContent = title;
    document.getElementById('ucSub').textContent   = sub;
    document.getElementById('ucStats').innerHTML   = stats.map(s =>
      `<div class="stat"><div class="sv">${s.v}</div><div class="sl">${s.l}</div></div>`
    ).join('');
    ['ucNum','ucTitle','ucSub','ucStats'].forEach(id => {
      const el = document.getElementById(id); if (!el) return;
      el.style.animation = 'none'; el.offsetHeight; el.style.animation = '';
    });
  }, { num, total, title, sub, stats });
  if (EFFECTS_LEVEL === 'cinematic') {
    await FX.glitchText(page, 'ucTitle');
    await FX.waveCounterRow(page, 'ucStats');
  }
  if (EFFECTS_LEVEL !== 'essential') await FX.fadeFromBlack(page, 300);
  await sleep(PACE.useCaseTitleCard);
  await page.goto(`${SRV}/full-video.html`, { waitUntil:'load' });
  await killModal(page);
  await FX.initCursor(page);
  if (EFFECTS_LEVEL === 'cinematic') { await FX.letterbox(page, true); await FX.grain(page, true); }
  await sleep(600);
}

// Pause before click — viewer anticipates the action
async function pauseBeforeClick(ms = 400) { await sleep(ms); }

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  fs.mkdirSync(TMP, { recursive:true });

  // Pre-flight
  console.log('Pre-flight...');
  execSync(`curl -sf ${SRV}/ > /dev/null 2>&1`);
  execSync('ffmpeg -version', { stdio:'pipe' });
  console.log('  ✓ Server + ffmpeg OK\n');

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security'],
  });
  const ctx  = await browser.newContext({
    viewport: { width:W, height:H },
    recordVideo: { dir:TMP, size:{ width:W, height:H } },
  });
  const page = await ctx.newPage();

  // ── SCENE 0: Product title card ───────────────────────────────────────────
  console.log('[0] Title card');
  await page.goto(`${SRV}/title-card.html`, { waitUntil:'load' });
  await FX.initCursor(page);
  if (EFFECTS_LEVEL === 'cinematic') {
    await FX.particles(page, true);
    await FX.aurora(page, true);
    await FX.letterbox(page, true);
    await sleep(300);
    await FX.scramble(page, 'app-name', 'APP NAME', 800);
    await FX.tilt3d(page, 'app-name', true);
  }
  await sleep(PACE.productTitleCard);

  // ── Load video wrapper ────────────────────────────────────────────────────
  await page.goto(`${SRV}/full-video.html`, { waitUntil:'load' });
  await killModal(page);
  await FX.initCursor(page);
  if (EFFECTS_LEVEL === 'cinematic') { await FX.letterbox(page, true); await FX.grain(page, true); }
  await sleep(800);

  // ══════════════════════════════════════════════════════════════════════════
  // USE CASE TEMPLATE — repeat for each use case, choosing pattern A / B / C
  // ══════════════════════════════════════════════════════════════════════════

  // ── Use Case N — [Name] ───────────────────────────────────────────────────
  console.log('[UCN] [Name]');

  // 1. Per-use-case title card
  await ucTitle(page, N, TOTAL, '[Title]', '[Description]', [
    { v:'[STAT1]', l:'[label]' }, { v:'[STAT2]', l:'[label]' },
    { v:'[STAT3]', l:'[label]' }, { v:'[STAT4]', l:'[label]' },
  ]);

  // 2. Set chip, navigate to workflow page
  await chip(page, '[Scene Label]', 'exec');
  await nav(page, `${SRV}/workflows/WORKFLOW_NAME`);
  await sleep(withSlowdown(PACE.navLoad, ['novelUiPattern'])); // +2000ms first time

  // 3. Before pain (L-bottom, .ci.red)
  await show(page, 'ucNL', 'right');
  type(page, 'ucNLt', '[1-2 sentences: specific painful current state. Real numbers.]');
  if (EFFECTS_LEVEL !== 'essential') await FX.spotlight(page, true);
  await sleep(PACE.beforePainRead);
  if (EFFECTS_LEVEL !== 'essential') await FX.spotlight(page, false);
  await hide(page, 'ucNL');
  await sleep(PACE.modalKillWait); // MANDATORY gap

  // 4. Choose ONE of these interaction patterns:

  // ── PATTERN A — Full wizard (upload → column map → preview → import → board) ─
  // Use when: page has a multi-step import wizard with file input
  //
  // await iframeClick(page, 'Import [Name]');
  // await sleep(800);
  // await injectFileToIframe(page, CSV_DATA, 'filename.csv');    // step 1→2
  // await show(page, 'ucNR', 'left');
  // type(page, 'ucNRt', 'File uploaded — N rows. Auto-mapping columns...');
  // await activateStep(page, 'ucNR', 1);
  // await sleep(PACE.executionRead);
  // await pauseBeforeClick(); await iframeClick(page, 'Preview');  // step 2→3
  // await activateStep(page, 'ucNR', 2);
  // await sleep(PT.sleep('wizard', PACE.wizardStepDelay));
  // await hide(page, 'ucNR'); await sleep(PACE.modalKillWait);
  // await show(page, 'ucNR', 'left');
  // type(page, 'ucNRt', 'Preview: N ready, M flagged. Clicking Import...');
  // await activateStep(page, 'ucNR', 3);
  // await sleep(PACE.executionRead);
  // await pauseBeforeClick(); await iframeClick(page, 'Import');   // step 3→4
  // await hide(page, 'ucNR'); await sleep(PACE.modalKillWait);
  // await show(page, 'ucNR', 'left');
  // type(page, 'ucNRt', 'Importing N items… routing to approval lanes…');
  // await Promise.all([
  //   progressBar(page, 'ucNprog', 'ucNpct', 100, PACE.progressBarDur),
  //   smoothScroll(page, 200, 3000),
  // ]);
  // await sleep(withSpeedup(PACE.progressBarDur, 'afterProgressBar'));
  // if (EFFECTS_LEVEL !== 'essential') await FX.confetti(page);
  // if (EFFECTS_LEVEL !== 'essential') await FX.checkmark(page, 'ucNR');
  // await hide(page, 'ucNR'); await sleep(PACE.modalKillWait);
  // await show(page, 'ucNRes', 'left');
  // type(page, 'ucNRest', '[Result: N imported, M flagged, board populated]');
  // if (EFFECTS_LEVEL !== 'essential') await FX.successPulse(page, 980, 560);
  // await sleep(withSlowdown(PACE.resultRead, ['dollarOrPercentResult']));
  // await hide(page, 'ucNRes');
  // await pauseBeforeClick(); await iframeClick(page, 'View [Board Name]');
  // await sleep(PACE.boardView);
  // await chip(page, '[Board Name] — Live', 'live');
  // await openCard(page, '[most interesting card text]');
  // await hideChip(page); await sleep(800);

  // ── PATTERN B — Workflow stepper (scroll + step indicator advances) ────────
  // Use when: page has numbered workflow steps (Stepper component)
  //
  // await show(page, 'ucNR', 'left');
  // type(page, 'ucNRt', '[What the system is processing...]');
  // await sleep(800);
  // for (let step = 1; step <= NUM_STEPS; step++) {
  //   await activateStep(page, 'ucNR', step);
  //   await sleep(PT.sleep('stepper', PACE.wizardStepDelay));
  //   await smoothScroll(page, 260, 1600);
  // }
  // await hide(page, 'ucNR'); await sleep(PACE.modalKillWait);
  // await injectFileToWorkflowCta(page, CSV_DATA, 'filename.csv');
  // await sleep(1500);
  // if (EFFECTS_LEVEL !== 'essential') await FX.confetti(page);
  // await show(page, 'ucNRes', 'left');
  // type(page, 'ucNRest', '[Result: N processed, M flagged]');
  // await sleep(PACE.resultRead);
  // await hide(page, 'ucNRes');
  // await pauseBeforeClick(); await iframeClick(page, 'Launch Board');
  // await sleep(PACE.boardView);
  // await chip(page, '[Board Name]', 'live');
  // await openCard(page, '[card text]');
  // await hideChip(page); await sleep(800);

  // ── PATTERN C — Progress bar only (processing-heavy workflows) ─────────────
  // Use when: focus is on validation/processing volume
  //
  // await show(page, 'ucNR', 'left');
  // type(page, 'ucNRt', '[What is being validated: N items, checking for X]');
  // await Promise.all([
  //   progressBar(page, 'ucNprog', 'ucNpct', 100, 7000),
  //   (async () => {
  //     await sleep(1800); await smoothScroll(page, 320, 2000);
  //     await sleep(1800); await smoothScroll(page, 320, 2000);
  //     await sleep(1800); await smoothScroll(page, 260, 1600);
  //   })(),
  // ]);
  // await sleep(withSpeedup(PACE.progressBarDur, 'afterProgressBar'));
  // await hide(page, 'ucNR'); await sleep(PACE.modalKillWait);
  // await injectFileToWorkflowCta(page, CSV_DATA, 'filename.csv');
  // await sleep(1500);
  // await show(page, 'ucNRes', 'left');
  // type(page, 'ucNRest', '[Result: what was caught, cleared, routed]');
  // await sleep(withSlowdown(PACE.resultRead, ['dollarOrPercentResult']));
  // await hide(page, 'ucNRes');
  // await pauseBeforeClick(); await iframeClick(page, 'Launch Board');
  // await sleep(PACE.boardView);
  // await chip(page, '[Board Name]', 'live');
  // await openCard(page, '[card text]');
  // await hideChip(page); await sleep(800);

  // ── FINAL SCENE: Dashboard + 4 impact callouts (18s) ─────────────────────
  console.log('[Final] Impact summary');
  if (EFFECTS_LEVEL !== 'essential') await FX.fadeToBlack(page, 400);
  await page.goto(`${SRV}/title-card.html`, { waitUntil:'load' });
  if (EFFECTS_LEVEL !== 'essential') await FX.fadeFromBlack(page, 400);
  await sleep(3500);

  await page.goto(`${SRV}/full-video.html`, { waitUntil:'load' });
  await killModal(page);
  await FX.initCursor(page);
  if (EFFECTS_LEVEL === 'cinematic') { await FX.letterbox(page, true); await FX.grain(page, true); }
  await sleep(800);

  await chip(page, 'Impact Summary');
  await nav(page, `${SRV}/dashboard`);
  await sleep(PACE.navLoad);

  // 4 metrics, alternate L/R, never same side simultaneously
  await show(page, 'sumA', 'right');
  if (EFFECTS_LEVEL !== 'essential') await FX.animateCounter(page, 'sumAval', STAT_A_NUM, STAT_A_SUFFIX);
  await sleep(PACE.impactMetricCard);

  await show(page, 'sumB', 'left');
  if (EFFECTS_LEVEL !== 'essential') await FX.animateCounter(page, 'sumBval', STAT_B_NUM, STAT_B_SUFFIX);
  await sleep(PACE.impactMetricCard);

  await hide(page, 'sumA'); await sleep(PACE.modalKillWait);
  await show(page, 'sumC', 'right');
  if (EFFECTS_LEVEL !== 'essential') await FX.animateCounter(page, 'sumCval', STAT_C_NUM, STAT_C_SUFFIX);
  await sleep(PACE.impactMetricCard);

  await hide(page, 'sumB'); await sleep(PACE.modalKillWait);
  await show(page, 'sumD', 'left');
  if (EFFECTS_LEVEL !== 'essential') await FX.animateCounter(page, 'sumDval', STAT_D_NUM, STAT_D_SUFFIX);
  await sleep(withSlowdown(PACE.impactMetricCard, ['neonStat']));

  await hide(page, 'sumC'); await hide(page, 'sumD');
  await hideChip(page);
  await sleep(PACE.outroDelay);

  // ── Encode ────────────────────────────────────────────────────────────────
  console.log('\nStopping recording...');
  await ctx.close(); await browser.close();

  const webm = fs.readdirSync(TMP).find(f => f.endsWith('.webm'));
  if (!webm) { console.error('No webm found'); process.exit(1); }

  // Color grade based on Q7
  const GRADE = EFFECTS_LEVEL === 'cinematic'
    ? FX.grades.warmHollywood
    : FX.grades.none;

  console.log(`Encoding H.264 30fps CRF16 (${EFFECTS_LEVEL} grade)...`);
  execSync(
    `ffmpeg -y -i "${path.join(TMP, webm)}" ` +
    `-vf "scale=${W}:${H},fps=30${GRADE ? ',' + GRADE : ''}" ` +
    `-c:v libx264 -preset slow -crf 16 -pix_fmt yuv420p "${OUT}"`,
    { stdio:'inherit' }
  );
  fs.rmSync(TMP, { recursive:true });
  console.log(`\n✅ ${OUT}  (${(fs.statSync(OUT).size / 1048576).toFixed(1)} MB)`);
}
main().catch(e => { console.error('❌', e.message); process.exit(1); });
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
### FILE 6: generate-script.js — Voiceover script writer (Q6 answer a or b)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Skip this file entirely if Q6 answer was c (no audio).

```js
// Writes script.json with timing estimates for every scene.
// Timing model: 150 wpm + 300ms per sentence boundary + 150ms per comma.
const fs = require('fs'), path = require('path');

const APP_NAME = '[APP NAME]';

// ── Write the full narration script here ─────────────────────────────────────
// Style: confident, specific, no buzzwords. Apple/Stripe narrator voice.
// SSML tokens for say command: [[slnc 500]] = 500ms pause, [[rate 150]] = slow emphasis
const SCRIPT = {
  intro: {
    text: `[APP NAME] gives [team type] a single place to [core value prop 1],
[[slnc 400]] [core value prop 2], and [core value prop 3].
[[slnc 500]] Here is what that looks like in practice.`,
    scene: 'title-card',
  },
  useCases: [
    {
      id: 'uc1',
      name: '[Use Case Name]',
      titleCard: {
        text: `Use case [N]: [[rate 140]][Use Case Name].[[rate 180]]`,
        scene: 'uc-title',
      },
      beforePain: {
        text: `Today, [team] [painful manual process]. [[slnc 400]]
[Specific consequence — hours lost, errors made, risk created].`,
        scene: 'before-pain',
      },
      execution: {
        text: `With [APP NAME], [what happens automatically].
[[slnc 300]] The system [specific action], so the team [what they do instead].`,
        scene: 'execution',
      },
      result: {
        text: `The result: [[rate 140]][specific metric — e.g. "reconciled in 28 minutes"].[[rate 180]]
[[slnc 400]] [What used to take X now takes Y].`,
        scene: 'result',
      },
      board: {
        text: `The [board name] board gives a live view of every item, status, and owner.`,
        scene: 'board',
      },
    },
    // Repeat for each use case...
  ],
  outro: {
    text: `[APP NAME] does not just organize your data — [[rate 150]]it makes it actionable.[[rate 180]]
[[slnc 400]] [Result 1 compressed]. [Result 2 compressed]. [Result 3 compressed].
[[slnc 500]] This is what modern [industry] operations looks like.
[[slnc 300]] [APP NAME] — [[rate 140]]built for teams that move fast and cannot afford mistakes.[[rate 180]]`,
    scene: 'outro',
  },
};

// Estimate duration: 150 wpm, strip SSML tokens for word count, add pause ms
function estimateDuration(text) {
  const pauses = (text.match(/\[\[slnc (\d+)\]\]/g) || [])
    .reduce((sum, m) => sum + parseInt(m.match(/\d+/)[0]), 0);
  const clean = text.replace(/\[\[.*?\]\]/g, '').trim();
  const words = clean.split(/\s+/).length;
  const wpm = Math.round((words / 150) * 60000);
  return wpm + pauses + 800; // +800ms for lead/tail padding
}

// Build manifest
const scenes = [
  { id: 'intro',    ...SCRIPT.intro,    duration_ms: estimateDuration(SCRIPT.intro.text) },
  ...SCRIPT.useCases.flatMap(uc => [
    { id: `${uc.id}_title`,      ...uc.titleCard,  duration_ms: estimateDuration(uc.titleCard.text) },
    { id: `${uc.id}_before`,     ...uc.beforePain, duration_ms: estimateDuration(uc.beforePain.text) },
    { id: `${uc.id}_execution`,  ...uc.execution,  duration_ms: estimateDuration(uc.execution.text) },
    { id: `${uc.id}_result`,     ...uc.result,     duration_ms: estimateDuration(uc.result.text) },
    { id: `${uc.id}_board`,      ...uc.board,      duration_ms: estimateDuration(uc.board.text) },
  ]),
  { id: 'outro', ...SCRIPT.outro, duration_ms: estimateDuration(SCRIPT.outro.text) },
];

fs.writeFileSync(path.join(__dirname, 'script.json'), JSON.stringify({ appName: APP_NAME, scenes }, null, 2));
console.log('✅ script.json written');
scenes.forEach(s => console.log(`  ${s.id.padEnd(22)} ~${(s.duration_ms/1000).toFixed(1)}s`));
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
### FILE 7: generate-audio.js — TTS renderer + mixer
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Skip this file entirely if Q6 answer was c (no audio).

```js
// Generates WAV voiceover files from script.json and mixes them with video.
// Run AFTER render-video.js produces the raw MP4.
// Usage: node generate-audio.js [--elevenlabs APIKEY] [--voice Alex] [--rate 180]

const { execSync, spawnSync } = require('child_process');
const fs = require('fs'), path = require('path');

const args  = process.argv.slice(2);
const USE_EL = args.includes('--elevenlabs');
const API_KEY = USE_EL ? args[args.indexOf('--elevenlabs') + 1] : null;
const VOICE  = args[args.indexOf('--voice') + 1] || 'Alex';
const RATE   = args[args.indexOf('--rate')  + 1] || '180';

// Voice recommendations:
// macOS say: Alex (enterprise/confident), Daniel (British/polished), Samantha (warm/natural)
// ElevenLabs: rachel (21m00Tcm4TlvDq8ikWAM), josh (TxGEqnHWrfWFTfGW9XjX), adam (pNInz6obpgDQGcFmaJgB)
const EL_VOICES = {
  rachel: '21m00Tcm4TlvDq8ikWAM',
  josh:   'TxGEqnHWrfWFTfGW9XjX',
  adam:   'pNInz6obpgDQGcFmaJgB',
  antoni: 'ErXwobaYiN019PkySvjV',
};

const AUDIO_DIR = path.join(__dirname, 'audio-scenes');
const VIDEO_IN  = path.join(__dirname, 'OUTPUT.mp4');
const MUSIC_IN  = path.join(__dirname, 'ambient-music.mp3');
const FINAL_OUT = path.join(__dirname, 'OUTPUT_with_audio.mp4');

fs.mkdirSync(AUDIO_DIR, { recursive:true });

const script = JSON.parse(fs.readFileSync(path.join(__dirname, 'script.json'), 'utf8'));

// ── Generate voiceover WAVs ───────────────────────────────────────────────────
const manifest = [];
let wallClock = 0;

for (const scene of script.scenes) {
  const aiffPath = path.join(AUDIO_DIR, `${scene.id}.aiff`);
  const wavPath  = path.join(AUDIO_DIR, `${scene.id}.wav`);

  if (USE_EL) {
    // ElevenLabs API
    const voiceId = EL_VOICES[VOICE.toLowerCase()] || VOICE;
    const body = JSON.stringify({
      text: scene.text.replace(/\[\[.*?\]\]/g, ' '), // strip SSML tokens
      model_id: 'eleven_multilingual_v2',
      voice_settings: { stability:0.55, similarity_boost:0.75, style:0.20, use_speaker_boost:true },
    });
    execSync(
      `curl -s -X POST "https://api.elevenlabs.io/v1/text-to-speech/${voiceId}" ` +
      `-H "xi-api-key: ${API_KEY}" -H "Content-Type: application/json" ` +
      `-d '${body.replace(/'/g, "\\'")}' -o "${path.join(AUDIO_DIR, scene.id)}.mp3"`,
      { stdio:'pipe' }
    );
    execSync(`ffmpeg -y -i "${path.join(AUDIO_DIR, scene.id)}.mp3" -ar 44100 -ac 1 "${wavPath}"`, { stdio:'pipe' });
    await new Promise(r => setTimeout(r, 650)); // rate limit
  } else {
    // macOS say
    execSync(`say -v "${VOICE}" -r ${RATE} -o "${aiffPath}" "[[slnc 200]]${scene.text}[[slnc 300]]"`, { stdio:'pipe' });
    execSync(`ffmpeg -y -i "${aiffPath}" -ar 44100 -ac 1 "${wavPath}"`, { stdio:'pipe' });
  }

  // Measure actual duration
  const result = spawnSync('ffprobe', [
    '-v','quiet','-print_format','json','-show_streams', wavPath
  ], { encoding:'utf8' });
  const info = JSON.parse(result.stdout);
  const actualMs = Math.round(parseFloat(info.streams[0].duration) * 1000);

  manifest.push({ id: scene.id, scene: scene.scene, start_ms: wallClock, duration_ms: actualMs, wav: wavPath });
  wallClock += actualMs + 200; // 200ms gap between scenes
  console.log(`  ✓ ${scene.id.padEnd(22)} ${(actualMs/1000).toFixed(1)}s`);
}

fs.writeFileSync(path.join(__dirname, 'audio-manifest.json'), JSON.stringify(manifest, null, 2));
console.log('\n✅ audio-manifest.json written\n');

// ── Mix voiceover + music into video ─────────────────────────────────────────
// Generate procedural ambient music if no music file
if (!fs.existsSync(MUSIC_IN)) {
  console.log('Generating ambient drone (sox)...');
  execSync(
    `sox -n -r 44100 -c 2 "${MUSIC_IN.replace('.mp3','.wav')}" ` +
    `synth 400 sine 60 sine 80 sine 120 remix - vol 0.25 fade 8 400 12`,
    { stdio:'pipe' }
  );
  execSync(`ffmpeg -y -i "${MUSIC_IN.replace('.mp3','.wav')}" "${MUSIC_IN}"`, { stdio:'pipe' });
}

// Build ffmpeg filter_complex with all VO scenes + sidechain ducking
let inputs = `-i "${VIDEO_IN}" -i "${MUSIC_IN}" `;
let delays = '';
manifest.forEach((s, i) => {
  inputs += `-i "${s.wav}" `;
  delays += `[${i+2}:a]adelay=${s.start_ms}|${s.start_ms}[vo${i}];`;
});
const voCnt = manifest.length;
const voMix = manifest.map((_, i) => `[vo${i}]`).join('') + `amix=inputs=${voCnt}[vo_all];`;
const filterComplex = [
  delays,
  voMix,
  `[1:a]volume=0.18,apad[music_raw];`,
  `[music_raw][vo_all]sidechaincompress=threshold=0.015:ratio=6:attack=80:release=600[music_duck];`,
  `[music_duck][vo_all]amix=inputs=2:normalize=0[pre_final];`,
  `[pre_final]alimiter=level_out=0.95[final_audio]`,
].join('');

execSync(
  `ffmpeg -y ${inputs} ` +
  `-filter_complex "${filterComplex}" ` +
  `-map 0:v:0 -map "[final_audio]" ` +
  `-c:v copy -c:a aac -b:a 192k -ar 44100 -ac 2 -movflags +faststart "${FINAL_OUT}"`,
  { stdio:'inherit' }
);

// Normalize to YouTube -14 LUFS
const NORM_OUT = FINAL_OUT.replace('.mp4', '_normalized.mp4');
execSync(
  `ffmpeg -y -i "${FINAL_OUT}" -af "loudnorm=I=-14:TP=-1.5:LRA=11" -c:v copy "${NORM_OUT}"`,
  { stdio:'inherit' }
);

console.log(`\n✅ ${NORM_OUT}  (${(fs.statSync(NORM_OUT).size / 1048576).toFixed(1)} MB)`);
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## IRON RULES — silent failures if broken
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### RULE 1: Modal suppression is 3 layers — skip any = modal reappears mid-video
1. Inject localStorage in parent page BEFORE setting iframe.src
2. Inject into iframe.contentWindow.localStorage AFTER iframe loads
3. Click any visible dismiss buttons inside iframe.contentDocument
All three happen inside `nav()`. Never skip any layer.

### RULE 2: type() is ALWAYS fire-and-forget — NEVER await it
```js
// CORRECT — types while user is reading, sleep covers both:
await show(page, 'uc1L', 'right');
type(page, 'uc1Lt', 'Your text...');   // no await
await sleep(PACE.beforePainRead);      // covers typing + reading
await hide(page, 'uc1L');

// WRONG — blocks the visual until typing finishes:
await type(page, 'uc1Lt', '...');
```

### RULE 3: 700ms mandatory gap between same-side callouts
```js
await hide(page, 'uc1L');
await sleep(PACE.modalKillWait);  // 700ms — ALWAYS, never skip
await show(page, 'uc1R', 'left');
```

### RULE 4: Progress bar + scroll MUST be parallel — never sequential
```js
// CORRECT:
await Promise.all([
  progressBar(page, 'ucNprog', 'ucNpct', 100, PACE.progressBarDur),
  (async () => {
    await sleep(1800); await smoothScroll(page, 350, 2000);
    await sleep(1800); await smoothScroll(page, 350, 2000);
  })(),
]);

// WRONG — bar fills, THEN you scroll:
await progressBar(page, 'ucNprog', 'ucNpct', 100, PACE.progressBarDur);
await smoothScroll(page, 350, 2000);
```

### RULE 5: Wizard must show ALL steps — upload → map → preview → import → done
Skipping steps means viewers don't see actual execution. That is the point of the demo.

### RULE 6: WorkflowCta MUST have local file upload
Every workflow page must have a drag-drop upload zone. If it doesn't exist, add it
in Step 0 BEFORE writing any renderer files.

### RULE 7: Every use-case ends with Launch Board + card drawer open
After result callout: click "Launch Board" → wait boardView → openCard() → wait drawerOpen.

### RULE 8: Unique callout IDs — one set per use-case
`uc1L/uc1R/uc1Res`, `uc2L/uc2R/uc2Res`, etc. Never reuse across scenes.

### RULE 9: headless:true always — macOS kills idle windows after ~60s

### RULE 10: Playwright require must be path-resolved, not bare require('playwright')

### RULE 11: iframe src must be absolute URL (http://localhost:PORT/path), not relative

### RULE 12: Run preflight checks before recording starts
Verify server up, ffmpeg installed, disk space >500 MB, viewport fits at 1280px.
If any check fails: stop and report. Do not start recording.

### RULE 13: Slow down for complexity — PACE constants are minimums
Apply `withSlowdown()` on first novel UI, charts, dollar amounts, badge changes.
Use `makePatternTracker()` to auto-speed-up on 3rd+ repeated pattern.

### RULE 14: Full-screen always — verify iframe fills 100% of viewport
If APP_NATURAL_WIDTH > 1280, compute scale and inject it in full-video.html.
Never record with horizontal scrollbars visible.

### RULE 15: Audio sync — sleep durations must be ≥ voiceover duration
If generate-audio.js is used, read audio-manifest.json after generating.
Set each scene's sleep() to `Math.max(PACE_DEFAULT, manifest[scene].duration_ms + 200)`.

### RULE 16: smoothScroll() replaces scrollIframe() everywhere
Always use eased movement. Raw scrollIframe() is only acceptable as a fallback
if smoothScroll() produces unexpected behavior in that specific iframe context.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## EXECUTION CHECKLIST
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

```bash
# ── Pre-flight (Phase 0) ───────────────────────────────────────────────────
curl -sf SERVER_URL/ > /dev/null && echo "server OK"
ffmpeg -version 2>&1 | head -1
node -e "require('PLAYWRIGHT_PATH')" && echo "playwright OK"
df -h . | awk 'NR==2{print "Disk free:", $4}'

# ── HTML assets ───────────────────────────────────────────────────────────
curl -s -o /dev/null -w "%{http_code}" SERVER_URL/title-card.html      # → 200
curl -s -o /dev/null -w "%{http_code}" SERVER_URL/use-case-title.html  # → 200
curl -s -o /dev/null -w "%{http_code}" SERVER_URL/full-video.html      # → 200
curl -s -o /dev/null -w "%{http_code}" SERVER_URL/fx.js                # → 200

# ── Run ───────────────────────────────────────────────────────────────────
node render-video.js

# ── Audio (if Q6 ≠ c) ────────────────────────────────────────────────────
node generate-script.js
node generate-audio.js --voice Alex --rate 180
# OR: node generate-audio.js --elevenlabs YOUR_API_KEY --voice rachel

# ── Verify 10 key frames ──────────────────────────────────────────────────
for t in 7 35 55 80 120 165 210 255 300 345; do
  ffmpeg -y -ss $t -i OUTPUT.mp4 -frames:v 1 /tmp/check_${t}s.png -loglevel error
done
# READ each screenshot — confirm: wizard steps visible, CTA upload shown,
# board + drawer visible, letterbox bars present (Cinematic), no scrollbars.
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## VIDEO STRUCTURE (~45s per use-case)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

| Segment | Duration | Content | Audio |
|---------|----------|---------|-------|
| Product title card | 7s | Name (scramble), tagline, 4 wave-in stats | intro voiceover |
| Dashboard intro | 12s | Command centre overview, 2 quick callouts | *(gap)* |
| UC N title card | 4.5s | "Use Case N of X", title (glitch), description, 4 stats | uc_title VO |
| Before pain | 8s | Navigate to workflow, L callout (type concurrent) | before_pain VO |
| Execute | 12-16s | Real interaction: wizard/stepper/progress + exec callout | execution VO |
| Result | 8s | R callout with specific result + optional confetti | result VO |
| Board + drawer | 5s | Launch Board → openCard → drawer visible | board VO |
| *(repeat for each UC)* | | | |
| Final title card | 3.5s | Return to product title briefly | *(gap)* |
| Impact summary | 18s | Dashboard + 4 stat counter callouts alternating L/R | outro VO |

**Total:** 8 UCs ≈ 6 min | 4 UCs ≈ 3.5 min | 3 UCs ≈ 2.5 min

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## DO NOT DO THESE THINGS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Do NOT show a workflow page and just scroll — upload a file, advance wizard steps, click buttons
- Do NOT stop after the workflow page — always click Launch Board and open a card drawer
- Do NOT await type() — it must be fire-and-forget
- Do NOT run progressBar and smoothScroll sequentially — always Promise.all()
- Do NOT skip wizard steps — show upload → column mapping → preview rows → import bar → done state
- Do NOT generate WorkflowCta without a local file upload zone
- Do NOT assume the modal is gone — 3-layer suppression on every nav
- Do NOT reuse callout div IDs across scenes
- Do NOT use headless:false or bare require('playwright')
- Do NOT use relative iframe src
- Do NOT use raw scrollIframe() — always use smoothScroll() for cinematic movement
- Do NOT skip PACE constants — they encode viewer reading speed and cognitive load, not arbitrary waits
- Do NOT skip the pre-flight checks — a missing ffmpeg or wrong port corrupts the entire recording
- Do NOT make the video shorter than needed to show every use-case fully executed
- Do NOT generate audio without first running generate-script.js to produce script.json
- Do NOT apply a color LUT grade unless effects level is Cinematic — it changes apparent brightness
