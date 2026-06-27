# Universal Product Demo Video Generator v6
# Apple / Stripe / Linear launch film style. Real UI. Real interactions. Real voiceover.
# WHAT'S NEW IN v6:
#   → 72 effects across 10 categories (was 42 across 7)
#   → Problem-First Architecture: pain SHOWN on screen, not just described
#   → UI Spotlight Protocol: every VO claim maps to a visible UI moment
#   → Kinetic Typography System: 12 new text animation primitives
#   → Motion Graphics Interlude: full-screen MG scenes when UI isn't visible
#   → Voiceover-Sync Engine: scene timing driven by audio manifest, not estimates
#   → Emoji Burst + Icon Animation layer
#   → Before/After Split-Screen overlay
#   → Micro-interaction capture: typing simulation, hover states, loading pulses
#   → Extended color grades: 5 looks including cool-dark and vibrant gradient
#   → 5 new interaction patterns (was 3): wizard, stepper, progress, quick-demo, ai-magic
#   → Subtitle/caption pop-in synchronized to voiceover
# Paste everything BELOW the === line into Claude Code from your project directory.
# ─────────────────────────────────────────────────────────────────────────────────────────

===

You are producing a world-class product launch video for this web application.
Style: Apple / Stripe / Linear launch film. The REAL application UI is the hero.
Every use-case is EXECUTED live — not explained. You upload real files, advance through
wizard steps, show processing progress, click "Launch Board", and open a card to reveal
result states. Glass-morphism overlay cards with live-typing text explain each step.
A professional voiceover narrates concurrently.

THE ONE RULE YOUR VIDEO MUST FOLLOW:
  Every claim the voiceover makes → a matching UI moment must be VISIBLE on screen.
  When the UI isn't showing (title cards, transitions) → motion graphic interludes fill the gap.
  This is a sales video. Viewers must BELIEVE the software works AND understand its value.

Work through four phases: Pre-flight → Discovery → User Interview → Code Generation.
Do NOT skip phases. Do NOT ask questions before completing Pre-flight and Discovery.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## PHASE 0 — PRE-FLIGHT VERIFICATION (runs before anything else)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### 0a. Find and start the server (auto-start if not running)
```bash
for port in 3000 3001 3031 4000 5173 8080 8000; do
  code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$port/ 2>/dev/null)
  [[ "$code" =~ ^(200|307|308)$ ]] && echo "FOUND: $port" && break
done
# If not found: npm run dev &  OR  npm start &
# Then poll: for i in {1..30}; do sleep 2; curl -sf http://localhost:3000/ && break; done
```

### 0b. Verify dependencies
```bash
ffmpeg -version 2>&1 | head -1 || echo "MISSING: brew install ffmpeg"
node -e "require('@playwright/test')" 2>/dev/null && echo "playwright OK" || \
  find . -path "*/node_modules/@playwright/test/package.json" 2>/dev/null | head -3
df -h . | awk 'NR==2{print "Free:", $4}'
sox --version 2>/dev/null || echo "OPTIONAL: brew install sox"
```

### 0c. Verify full-screen capture (no clipping, no scrollbars)
```bash
# Screenshot homepage, confirm renders at 1280px with no horizontal scroll
# If scrollWidth > 1280: scale = 1280 / scrollWidth → inject in full-video.html
```

### 0d. Pre-flight summary
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
Read `<title>`, `package.json → name`, `README.md → H1`. Use most human-readable.

### 1b. Server port (found in Phase 0)
Record as SERVER_URL for all subsequent steps.

### 1c. Zustand persist store keys — CRITICAL for modal suppression
```bash
grep -rn "name:" src/store/ --include="*.ts" --include="*.tsx" | grep -i "persist\|name:"
```

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
- **Stepper components** — numbered workflow steps
- **WorkflowCta / "Try it on your data"** — "Launch Board" + "Connect your ERP" buttons
- **Board cards** — draggable, clickable to open analysis/detail drawers
- **Processing states** — progress bars, spinners, status badges
- **AI/Smart features** — auto-classify, suggest, detect buttons (highest demo value)

