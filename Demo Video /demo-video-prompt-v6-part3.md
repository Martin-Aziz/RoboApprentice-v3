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
4 key metrics row (wave-in), "Month YEAR" date stamp, cinematic letterbox if Cinematic.
Colors: `background:#060d14`, `brand: BRAND_HEX`.

**NEW in v6:** Include the REC indicator (top-right) + Timeline bar (bottom) + scene label badge.
Also include a subtle radial burst ring animation behind the orb.

```html
<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
* { margin:0; padding:0; box-sizing:border-box; }
html, body { width:1280px; height:720px; overflow:hidden;
  background:#060d14; font-family:'Helvetica Neue',Arial,sans-serif; }
/* Grid */
.grid { position:absolute; inset:0;
  background-image:linear-gradient(rgba(BR,BG,BB,.07) 1px,transparent 1px),
    linear-gradient(90deg,rgba(BR,BG,BB,.07) 1px,transparent 1px);
  background-size:60px 60px; animation:gIn 5s ease-out forwards; }
@keyframes gIn { 0%{opacity:0} 25%{opacity:1} 100%{opacity:.35} }
/* Radial burst rings */
.ring-wrap { position:absolute; inset:0; overflow:hidden; }
.ring { position:absolute;border-radius:50%;border:1px solid rgba(BR,BG,BB,.10);
  top:50%;left:50%;transform:translate(-50%,-50%);
  animation:ringExpand 3.8s linear infinite; }
.ring:nth-child(2){animation-delay:.76s} .ring:nth-child(3){animation-delay:1.52s}
.ring:nth-child(4){animation-delay:2.28s} .ring:nth-child(5){animation-delay:3.04s}
@keyframes ringExpand{from{width:0;height:0;opacity:.5}to{width:1400px;height:1400px;opacity:0}}
/* Orb */
.orb { position:absolute; width:580px; height:580px; border-radius:50%;
  background:radial-gradient(circle,rgba(BR,BG,BB,.14) 0%,transparent 70%);
  top:50%; left:50%; transform:translate(-50%,-50%);
  animation:pulse 3.5s ease-in-out infinite; }
@keyframes pulse { 0%,100%{transform:translate(-50%,-50%) scale(1)} 50%{transform:translate(-50%,-50%) scale(1.12)} }
/* Cinematic 3D tilt applied by renderer */
@keyframes fx-tilt3d {
  0%,100%{transform:perspective(800px) rotateX(2deg) rotateY(-2deg)}
  25%{transform:perspective(800px) rotateX(-1deg) rotateY(2deg)}
  50%{transform:perspective(800px) rotateX(2deg) rotateY(2deg)}
  75%{transform:perspective(800px) rotateX(-2deg) rotateY(-1deg)} }
/* Particles injected by renderer: FX.particles(page, true) */
@keyframes fx-floatUp {
  0%{transform:translateY(0) translateX(var(--drift,20px));opacity:0}
  10%{opacity:.5} 90%{opacity:.3}
  100%{transform:translateY(-720px) translateX(var(--drift,20px));opacity:0} }
.particle { position:absolute; width:3px; height:3px; border-radius:50%;
  background:BRAND_HEX; animation:fx-floatUp var(--dur,12s) linear var(--delay,0s) infinite; }
.bar { position:absolute; top:0; left:0; right:0; height:3px;
  background:linear-gradient(90deg,BRAND_HEX,BRAND_HEX_LIGHT,BRAND_HEX); }
/* Content */
.content { position:absolute; inset:0; display:flex; flex-direction:column;
  align-items:center; justify-content:center; }
.badge { font-size:11px; font-weight:700; letter-spacing:3px; text-transform:uppercase;
  color:BRAND_HEX; border:1px solid rgba(BR,BG,BB,.35); padding:5px 16px; border-radius:20px;
  margin-bottom:24px; background:rgba(BR,BG,BB,.07); animation:fu .8s .2s ease both; }
/* Scramble target */
.name { font-size:64px; font-weight:800; color:white; letter-spacing:-2px; margin-bottom:18px;
  animation:fu .8s .4s ease both; }
.tag { font-size:21px; color:rgba(255,255,255,.48); max-width:660px; text-align:center;
  line-height:1.5; animation:fu .8s .65s ease both; }
.sub { margin-top:12px; font-size:13px; color:rgba(BR,BG,BB,.68); letter-spacing:1px;
  animation:fu .8s .85s ease both; }
/* Wave counter row */
.stats { position:absolute; bottom:60px; display:flex; gap:48px; }
.stat { text-align:center; }
.stat:nth-child(1){animation:waveIn .5s .9s  ease both}
.stat:nth-child(2){animation:waveIn .5s 1.05s ease both}
.stat:nth-child(3){animation:waveIn .5s 1.2s  ease both}
.stat:nth-child(4){animation:waveIn .5s 1.35s ease both}
@keyframes waveIn{from{transform:translateY(20px) scale(.9);opacity:0}to{transform:translateY(0) scale(1);opacity:1}}
.sv { font-size:28px; font-weight:800; color:BRAND_HEX; }
.sl { font-size:10px; color:rgba(255,255,255,.30); letter-spacing:2px; text-transform:uppercase; margin-top:3px; }
/* Timeline bar (bottom) */
#tl-bar { position:absolute; bottom:0; left:0; right:0; height:2px; background:rgba(255,255,255,.08); }
#tl-fill { height:100%; background:BRAND_HEX; width:2%; transition:width .8s linear; }
/* REC indicator */
#rec-badge { position:absolute; top:22px; right:22px; display:flex; align-items:center; gap:6px; }
#rec-dot { width:8px; height:8px; border-radius:50%; background:#ef4444; animation:blink .8s ease-in-out infinite; }
#rec-text { font-size:11px; font-weight:700; letter-spacing:2px; color:rgba(255,255,255,.6); }
@keyframes blink{0%,100%{opacity:1}50%{opacity:.2}}
.date { position:absolute; bottom:26px; right:38px; font-size:12px; color:rgba(255,255,255,.20); letter-spacing:2px; }
@keyframes fu { from{transform:translateY(22px);opacity:0} to{transform:translateY(0);opacity:1} }
/* Cinematic letterbox */
#lb-top,#lb-bot { position:absolute; left:0; right:0; height:78px; background:#000; z-index:10; }
#lb-top { top:0; } #lb-bot { bottom:0; }
</style></head><body>
<div class="ring-wrap"><div class="ring"></div><div class="ring"></div><div class="ring"></div><div class="ring"></div><div class="ring"></div></div>
<div class="grid"></div>
<div class="orb"></div>
<div class="bar"></div>
<div id="rec-badge"><div id="rec-dot"></div><div id="rec-text">REC</div></div>
<div class="content">
  <div class="badge">Product Launch</div>
  <div class="name" id="app-name">[APP NAME]</div>
  <div class="tag" id="app-tag">[ONE-LINE TAGLINE]</div>
  <div class="sub" id="app-sub">[WORKFLOW CATEGORIES — e.g. AP · AR · Payroll · Compliance]</div>
</div>
<div class="stats">
  <div class="stat"><div class="sv" id="stat0">[N]</div><div class="sl">[label]</div></div>
  <div class="stat"><div class="sv" id="stat1">[N%]</div><div class="sl">[label]</div></div>
  <div class="stat"><div class="sv" id="stat2">[Nh]</div><div class="sl">[label]</div></div>
  <div class="stat"><div class="sv" id="stat3">[KEY]</div><div class="sl">[label]</div></div>
</div>
<div id="tl-bar"><div id="tl-fill"></div></div>
<div class="date">[MONTH YEAR]</div>
<!-- Cinematic level only: -->
<!-- <div id="lb-top"></div><div id="lb-bot"></div> -->
</body></html>
```
Replace `BR,BG,BB` with decimal R,G,B of BRAND_HEX. Replace `BRAND_HEX_LIGHT` with a 20% lighter tint.

