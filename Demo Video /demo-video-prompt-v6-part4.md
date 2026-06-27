━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
### FILE 4: public/fx.js — Effects module (all 72 effects)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Copy the full FX object from the Effects Arsenal (Part 2) into public/fx.js.
Call `FX.setBrand(hex, r, g, b)` at the top of render-video.js once the brand color is known.

**Activation by effects level:**

Essential:
- `initCursor`, `clickRipple`, `particles`, `bounceIn`, `sceneLabel`, `recIndicator`
- `timelineBar` (every scene update)
- `subtitle` (every VO line)
- `wordReveal` (title cards)

Full — Essential +:
- `fadeToBlack`/`fadeFromBlack`, `shimmer`, `animateCounter`
- `arrow`, `annotate`, `regionFocus`, `zoomLens`
- `spotlight`, `confetti`, `checkmark`, `emojiBurst`
- `statFlip`, `mgBeforeAfter`, `mgProcess`
- `decimalCounter` (impact summary)
- `swipePush` (transitions)
- `particleExplode` (success moments)

Cinematic — Full +:
- `letterbox`, `scramble`, `tilt3d`, `glitchText`, `grain`
- `chromaticAberration` (AI reveal), `dataStream` (AI processing)
- `radialBurst` (title cards), `mgCompare` (outro)
- `splitStagger`, `blurIn` (text animations)
- Color grades: `warmHollywood` or `coolTech`

