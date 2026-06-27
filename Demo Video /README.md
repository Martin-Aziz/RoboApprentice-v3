# Demo Video Generator v6 — Complete AI Execution Guide

> **How to use this:** Paste the prompt block (between the `===` lines) into Claude Code
> from your project's root directory. The AI reads your app, asks 9 questions, then generates
> and runs a complete product demo video end-to-end without further input.

---

## What this produces

A professional 1280×720 MP4 product launch video — Apple / Stripe / Linear style.
The video records your **real running application**: real clicks, real file uploads, real UI
state changes, real voiceover. Every voiceover claim is paired with a visible UI moment.
Motion graphic interludes fill transitions. Nothing is simulated or mocked.

**Output files (in your project directory after running):**
```
OUTPUT_with_audio_normalized.mp4  ← final deliverable (voice + music + color grade)
OUTPUT.mp4                        ← video-only fallback
preflight-screenshots/            ← app screenshots taken during pre-flight
sample-data/
  *.clean.csv                     ← realistic sample data per workflow
  *.messy.csv                     ← intentionally broken data (shows the "before" state)
audio-scenes/                     ← per-scene WAV files
audio-manifest.json               ← scene start times + actual durations
ambient-music.mp3                 ← generated background music
```

---

## Prerequisites

```bash
brew install ffmpeg              # video encoding + audio mixing
brew install sox                 # optional: procedural ambient music generation
npm install playwright           # browser automation (in your project)
npx playwright install chromium  # headless browser binary
```

---

## Prompt — paste into Claude Code from your project root

Copy everything between the `===` lines and paste it into Claude Code.

===

You are producing a world-class product launch demo video for this web application.
All instructions and code modules are in the folder:

  06-projects/Demo Video /Demo video Skills/v6/

Read the README.md there first. Then execute the four phases in order:

  Phase 0 — Pre-flight        (auto — runs before anything)
  Phase 1 — Discovery         (auto — no questions yet)
  Phase 2 — User Interview    (ask all 9 questions in one message)
  Phase 3 — Code Generation   (generate + run all 7 files)

Module paths (require these in generated files — do NOT modify the originals):
  fx.js              → ./v6/fx.js               (72 effects)
  preflight.js       → ./v6/preflight.js         (pre-flight checks)
  render-progress.js → ./v6/render-progress.js   (recording progress bar)
  start-server.js    → ./v6/start-server.js      (auto server start)
  verify-output.js   → ./v6/verify-output.js     (post-render verification)
  verify-fullscreen  → ./v6/verify-fullscreen.js (viewport clipping checks)
  audio-system/      → ./v6/audio-system/        (voiceover + mixing pipeline)

Do NOT skip phases. Do NOT ask questions before completing Phase 0 and Phase 1.

===

---

## Module Reference

Every file in `v6/` is a drop-in Node.js module. Here is what each does and when the AI should use it.

### `fx.js` — 72 visual effects across 10 categories
```js
const FX = require('./v6/fx');
FX.setBrand('#2563eb', 37, 99, 235); // call once at startup
```
| Category | Effect count | Key new effects in v6 |
|---|---|---|
| 1 Cursor | 5 | — |
| 2 Transitions | 11 | `chromaticAberration`, `swipePush`, `particleExplode` |
| 3 Ambient | 7 | `radialBurst`, `dataStream` |
| 4 Callouts | 11 | `statFlip`, `emojiBurst` |
| 5 UI Highlight | 6 | `annotate` + `hideAnnotate`, `regionFocus` |
| 6 Kinetic Typography | 12 | `wordReveal`, `blurIn`, `splitStagger`, `highlightWord`, `decimalCounter` |
| 8 Motion Graphic Interludes | 8 | `mgBeforeAfter`, `mgProcess`, `mgProblem`, `mgDataViz` (all new) |
| 9 Subtitle / Caption | 4 | `subtitle`, `sceneLabel`, `timelineBar`, `recIndicator` (all new) |
| 10 ffmpeg color grades | 5 | `darkPremium` (new), `fullCinematic` (new) |

**Effects level activation:**
- `essential` → cursor, ripple, particles, bounceIn, sceneLabel, recIndicator, timelineBar, subtitle, wordReveal
- `full` → essential + all transitions, shimmer, counters, arrow, annotate, regionFocus, zoomLens, spotlight, confetti, checkmark, emojiBurst, statFlip, mgBeforeAfter, mgProcess, swipePush, particleExplode, decimalCounter
- `cinematic` → full + letterbox, scramble, tilt3d, glitchText, grain, chromaticAberration, dataStream, radialBurst, splitStagger, blurIn + color grade

