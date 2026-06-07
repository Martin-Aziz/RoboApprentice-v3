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