```js
// ─── Brand color — set once at startup ─────────────────────────────────────
let BRAND_HEX = '#0ea5e9', BR = 14, BG = 165, BB = 233;
const FX = {
  setBrand(hex, r, g, b) { BRAND_HEX = hex; BR = r; BG = g; BB = b; },

  // CATEGORY 1 — Cursor
  initCursor:         (page) => { /* see Part 2 */ },
  clickRipple:        (page, x, y) => { /* see Part 2 */ },
  spotlight:          (page, on = true) => page.evaluate(on => {
                        const el = document.getElementById('fx-spotlight');
                        if (el) el.style.opacity = on ? '1' : '0';
                      }, on),
  cursorTrail:        (page, on = true) => page.evaluate(on => {
                        document.querySelectorAll('.fx-ghost').forEach(g => g.style.opacity = on ? null : '0');
                      }, on),
  clickTargetRings:   (page, x, y) => { /* 3 concentric expanding rings */ },

  // CATEGORY 2 — Transitions
  fadeToBlack:        (page, ms = 400) => { /* see Part 2 */ },
  fadeFromBlack:      (page, ms = 400) => { /* see Part 2 */ },
  zoomOut:            (page, ms = 600) => { /* zoom + fade overlay */ },
  glitchFlash:        (page) => { /* 3 white flashes + translateX */ },
  blurTransition:     (page, ms = 600) => { /* gaussianBlur via filter */ },
  whiteFlash:         (page, ms = 200) => { /* white overlay flash */ },
  irisIn:             (page) => { /* clip-path circle expand */ },
  irisOut:            (page) => { /* clip-path circle shrink */ },
  chromaticAberration:(page, ms = 300) => { /* see Part 2 */ },
  swipePush:          (page, dir = 'left', ms = 500) => { /* see Part 2 */ },
  zoomIntoUI:         (page, selector, ms = 600) => { /* scroll+scale to selector */ },
  particleExplode:    (page, x, y, count = 80) => { /* see Part 2 */ },

  // CATEGORY 3 — Ambient
  particles:          (page, on = true) => { /* 20 floating dots */ },
  aurora:             (page, on = true) => { /* shifting gradient */ },
  grid:               (page, on = true) => { /* animated grid */ },
  grain:              (page, on = true) => { /* SVG feTurbulence */ },
  scanlines:          (page, on = true) => { /* repeating-gradient */ },
  radialBurst:        (page, on = true) => { /* see Part 2 */ },
  dataStream:         (page, on = true) => { /* see Part 2 */ },

  // CATEGORY 4 — Callouts
  confetti:           (page) => { /* 50 rectangles burst */ },
  animateCounter:     (page, id, target, suffix, ms) => { /* easeOutCubic */ },
  checkmark:          (page, containerId) => { /* SVG circle + check draw */ },
  addShimmer:         (page, elementId) => { /* shimmer CSS class */ },
  rotatingBorder:     (page, id, on) => { /* conic-gradient */ },
  bounceIn:           (page, elementId) => { /* fx-bounceIn */ },
  neonStat:           (page, id, on) => { /* fx-neon text-shadow */ },
  progressRing:       (page, svgId, pct) => { /* stroke-dashoffset */ },
  successPulse:       (page, x, y) => { /* expanding ring */ },
  statFlip:           (page, id, from, to, ms) => { /* see Part 2 */ },
  emojiBurst:         (page, x, y, emoji, count) => { /* see Part 2 */ },

  // CATEGORY 5 — UI Highlight
  highlight:          (page, selector, ms, iframeMode) => { /* dashed border box */ },
  arrow:              (page, x, y, dir) => { /* bouncing arrow */ },
  hideArrow:          (page) => { /* remove arrow */ },
  zoomLens:           (page, x, y, scale) => { /* magnify region */ },
  hideZoomLens:       (page) => page.evaluate(() => document.getElementById('fx-zoom-lens')?.remove()),
  scrollHint:         (page, on) => { /* bouncing scroll indicator */ },
  annotate:           (page, x, y, text, dir) => { /* see Part 2 */ },
  hideAnnotate:       (page) => { /* see Part 2 */ },
  regionFocus:        (page, x, y, w, h, ms) => { /* see Part 2 */ },

  // CATEGORY 6 — Kinetic Typography
  scramble:           (page, id, text, ms) => { /* Matrix scramble */ },
  glitchText:         (page, id) => { /* fx-glitchText */ },
  waveCounterRow:     (page, containerId) => { /* staggered waveIn */ },
  tilt3d:             (page, id, on) => { /* perspective tilt */ },
  drawLogo:           (page, svgId, ms) => { /* stroke-dashoffset draw */ },
  letterbox:          (page, on) => { /* 78px bars top+bottom */ },
  wordReveal:         (page, id, text, ms) => { /* see Part 2 */ },
  blurIn:             (page, id, ms) => { /* blur→clear transition */ },
  splitStagger:       (page, id, text, ms) => { /* per-letter stagger */ },
  typewriterCursor:   (page, id, text, wpm) => { /* type() with cursor */ },
  highlightWord:      (page, id, word, color) => { /* see Part 2 */ },
  decimalCounter:     (page, id, from, to, dec, suffix, ms) => { /* see Part 2 */ },

  // CATEGORY 8 — Motion Graphic Interludes
  mgBeforeAfter:      (page, beforeText, afterText, metric) => { /* see Part 2 */ },
  hideMgBeforeAfter:  (page) => page.evaluate(() => document.getElementById('fx-ba-split')?.remove()),
  mgProcess:          (page, steps) => { /* see Part 2 */ },
  hideMgProcess:      (page) => page.evaluate(() => document.getElementById('fx-mg-process')?.remove()),
  mgProblem:          (page, headline, body, stat) => { /* full-screen problem card */ },
  hideMgProblem:      (page) => page.evaluate(() => document.getElementById('fx-mg-problem')?.remove()),
  mgFeature:          (page, icon, title, bullets) => { /* feature spotlight card */ },
  hideMgFeature:      (page) => page.evaluate(() => document.getElementById('fx-mg-feature')?.remove()),
  mgDataViz:          (page, label, value, unit, subtext) => { /* single dramatic metric */ },
  hideMgDataViz:      (page) => page.evaluate(() => document.getElementById('fx-mg-dataviz')?.remove()),
  mgCompare:          (page, rows) => { /* old way vs new way comparison grid */ },
  hideMgCompare:      (page) => page.evaluate(() => document.getElementById('fx-mg-compare')?.remove()),
  mgQuote:            (page, quote, attribution) => { /* customer quote card */ },
  hideMgQuote:        (page) => page.evaluate(() => document.getElementById('fx-mg-quote')?.remove()),
  mgTimeline:         (page, items) => { /* timeline reveal */ },
  hideMgTimeline:     (page) => page.evaluate(() => document.getElementById('fx-mg-timeline')?.remove()),

  // CATEGORY 9 — Subtitle / Caption
  subtitle:           (page, text, durationMs) => { /* see Part 2 */ },
  sceneLabel:         (page, text, subtext) => { /* see Part 2 */ },
  hideSceneLabel:     (page) => page.evaluate(() => document.getElementById('fx-scene-label')?.remove()),
  timelineBar:        (page, pct, on = true) => { /* see Part 2 */ },
  recIndicator:       (page, on = true) => { /* see Part 2 */ },

  // CATEGORY 10 — ffmpeg grades
  grades,
};

module.exports = { FX };
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
### FILE 5: render-video.js — Main renderer (v6 structure)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The structure follows v5 with these v6 additions:
1. `STORY_MODE` constant: 'problem-led' | 'feature-led' | 'result-led'
2. `TOTAL_SCENES` constant: compute before recording starts (for timelineBar %)
3. `TIMELINE_PCT` variable: incremented by `100 / TOTAL_SCENES` each scene
4. Motion graphic interludes between every use-case (Pattern A/B/C/D/E)
5. `FX.subtitle()` called after every `type()` call with matching voiceover text
6. `FX.sceneLabel()` at the start of every use-case navigation
7. `FX.timelineBar(page, TIMELINE_PCT)` updated every scene change
8. Impact summary uses `FX.decimalCounter` instead of `FX.animateCounter` for decimal precision

```js
const { chromium } = require('PLAYWRIGHT_PATH');
const { execSync }  = require('child_process');
const path = require('path'), fs = require('fs');
const { FX }        = require('./public/fx');