---

### FILE 2: public/use-case-title.html — Per-use-case intro (4.5s each)

**NEW in v6:** Each title card includes a "Problem Statement" section at the bottom.
The renderer injects: use case number, title (glitch), sub-description, 4 stats, AND
a one-line problem statement that primes the viewer for what they're about to see.

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
  align-items:center; justify-content:center; padding-bottom:80px; }
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
/* NEW: Problem statement bar */
.problem-bar { position:absolute; bottom:0; left:0; right:0; padding:16px 48px;
  background:rgba(220,50,50,.07); border-top:1px solid rgba(220,50,50,.2);
  display:flex; align-items:center; gap:12px;
  opacity:0; animation:fu .7s 1.1s ease forwards; }
.problem-icon { font-size:16px; }
.problem-text { font-size:13px; color:rgba(255,255,255,.55); line-height:1.4; }
.problem-text strong { color:rgba(220,80,80,.9); font-weight:600; }
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
<div class="problem-bar">
  <span class="problem-icon">⚠️</span>
  <div class="problem-text" id="ucProblem"></div>
</div>
</body></html>
```

---

### FILE 3: public/full-video.html — App wrapper + overlay layer

The iframe loads the app (scaled to 1280px). All callouts, chips, cursor dot are overlaid on top.

**iframe scale:** `transform:scale(COMPUTED_SCALE); width:APP_WIDTHpx; height:APP_HEIGHTpx;`

**Callout design system (v6 — enhanced):**
- `.ci.red`    = "Before / Today's Pain" — always bottom-LEFT
- `.ci.orange` = "Live Execution / Processing" — always TOP-RIGHT
- `.ci.green`  = "Result / After" — always bottom-RIGHT
- `.ci` (blue) = Neutral context / AI feature

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

/* Overlay layer */
.overlay { position:absolute; inset:0; pointer-events:none; }

/* Status chip */
#chip { position:absolute; top:22px; left:50%; transform:translateX(-50%);
  font-size:11px; font-weight:700; letter-spacing:2px; text-transform:uppercase;
  padding:6px 18px; border-radius:20px; opacity:0; transition:opacity .4s;
  color:#fff; background:rgba(14,165,233,.18); border:1px solid rgba(14,165,233,.4); }
#chip.exec { background:rgba(240,130,20,.18); border-color:rgba(240,130,20,.4); }
#chip.live { background:rgba(20,190,110,.18); border-color:rgba(20,190,110,.4); }
#chip.ai   { background:rgba(139,92,246,.18); border-color:rgba(139,92,246,.4); }

/* Timeline bar (always visible at bottom) */
#fx-timeline { position:absolute; bottom:0; left:0; right:0; height:2px; background:rgba(255,255,255,.08); }
#fx-timeline-fill { height:100%; background:BRAND_HEX; transition:width .8s linear; width:0%; }

/* Callout cards */
.callout { position:absolute; max-width:340px; opacity:0; pointer-events:none; }
.callout.show { animation:fromBottom .5s ease forwards; }
.callout.fromRight { animation:fromRight .5s ease forwards !important; }
.callout.fromLeft  { animation:fromLeft  .5s ease forwards !important; }
.callout.bounce    { animation:fx-bounceIn .5s cubic-bezier(.34,1.56,.64,1) forwards !important; }
@keyframes fromBottom{ from{transform:translateY(20px);opacity:0} to{transform:translateY(0);opacity:1} }
@keyframes fromRight { from{transform:translateX(20px);opacity:0} to{transform:translateX(0);opacity:1} }
@keyframes fromLeft  { from{transform:translateX(-20px);opacity:0} to{transform:translateX(0);opacity:1} }
@keyframes fx-bounceIn {
  0%{transform:scale(.85) translateY(10px);opacity:0}
  60%{transform:scale(1.04) translateY(-3px);opacity:1}
  80%{transform:scale(.98)}
  100%{transform:scale(1) translateY(0);opacity:1} }

/* Glass-morphism callout body */
.ci { background:rgba(4,14,28,.94); border:1px solid rgba(0,110,220,.38);
  backdrop-filter:blur(18px); border-radius:13px; padding:20px 22px;
  box-shadow:0 8px 40px rgba(0,0,0,.5); }
.ci.green  { border-color:rgba(20,190,110,.50); }
.ci.orange { border-color:rgba(240,130,20,.50); }
.ci.red    { border-color:rgba(210,50,50,.50);  }
.ci.ai     { border-color:rgba(139,92,246,.50); }

/* Shimmer */
@keyframes fx-shimmer { 0%{background-position:-400px 0} 100%{background-position:400px 0} }
.ci.shimmer {
  background-image:linear-gradient(90deg,transparent 0%,rgba(255,255,255,.04) 40%,rgba(255,255,255,.07) 50%,rgba(255,255,255,.04) 60%,transparent 100%);
  background-size:800px 100%; animation:fx-shimmer 2s linear infinite; }

.label { font-size:10px; font-weight:700; letter-spacing:2px; text-transform:uppercase; margin-bottom:8px; }
.label.red    { color:rgba(220,70,70,.9);   }
.label.orange { color:rgba(240,150,30,.9);  }
.label.green  { color:rgba(20,190,110,.9);  }
.label.ai     { color:rgba(139,92,246,.9);  }
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

/* AI processing indicator */
.ai-dots { display:flex; gap:4px; margin-top:8px; }
.ai-dot { width:6px; height:6px; border-radius:50%; background:rgba(139,92,246,.7);
  animation:aiPulse 1s ease-in-out infinite; }
.ai-dot:nth-child(2){animation-delay:.2s}
.ai-dot:nth-child(3){animation-delay:.4s}
@keyframes aiPulse{0%,100%{transform:scale(1);opacity:.7}50%{transform:scale(1.5);opacity:1}}
</style></head><body>
<div class="app-wrap">
  <iframe id="app" src="SERVER_URL"></iframe>
</div>
<div class="overlay">
  <div id="chip"></div>
  <div id="fx-timeline"><div id="fx-timeline-fill"></div></div>

  <!-- ═══════════════════════════════════════════════════════════════════
       PER-USE-CASE CALLOUT SETS — one trio per UC, unique IDs
       ═══════════════════════════════════════════════════════════════════

  <!-- UC1 — [Name] -->
  <div class="callout" id="uc1L" style="bottom:54px;left:26px">
    <div class="ci red">
      <div class="label red">Before — [Pain Label]</div>
      <div class="title">[Pain Line 1]<br>[Pain Line 2]</div>
      <div class="typed" id="uc1Lt"></div>
      <div class="stat-row">
        <span class="s-before">[OLD metric]</span>
        <span class="s-after">[NEW metric]</span>
        <span class="s-unit">[unit]</span>
      </div>
    </div>
  </div>
  <div class="callout" id="uc1R" style="top:110px;right:26px">
    <div class="ci orange shimmer">
      <div class="label orange">Live — [Execution Label]</div>
      <div class="title">[Action Line 1]<br>[Action Line 2]</div>
      <div class="typed" id="uc1Rt"></div>
      <div class="prog-wrap">
        <div class="prog-label">PROCESSING...</div>
        <div class="prog-bar"><div class="prog-fill" id="uc1prog"></div></div>
        <div class="prog-pct" id="uc1pct">0%</div>
      </div>
      <!-- OR: AI processing (for AI-magic pattern):
      <div class="ai-dots"><div class="ai-dot"></div><div class="ai-dot"></div><div class="ai-dot"></div></div>
      -->
      <!-- OR: wizard step indicators:
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
        <span class="s-after" id="uc1ResVal">[METRIC]</span>
        <span class="s-unit">[unit]</span>
      </div>
    </div>
  </div>

  <!-- IMPACT SUMMARY CALLOUTS (final scene) — 4 green metric cards -->
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
## 5 INTERACTION PATTERNS — Use one per use-case
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Choose the pattern that best matches each use-case's UI.

### PATTERN A — Full wizard (upload → map → preview → import → board)
Use when: page has a multi-step import wizard with file input.
```js
// 0. Motion graphic interlude: problem statement (NEW in v6)
await page.goto(`${SRV}/full-video.html`, { waitUntil:'load' });
await FX.mgBeforeAfter(page,
  'Finance team processes invoices manually in spreadsheets.',
  '[AppName] auto-routes, validates, and approves in real time.',
  { before: '4-6 hours per batch', after: '28 min', unit: 'per 500 invoices' }
);
if (EFFECTS_LEVEL !== 'essential') await FX.subtitle(page, 'Manual processing leaves teams buried in busywork.', PACE.subtitleMedium);
await sleep(PACE.beforeAfterSplit);
await FX.hideMgBeforeAfter(page);

