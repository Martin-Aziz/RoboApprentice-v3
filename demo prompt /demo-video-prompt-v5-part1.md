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