const W = 1280, H = 720, SRV = 'SERVER_URL';
const OUT = path.join(__dirname, 'OUTPUT.mp4');
const TMP = path.join(__dirname, 'video-tmp-raw');
const EFFECTS_LEVEL = 'EFFECTS_LEVEL'; // 'essential' | 'full' | 'cinematic'
const STORY_MODE    = 'STORY_MODE';    // 'problem-led' | 'feature-led' | 'result-led'

// ── Brand ─────────────────────────────────────────────────────────────────
FX.setBrand('BRAND_HEX', BR, BG, BB);

// ── Store keys ─────────────────────────────────────────────────────────────
const DEMO_LS = JSON.stringify({ state:{ hasSeenWelcome:true }, version:0 });
const AUTH_LS = JSON.stringify({
  state:{ user:{ id:'demo', firstName:'Demo', role:'ADMIN', email:'demo@app.com' },
          accessToken:'demo-token', isAuthenticated:true }, version:0 });
const LS = { demo:'DEMO_STORE_KEY', auth:'AUTH_STORE_KEY', guide:'GUIDE_DISMISS_KEY' };

// ── Pacing ─────────────────────────────────────────────────────────────────
const PACE = { /* ... see Part 2 ... */ };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const PT = makePatternTracker();

// ── Timeline tracking (NEW in v6) ─────────────────────────────────────────
const TOTAL_SCENES = USE_CASE_COUNT * 5 + 4; // title + mg + N*(5 sub-scenes) + impact + outro
let TIMELINE_PCT = 0;
function advanceTimeline(page, steps = 1) {
  TIMELINE_PCT = Math.min(98, TIMELINE_PCT + (100 / TOTAL_SCENES) * steps);
  return FX.timelineBar(page, TIMELINE_PCT);
}

// ── (All v5 helper functions: killModal, nav, smoothScroll, iframeClick, etc.) ──