// 1. Navigate to workflow, show before-pain
await chip(page, '[Scene Label]', 'exec');
await FX.timelineBar(page, TIMELINE_PCT);  // update % each scene
await nav(page, `${SRV}/workflows/WORKFLOW_NAME`);
await sleep(withSlowdown(PACE.navLoad, ['novelUiPattern']));
await FX.sceneLabel(page, 'USE CASE N', '[Name]');
await show(page, 'ucNL', 'right');
type(page, 'ucNLt', '[1-2 sentences: specific current pain. Real numbers from discovery.]');
if (EFFECTS_LEVEL !== 'essential') await FX.spotlight(page, true);
if (EFFECTS_LEVEL !== 'essential') await FX.subtitle(page, '[Short caption matching VO]', PACE.subtitleShort);
await sleep(PACE.beforePainRead);
if (EFFECTS_LEVEL !== 'essential') await FX.spotlight(page, false);
await hide(page, 'ucNL'); await FX.hideSceneLabel(page);
await sleep(PACE.modalKillWait);

// 2. Annotate the upload zone before clicking
if (EFFECTS_LEVEL !== 'essential') await FX.annotate(page, 640, 420, 'Upload your data here', 'right');
await sleep(800);
await FX.hideAnnotate(page);

// 3. Click Import button
await pauseBeforeClick(); await iframeClick(page, 'Import [Name]');
await sleep(800);
await injectFileToIframe(page, CSV_DATA, 'filename.csv');   // step 1→2
await show(page, 'ucNR', 'left');
type(page, 'ucNRt', 'File uploaded — N rows. Auto-mapping columns...');
await activateStep(page, 'ucNR', 1);
await sleep(PACE.executionRead);
await pauseBeforeClick(); await iframeClick(page, 'Preview'); // step 2→3
await activateStep(page, 'ucNR', 2);
await sleep(PT.sleep('wizard', PACE.wizardStepDelay));
await hide(page, 'ucNR'); await sleep(PACE.modalKillWait);
await show(page, 'ucNR', 'left');
type(page, 'ucNRt', 'Preview: N ready, M flagged. Clicking Import...');
await activateStep(page, 'ucNR', 3);
await sleep(PACE.executionRead);
await pauseBeforeClick(); await iframeClick(page, 'Import');  // step 3→4
await hide(page, 'ucNR'); await sleep(PACE.modalKillWait);
await show(page, 'ucNR', 'left');
type(page, 'ucNRt', 'Importing N items… routing to approval lanes…');
await Promise.all([
  progressBar(page, 'ucNprog', 'ucNpct', 100, PACE.progressBarDur),
  smoothScroll(page, 200, 3000),
]);
await sleep(withSpeedup(PACE.progressBarDur, 'afterProgressBar'));
if (EFFECTS_LEVEL !== 'essential') await FX.confetti(page);
if (EFFECTS_LEVEL !== 'essential') await FX.checkmark(page, 'ucNR');
if (EFFECTS_LEVEL !== 'essential') await FX.emojiBurst(page, 640, 360, '✅', 10);
await hide(page, 'ucNR'); await sleep(PACE.modalKillWait);
await show(page, 'ucNRes', 'left');
type(page, 'ucNRest', '[Result: N imported, M flagged, board populated]');
if (EFFECTS_LEVEL !== 'essential') await FX.statFlip(page, 'ucNResVal', '[OLD]', '[NEW]');
if (EFFECTS_LEVEL !== 'essential') await FX.successPulse(page, 980, 560);
await sleep(withSlowdown(PACE.resultRead, ['dollarOrPercentResult']));
await hide(page, 'ucNRes');
await pauseBeforeClick(); await iframeClick(page, 'View [Board Name]');
await sleep(PACE.boardView);
await chip(page, '[Board Name] — Live', 'live');
await FX.timelineBar(page, TIMELINE_PCT + 5);
await openCard(page, '[most interesting card text]');
await hideChip(page); await sleep(800);
```

### PATTERN B — Workflow stepper (scroll + step indicator advances)
Use when: page has numbered workflow steps (Stepper component).
```js
// Omitted for brevity — same structure as Pattern A but replacing wizard with stepper.
// Key difference: use smoothScroll() in sync with activateStep() calls.
// Always end with injectFileToWorkflowCta → confetti → Launch Board → openCard.
```

### PATTERN C — Progress bar only (processing-heavy workflows)
Use when: focus is on validation/processing volume, not multi-step wizard.
```js
// Uses progressBar() + parallel smoothScroll(). Key: show 3 scroll passes while bar fills.
// Always end with Launch Board → openCard.
```

### PATTERN D — Quick demo (lightweight single-click workflows)  **NEW in v6**
Use when: the feature can be demonstrated with 1-2 clicks and immediate result.
Ideal for: dashboard filters, quick exports, single-button AI features, toggle switches.
```js
// 0. Motion graphic process diagram (shows the flow before clicking)
await FX.mgProcess(page, [
  { icon: '📤', label: 'Connect Data' },
  { icon: '⚡', label: '[AppName] Processes' },
  { icon: '📊', label: 'Live Board' },
]);
await sleep(PACE.mgProcessDiagram);
await FX.hideMgProcess(page);

