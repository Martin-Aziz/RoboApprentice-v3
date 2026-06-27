/**
 * render-progress.js v6
 *
 * Real-time recording progress display for the video rendering pipeline.
 *
 * Output format:
 *   [=====>      ] 45% | ● 38% video | UC 2/4 — Payroll Compliance | Scene | 02:15
 *
 * API:
 *   const progress = createRenderProgress(totalUseCases);
 *   progress.start();
 *   progress.update({ ucIndex: 1, ucTotal: 4, ucName: 'Payroll Compliance', scene: 'Execution', percent: 45, timelinePct: 38 });
 *   progress.finish('Done');
 *   progress.error('Something failed');
 *   progress.logScene('MG Interlude', ['chromaticAberration', 'swipePush']);
 *
 * v6 additions:
 *   - SCENE_COLORS map for new scene types (MG Interlude, Before/After, AI Processing,
 *     Problem Card, Scene Label, Timeline)
 *   - timelinePct field: shows "● 38% video" alongside the bar
 *   - logScene(name, effectsUsed) — formatted scene-start log line
 *
 * Node.js built-ins only — uses readline and process.stdout.write.
 */

'use strict';

const readline = require('readline');

// ---------------------------------------------------------------------------
// ANSI colour codes (zero-dep)
// ---------------------------------------------------------------------------
const C = {
  reset:    '\x1b[0m',
  bold:     '\x1b[1m',
  dim:      '\x1b[2m',
  green:    '\x1b[32m',
  yellow:   '\x1b[33m',
  cyan:     '\x1b[36m',
  blue:     '\x1b[34m',
  magenta:  '\x1b[35m',
  red:      '\x1b[31m',
  white:    '\x1b[37m',
  bgGreen:  '\x1b[42m',
  // v6 additions
  purple:   '\x1b[35m',   // same escape as magenta; distinguish semantically in SCENE_COLORS
  violet:   '\x1b[35m',
  bgRed:    '\x1b[41m',
  bgMagenta:'\x1b[45m',
};

// ---------------------------------------------------------------------------
// v6: SCENE_COLORS — maps scene type names to ANSI colour strings
// ---------------------------------------------------------------------------
/**
 * SCENE_COLORS
 *
 * Keys are the canonical scene type names (case-sensitive).
 * Values are ANSI escape sequences applied to the scene name in buildLine()
 * and in logScene().
 *
 * Original scene types (Intro, Upload, Processing, Execution, Results) keep
 * the existing yellow colouring via the fallback in buildLine().
 *
 * New v6 scene types:
 *   MG Interlude  — magenta
 *   Before/After  — red→green gradient simulation (red prefix, green suffix)
 *   AI Processing — violet/purple
 *   Problem Card  — red
 *   Scene Label   — cyan
 *   Timeline      — dim/gray
 */
const SCENE_COLORS = {
  // v6 new scene types
  'MG Interlude':   C.magenta,
  'Before/After':   C.red,      // Opening colour; suffix handled in colorScene()
  'AI Processing':  '\x1b[38;5;135m', // 256-colour violet (falls back gracefully)
  'Problem Card':   C.red,
  'Scene Label':    C.cyan,
  'Timeline':       C.dim,

  // Original scene types — explicit entries so colorScene() has full coverage
  'Intro':          C.yellow,
  'Upload':         C.yellow,
  'Upload CSV':     C.yellow,
  'Processing':     C.yellow,
  'Execution':      C.yellow,
  'Results':        C.yellow,
  'Dashboard':      C.yellow,
  'Clock In/Out':   C.yellow,
  'Export':         C.yellow,
  'Welcome':        C.yellow,
  'Form Fill':      C.yellow,
  'Document Upload':C.yellow,
  'Confirmation':   C.yellow,
  'Calendar View':  C.yellow,
  'Request Flow':   C.yellow,
  'Approval':       C.yellow,
  'Summary':        C.yellow,
};