// ── ucTitle — show use-case title card (v6: includes problem statement) ───
async function ucTitle(page, num, total, title, sub, stats, problemText) {
  if (EFFECTS_LEVEL !== 'essential') await FX.fadeToBlack(page, 300);
  await page.goto(`${SRV}/use-case-title.html`, { waitUntil:'load' });
  await page.evaluate(({ num, total, title, sub, stats, problem }) => {
    document.getElementById('ucNum').textContent   = `Use Case ${num} of ${total}`;
    document.getElementById('ucTitle').textContent = title;
    document.getElementById('ucSub').textContent   = sub;
    document.getElementById('ucStats').innerHTML   = stats.map(s =>
      `<div class="stat"><div class="sv">${s.v}</div><div class="sl">${s.l}</div></div>`
    ).join('');
    const pb = document.getElementById('ucProblem');
    if (pb) pb.innerHTML = problem || '';
    ['ucNum','ucTitle','ucSub','ucStats'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return; el.style.animation = 'none'; el.offsetHeight; el.style.animation = '';
    });
  }, { num, total, title, sub, stats, problem: problemText });
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
  await FX.timelineBar(page, TIMELINE_PCT);
  await sleep(600);
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  fs.mkdirSync(TMP, { recursive:true });
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

  // ── SCENE 0: Product title card ─────────────────────────────────────────
  console.log('[0] Title card');
  await page.goto(`${SRV}/title-card.html`, { waitUntil:'load' });
  await FX.initCursor(page);
  await FX.recIndicator(page, true);
  await FX.timelineBar(page, 2);
  if (EFFECTS_LEVEL === 'cinematic') {
    await FX.particles(page, true);
    await FX.aurora(page, true);
    await FX.letterbox(page, true);
    await FX.radialBurst(page, true);
    await sleep(300);
    await FX.scramble(page, 'app-name', 'APP NAME', 800);
    await FX.tilt3d(page, 'app-name', true);
    await FX.wordReveal(page, 'app-tag', 'TAGLINE TEXT', 1200);
  }
  if (EFFECTS_LEVEL === 'full') {
    await FX.wordReveal(page, 'app-tag', 'TAGLINE TEXT', 1000);
  }
  await sleep(PACE.productTitleCard);

  // ── Load video wrapper ──────────────────────────────────────────────────
  await page.goto(`${SRV}/full-video.html`, { waitUntil:'load' });
  await killModal(page);
  await FX.initCursor(page);
  if (EFFECTS_LEVEL === 'cinematic') { await FX.letterbox(page, true); await FX.grain(page, true); }
  await FX.timelineBar(page, 5);
  await sleep(800);

  // ══════════════════════════════════════════════════════════════════════════
  // USE CASE TEMPLATE — repeat for each use case (choose pattern A/B/C/D/E)
  // ══════════════════════════════════════════════════════════════════════════

  console.log('[UC1] [Name]');
  await advanceTimeline(page);

  // Use-case title card (includes problem statement in footer)
  await ucTitle(page, 1, TOTAL, '[Title]', '[Description]', [
    { v:'[STAT1]', l:'[label]' }, { v:'[STAT2]', l:'[label]' },
    { v:'[STAT3]', l:'[label]' }, { v:'[STAT4]', l:'[label]' },
  ], 'Today, <strong>[specific pain]</strong> wastes [N hours/week].');

  // Choose Pattern A / B / C / D / E and execute it here.
  // See Part 3 for full pattern code.

  await advanceTimeline(page, 4); // 4 sub-scenes in this use case

  // ── FINAL SCENE: Impact summary ─────────────────────────────────────────
  console.log('[Final] Impact summary');
  if (EFFECTS_LEVEL !== 'essential') await FX.fadeToBlack(page, 400);
  await page.goto(`${SRV}/title-card.html`, { waitUntil:'load' });
  if (EFFECTS_LEVEL !== 'essential') await FX.fadeFromBlack(page, 400);
  await sleep(3500);

  await page.goto(`${SRV}/full-video.html`, { waitUntil:'load' });
  await killModal(page);
  await FX.initCursor(page);
  if (EFFECTS_LEVEL === 'cinematic') { await FX.letterbox(page, true); await FX.grain(page, true); }
  await FX.timelineBar(page, 92);
  await sleep(800);

  await chip(page, 'Impact Summary');
  await nav(page, `${SRV}/dashboard`);
  await sleep(PACE.navLoad);

  // 4 metrics, alternate L/R, use decimalCounter for precision
  await show(page, 'sumA', 'right');
  if (EFFECTS_LEVEL !== 'essential') await FX.decimalCounter(page, 'sumAval', 0, STAT_A, 0, STAT_A_UNIT);
  await sleep(PACE.impactMetricCard);

  await show(page, 'sumB', 'left');
  if (EFFECTS_LEVEL !== 'essential') await FX.decimalCounter(page, 'sumBval', 0, STAT_B, 1, STAT_B_UNIT);
  await sleep(PACE.impactMetricCard);

  await hide(page, 'sumA'); await sleep(PACE.modalKillWait);
  await show(page, 'sumC', 'right');
  if (EFFECTS_LEVEL !== 'essential') await FX.decimalCounter(page, 'sumCval', 0, STAT_C, 0, STAT_C_UNIT);
  if (EFFECTS_LEVEL !== 'essential') await FX.emojiBurst(page, 160, 500, '🎉', 8);
  await sleep(PACE.impactMetricCard);

  await hide(page, 'sumB'); await sleep(PACE.modalKillWait);
  await show(page, 'sumD', 'left');
  if (EFFECTS_LEVEL !== 'essential') await FX.decimalCounter(page, 'sumDval', 0, STAT_D, 1, STAT_D_UNIT);
  if (EFFECTS_LEVEL === 'cinematic') await FX.neonStat(page, 'sumDval', true);
  await sleep(withSlowdown(PACE.impactMetricCard, ['dollarOrPercentResult']));

  await hide(page, 'sumC'); await hide(page, 'sumD');
  await hideChip(page);
  await FX.timelineBar(page, 100);
  await sleep(PACE.outroDelay);

  // ── Encode ─────────────────────────────────────────────────────────────
  console.log('\nStopping recording...');
  await ctx.close(); await browser.close();

  const webm = fs.readdirSync(TMP).find(f => f.endsWith('.webm'));
  if (!webm) { console.error('No webm found'); process.exit(1); }

  const GRADE_KEY = { essential:'none', full:'vibrance', cinematic:'warmHollywood' }[EFFECTS_LEVEL];
  const GRADE = FX.grades[GRADE_KEY];

  console.log(`Encoding H.264 30fps CRF16 (${EFFECTS_LEVEL} / ${GRADE_KEY} grade)...`);
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
### FILE 6: generate-script.js — Voiceover script writer
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Skip if Q6 answer was c (no audio).