// 1. Navigate, annotate the key button, click it
await nav(page, `${SRV}/[ROUTE]`);
await sleep(PACE.navLoad);
await show(page, 'ucNL', 'right');
type(page, 'ucNLt', '[The problem: what they had to do manually before]');
await sleep(PACE.beforePainRead);
await hide(page, 'ucNL'); await sleep(PACE.modalKillWait);

// 2. Zoom lens + annotate the relevant button
await FX.zoomLens(page, BUTTON_X, BUTTON_Y, 2.5);
await sleep(600);
await FX.annotate(page, BUTTON_X + 40, BUTTON_Y, '[What this button does]', 'right');
await sleep(1200);
await FX.hideZoomLens(page); await FX.hideAnnotate(page);

// 3. Click and show result
await pauseBeforeClick();
await FX.clickTargetRings(page, BUTTON_X, BUTTON_Y);
await FX.clickRipple(page, BUTTON_X, BUTTON_Y);
await iframeClick(page, '[Button Text]');
await show(page, 'ucNR', 'left');
type(page, 'ucNRt', '[What just happened instantly]');
await sleep(PACE.microInteraction);
await hide(page, 'ucNR'); await sleep(PACE.modalKillWait);
await show(page, 'ucNRes', 'left');
type(page, 'ucNRest', '[The result in concrete terms]');
if (EFFECTS_LEVEL !== 'essential') await FX.emojiBurst(page, 640, 360, '🚀', 8);
await sleep(PACE.resultRead);
await hide(page, 'ucNRes');
```

### PATTERN E — AI magic reveal  **NEW in v6**
Use when: the software has an AI/smart feature (auto-classify, detect, suggest, generate).
This pattern is designed to make the AI moment feel dramatic and impressive.
```js
// 1. Show the messy input state first
await nav(page, `${SRV}/[AI_ROUTE]`);
await sleep(PACE.navLoad);
await show(page, 'ucNL', 'right');
type(page, 'ucNLt', '[What the human had to do manually: classify each item, flag outliers, etc.]');
if (EFFECTS_LEVEL !== 'essential') await FX.spotlight(page, true);
await sleep(PACE.beforePainRead);
if (EFFECTS_LEVEL !== 'essential') await FX.spotlight(page, false);
await hide(page, 'ucNL'); await sleep(PACE.modalKillWait);

