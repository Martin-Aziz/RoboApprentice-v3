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