**NEW in v6 — Script structure follows Q9 story emphasis:**

- Problem-led: intro → [uc title → problem → demo → result] × N → outro
- Feature-led: intro → capabilities → [uc title → feature demo] × N → outro
- Result-led: outro-first metric → [uc] × N → restate outcome

```js
// (Same as v5 generate-script.js with two additions:)
// 1. Add 'motionGraphic' scene type for MG interlude narration
// 2. Script narration must MAP to the 3-beat rule (Setup 30% / Action 45% / Payoff 25%)
//    within each use case. Voiceover lines:
//    - Setup (before-pain): "Today, [team] [pain]. [Consequence]."
//    - Action (execution): "With [App], [what happens]. [Specific step]."
//    - Payoff (result): "The result: [METRIC]. [What that means for them]."
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
### FILE 7: generate-audio.js — TTS renderer + mixer
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Skip if Q6 answer was c. Same as v5 generate-audio.js.
**NEW in v6:** Read the MG interlude durations from `audio-manifest.json` to ensure
`PACE.mgInterlude` and `PACE.beforeAfterSplit` sleeps are ≥ the voiceover duration for
those scenes. Update those constants in render-video.js after generating audio.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## IRON RULES v6 — 20 rules (16 from v5 + 4 new)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

All 16 v5 rules apply unchanged. Four new rules:

### RULE 17 (NEW): Every VO claim maps to a visible UI moment
Every sentence in the voiceover script that describes a software action MUST have a
corresponding on-screen moment. If the UI isn't showing what the VO says → insert a
motion graphic interlude OR use `FX.annotate` to point at the relevant element.
**Violation: voiceover says "automatically routes invoices" but screen shows a static page.**
**Fix: either navigate to the routing feature, OR show `FX.mgProcess` with routing steps.**

### RULE 18 (NEW): Motion graphic interludes replace dead transitions
Any scene transition longer than 3 seconds that was previously "just a fade between scenes"
must now show a motion graphic interlude: `FX.mgBeforeAfter`, `FX.mgProcess`, or `FX.mgProblem`.
The viewer must never see a black screen + music for more than 1.5 seconds without visuals.
**Violation: `await FX.fadeToBlack(page, 400); await sleep(3000); await FX.fadeFromBlack(page, 400);`**
**Fix: show an MG interlude during the sleep period.**

### RULE 19 (NEW): Timeline bar updates every scene
Call `advanceTimeline(page)` at the start of each new scene. The timeline bar at the bottom
gives viewers a progress anchor — critical for demos > 3 minutes.
**Violation: timeline stays at 0% for the first 90 seconds.**
**Fix: advance by computed percentage each scene change.**

### RULE 20 (NEW): Subtitle captions for every voiceover line (Full/Cinematic only)
At Full or Cinematic effects level, every call to `type()` must be accompanied by a
`FX.subtitle()` call with the same text (or a 5-12 word summary). Fire them concurrently.
```js
// CORRECT:
type(page, 'uc1Lt', 'Full voiceover text...');
if (EFFECTS_LEVEL !== 'essential') FX.subtitle(page, 'Short summary version', PACE.subtitleMedium); // no await
await sleep(PACE.beforePainRead);