---

### `preflight.js` — Pre-flight checks
```js
const { preflight, generateMessyCSV } = require('./v6/preflight.js');

// Run full check (9 sub-checks):
const result = await preflight('http://localhost:3000', ['/', '/dashboard', '/workflows/UC1'], null, {
  screenshotDir: './preflight-screenshots',
  csvOutputDir:  './sample-data',
  csvSpecs:      WORKFLOW_CSV_SPECS,  // custom specs or use built-in defaults
});
if (!result.ok) { console.error('Pre-flight failed'); process.exit(1); }

// result.problemEvidence  → pain-point stats found in source files
// result.mgInterludes     → pending item counts + KPI elements per route
// result.csvFiles         → { clean, messy } paths per spec

// Generate paired clean+messy CSV standalone:
const csvPairs = generateMessyCSV('./sample-data', WORKFLOW_CSV_SPECS);
// csvPairs = [{ clean: '...clean.csv', messy: '...messy.csv' }, ...]
```
The **messy CSV** contains intentional problems (duplicates, missing values, bad date formats,
currency in numeric fields) — used to show the "before" problem state in the demo.

---

### `start-server.js` — Auto server start
```js
const { startServerIfNeeded } = require('./v6/start-server.js');

// Auto-detects Next.js / Vite / CRA, starts if not running, returns URL:
const server = await startServerIfNeeded(process.cwd(), {
  expectedPort:   3000,       // optional — auto-detects from stdout
  startTimeoutMs: 60000,
  verbose:        false,
});
// server = { url, port, spawned, process, ready, killServer }
```
Use this at the top of `render-video.js` so the demo can be run in one command from any state.

---

### `verify-fullscreen.js` — Viewport clipping checks (Playwright)
```js
const { verifyFullScreen } = require('./v6/verify-fullscreen.js');

// Run inside a Playwright page after navigation:
const check = await verifyFullScreen(page, {
  viewportWidth:  1280,
  viewportHeight: 720,
  screenshotPath: './preflight-screenshots/uc1_fullscreen.png',
  applyFixes:     true,   // auto-fixes horizontal overflow, modals, iframe clipping
  resetScroll:    true,
});
// check.ok → false if clipping detected after fixes
// check.fixes → { horizontalOverflow, modals, scroll, iframeOverflow }
```
Run this after each `nav()` call when recording to catch mid-video clipping regressions.

---

### `verify-output.js` — Post-render verification
```js
const { verifyOutput } = require('./v6/verify-output.js');

// Run after render-video.js completes:
const result = await verifyOutput('./OUTPUT.mp4', {
  frameCount:   12,                          // frames to extract
  framesDir:    './preflight-screenshots',
  minSizeBytes: 1_048_576,
});
// result.ok → false if file missing, too small, wrong resolution, or no frames
// result.frames → array of extracted PNG paths for visual inspection
```
Always run this at the end of `render-video.js` before reporting the video as done.

---

### `render-progress.js` — Recording progress bar
```js
const { createSceneProgress } = require('./v6/render-progress.js');

const sp = createSceneProgress([
  { name: 'AP Reconciliation', scenes: ['MG Interlude', 'Before Pain', 'Execute', 'Result', 'Board'] },
  { name: 'Payroll Audit',     scenes: ['MG Interlude', 'AI Processing', 'Result', 'Board'] },
]);
sp.start();
sp.logScene('MG Interlude', ['mgBeforeAfter', 'subtitle']);  // prints scene start
sp.nextScene();      // advance one scene
sp.nextUseCase();    // jump to next use-case
sp.done();           // finish + print total time
```
New in v6: `logScene(name, effectsUsed)` prints `▶ MG Interlude  [mgBeforeAfter, subtitle]`
and the progress bar colour-codes scene types (MG Interlude → magenta, AI Processing → violet).

---

