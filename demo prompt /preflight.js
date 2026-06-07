/**
 * preflight.js — Pre-flight verification for video rendering pipeline.
 *
 * Call this at the top of render-video.js before any recording begins.
 *
 * Returns:
 *   {
 *     ok: boolean,
 *     port: number,
 *     routes: RouteStatus[],
 *     csvFiles: string[],
 *     warnings: string[]
 *   }
 *
 * Dependencies: Node.js built-ins + Playwright (already required by the renderer).
 */

'use strict';

const { execSync, spawnSync } = require('child_process');
const fs   = require('fs');
const path = require('path');
const os   = require('os');
const http = require('http');
const https = require('https');

// ---------------------------------------------------------------------------
// ANSI colour helpers (zero-dep, works in any modern terminal)
// ---------------------------------------------------------------------------
const C = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  dim:    '\x1b[2m',
  red:    '\x1b[31m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  cyan:   '\x1b[36m',
  white:  '\x1b[37m',
  bgRed:  '\x1b[41m',
};

const ok   = (msg) => console.log(`${C.green}  ✔ ${C.reset}${msg}`);
const warn = (msg) => console.log(`${C.yellow}  ⚠ ${C.reset}${msg}`);
const fail = (msg) => console.log(`${C.red}  ✖ ${C.reset}${C.bold}${msg}${C.reset}`);
const info = (msg) => console.log(`${C.cyan}  ℹ ${C.reset}${msg}`);
const head = (msg) => console.log(`\n${C.bold}${C.white}${msg}${C.reset}`);

// ---------------------------------------------------------------------------
// Utility: simple HTTP/HTTPS GET with timeout
// ---------------------------------------------------------------------------
function httpGet(url, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { timeout: timeoutMs }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('timeout', () => { req.destroy(); reject(new Error(`Timeout (${timeoutMs}ms): ${url}`)); });
    req.on('error', reject);
  });
}

// ---------------------------------------------------------------------------
// Utility: sleep
// ---------------------------------------------------------------------------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// 1. Server check with 3 retries
// ---------------------------------------------------------------------------
async function checkServer(serverUrl, maxRetries = 3, retryDelayMs = 2000) {
  head('[ 1/9 ] Server reachability');
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const { status } = await httpGet(serverUrl);
      if (status < 400) {
        ok(`Server responded ${status} at ${serverUrl} (attempt ${attempt})`);
        return { reachable: true, status };
      }
      lastError = new Error(`HTTP ${status}`);
    } catch (e) {
      lastError = e;
      if (attempt < maxRetries) {
        warn(`Attempt ${attempt} failed (${e.message}). Retrying in ${retryDelayMs / 1000}s…`);
        await sleep(retryDelayMs);
      }
    }
  }
  fail(`Server unreachable after ${maxRetries} attempts: ${lastError.message}`);
  return { reachable: false, status: null, error: lastError.message };
}

