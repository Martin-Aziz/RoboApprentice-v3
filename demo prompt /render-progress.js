/**
 * render-progress.js
 *
 * Real-time recording progress display for the video rendering pipeline.
 *
 * Output format:
 *   [=====>      ] 45% | UC 2/4 — Payroll Compliance | Scene: Execution | 02:15 elapsed
 *
 * API:
 *   const progress = createRenderProgress(totalUseCases);
 *   progress.start();
 *   progress.update({ ucIndex: 1, ucTotal: 4, ucName: 'Payroll Compliance', scene: 'Execution', percent: 45 });
 *   progress.finish('Done');
 *   progress.error('Something failed');
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
};

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
 *   start: () => void,
 *   update: (state: object) => void,
 *   finish: (message?: string) => void,
 *   error:  (message: string) => void,
 *   log:    (message: string) => void,
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
    ucIndex:  0,      // 0-based current use-case index
    ucTotal:  totalUseCases,
    ucName:   '',
    scene:    '',
    percent:  0,      // overall 0-100
    status:   'idle', // idle | running | done | error
  };

  let startTime  = null;
  let tickTimer  = null;
  let lastLineLen = 0;

  // Colour helper (respects useColor flag)
  const c = useColor ? C : Object.fromEntries(Object.keys(C).map(k => [k, '']));

  // ---- Rendering ----

  function buildLine() {
    const elapsed    = startTime ? (Date.now() - startTime) / 1000 : 0;
    const elapsedStr = formatElapsed(elapsed);
    const termWidth  = getTermWidth();

    const bar = renderBar(state.percent, barWidth);
    const pct = `${String(state.percent).padStart(3)}%`;

    // Use-case indicator: "UC 2/4"
    const ucNum  = state.ucIndex + 1;
    const ucTag  = `${c.cyan}UC ${ucNum}/${state.ucTotal}${c.reset}`;

    // Use-case name (truncated to fit)
    const ucName = state.ucName ? ` ${c.bold}${c.white}— ${truncate(state.ucName, 30)}${c.reset}` : '';

    // Scene indicator
    const scene = state.scene ? ` ${c.dim}| Scene: ${c.reset}${c.yellow}${truncate(state.scene, 20)}${c.reset}` : '';

    // Elapsed
    const elapsed_ = ` ${c.dim}|${c.reset} ${c.magenta}${elapsedStr} elapsed${c.reset}`;

    // Assemble
    const line = `  ${bar} ${c.bold}${pct}${c.reset} ${c.dim}|${c.reset} ${ucTag}${ucName}${scene}${elapsed_}`;
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
   * @param {number}  newState.ucIndex   - 0-based index of current use-case
   * @param {number}  [newState.ucTotal] - Override total use-cases
   * @param {string}  newState.ucName    - Name of current use-case
   * @param {string}  [newState.scene]   - Current scene name
   * @param {number}  newState.percent   - Overall 0-100 progress
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

  return { start, update, finish, error, log: log_ };
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
 *     { name: 'Payroll Compliance', scenes: ['Intro', 'Upload', 'Execution', 'Results'] },
 *     { name: 'Time Tracking',      scenes: ['Intro', 'Dashboard', 'Export'] },
 *   ]);
 *   sp.start();
 *   sp.nextScene(); // move to next scene
 *   sp.nextUseCase(); // move to next use-case
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

  function refreshDisplay() {
    const uc    = useCases[currentUcIdx];
    const scene = uc?.scenes[currentSceneIdx] ?? '';
    progress.update({
      ucIndex:  currentUcIdx,
      ucTotal:  useCases.length,
      ucName:   uc?.name ?? '',
      scene,
      percent:  computePercent(),
    });
  }

  function start() {
    progress.start();
    refreshDisplay();
  }

  function nextScene() {
    completedScenes++;
    const uc = useCases[currentUcIdx];
    if (uc && currentSceneIdx < uc.scenes.length - 1) {
      currentSceneIdx++;
    }
    refreshDisplay();
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

  return { start, nextScene, nextUseCase, done, log: progress.log, error: progress.error, raw: progress };
}

module.exports = { createRenderProgress, createSceneProgress, renderBar, formatElapsed };

// ---------------------------------------------------------------------------
// Demo / manual test: node render-progress.js
// ---------------------------------------------------------------------------
if (require.main === module) {
  const useCases = [
    { name: 'Payroll Compliance',   scenes: ['Intro', 'Upload CSV', 'Processing', 'Execution', 'Results'] },
    { name: 'Time Tracking',        scenes: ['Intro', 'Clock In/Out', 'Dashboard', 'Export'] },
    { name: 'Employee Onboarding',  scenes: ['Welcome', 'Form Fill', 'Document Upload', 'Confirmation'] },
    { name: 'Leave Management',     scenes: ['Calendar View', 'Request Flow', 'Approval', 'Summary'] },
  ];

  const sp = createSceneProgress(useCases);
  sp.start();

  let ucIdx    = 0;
  let sceneIdx = 0;

  const interval = setInterval(() => {
    const uc = useCases[ucIdx];
    if (!uc) {
      clearInterval(interval);
      sp.done();
      return;
    }

    if (sceneIdx < uc.scenes.length) {
      sp.nextScene();
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
  }, 400);
}