### `audio-system/generate-voiceover-script.js` — Script writer
```js
const { generateVoiceoverScript, estimateDuration } = require('./v6/audio-system/generate-voiceover-script.js');

const script = generateVoiceoverScript('FinFlow', [
  {
    id:         'uc1',
    title:      'AP Reconciliation',
    painPoint:  'invoices matched by hand across three spreadsheets',
    action:     'invoices are auto-matched against purchase orders with ML fallback',
    outcome:    'a full month reconciled in 28 minutes with a full audit trail',
    boardLabel: 'AP Reconciliation board',
  },
  // ... more use-cases
]);
// Returns: { intro, useCases: [{titleCard, beforePain, execution, result, board}], outro }
// Each scene has: { text, duration_ms } ready for TTS

// Write to disk for the audio pipeline:
const fs = require('fs');
fs.writeFileSync('./script.json', JSON.stringify(script, null, 2));
```

---

### `audio-system/mix-audio.js` — Full audio mixer
```js
// CLI — run after render-video.js and TTS generation:
node ./v6/audio-system/mix-audio.js \
  --manifest ./audio-manifest.json \
  --video    ./OUTPUT.mp4 \
  --music    ./ambient-music.mp3 \
  --out      ./OUTPUT_with_audio.mp4

// --dry-run  prints the ffmpeg command without running it
```
Mixing chain: voiceover scenes (adelay to timestamps) + sidechain-ducked background music
(threshold=0.015, ratio=6:1, attack=80ms, release=600ms) + UI sound effects at cue points
+ alimiter at -1dBFS + normalize to -14 LUFS.

**UI sound effect cue points** are hardcoded in `SFX_CUES` array inside the file.
The AI should update these to match the rendered video's actual click/success timestamps.

---

### `audio-system/generate-audio-say.sh` — macOS TTS
```bash
# Q6 answer (a): macOS say
bash ./v6/audio-system/generate-audio-say.sh --voice Alex --rate 180 --script ./script.json
```

### `audio-system/generate-audio-elevenlabs.js` — Neural TTS
```bash
# Q6 answer (b): ElevenLabs API
node ./v6/audio-system/generate-audio-elevenlabs.js --key YOUR_API_KEY --voice rachel
```

### `audio-system/generate-ambient.sh` — Procedural music via sox
```bash
# Q8 answer (a): ambient tech drone
bash ./v6/audio-system/generate-ambient.sh --out ./ambient-music.mp3
```

---

## Phase 0 — Pre-flight

```js
const { startServerIfNeeded } = require('./v6/start-server.js');
const { preflight }           = require('./v6/preflight.js');

// 1. Auto-start server
const server = await startServerIfNeeded(process.cwd(), { verbose: false });
if (!server.ready) { console.error('Server failed to start'); process.exit(1); }

// 2. Full pre-flight
const check = await preflight(server.url, DETECTED_ROUTES, null, {
  csvOutputDir: './sample-data',
  csvSpecs:     WORKFLOW_CSV_SPECS,
});
if (!check.ok) { console.error('Pre-flight failed'); process.exit(1); }

console.log('Problem evidence found:', check.problemEvidence);
console.log('MG interlude data:', check.mgInterludes);
```

**Stop and report if any check fails. Do not proceed to Discovery.**

---

## Phase 1 — Discovery

Run ALL steps before asking any questions:

### 1a–1b. App name + all routes
```bash
node -e "const p=require('./package.json');console.log(p.name,p.description)"
find src/app -name "page.tsx" | grep -v "[" | sort
```

### 1c–1d. Store keys + modal dismiss keys (CRITICAL for suppression)
```bash
grep -rn '"name"' src/store/ --include="*.ts" --include="*.tsx" 2>/dev/null
grep -rn "hasSeenWelcome\|modalDismissed\|localStorage.setItem" src/ --include="*.ts" --include="*.tsx" | grep -v node_modules | head -15
```

### 1e. Screenshot every page with modal suppression
Before any screenshot inject:
```js
await page.evaluate(() => {
  localStorage.setItem('DEMO_KEY', JSON.stringify({state:{hasSeenWelcome:true},version:0}));
  localStorage.setItem('AUTH_KEY', JSON.stringify({state:{isAuthenticated:true,user:{firstName:'Demo',role:'ADMIN'}},version:0}));
  localStorage.setItem('GUIDE_KEY', 'true');
});
```
Then run `verifyFullScreen(page, { applyFixes: true })` on each route.