// WRONG — subtitle fires after typing is done:
await type(page, 'uc1Lt', '...');
await FX.subtitle(page, '...', 3000);
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## DO NOT DO THESE THINGS (v6 additions to v5 list)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

All v5 prohibitions apply plus:
- Do NOT let the voiceover describe a feature without the feature being VISIBLE on screen
- Do NOT leave more than 1.5 seconds of black screen between scenes — use MG interludes
- Do NOT skip the timeline bar updates — viewers abandon long demos without progress cues
- Do NOT use Pattern A for a feature better suited to Pattern D or E — match the pattern to the UI
- Do NOT show the "before" pain WITHOUT also showing the UI that has the problem (not just the callout)
- Do NOT fire-and-forget `FX.subtitle()` — it must be called concurrently with type(), not after
- Do NOT skip `FX.sceneLabel()` at the start of each use-case section — it orients the viewer

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## EXECUTION CHECKLIST v6
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

```bash
# ── Pre-flight ─────────────────────────────────────────────────────────────
curl -sf SERVER_URL/ > /dev/null && echo "server OK"
ffmpeg -version 2>&1 | head -1
node -e "require('PLAYWRIGHT_PATH')" && echo "playwright OK"
df -h . | awk 'NR==2{print "Disk free:", $4}'

# ── HTML assets ────────────────────────────────────────────────────────────
curl -s -o /dev/null -w "%{http_code}" SERVER_URL/title-card.html      # → 200
curl -s -o /dev/null -w "%{http_code}" SERVER_URL/use-case-title.html  # → 200
curl -s -o /dev/null -w "%{http_code}" SERVER_URL/full-video.html      # → 200
curl -s -o /dev/null -w "%{http_code}" SERVER_URL/fx.js                # → 200

# ── Run ────────────────────────────────────────────────────────────────────
node render-video.js

# ── Audio (if Q6 ≠ c) ─────────────────────────────────────────────────────
node generate-script.js
node generate-audio.js --voice Alex --rate 180
# OR: node generate-audio.js --elevenlabs YOUR_API_KEY --voice rachel

# ── Verify 12 key frames ───────────────────────────────────────────────────
for t in 5 15 30 50 75 100 130 160 195 230 270 310; do
  ffmpeg -y -ss $t -i OUTPUT.mp4 -frames:v 1 /tmp/check_${t}s.png -loglevel error
done
# READ each screenshot — confirm:
# ✓ Title card has scramble text + wave stats (t=5)
# ✓ At least one MG interlude visible (t=15)
# ✓ Wizard steps shown on at least one UC (t=30-75)
# ✓ UI showing the PROBLEM state (pending items, flags) not just a static page
# ✓ UI showing the RESULT state (completed, green board) 
# ✓ At least one AI processing scene (t=100-160, if AI features exist)
# ✓ Timeline bar advancing across frames
# ✓ Scene label badges visible
# ✓ Letterbox bars present at Cinematic level
# ✓ No horizontal scrollbars
# ✓ Board + drawer visible in at least one frame
# ✓ Impact summary with 4 metrics visible (last frames)
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## VIDEO STRUCTURE v6 (~50s per use-case including MG interludes)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

| Segment | Duration | Content | Effect highlights |
|---------|----------|---------|-------------------|
| Product title card | 7s | Scramble name, tagline wordReveal, wave stats | radialBurst, particles, aurora (Cinematic) |
| Dashboard intro | 12s | Overview, 2 callouts, annotate key features | sceneLabel, timelineBar |
| UC N title card | 4.5s | Glitch title, stats, problem footer | glitchText, waveCounterRow |
| MG interlude | 4-5.5s | Before/after split or process diagram | mgBeforeAfter / mgProcess |
| Before pain | 8s | Navigate to workflow, L callout, spotlight | regionFocus, subtitle |
| Execute | 12-16s | Real interaction: wizard/AI/progress | Pattern A-E, annotate, dataStream |
| Result | 8s | R callout + metric flip + emoji burst | statFlip, emojiBurst, successPulse |
| Board + drawer | 5s | Launch Board → openCard → drawer | chip, openCard |
| *(repeat for each UC)* | | | |
| Final title card | 3.5s | Return briefly to product title | fadeToBlack/From |
| Impact summary | 18s | Dashboard + 4 decimal counters alternating | decimalCounter, neonStat, emojiBurst |

**Total:** 8 UCs ≈ 7 min | 4 UCs ≈ 3.5 min | 3 UCs ≈ 2.5 min