### 1g. Check if WorkflowCta has local file upload
```bash
cat src/components/workflows/workflow-cta.tsx
```
**If WorkflowCta only has "Launch Board" and "Connect your ERP" with no file upload:**
Add a drag-drop upload zone + processing animation to WorkflowCta BEFORE generating
the renderer. Every workflow must have a local upload option. The upload zone must:
- Accept CSV/XLS/XLSX
- Show a processing animation (progress bar 0→100%)
- Show a green "✓ data loaded to board" state when done
- Keep the "Launch Board" and "Connect your ERP" buttons

### 1h. Find CSV sample files + AI demo data
```bash
find . -name "*.csv" | grep -v node_modules | grep "public\|test-data\|sample\|mock" | head -20
```
If not enough, generate realistic CSV matching each workflow.
**NEW in v6:** Also generate a "messy" CSV with intentional errors for before/after demonstration.
The messy CSV shows the PROBLEM state (duplicate entries, wrong formats, missing fields).
The clean CSV shows the SOLVED state after the software processes it.

### 1i. Playwright path
```bash
node -e "require('@playwright/test')" 2>/dev/null && echo "root OK" || \
  find . -path "*/node_modules/@playwright/test/package.json" 2>/dev/null | head -3
```

### 1j. Brand color + iframe scale
```bash
grep '\-\-primary\b' src/app/globals.css -h | head -3
grep -r "max-w\|1280\|1400\|1440\|1920" src/app/layout.tsx 2>/dev/null | head -5
```
iframe scale formula: `scale = 1280 / APP_NATURAL_WIDTH`

### 1k. NEW — Problem Evidence Collection (for before/after storytelling)
For each use-case, collect VISUAL EVIDENCE of the problem:
```bash
# Find any dashboard stats showing volume, error rate, processing time
grep -rn "hours\|minutes\|days\|errors\|manual\|% of\|rate" src/ --include="*.tsx" | head -20
```
- What numbers prove the problem exists? (hours saved, error reduction, volume handled)
- What UI state shows the "messy before" (status PENDING, flags, manual overrides)?
- What UI state shows the "clean after" (status COMPLETE, all green, auto-processed)?
These before/after states become the visual anchors for each use-case's callouts.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## PHASE 2 — USER INTERVIEW (one message, all 9 questions)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

---
**Scanned your project. Here's what I found:**
- App name: [DETECTED]
- Server: [URL:PORT]
- Store keys (modal suppression): [AUTH_KEY, DEMO_KEY, GUIDE_KEY]
- Use-cases detected: [LIST — route + one-line description + real stats from screenshots]
- Interactive elements per use-case: [LIST — file inputs, wizard steps, CTA buttons, board cards, AI features]
- Problem evidence found: [LIST — metrics, pending states, error counts from discovery]
- WorkflowCta status: [Has upload zone / Needs upload zone added]
- CSV sample files: [LIST or "will generate clean + messy versions"]
- Brand color: [HEX]
- iframe scale: [SCALE] (for 1280px output from [WIDTH]px app)
- Playwright path: [PATH]
- Pre-flight: [all green / issues found]

**9 questions:**

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
a) macOS `say` (free, built-in, zero setup)
   Voices: Samantha (warm/natural), Alex (clear/confident), Daniel (British/polished),
   Karen (Australian/friendly), Moira (Irish/distinctive)
b) ElevenLabs API (neural, highest quality) — paste your API key after answering
   Best voices: Rachel (warm professional), Adam (authoritative), Josh (deep/confident)
c) No audio — video only

**Q7 — Visual effects level?**
a) Essential — animated cursor + click ripples + floating particles + callout bounce-ins + kinetic text titles
b) Full — Essential + scene transitions + shimmer callouts + stat counters + zoom lens + emoji bursts + motion graphic interludes + subtitle captions
c) Cinematic — Full + letterbox bars + 3D title tilt + scramble text + color LUT + film grain + split-screen before/after + AI magic reveal + chromatic aberration flash
   (most professional, closest to an Apple product video)

**Q8 — Background music?**
a) Ambient tech drone (procedural via `sox`, always available)
b) Royalty-free corporate (download from Pixabay/Mixkit — exact command provided)
c) No music

**Q9 — NEW — Story emphasis:**
a) Problem-led (start with the pain, let the software be the hero) — recommended for sales demos
b) Feature-led (open with capabilities, show the workflow) — better for investor demos
c) Result-led (open with the outcome metric, flashback to how) — best for conference demos
---