### 1f–1g. Interactive elements + WorkflowCta upload check
```bash
# Read each workflow page.tsx
# Look for: file inputs, wizards, stepper, Launch Board, AI/smart features
cat src/components/workflows/workflow-cta.tsx 2>/dev/null
# If no file input in WorkflowCta → add one BEFORE any renderer files
```

### 1h. Problem evidence (for callout pain numbers)
```bash
grep -rn "hours\|minutes\|errors\|manual\|pending\|flagged" src/ --include="*.tsx" | grep -v "node_modules\|\.test\." | head -20
```

### 1i. CSV samples — generate clean + messy pairs
```js
const { generateMessyCSV } = require('./v6/preflight.js');
generateMessyCSV('./sample-data', WORKFLOW_CSV_SPECS);
```

### 1j. Brand color + iframe scale
```bash
grep '\-\-primary\b' src/app/globals.css | head -3
# scale = 1280 / APP_NATURAL_WIDTH
```

---

## Phase 2 — User Interview (9 questions, one message)

```
Scanned your project. Here's what I found:
• App name: [DETECTED]            Server: [URL:PORT]
• Store keys: [AUTH, DEMO, GUIDE]
• Use-cases: [LIST — route + description + real stats from screenshots]
• Interactive elements: [per UC — file inputs, wizard steps, AI features, CTAs]
• Problem evidence: [real pain numbers from source: "28 hours/week", "12% error rate"]
• WorkflowCta: [has upload / needs upload added]
• CSV pairs: [will generate clean + messy for each workflow]
• Brand: [HEX]  iframe scale: [SCALE]  Playwright: [PATH]

Q1 — Scope: (a) All use-cases ~6min  (b) Top 3-4 ~3.5min  (c) Custom list
Q2 — Which use-cases? [list] — reply with numbers or "all"
Q3 — Accent color: [DETECTED HEX] or paste another
Q4 — Before/after metrics: I found [LIST] — use these or override?
Q5 — Output filename: [AppName]_Demo_Video.mp4 or specify
Q6 — Voiceover: (a) macOS say (Samantha/Alex/Daniel/Karen/Moira)
                (b) ElevenLabs API — paste key  (Rachel/Adam/Josh)
                (c) None — video only
Q7 — Effects level: (a) Essential  (b) Full  (c) Cinematic (most professional)
Q8 — Background music: (a) Ambient drone via sox  (b) Royalty-free download  (c) None
Q9 — Story emphasis: (a) Problem-led — recommended for sales demos
                     (b) Feature-led — better for investor demos
                     (c) Result-led — best for conference demos
```

---

## Phase 3 — Code Generation (zero questions after Q&A)

### Step 0 (conditional) — Add WorkflowCta upload zone if missing
Before writing any renderer files. Accept CSV/XLS/XLSX, show 0→100% progress bar,
show "✓ data loaded" state, keep Launch Board + Connect ERP buttons.

### Files to generate in order

| # | Filename | Notes |
|---|----------|-------|
| 1 | `public/title-card.html` | 7s product intro — radialBurst, scramble/wordReveal, wave stats, timeline bar, REC indicator |
| 2 | `public/use-case-title.html` | 4.5s per-UC — glitchText, waveCounterRow, problem bar footer |
| 3 | `public/full-video.html` | App iframe + all callout overlays (red/orange/green/ai) + timeline bar |
| 4 | `public/fx.js` | **Copy verbatim from `./v6/fx.js`** — do not modify |
| 5 | `render-video.js` | Main recorder — uses all helper modules |
| 6 | `generate-script.js` | Voiceover script (skip if Q6=c) |
| 7 | `generate-audio.js` | TTS + mixer (skip if Q6=c) |

### `render-video.js` required structure