/**
 * colorScene(name, useColor)
 *
 * Returns the scene name wrapped in the appropriate ANSI colour sequence.
 * Special treatment for 'Before/After': first half red, second half green.
 *
 * @param {string}  name      - scene type name
 * @param {boolean} useColor  - whether ANSI codes are enabled
 * @returns {string}
 */
function colorScene(name, useColor) {
  if (!useColor) return name;

  if (name === 'Before/After') {
    // Split at the slash for a red→green visual
    const parts = name.split('/');
    return `${C.red}${parts[0]}${C.reset}/${C.green}${parts[1] || ''}${C.reset}`;
  }

  const colour = SCENE_COLORS[name] || C.yellow;
  return `${colour}${name}${C.reset}`;
}

// ---------------------------------------------------------------------------
// Format helpers
// ---------------------------------------------------------------------------

/** Format elapsed seconds as MM:SS */
function formatElapsed(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

/** Render a progress bar of a given width */
function renderBar(percent, width = 20) {
  const filled  = Math.round((percent / 100) * (width - 1));
  const empty   = width - filled - 1;
  const arrow   = percent >= 100 ? '=' : '>';
  return `[${C.green}${'='.repeat(filled)}${arrow}${C.reset}${' '.repeat(Math.max(0, empty))}]`;
}

/** Truncate a string to maxLen, adding ellipsis if needed */
function truncate(str, maxLen) {
  if (!str) return '';
  return str.length > maxLen ? str.slice(0, maxLen - 1) + '…' : str;
}

// ---------------------------------------------------------------------------
// Terminal width detection (with fallback)
// ---------------------------------------------------------------------------
function getTermWidth() {
  try { return process.stdout.columns || 100; }
  catch (_) { return 100; }
}

// ---------------------------------------------------------------------------
// createRenderProgress
// ---------------------------------------------------------------------------

/**
 * @param {number} totalUseCases - Total number of use-cases being rendered.
 * @param {object} options
 * @param {number}  options.barWidth       - Width of the progress bar (default: 20)
 * @param {number}  options.tickIntervalMs - How often to re-draw even without update (default: 500)
 * @param {boolean} options.useColor       - Enable ANSI colour (default: true if TTY)
 *
 * @returns {{
 *   start:    () => void,
 *   update:   (state: object) => void,
 *   finish:   (message?: string) => void,
 *   error:    (message: string) => void,
 *   log:      (message: string) => void,
 *   logScene: (name: string, effectsUsed?: string[]) => void,
 * }}
 */
function createRenderProgress(totalUseCases, options = {}) {
  const {
    barWidth       = 20,
    tickIntervalMs = 500,
    useColor       = process.stdout.isTTY !== false,
  } = options;

  // Internal state
  let state = {
    ucIndex:     0,             // 0-based current use-case index
    ucTotal:     totalUseCases,
    ucName:      '',
    scene:       '',
    percent:     0,             // overall 0-100
    timelinePct: null,          // v6: how far through the actual video (0-100 or null)
    status:      'idle',        // idle | running | done | error
  };

  let startTime   = null;
  let tickTimer   = null;
  let lastLineLen = 0;

  // Colour helper (respects useColor flag)
  const c = useColor ? C : Object.fromEntries(Object.keys(C).map(k => [k, '']));

  // ---- Rendering ----

  function buildLine() {
    const elapsed    = startTime ? (Date.now() - startTime) / 1000 : 0;
    const elapsedStr = formatElapsed(elapsed);

    const bar = renderBar(state.percent, barWidth);
    const pct = `${String(state.percent).padStart(3)}%`;

    // v6: timeline percentage indicator ("● 38% video")
    const timelineIndicator = (state.timelinePct !== null && state.timelinePct !== undefined)
      ? ` ${c.dim}|${c.reset} ${c.cyan}●${c.reset} ${c.bold}${String(Math.round(state.timelinePct)).padStart(3)}%${c.reset} ${c.dim}video${c.reset}`
      : '';

    // Use-case indicator: "UC 2/4"
    const ucNum = state.ucIndex + 1;
    const ucTag = `${c.cyan}UC ${ucNum}/${state.ucTotal}${c.reset}`;

    // Use-case name (truncated to fit)
    const ucName = state.ucName
      ? ` ${c.bold}${c.white}— ${truncate(state.ucName, 30)}${c.reset}`
      : '';

    // Scene indicator — v6: coloured per SCENE_COLORS
    const sceneColoured = state.scene ? colorScene(truncate(state.scene, 20), useColor) : '';
    const scene = state.scene
      ? ` ${c.dim}|${c.reset} ${sceneColoured}`
      : '';

    // Elapsed
    const elapsed_ = ` ${c.dim}|${c.reset} ${c.magenta}${elapsedStr}${c.reset}`;

    // Assemble: bar pct | ● timelinePct video | UC n/N — Name | Scene | MM:SS
    const line = `  ${bar} ${c.bold}${pct}${c.reset}${timelineIndicator} ${c.dim}|${c.reset} ${ucTag}${ucName}${scene}${elapsed_}`;
    return line;
  }

  function writeLine(line) {
    // Strip ANSI codes to get visible length for clearing
    const visible = line.replace(/\x1b\[[0-9;]*m/g, '');
    const pad     = Math.max(0, lastLineLen - visible.length);
    process.stdout.write(`\r${line}${' '.repeat(pad)}`);
    lastLineLen = visible.length;
  }

  function tick() {
    if (state.status === 'running') {
      writeLine(buildLine());
    }
  }

  // ---- Public API ----

  /**
   * Start the progress display.
   */
  function start() {
    state.status = 'running';
    startTime    = Date.now();
    process.stdout.write('\n'); // new line before progress bar
    tickTimer = setInterval(tick, tickIntervalMs);
  }

  /**
   * Update progress state and immediately re-render.
   *
   * @param {object} newState
   * @param {number}  newState.ucIndex      - 0-based index of current use-case
   * @param {number}  [newState.ucTotal]    - Override total use-cases
   * @param {string}  newState.ucName       - Name of current use-case
   * @param {string}  [newState.scene]      - Current scene name
   * @param {number}  newState.percent      - Overall 0-100 progress
   * @param {number}  [newState.timelinePct]- v6: 0-100 position in the actual video timeline
   */
  function update(newState) {
    state = { ...state, ...newState, status: 'running' };
    if (!startTime) start();
    tick();
  }

  /**
   * Mark rendering complete and print a final summary line.
   *
   * @param {string} [message] - Optional completion message.
   */
  function finish(message = 'Render complete') {
    state.percent = 100;
    state.status  = 'done';
    clearInterval(tickTimer);

    const elapsed    = startTime ? (Date.now() - startTime) / 1000 : 0;
    const elapsedStr = formatElapsed(elapsed);

    const bar = renderBar(100, barWidth);
    const finalLine = `  ${bar} ${c.bold}${c.green}100%${c.reset} ${c.dim}|${c.reset} ${c.green}${c.bold}${message}${c.reset} ${c.dim}|${c.reset} ${c.magenta}${elapsedStr} total${c.reset}`;
    writeLine(finalLine);
    process.stdout.write('\n\n');
  }

  /**
   * Display an error state and stop the ticker.
   *
   * @param {string} message - Error description.
   */
  function error(message) {
    state.status = 'error';
    clearInterval(tickTimer);

    const bar      = renderBar(state.percent, barWidth);
    const errorLine = `  ${bar} ${c.bold}${c.red}ERROR${c.reset} ${c.dim}|${c.reset} ${c.red}${message}${c.reset}`;
    writeLine(errorLine);
    process.stdout.write('\n\n');
  }

  /**
   * Print a log message ABOVE the progress bar without disrupting it.
   * (Clears the current line, prints the message, then redraws the progress bar.)
   *
   * @param {string} message
   */
  function log_(message) {
    // Clear current progress line
    process.stdout.write(`\r${' '.repeat(lastLineLen)}\r`);
    // Print the log message on its own line
    process.stdout.write(`${c.dim}  ${message}${c.reset}\n`);
    // Redraw progress bar on the next line
    if (state.status === 'running') tick();
  }

  /**
   * v6: logScene(name, effectsUsed)
   *
   * Prints a formatted scene-start log line above the progress bar.
   * Clears the progress line, prints the scene header, then redraws the bar.
   *
   * Format:
   *   ▶ MG Interlude   [chromaticAberration, swipePush]
   *
   * The scene name is coloured per SCENE_COLORS; the effects list is dim.
   *
   * @param {string}   name         - Scene type name (matched against SCENE_COLORS)
   * @param {string[]} [effectsUsed] - Array of effect names applied to this scene
   */
  function logScene(name, effectsUsed = []) {
    // Clear current progress line
    process.stdout.write(`\r${' '.repeat(lastLineLen)}\r`);

    const coloured = useColor ? colorScene(name, true) : name;
    const nameField = `${c.bold}${coloured}${c.reset}`.padEnd(useColor ? 40 : 20); // pad for alignment (ANSI codes inflate length)

    const effectsPart = effectsUsed.length > 0
      ? `${c.dim}[${effectsUsed.join(', ')}]${c.reset}`
      : '';

    const marker = useColor ? `${c.bold}  ▶ ${c.reset}` : '  ▶ ';

    process.stdout.write(`${marker}${nameField}${effectsPart}\n`);

    // Redraw progress bar
    if (state.status === 'running') tick();
  }

  return { start, update, finish, error, log: log_, logScene };
}

// ---------------------------------------------------------------------------
// Higher-level helper: createSceneProgress
//
// Tracks both use-case level and scene level progress, computes overall %.
// ---------------------------------------------------------------------------

/**
 * createSceneProgress(useCases)
 *
 * @param {Array<{name: string, scenes: string[]}>} useCases - Use-case definitions.
 *
 * Usage:
 *   const sp = createSceneProgress([
 *     { name: 'Payroll Compliance', scenes: ['Intro', 'Upload', 'MG Interlude', 'Execution', 'Results'] },
 *     { name: 'Time Tracking',      scenes: ['Intro', 'Dashboard', 'AI Processing', 'Export'] },
 *   ]);
 *   sp.start();
 *   sp.nextScene();             // move to next scene
 *   sp.nextScene(38);           // move to next scene and set timeline position to 38%
 *   sp.nextUseCase();           // move to next use-case
 *   sp.logScene('MG Interlude', ['chromaticAberration', 'swipePush']);
 *   sp.done();
 */
function createSceneProgress(useCases, options = {}) {
  const totalScenes = useCases.reduce((sum, uc) => sum + uc.scenes.length, 0);
  const progress    = createRenderProgress(useCases.length, options);

  let currentUcIdx    = 0;
  let currentSceneIdx = 0;
  let completedScenes = 0;

  function computePercent() {
    return Math.min(100, Math.round((completedScenes / totalScenes) * 100));
  }

  function refreshDisplay(timelinePct) {
    const uc    = useCases[currentUcIdx];
    const scene = uc?.scenes[currentSceneIdx] ?? '';
    progress.update({
      ucIndex:     currentUcIdx,
      ucTotal:     useCases.length,
      ucName:      uc?.name ?? '',
      scene,
      percent:     computePercent(),
      timelinePct: timelinePct !== undefined ? timelinePct : null,
    });
  }

  function start() {
    progress.start();
    refreshDisplay();
  }

  /**
   * Advance to the next scene.
   *
   * @param {number} [timelinePct] - v6: optional 0-100 position in the video timeline
   */
  function nextScene(timelinePct) {
    completedScenes++;
    const uc = useCases[currentUcIdx];
    if (uc && currentSceneIdx < uc.scenes.length - 1) {
      currentSceneIdx++;
    }
    refreshDisplay(timelinePct);
  }

  function nextUseCase() {
    completedScenes += (useCases[currentUcIdx]?.scenes.length ?? 0) - currentSceneIdx;
    currentUcIdx++;
    currentSceneIdx = 0;
    if (currentUcIdx < useCases.length) {
      refreshDisplay();
    }
  }

  function done() {
    completedScenes = totalScenes;
    progress.finish('All use-cases rendered');
  }

  /**
   * v6: logScene — delegates to the underlying render progress logScene.
   *
   * @param {string}   name        - Scene type name
   * @param {string[]} [effects]   - Effects used in this scene
   */
  function logScene(name, effects = []) {
    progress.logScene(name, effects);
  }

  return {
    start,
    nextScene,
    nextUseCase,
    done,
    logScene,
    log:   progress.log,
    error: progress.error,
    raw:   progress,
  };
}

module.exports = { createRenderProgress, createSceneProgress, renderBar, formatElapsed, SCENE_COLORS, colorScene };

// ---------------------------------------------------------------------------
// Demo / manual test: node render-progress.js
// ---------------------------------------------------------------------------
if (require.main === module) {
  // v6 demo includes new scene types across the use-case list
  const useCases = [
    {
      name: 'Payroll Compliance',
      scenes: ['Intro', 'Problem Card', 'Upload CSV', 'MG Interlude', 'AI Processing', 'Execution', 'Before/After', 'Results'],
    },
    {
      name: 'Time Tracking',
      scenes: ['Intro', 'Scene Label', 'Clock In/Out', 'Timeline', 'Dashboard', 'AI Processing', 'Export'],
    },
    {
      name: 'Employee Onboarding',
      scenes: ['Welcome', 'MG Interlude', 'Form Fill', 'Document Upload', 'AI Processing', 'Before/After', 'Confirmation'],
    },
    {
      name: 'Leave Management',
      scenes: ['Problem Card', 'Calendar View', 'Request Flow', 'MG Interlude', 'Approval', 'Scene Label', 'Summary'],
    },
  ];

  const sp = createSceneProgress(useCases);
  sp.start();

  let ucIdx    = 0;
  let sceneIdx = 0;

  // Simulate a video timeline position that advances independently
  let timelinePctValue = 0;

  const interval = setInterval(() => {
    const uc = useCases[ucIdx];
    if (!uc) {
      clearInterval(interval);
      sp.done();
      return;
    }

    // Advance the simulated timeline position
    timelinePctValue = Math.min(100, timelinePctValue + Math.round(Math.random() * 4 + 1));

    if (sceneIdx < uc.scenes.length) {
      const sceneName = uc.scenes[sceneIdx];

      // Demonstrate logScene for the v6 scene types
      const v6SceneTypes = new Set(['MG Interlude', 'Before/After', 'AI Processing', 'Problem Card', 'Scene Label', 'Timeline']);
      if (v6SceneTypes.has(sceneName)) {
        const demoEffects = {
          'MG Interlude':   ['chromaticAberration', 'swipePush'],
          'Before/After':   ['crossDissolve', 'colorGrade'],
          'AI Processing':  ['particleStream', 'pulseGlow'],
          'Problem Card':   ['shakeImpact', 'redVignette'],
          'Scene Label':    ['fadeIn', 'typewriter'],
          'Timeline':       ['slowZoom'],
        };
        sp.logScene(sceneName, demoEffects[sceneName] || []);
      }

      sp.nextScene(timelinePctValue);
      sceneIdx++;
    } else {
      sp.log(`Finished UC: ${uc.name}`);
      sp.nextUseCase();
      ucIdx++;
      sceneIdx = 0;
    }

    if (ucIdx >= useCases.length) {
      clearInterval(interval);
      sp.done();
    }
  }, 350);
}