// ---------------------------------------------------------------------------
// 2. Route check — expects HTTP 200 for each route
// ---------------------------------------------------------------------------
async function checkRoutes(serverUrl, routes) {
  head('[ 2/9 ] Route status check');
  const results = [];
  for (const route of routes) {
    const url = `${serverUrl}${route}`;
    try {
      const { status } = await httpGet(url);
      const passed = status === 200;
      if (passed) ok(`${route}  →  ${status}`);
      else         warn(`${route}  →  ${status} (expected 200)`);
      results.push({ route, status, ok: passed });
    } catch (e) {
      fail(`${route}  →  ERROR: ${e.message}`);
      results.push({ route, status: null, ok: false, error: e.message });
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// 3 & 4 & 5 & 6 — Playwright visual checks
// ---------------------------------------------------------------------------
/**
 * checkRoutesVisually(page, serverUrl, routes, screenshotDir)
 *
 * For each route:
 *   - Navigate to the route
 *   - Suppress modals (step 6)
 *   - Scroll to top
 *   - Verify iframe scale (step 4)
 *   - Verify WorkflowCta upload zone (step 5)
 *   - Take a screenshot (step 3)
 */
async function checkRoutesVisually(page, serverUrl, routes, screenshotDir) {
  head('[ 3-6 ] Visual route checks (Playwright)');
  fs.mkdirSync(screenshotDir, { recursive: true });
  const results = [];

  // Modal suppression script — injected into every page before load
  const modalSuppressionScript = `
    // Override window.alert / confirm / prompt
    window.alert   = () => {};
    window.confirm = () => true;
    window.prompt  = () => '';

    // Remove any visible dialog/modal/overlay on DOM mutations
    const _removeModals = () => {
      const selectors = [
        '[role="dialog"]',
        '[role="alertdialog"]',
        '.modal',
        '.modal-backdrop',
        '.overlay',
        '[data-modal]',
        '[data-testid*="modal"]',
        '[class*="Modal"]',
        '[class*="modal"]',
        '[class*="Overlay"]',
        '[class*="overlay"]',
        'dialog[open]',
      ];
      selectors.forEach(sel => {
        document.querySelectorAll(sel).forEach(el => {
          // Only remove if it is truly covering content (position fixed/absolute)
          const style = getComputedStyle(el);
          if (style.position === 'fixed' || style.position === 'absolute') {
            el.remove();
          }
        });
      });
      // Restore body scroll when modals are removed
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };

    const _obs = new MutationObserver(_removeModals);
    _obs.observe(document.body || document.documentElement, { childList: true, subtree: true });
    _removeModals();
  `;

  await page.addInitScript({ content: modalSuppressionScript });

  for (const route of routes) {
    const url = `${serverUrl}${route}`;
    const slug = route.replace(/\//g, '_').replace(/^_/, '') || 'root';
    const screenshotPath = path.join(screenshotDir, `preflight_${slug}.png`);
    const result = { route, screenshot: null, iframeOk: null, uploadZoneOk: null, modalFree: null };

    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

      // Step 6: active modal suppression after navigation
      await page.evaluate(() => {
        const selectors = [
          '[role="dialog"]', '[role="alertdialog"]',
          '.modal', '.modal-backdrop', '.overlay',
          'dialog[open]',
        ];
        selectors.forEach(sel => {
          document.querySelectorAll(sel).forEach(el => {
            const style = getComputedStyle(el);
            if (style.position === 'fixed' || style.position === 'absolute') el.remove();
          });
        });
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';
      });

      // Always scroll to top after navigation
      await page.evaluate(() => window.scrollTo(0, 0));
      await sleep(300);

      // Step 4: iframe scale verification — no scrollbars, no clipping
      const iframeResult = await page.evaluate(() => {
        const iframes = Array.from(document.querySelectorAll('iframe'));
        const issues = [];
        iframes.forEach((iframe, i) => {
          const rect = iframe.getBoundingClientRect();
          const style = getComputedStyle(iframe);

          // Check for overflow (scrollbars appear if content overflows)
          if (style.overflow === 'scroll' || style.overflow === 'auto') {
            issues.push(`iframe[${i}] has overflow:${style.overflow} — may show scrollbars`);
          }
          // Check if iframe is clipped by parent
          const parent = iframe.parentElement;
          if (parent) {
            const parentRect = parent.getBoundingClientRect();
            const parentStyle = getComputedStyle(parent);
            if (
              (parentStyle.overflow === 'hidden') &&
              (rect.bottom > parentRect.bottom + 2 || rect.right > parentRect.right + 2)
            ) {
              issues.push(`iframe[${i}] is clipped by parent (overflow:hidden)`);
            }
          }
          // Check negative dimensions
          if (rect.width <= 0 || rect.height <= 0) {
            issues.push(`iframe[${i}] has zero/negative dimensions (${rect.width}x${rect.height})`);
          }
        });
        return { iframeCount: iframes.length, issues };
      });

      if (iframeResult.issues.length === 0) {
        ok(`  ${route} — iframes OK (${iframeResult.iframeCount} found)`);
        result.iframeOk = true;
      } else {
        // Auto-fix: force overflow visible on iframes and their parents
        await page.evaluate(() => {
          document.querySelectorAll('iframe').forEach(iframe => {
            iframe.style.overflow = 'visible';
            if (iframe.parentElement) {
              const pStyle = getComputedStyle(iframe.parentElement);
              if (pStyle.overflow === 'hidden') {
                iframe.parentElement.style.overflow = 'visible';
              }
            }
          });
        });
        warn(`  ${route} — iframe issues fixed: ${iframeResult.issues.join('; ')}`);
        result.iframeOk = false;
        result.iframeIssues = iframeResult.issues;
      }

      // Step 5: WorkflowCta upload zone verification
      const uploadZone = await page.evaluate(() => {
        // Common selectors for upload zones inside WorkflowCta-style components
        const candidates = [
          '[data-testid="upload-zone"]',
          '[data-testid="dropzone"]',
          '.upload-zone',
          '.dropzone',
          '[class*="UploadZone"]',
          '[class*="Dropzone"]',
          '[class*="WorkflowCta"]',
          'input[type="file"]',
        ];
        for (const sel of candidates) {
          const el = document.querySelector(sel);
          if (el) {
            const rect = el.getBoundingClientRect();
            return { found: true, selector: sel, visible: rect.width > 0 && rect.height > 0 };
          }
        }
        return { found: false };
      });

      if (uploadZone.found && uploadZone.visible) {
        ok(`  ${route} — WorkflowCta upload zone found (${uploadZone.selector})`);
        result.uploadZoneOk = true;
      } else if (uploadZone.found && !uploadZone.visible) {
        warn(`  ${route} — WorkflowCta upload zone found but not visible`);
        result.uploadZoneOk = false;
      } else {
        info(`  ${route} — No upload zone element detected (may not apply to this route)`);
        result.uploadZoneOk = null; // Not applicable
      }

      // Step 6 verification: check no modal/dialog is visible in screenshot
      const modalCount = await page.evaluate(() => {
        const selectors = [
          '[role="dialog"]', '[role="alertdialog"]', '.modal', 'dialog[open]',
        ];
        let count = 0;
        selectors.forEach(sel => {
          document.querySelectorAll(sel).forEach(el => {
            const style = getComputedStyle(el);
            if (style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0') {
              count++;
            }
          });
        });
        return count;
      });

      if (modalCount === 0) {
        ok(`  ${route} — No visible modals/dialogs`);
        result.modalFree = true;
      } else {
        warn(`  ${route} — ${modalCount} modal(s) still visible after suppression`);
        result.modalFree = false;
      }

      // Step 3: Screenshot
      await page.screenshot({ path: screenshotPath, fullPage: false });
      ok(`  ${route} — Screenshot saved → ${screenshotPath}`);
      result.screenshot = screenshotPath;

    } catch (e) {
      fail(`  ${route} — Playwright error: ${e.message}`);
      result.error = e.message;
    }

    results.push(result);
  }

  return results;
}

// ---------------------------------------------------------------------------
// 7. ffmpeg check
// ---------------------------------------------------------------------------
function checkFfmpeg() {
  head('[ 7/9 ] ffmpeg installation');
  try {
    const result = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8', timeout: 5000 });
    if (result.status === 0) {
      const versionLine = (result.stdout || '').split('\n')[0];
      ok(`ffmpeg found: ${versionLine}`);
      return { ok: true, version: versionLine };
    }
    fail('ffmpeg exited with non-zero status');
    return { ok: false };
  } catch (e) {
    fail(`ffmpeg not found: ${e.message}`);
    info('Install: brew install ffmpeg  (macOS) | apt install ffmpeg  (Linux)');
    return { ok: false, error: e.message };
  }
}

// ---------------------------------------------------------------------------
// 8. Disk space check — require >500MB free
// ---------------------------------------------------------------------------
function checkDiskSpace(requiredMb = 500) {
  head('[ 8/9 ] Disk space');
  try {
    // df -m . returns usage in 1MB blocks on macOS/Linux
    const result = spawnSync('df', ['-m', '.'], { encoding: 'utf8', timeout: 5000 });
    if (result.status !== 0) throw new Error('df command failed');

    // Parse the "Available" column from df output
    // Line format (macOS): Filesystem  1M-blocks  Used  Available  Capacity  Mounted on
    // Line format (Linux):  Filesystem  1M-blocks  Used  Available  Use%      Mounted on
    const lines = result.stdout.trim().split('\n');
    const dataLine = lines[lines.length - 1]; // last line is always the relevant mount
    const cols = dataLine.trim().split(/\s+/);

    // Column index 3 is "Available" on both macOS and GNU df
    const availableMb = parseInt(cols[3], 10);

    if (isNaN(availableMb)) throw new Error('Could not parse df output');

    if (availableMb >= requiredMb) {
      ok(`${availableMb} MB free (required: ${requiredMb} MB)`);
      return { ok: true, availableMb };
    } else {
      fail(`Only ${availableMb} MB free — need at least ${requiredMb} MB`);
      info('Free up disk space before rendering. Video temp files can be large.');
      return { ok: false, availableMb };
    }
  } catch (e) {
    warn(`Disk space check failed: ${e.message} — skipping`);
    return { ok: true, availableMb: null, warning: e.message }; // non-fatal
  }
}

// ---------------------------------------------------------------------------
// 9. Pre-generate CSV sample files
// ---------------------------------------------------------------------------
function generateCsvFiles(outputDir, specs = []) {
  head('[ 9/9 ] CSV sample file generation');
  fs.mkdirSync(outputDir, { recursive: true });

  // Default specs if none provided
  const defaultSpecs = [
    {
      name: 'employees_sample.csv',
      headers: ['id', 'name', 'department', 'salary', 'start_date'],
      rows: [
        ['1', 'Alice Johnson',  'Engineering',  '95000', '2021-03-15'],
        ['2', 'Bob Martinez',   'Sales',         '72000', '2020-07-01'],
        ['3', 'Carol Williams', 'HR',             '68000', '2019-11-20'],
        ['4', 'David Lee',      'Engineering',  '102000', '2022-01-10'],
        ['5', 'Eva Chen',       'Marketing',     '75000', '2021-09-05'],
      ],
    },
    {
      name: 'payroll_sample.csv',
      headers: ['employee_id', 'period', 'gross_pay', 'deductions', 'net_pay'],
      rows: [
        ['1', '2024-01', '7916.67', '2375.00', '5541.67'],
        ['2', '2024-01', '6000.00', '1800.00', '4200.00'],
        ['3', '2024-01', '5666.67', '1700.00', '3966.67'],
        ['4', '2024-01', '8500.00', '2550.00', '5950.00'],
        ['5', '2024-01', '6250.00', '1875.00', '4375.00'],
      ],
    },
    {
      name: 'timesheets_sample.csv',
      headers: ['employee_id', 'date', 'hours_worked', 'project_code', 'notes'],
      rows: [
        ['1', '2024-01-15', '8.0', 'PROJ-101', 'Sprint planning'],
        ['2', '2024-01-15', '7.5', 'PROJ-202', 'Client call'],
        ['3', '2024-01-15', '8.0', 'INTERNAL', 'Compliance review'],
        ['4', '2024-01-15', '9.0', 'PROJ-101', 'Feature development'],
        ['5', '2024-01-15', '8.0', 'PROJ-303', 'Campaign analysis'],
      ],
    },
  ];

  const specsToUse = specs.length > 0 ? specs : defaultSpecs;
  const generatedFiles = [];

  for (const spec of specsToUse) {
    const filePath = path.join(outputDir, spec.name);
    const csvContent = [
      spec.headers.join(','),
      ...spec.rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n') + '\n';

    fs.writeFileSync(filePath, csvContent, 'utf8');
    ok(`Generated ${spec.name} (${spec.rows.length} rows) → ${filePath}`);
    generatedFiles.push(filePath);
  }

  return generatedFiles;
}

// ---------------------------------------------------------------------------
// Print health summary
// ---------------------------------------------------------------------------
function printHealthSummary({ serverOk, routeResults, ffmpegOk, diskOk, csvFiles, warnings }) {
  head('='.repeat(56));
  head(' PRE-FLIGHT SUMMARY');
  head('='.repeat(56));

  const passCount = routeResults.filter(r => r.ok !== false).length;
  const failCount = routeResults.filter(r => r.ok === false).length;

  console.log(`\n  Server     : ${serverOk  ? C.green + 'OK'   + C.reset : C.red + 'FAIL' + C.reset}`);
  console.log(  `  Routes     : ${C.green}${passCount} passed${C.reset}  ${failCount > 0 ? C.red + failCount + ' failed' + C.reset : ''}`);
  console.log(  `  ffmpeg     : ${ffmpegOk  ? C.green + 'OK'   + C.reset : C.red + 'MISSING' + C.reset}`);
  console.log(  `  Disk space : ${diskOk    ? C.green + 'OK'   + C.reset : C.red + 'LOW'  + C.reset}`);
  console.log(  `  CSV files  : ${C.green}${csvFiles.length} generated${C.reset}`);

  if (warnings.length > 0) {
    console.log(`\n  ${C.yellow}Warnings:${C.reset}`);
    warnings.forEach(w => console.log(`    ${C.yellow}⚠${C.reset} ${w}`));
  }

  const allOk = serverOk && ffmpegOk && diskOk && failCount === 0;
  console.log(`\n  ${allOk ? C.green + C.bold + '✔ ALL CHECKS PASSED — safe to render' : C.red + C.bold + '✖ ISSUES DETECTED — review above before rendering'}${C.reset}\n`);
}

// ---------------------------------------------------------------------------
// MAIN preflight() export
// ---------------------------------------------------------------------------
/**
 * @param {string}   serverUrl       - e.g. 'http://localhost:3000'
 * @param {string[]} routesToCheck   - e.g. ['/', '/dashboard', '/payroll']
 * @param {string}   playwrightPath  - path to installed playwright (or null to auto-resolve)
 * @param {object}   options
 * @param {string}   options.screenshotDir  - where to save preflight screenshots (default: ./preflight-screenshots)
 * @param {string}   options.csvOutputDir   - where to write CSV samples (default: ./sample-data)
 * @param {object[]} options.csvSpecs        - custom CSV spec array (default: built-in samples)
 *
 * @returns {Promise<{ok: boolean, port: number, routes: object[], csvFiles: string[], warnings: string[]}>}
 */
async function preflight(serverUrl, routesToCheck = ['/'], playwrightPath = null, options = {}) {
  const {
    screenshotDir = path.join(process.cwd(), 'preflight-screenshots'),
    csvOutputDir  = path.join(process.cwd(), 'sample-data'),
    csvSpecs      = [],
  } = options;

  head('='.repeat(56));
  head(' VIDEO RENDERER — PRE-FLIGHT CHECKS');
  head('='.repeat(56));
  info(`Target: ${serverUrl}`);
  info(`Routes: ${routesToCheck.join(', ')}`);

  const warnings = [];
  let playwrightBrowser = null;
  let playwrightPage    = null;

  // ---- 1. Server check ----
  const serverResult = await checkServer(serverUrl);
  if (!serverResult.reachable) {
    warnings.push(`Server not reachable at ${serverUrl}`);
  }

  // ---- 2. Route HTTP check ----
  const routeResults = await checkRoutes(serverUrl, routesToCheck);
  routeResults.filter(r => !r.ok).forEach(r => {
    warnings.push(`Route ${r.route} returned ${r.status ?? 'error'}`);
  });

  // ---- 3-6. Playwright visual checks (only if server is up) ----
  let visualResults = [];
  if (serverResult.reachable) {
    try {
      // Resolve playwright dynamically so this file itself needs no deps beyond node built-ins
      const pw = require(playwrightPath || 'playwright');
      playwrightBrowser = await pw.chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          // Force 1280x720 viewport
          '--window-size=1280,720',
        ],
      });
      playwrightPage = await playwrightBrowser.newPage();
      await playwrightPage.setViewportSize({ width: 1280, height: 720 });

      visualResults = await checkRoutesVisually(
        playwrightPage, serverUrl, routesToCheck, screenshotDir
      );

      visualResults.forEach(r => {
        if (r.error)          warnings.push(`Visual check failed for ${r.route}: ${r.error}`);
        if (r.iframeOk === false) warnings.push(`Iframe overflow issue on ${r.route} (auto-fixed)`);
        if (r.modalFree === false) warnings.push(`Modal still visible on ${r.route} after suppression`);
      });

    } catch (e) {
      warn(`Playwright not available — skipping visual checks: ${e.message}`);
      warnings.push(`Playwright visual checks skipped: ${e.message}`);
    } finally {
      if (playwrightBrowser) await playwrightBrowser.close().catch(() => {});
    }
  } else {
    warn('Skipping Playwright checks (server unreachable)');
  }

  // ---- 7. ffmpeg ----
  const ffmpegResult = checkFfmpeg();
  if (!ffmpegResult.ok) warnings.push('ffmpeg not found — video encoding will fail');

  // ---- 8. Disk space ----
  const diskResult = checkDiskSpace(500);
  if (!diskResult.ok) warnings.push(`Low disk space: ${diskResult.availableMb} MB free`);

  // ---- 9. CSV generation ----
  const csvFiles = generateCsvFiles(csvOutputDir, csvSpecs);

  // ---- Summary ----
  const allRouteResults = routeResults.map(r => {
    const visual = visualResults.find(v => v.route === r.route) || {};
    return { ...r, ...visual };
  });

  printHealthSummary({
    serverOk:     serverResult.reachable,
    routeResults: allRouteResults,
    ffmpegOk:     ffmpegResult.ok,
    diskOk:       diskResult.ok,
    csvFiles,
    warnings,
  });

  // Parse port from URL
  let port = 3000;
  try { port = parseInt(new URL(serverUrl).port || '3000', 10); } catch (_) {}

  const ok = serverResult.reachable && ffmpegResult.ok && diskResult.ok;

  return { ok, port, routes: allRouteResults, csvFiles, warnings };
}

module.exports = { preflight };

// ---------------------------------------------------------------------------
// CLI usage: node preflight.js http://localhost:3000 /,/dashboard,/payroll
// ---------------------------------------------------------------------------
if (require.main === module) {
  const [,, serverUrl = 'http://localhost:3000', routesCsv = '/'] = process.argv;
  const routes = routesCsv.split(',').map(r => r.trim());
  preflight(serverUrl, routes).then(result => {
    process.exit(result.ok ? 0 : 1);
  });
}