```js
const { chromium }              = require('PLAYWRIGHT_PATH');
const { execSync }              = require('child_process');
const FX                        = require('./public/fx');
const { startServerIfNeeded }   = require('./v6/start-server');
const { preflight }             = require('./v6/preflight');
const { createSceneProgress }   = require('./v6/render-progress');
const { verifyFullScreen }      = require('./v6/verify-fullscreen');
const { verifyOutput }          = require('./v6/verify-output');
const path = require('path'), fs = require('fs');

// ── Config ──────────────────────────────────────────────────────────
const W = 1280, H = 720;
const EFFECTS_LEVEL = 'ANSWER_Q7';   // 'essential' | 'full' | 'cinematic'
const STORY_MODE    = 'ANSWER_Q9';   // 'problem-led' | 'feature-led' | 'result-led'
const GRADE_MAP = { essential: 'none', full: 'vibrance', cinematic: 'warmHollywood' };

// ── Startup ─────────────────────────────────────────────────────────
FX.setBrand('BRAND_HEX', BR, BG, BB);
const server = await startServerIfNeeded(process.cwd());
const SRV = server.url;
const OUT = path.join(__dirname, 'APP_NAME_Demo_Video.mp4');

// ── Scene progress ───────────────────────────────────────────────────
const sp = createSceneProgress(USE_CASE_DEFS);
sp.start();

// ── Timeline ────────────────────────────────────────────────────────
let TIMELINE_PCT = 0;
const TOTAL_SCENES = UC_COUNT * 5 + 4;
async function advanceTimeline(page, steps = 1) {
  TIMELINE_PCT = Math.min(98, TIMELINE_PCT + (100 / TOTAL_SCENES) * steps);
  await FX.timelineBar(page, TIMELINE_PCT);
}

// ── All pacing constants, helpers (killModal, nav, smoothScroll,
//    iframeClick, injectFileToIframe, progressBar, activateStep,
//    openCard, chip, hideChip, show, hide, type, ucTitle) ──────────

// ── main() ──────────────────────────────────────────────────────────
async function main() {
  // 1. Browser launch with recordVideo
  // 2. Scene 0: title card
  // 3. Per-UC: ucTitle → MG interlude → pattern A-E → board
  // 4. Impact summary
  // 5. Stop recording + ffmpeg encode
  // 6. verifyOutput() — check resolution, duration, extract frames
  sp.done();
}
main().catch(e => { sp.error(e.message); process.exit(1); });
```

---

## Interaction Patterns

### Pattern A — Full Wizard
Upload → column map → preview → import → board.
```
MG interlude (mgBeforeAfter) → nav → sceneLabel → show red callout (pain)
→ spotlight → sleep(beforePainRead) → annotate upload zone → click Import
→ injectFileToIframe → show orange callout → activateStep × N
→ Promise.all([progressBar, smoothScroll]) → confetti + checkmark + emojiBurst
→ show green callout → statFlip → successPulse → Launch Board → openCard
```

### Pattern B — Workflow Stepper
Numbered steps scrolling, no file wizard.
```
Same as A but activateStep synced with smoothScroll.
End with injectFileToWorkflowCta → confetti → Launch Board → openCard.
```

### Pattern C — Progress Bar Only
Validation/processing-heavy workflows.
```
show orange callout → Promise.all([progressBar(7s), 3× smoothScroll])
→ confetti → show green callout → Launch Board → openCard.
```

### Pattern D — Quick Demo
1-2 click feature with immediate result.
```
mgProcess diagram → nav → show red callout → zoomLens on button
→ annotate button label → clickTargetRings + clickRipple + click
→ show green callout → emojiBurst.
```

### Pattern E — AI Magic Reveal
Auto-classify, detect, suggest, generate features.
```
nav → show red callout → spotlight → chip('AI Processing','ai')
→ dataStream(on) → show ai callout with ai-dots → sleep(aiMagicReveal 2.5s)
→ chromaticAberration (Cinematic) → dataStream(off)
→ show green callout → particleExplode + emojiBurst → Launch Board → openCard.
```

---

## 20 Iron Rules — violating any of these silently breaks the video