// 2. Trigger AI action with dramatic buildup
await chip(page, 'AI Processing', 'ai');
if (EFFECTS_LEVEL !== 'essential') await FX.dataStream(page, true);   // Matrix-style columns
await show(page, 'ucNR', 'left');
type(page, 'ucNRt', 'Analyzing patterns across [N] data points...');
await sleep(500);
// Show AI dots animation in the callout
await page.evaluate(() => {
  const dots = document.querySelector('#ucNR .ai-dots'); if (dots) dots.style.display = 'flex';
});
await sleep(PACE.aiMagicReveal);                             // 2.5s of "thinking"
if (EFFECTS_LEVEL === 'cinematic') await FX.chromaticAberration(page, 250); // reveal flash
if (EFFECTS_LEVEL !== 'essential') await FX.dataStream(page, false);

// 3. Reveal result with success moment
await hide(page, 'ucNR'); await sleep(PACE.modalKillWait);
await show(page, 'ucNRes', 'left');
type(page, 'ucNRest', '[What the AI found / classified / generated]');
if (EFFECTS_LEVEL !== 'essential') await FX.particleExplode(page, 640, 360, 60);
if (EFFECTS_LEVEL !== 'essential') await FX.emojiBurst(page, 640, 360, '🎯', 8);
await sleep(withSlowdown(PACE.resultRead, ['aiFeatureFirst', 'dollarOrPercentResult']));
await hide(page, 'ucNRes');
await pauseBeforeClick(); await iframeClick(page, 'View Board');
await sleep(PACE.boardView);
await chip(page, '[Board Name] — AI Results', 'live');
await openCard(page, '[card with AI-classified data]');
await hideChip(page); await sleep(800);
```