| # | Rule |
|---|------|
| 1 | Modal suppression is **3 layers**: inject LS in parent before iframe.src, inject in iframe.contentWindow after load, click dismiss buttons. Never skip. |
| 2 | `type()` is **always fire-and-forget** — never `await type(...)`. |
| 3 | **700ms gap** between same-side callouts: hide → sleep(700) → show. |
| 4 | progressBar + smoothScroll must be **parallel**: `Promise.all([...])`. |
| 5 | Wizard must show **ALL steps** — upload → map → preview → import → done. |
| 6 | WorkflowCta **must have local file upload** — add it if missing. |
| 7 | Every UC ends with **Launch Board + card drawer open**. |
| 8 | Unique callout IDs per UC: `uc1L/uc1R/uc1Res`, `uc2L/...`, etc. |
| 9 | `headless:true` always — macOS kills idle windows after ~60s. |
| 10 | iframe src must be **absolute URL** — `http://localhost:PORT/path`. |
| 11 | Always use `smoothScroll()` — never raw `scrollBy`. |
| 12 | PACE constants are **minimums** — add `withSlowdown()` for novel UI, charts, dollar amounts. |
| 13 | Every VO claim needs a **visible UI moment** — if UI not showing it, show MG interlude or use `annotate()`. |
| 14 | No black screen > 1.5s — use `mgBeforeAfter` or `mgProcess` to fill transitions. |
| 15 | **Timeline bar advances every scene** — call `advanceTimeline(page)` at each scene. |
| 16 | **Subtitle captions fire concurrently with `type()`** at Full/Cinematic — never after. |
| 17 | Run `verifyFullScreen(page)` after each nav — catch clipping before it reaches the encode. |
| 18 | Run `verifyOutput()` after ffmpeg — confirm 1280×720, 30fps, >1MB, readable frames. |
| 19 | Audio cue points in `mix-audio.js SFX_CUES` must be **updated to match actual video timestamps** before mixing. |
| 20 | `sp.logScene()` and `sp.nextScene()` must be called at every scene boundary for accurate progress reporting. |

---

## Full Execution Sequence

```bash
# 1. Prerequisites check
ffmpeg -version | head -1
sox --version 2>/dev/null || echo "sox not installed (optional)"
node -e "require('@playwright/test')" && echo "playwright OK"

# 2. Verify HTML assets are served by the app
curl -s -o /dev/null -w "%{http_code}" SERVER_URL/title-card.html      # 200
curl -s -o /dev/null -w "%{http_code}" SERVER_URL/use-case-title.html  # 200
curl -s -o /dev/null -w "%{http_code}" SERVER_URL/full-video.html      # 200
curl -s -o /dev/null -w "%{http_code}" SERVER_URL/fx.js                # 200

# 3. Record
node render-video.js

# 4. Generate voiceover (if Q6 ≠ c)
node generate-script.js
# macOS say:
node generate-audio.js --voice Alex --rate 180
# OR ElevenLabs:
node generate-audio.js --elevenlabs YOUR_KEY --voice rachel

# 5. Mix audio (update SFX_CUES first, then):
node ./v6/audio-system/mix-audio.js \
  --video ./OUTPUT.mp4 \
  --music ./ambient-music.mp3 \
  --out   ./OUTPUT_with_audio.mp4

# 6. Verify output
node -e "
const { verifyOutput } = require('./v6/verify-output');
verifyOutput('./OUTPUT_with_audio_normalized.mp4', { frameCount: 12, framesDir: './preflight-screenshots' })
  .then(r => { console.log(r.ok ? '✓ Video OK' : '✗ FAILED'); process.exit(r.ok ? 0 : 1); });
"

# 7. Manual spot-check (READ each screenshot in Claude Code)
for t in 5 15 30 50 75 100 130 160 200 240 280 320; do
  ffmpeg -y -ss $t -i OUTPUT_with_audio_normalized.mp4 -frames:v 1 \
    ./preflight-screenshots/spot_${t}s.png -loglevel error 2>/dev/null
done
```

**Spot-check visual checklist — READ every screenshot:**
- `t=5` → title card: scramble/wordReveal text, wave stats, radial burst rings visible
- `t=15` → MG interlude: before/after split or process diagram visible (NOT a black screen)
- `t=30` → first UC: UI showing the PROBLEM state (pending items, red flags, manual items)
- `t=50` → wizard steps OR AI processing scene visible — not just static page
- `t=75` → result: green board with completed items, metric callout
- `t=100–160` → additional UCs — verify each follows pattern A-E correctly
- Last 30s → impact summary: 4 glass metric cards with decimal counter values
- All frames → timeline bar advancing, scene label badges visible, no horizontal scrollbars
- Cinematic level → letterbox bars present

---

## Video Structure

| Segment | Duration | Key effects used |
|---------|----------|-----------------|
| Product title card | 7s | radialBurst, scramble or wordReveal, aurora, particles, wave stats, REC indicator |
| *(per use-case × N)* | | |
| UC title card | 4.5s | glitchText, waveCounterRow, problem footer |
| MG interlude | 4–5.5s | mgBeforeAfter **or** mgProcess |
| Before pain | 8s | regionFocus, spotlight, sceneLabel, subtitle |
| Execute | 12–16s | Pattern A–E + annotate + dataStream (AI) + progressBar |
| Result | 8s | statFlip, emojiBurst, successPulse, confetti |
| Board + drawer | 5s | chip, openCard |
| Final title card | 3.5s | fadeToBlack/From |
| Impact summary | 18s | decimalCounter ×4, neonStat, emojiBurst |

**Total runtime:** 3 UCs ≈ 2.5 min | 4 UCs ≈ 3.5 min | 6 UCs ≈ 5 min | 8 UCs ≈ 7 min

---

## What to add next (known gaps + improvements)

### High priority — will noticeably improve output quality
1. **SFX library** — add `public/sfx/click.wav`, `success.wav`, `processing.wav`. Currently
   `mix-audio.js` references them but the files aren't generated. Either record them from
   macOS System Sounds or download from Freesound. Add a `generate-sfx.sh` that copies them
   from `/System/Library/Sounds/`.
2. **Keyboard shortcut badges** — add `FX.kbdBadge(page, keys, nearX, nearY)` to fx.js.
   Shows a `⌘K`-style pill near a UI element when the narrator mentions shortcuts.
   Extremely effective for power-user feature demos.
3. **Ambient UI breathing** — add `FX.breathe(page, selector)` that applies subtle
   scale(1.0)→scale(1.04)→scale(1.0) infinite pulse to badges, notification dots, timestamps.
   Prevents static holds from looking like frozen screenshots.
4. **Camera parallax drift** — add an ffmpeg post-processing step that applies a slow
   `zoompan=z='zoom+0.001':x='iw/2-(iw/zoom/2)'` drift to the final video. Makes the
   entire recording look slightly filmed rather than screen-captured.

### Medium priority — better AI coder guidance
5. **Before-state screenshot injection** — currently the "pain" callout describes the problem
   with text. Instead, have the AI inject a mini-screenshot (the messy CSV thumbnail or a
   red-flagged table) directly into the callout card `<div>` before the red callout appears.
6. **Voiceover sync validation** — after generating `audio-manifest.json`, compare each
   scene's `duration_ms` against its corresponding `PACE` constant and auto-adjust if the
   audio is longer than the sleep. Add this as a post-TTS step in `generate-audio.js`.
7. **Export thumbnail** — after `verifyOutput()`, extract a single representative frame at
   30% of video duration and save as `THUMBNAIL.jpg` for use in video hosting uploads.

### Nice to have — polish
8. **Multi-language voiceover** — `generate-audio-elevenlabs.js` already supports API calls;
   add a `--lang` flag that swaps the script to a translated version via Claude API before TTS.
9. **Chapter markers** — write an `.ffmetadata` file mapping use-case titles to timestamps,
   then pass `-i metadata.txt -map_metadata 1` to ffmpeg so the MP4 has native chapter support.
10. **Auto-upload script** — add `upload-to-drive.js` that posts the final MP4 to Google Drive
    or Dropbox using their CLI tools, printing a shareable link at the end.

---

## Complete file tree (v6/)

```
v6/
├── README.md                          ← this file
├── fx.js                              ← 72 effects (copy to public/fx.js)
├── preflight.js                       ← pre-flight + messy CSV generation
├── render-progress.js                 ← real-time progress bar
├── start-server.js                    ← auto-start Next.js/Vite/CRA server
├── verify-output.js                   ← post-render MP4 validation
├── verify-fullscreen.js               ← viewport clipping detection + auto-fix
└── audio-system/
    ├── generate-voiceover-script.js   ← script writer → script.json
    ├── mix-audio.js                   ← ffmpeg audio mixer (VO + music + SFX)
    ├── generate-audio-say.sh          ← macOS say TTS
    ├── generate-audio-elevenlabs.js   ← ElevenLabs neural TTS
    ├── generate-ambient.sh            ← sox procedural ambient music
    ├── music-sources.js               ← royalty-free music URL list
    ├── script.json                    ← example script (FinFlow demo)
    └── audio-manifest.json            ← example manifest format
```

**Prompt files (reference — do not paste these; use the prompt block at the top):**
```
Demo video Skills/
├── demo-video-prompt-v6-part1.md  ← phases 0-2, discovery, Q&A
├── demo-video-prompt-v6-part2.md  ← 72 effects arsenal with full implementations
├── demo-video-prompt-v6-part3.md  ← code generation + 5 interaction patterns
└── demo-video-prompt-v6-part4.md  ← iron rules + execution checklist + video structure
```
