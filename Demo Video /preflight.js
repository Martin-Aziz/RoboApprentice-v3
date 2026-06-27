/**
 * preflight.js v6 — Pre-flight verification for video rendering pipeline.
 *
 * Call this at the top of render-video.js before any recording begins.
 *
 * Returns:
 *   {
 *     ok: boolean,
 *     port: number,
 *     routes: RouteStatus[],
 *     csvFiles: { clean: string, messy: string }[],
 *     warnings: string[],
 *     problemEvidence: { route: string, stats: { text: string, value: string }[] }[],
 *     mgInterludes: { route: string, pendingItems: number|null, kpiElements: string[] }[],
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
  reset:   '\x1b[0m',
  bold:    '\x1b[1m',
  dim:     '\x1b[2m',
  red:     '\x1b[31m',
  green:   '\x1b[32m',
  yellow:  '\x1b[33m',
  cyan:    '\x1b[36m',
  magenta: '\x1b[35m',
  white:   '\x1b[37m',
  bgRed:   '\x1b[41m',
};

const ok_   = (msg) => console.log(`${C.green}  ✔ ${C.reset}${msg}`);
const warn  = (msg) => console.log(`${C.yellow}  ⚠ ${C.reset}${msg}`);
const fail  = (msg) => console.log(`${C.red}  ✖ ${C.reset}${C.bold}${msg}${C.reset}`);
const info  = (msg) => console.log(`${C.cyan}  ℹ ${C.reset}${msg}`);
const head  = (msg) => console.log(`\n${C.bold}${C.white}${msg}${C.reset}`);

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
        ok_(`Server responded ${status} at ${serverUrl} (attempt ${attempt})`);
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
      if (passed) ok_(`${route}  →  ${status}`);
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
// 3 & 4 & 5 & 5b & 6 — Playwright visual checks
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
 *   - Check before-state indicators and KPI elements (step 5b)
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
    const result = {
      route,
      screenshot:     null,
      iframeOk:       null,
      uploadZoneOk:   null,
      modalFree:      null,
      // v6 additions
      pendingItems:   null,
      kpiElements:    [],
    };

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
        ok_(`  ${route} — iframes OK (${iframeResult.iframeCount} found)`);
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
        ok_(`  ${route} — WorkflowCta upload zone found (${uploadZone.selector})`);
        result.uploadZoneOk = true;
      } else if (uploadZone.found && !uploadZone.visible) {
        warn(`  ${route} — WorkflowCta upload zone found but not visible`);
        result.uploadZoneOk = false;
      } else {
        info(`  ${route} — No upload zone element detected (may not apply to this route)`);
        result.uploadZoneOk = null; // Not applicable
      }

      // Step 5b (v6): MG Interlude readiness — before-state indicators and KPI elements
      const mgInterludes = await page.evaluate(() => {
        // Check for PENDING / ERROR / MANUAL status items
        let pendingCount = 0;
        const statusSelectors = [
          '[data-status="pending"]',
          '[data-status="PENDING"]',
          '[data-status="error"]',
          '[data-status="ERROR"]',
          '[data-status="manual"]',
          '[data-status="MANUAL"]',
          '[class*="pending"]',
          '[class*="Pending"]',
          '[class*="error"]',
          '[class*="Error"]',
          '[class*="manual"]',
          '[class*="Manual"]',
        ];
        statusSelectors.forEach(sel => {
          pendingCount += document.querySelectorAll(sel).length;
        });
        // Also count text nodes containing these words in badge/chip/tag elements
        const badgeSelectors = ['.badge', '.chip', '.tag', '.status', '[class*="Badge"]', '[class*="Chip"]', '[class*="Tag"]', '[class*="Status"]'];
        badgeSelectors.forEach(sel => {
          document.querySelectorAll(sel).forEach(el => {
            const txt = (el.textContent || '').trim().toUpperCase();
            if (txt === 'PENDING' || txt === 'ERROR' || txt === 'MANUAL' || txt === 'FLAGGED') {
              pendingCount++;
            }
          });
        });

        // Check for numeric KPI elements — large numbers, %, currency
        const kpiFound = [];
        const allElements = Array.from(document.querySelectorAll('*'));
        const kpiPattern = /(\d[\d,]*(\.\d+)?%|\$[\d,]+(\.\d{2})?|\d{2,}(\.\d+)?[kKmMbB]?\s*(hrs?|hours?|days?|errors?|records?))/i;
        const largeNumberPattern = /^\s*[\$£€]?[\d,]{4,}(\.\d{1,2})?\s*[%kKmMbB]?\s*$/;

        for (const el of allElements) {
          // Only look at leaf-ish nodes with meaningful text
          if (el.children.length > 3) continue;
          const txt = (el.textContent || '').trim();
          if (!txt || txt.length > 80) continue;

          // Match KPI-like text: percentages, large currency, shorthand numbers
          if (kpiPattern.test(txt) || largeNumberPattern.test(txt)) {
            const rect = el.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              kpiFound.push(txt.replace(/\s+/g, ' ').slice(0, 40));
            }
          }
        }

        // De-duplicate and cap at 10
        const uniqueKpi = [...new Set(kpiFound)].slice(0, 10);

        return { pendingCount, kpiElements: uniqueKpi };
      });

      result.pendingItems = mgInterludes.pendingCount > 0 ? mgInterludes.pendingCount : null;
      result.kpiElements  = mgInterludes.kpiElements;

      if (mgInterludes.pendingCount > 0) {
        ok_(`  ${route} — MG Interlude: ${mgInterludes.pendingCount} before-state item(s) (PENDING/ERROR/MANUAL)`);
      } else {
        info(`  ${route} — MG Interlude: no before-state indicators found`);
      }
      if (mgInterludes.kpiElements.length > 0) {
        ok_(`  ${route} — KPI elements (${mgInterludes.kpiElements.length}): ${mgInterludes.kpiElements.slice(0, 3).join(' · ')}${mgInterludes.kpiElements.length > 3 ? ' …' : ''}`);
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
        ok_(`  ${route} — No visible modals/dialogs`);
        result.modalFree = true;
      } else {
        warn(`  ${route} — ${modalCount} modal(s) still visible after suppression`);
        result.modalFree = false;
      }

      // Step 3: Screenshot
      await page.screenshot({ path: screenshotPath, fullPage: false });
      ok_(`  ${route} — Screenshot saved → ${screenshotPath}`);
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
      ok_(`ffmpeg found: ${versionLine}`);
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
      ok_(`${availableMb} MB free (required: ${requiredMb} MB)`);
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
// 9. Pre-generate CSV sample files (clean versions)
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
    ok_(`Generated ${spec.name} (${spec.rows.length} rows) → ${filePath}`);
    generatedFiles.push(filePath);
  }

  return generatedFiles;
}

// ---------------------------------------------------------------------------
// 9b (v6). generateMessyCSV — produces intentionally dirty counterpart files
// ---------------------------------------------------------------------------
/**
 * generateMessyCSV(outputDir, specs)
 *
 * For each CSV spec, writes a clean file (spec.name) and a messy companion
 * file (spec.name replaced with *_messy.csv).
 *
 * Intentional problems injected into the messy file:
 *   - Duplicate rows (row[0] and row[2] are each repeated once)
 *   - Missing values (some cells are left blank)
 *   - Mixed date formats (MM/DD/YYYY and DD-MM-YYYY alongside ISO)
 *   - Extra whitespace in name fields (leading/trailing spaces)
 *   - Currency symbols in numeric fields ($1,234.56 instead of 1234.56)
 *
 * @param {string}   outputDir - directory to write files into (created if absent)
 * @param {object[]} specs     - same spec format as generateCsvFiles (default specs used if empty)
 * @returns {{ clean: string, messy: string }[]}
 */
function generateMessyCSV(outputDir, specs = []) {
  head('[ 9b/9 ] Messy CSV generation (v6)');
  fs.mkdirSync(outputDir, { recursive: true });

  const defaultSpecs = [
    {
      name: 'employees_sample.csv',
      headers: ['id', 'name', 'department', 'salary', 'start_date'],
      rows: [
        ['1', 'Alice Johnson',  'Engineering',  '95000',  '2021-03-15'],
        ['2', 'Bob Martinez',   'Sales',         '72000',  '2020-07-01'],
        ['3', 'Carol Williams', 'HR',             '68000',  '2019-11-20'],
        ['4', 'David Lee',      'Engineering',  '102000',  '2022-01-10'],
        ['5', 'Eva Chen',       'Marketing',     '75000',  '2021-09-05'],
      ],
      // column hints: which column index is a "date" and which is "numeric"
      dateColIdx:    4,
      numericColIdx: 3,
      nameColIdx:    1,
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
      dateColIdx:    1,
      numericColIdx: 2,
      nameColIdx:    null,
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
      dateColIdx:    1,
      numericColIdx: 2,
      nameColIdx:    null,
    },
  ];

  const specsToUse = specs.length > 0 ? specs : defaultSpecs;
  const results = [];

  // Helper: reformat an ISO date string to a messy alternative format
  function messyDate(isoDate, rowIndex) {
    // Try to parse yyyy-mm or yyyy-mm-dd
    const fullMatch = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const shortMatch = isoDate.match(/^(\d{4})-(\d{2})$/);
    if (fullMatch) {
      const [, yr, mo, dy] = fullMatch;
      // Alternate between MM/DD/YYYY and DD-MM-YYYY based on row parity
      return rowIndex % 2 === 0
        ? `${mo}/${dy}/${yr}`          // MM/DD/YYYY
        : `${dy}-${mo}-${yr}`;         // DD-MM-YYYY
    }
    if (shortMatch) {
      const [, yr, mo] = shortMatch;
      return rowIndex % 2 === 0 ? `${mo}/${yr}` : `${mo}-${yr}`;
    }
    return isoDate; // leave unchanged if unrecognised
  }

  // Helper: add currency symbol and comma-formatting to a numeric string
  function messyCurrency(numStr) {
    const n = parseFloat(numStr);
    if (isNaN(n)) return numStr;
    // Format with commas and prepend $
    const formatted = n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return `$${formatted}`;
  }

  for (const spec of specsToUse) {
    const cleanName = spec.name;
    const messyName = cleanName.replace(/\.csv$/i, '_messy.csv');
    const cleanPath = path.join(outputDir, cleanName);
    const messyPath = path.join(outputDir, messyName);

    // --- Write clean file ---
    const cleanContent = [
      spec.headers.join(','),
      ...spec.rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n') + '\n';
    fs.writeFileSync(cleanPath, cleanContent, 'utf8');
    ok_(`  Clean  → ${cleanPath} (${spec.rows.length} rows)`);

    // --- Build messy rows ---
    // 1. Start with a deep copy of the original rows
    let messyRows = spec.rows.map(row => [...row]);

    // 2. Duplicate rows 0 and 2 (if they exist)
    const dupeRow0 = spec.rows[0] ? [...spec.rows[0]] : null;
    const dupeRow2 = spec.rows[2] ? [...spec.rows[2]] : null;

    // 3. Apply per-cell transforms to all rows
    messyRows = messyRows.map((row, rowIdx) => {
      return row.map((cell, colIdx) => {
        // Missing value: blank out specific cells (row 1 col 1, row 3 col 2, row 4 col 0)
        if ((rowIdx === 1 && colIdx === (spec.nameColIdx ?? 1)) ||
            (rowIdx === 3 && colIdx === (spec.numericColIdx ?? 2)) ||
            (rowIdx === 4 && colIdx === 0)) {
          return '';
        }
        // Messy date format
        if (colIdx === spec.dateColIdx && rowIdx % 2 !== 0) {
          return messyDate(cell, rowIdx);
        }
        // Currency symbol in numeric fields (rows 0, 2, 4)
        if (colIdx === spec.numericColIdx && rowIdx % 2 === 0) {
          return messyCurrency(cell);
        }
        // Extra whitespace in name field (rows 2 and 3)
        if (spec.nameColIdx !== null && colIdx === spec.nameColIdx && (rowIdx === 2 || rowIdx === 3)) {
          return `  ${cell}  `;
        }
        return cell;
      });
    });

    // 4. Inject duplicate rows after original positions
    //    Insert dupe of row[0] after index 1, dupe of row[2] after index 4
    if (dupeRow0) messyRows.splice(1, 0, dupeRow0);  // after first row
    if (dupeRow2) {
      // After inserting dupeRow0, row[2] is now at index 3; dupe goes after index 4
      messyRows.splice(5, 0, dupeRow2);
    }

    // 5. Serialise
    const messyContent = [
      spec.headers.join(','),
      ...messyRows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n') + '\n';
    fs.writeFileSync(messyPath, messyContent, 'utf8');
    ok_(`  Messy  → ${messyPath} (${messyRows.length} rows, intentional errors injected)`);

    results.push({ clean: cleanPath, messy: messyPath });
  }

  return results;
}

// ---------------------------------------------------------------------------
// 9c (v6). Problem Evidence Collection — grep source files for pain-point stats
// ---------------------------------------------------------------------------
/**
 * collectProblemEvidence(routes, screenshotDir, sourceRoots)
 *
 * Searches the app's source files for metrics that indicate pain points.
 * Grep patterns: hours, minutes, days, errors, manual, rate, "% of", pending, flagged.
 *
 * @param {string[]} routes       - route list (used to label evidence by route)
 * @param {string}   sourceRoot   - root directory of the app's source (default: cwd)
 * @returns {{ route: string, stats: { text: string, value: string }[] }[]}
 *          Non-blocking — returns empty results on any failure.
 */
function collectProblemEvidence(routes, sourceRoot) {
  head('[ 9b ] Problem Evidence Collection (v6)');
  const root = sourceRoot || process.cwd();

  const grepPatterns = [
    'hours',
    'minutes',
    'days',
    'errors',
    'manual',
    'rate',
    '% of',
    'pending',
    'flagged',
  ];

  // Build a single grep pattern
  const combinedPattern = grepPatterns.join('|');

  // File extensions to search
  const fileExts = '\\.(js|jsx|ts|tsx|vue|svelte|html|json)$';

  let rawLines = [];
  try {
    const grepCmd = `grep -rniE "${combinedPattern}" "${root}" --include="*.js" --include="*.jsx" --include="*.ts" --include="*.tsx" --include="*.vue" --include="*.svelte" --include="*.html" --include="*.json" 2>/dev/null | head -200`;
    const output = execSync(grepCmd, { encoding: 'utf8', timeout: 15000 });
    rawLines = output.split('\n').filter(Boolean);
  } catch (e) {
    // Non-blocking: grep returning no results exits with code 1
    rawLines = [];
  }

  // Extract stat-like values from grep matches
  // Look for patterns like: "47 hours", "12%", "3.2 days", "$1,200", "23 errors"
  const statPattern = /(\d[\d,.]*\s*(?:%|hours?|mins?|minutes?|days?|errors?|records?|pending|flagged)|\$[\d,]+(?:\.\d{2})?|\d+\s*(?:manual|rate))/gi;

  const statsFound = [];
  for (const line of rawLines) {
    const matches = line.match(statPattern);
    if (matches) {
      // Extract the surrounding text snippet (up to 80 chars)
      const snippet = line.replace(/^[^:]+:[^:]+:/, '').trim().slice(0, 80);
      matches.forEach(val => {
        statsFound.push({ text: snippet, value: val.trim() });
      });
    }
  }

  // De-duplicate by value
  const seen = new Set();
  const uniqueStats = statsFound.filter(s => {
    const key = s.value.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 30); // cap at 30 findings

  if (uniqueStats.length > 0) {
    ok_(`Found ${uniqueStats.length} pain-point metric(s) in source files`);
    uniqueStats.slice(0, 5).forEach(s => {
      info(`  "${s.value}"  —  ${s.text.slice(0, 60)}`);
    });
    if (uniqueStats.length > 5) info(`  … and ${uniqueStats.length - 5} more`);
  } else {
    info('No pain-point metrics found in source files');
  }

  // Map to routes: since these are global source file findings (not route-specific),
  // attach all findings to the first route as a summary, plus one entry per route
  // that had KPI elements discovered in step 5b (merged by caller).
  const evidence = routes.map((route, idx) => ({
    route,
    stats: idx === 0 ? uniqueStats : [],
  }));

  return evidence;
}

// ---------------------------------------------------------------------------
// Print health summary (v6)
// ---------------------------------------------------------------------------
function printHealthSummary({ serverOk, routeResults, ffmpegOk, diskOk, csvFiles, warnings, problemEvidence, mgInterludes }) {
  head('='.repeat(56));
  head(' PRE-FLIGHT SUMMARY  (v6)');
  head('='.repeat(56));

  const passCount = routeResults.filter(r => r.ok !== false).length;
  const failCount = routeResults.filter(r => r.ok === false).length;

  // Count CSV pairs
  const csvPairCount = Array.isArray(csvFiles) && csvFiles.length > 0 && typeof csvFiles[0] === 'object'
    ? csvFiles.length
    : (csvFiles || []).length;

  console.log(`\n  Server     : ${serverOk  ? C.green + 'OK'   + C.reset : C.red + 'FAIL' + C.reset}`);
  console.log(  `  Routes     : ${C.green}${passCount} passed${C.reset}  ${failCount > 0 ? C.red + failCount + ' failed' + C.reset : ''}`);
  console.log(  `  ffmpeg     : ${ffmpegOk  ? C.green + 'OK'   + C.reset : C.red + 'MISSING' + C.reset}`);
  console.log(  `  Disk space : ${diskOk    ? C.green + 'OK'   + C.reset : C.red + 'LOW'  + C.reset}`);
  console.log(  `  CSV files  : ${C.green}${csvPairCount} spec(s) (clean + messy pairs)${C.reset}`);

  // v6: Problem evidence
  if (problemEvidence && problemEvidence.length > 0) {
    const totalStats = problemEvidence.reduce((sum, pe) => sum + pe.stats.length, 0);
    console.log(`  Pain-point : ${totalStats > 0 ? C.green + totalStats + ' metric(s) found' + C.reset : C.dim + 'none detected' + C.reset}`);
    if (totalStats > 0) {
      const allStats = problemEvidence.flatMap(pe => pe.stats).slice(0, 3);
      allStats.forEach(s => console.log(`    ${C.dim}→ ${C.reset}${s.value}  ${C.dim}(${s.text.slice(0, 50)})${C.reset}`));
    }
  }

  // v6: MG Interlude readiness
  if (mgInterludes && mgInterludes.length > 0) {
    const routesWithPending  = mgInterludes.filter(m => m.pendingItems !== null && m.pendingItems > 0);
    const routesWithKpi      = mgInterludes.filter(m => m.kpiElements && m.kpiElements.length > 0);
    console.log(`  MG Ready   : ${routesWithPending.length} route(s) with before-state  |  ${routesWithKpi.length} route(s) with KPI elements`);
    routesWithPending.forEach(m => {
      console.log(`    ${C.dim}→ ${C.reset}${m.route}  ${C.yellow}${m.pendingItems} pending item(s)${C.reset}`);
    });
    routesWithKpi.forEach(m => {
      console.log(`    ${C.dim}→ ${C.reset}${m.route}  KPIs: ${C.cyan}${m.kpiElements.slice(0, 3).join(' · ')}${C.reset}`);
    });
  }

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
 * @param {string}   options.sourceRoot      - root of the app's source files for problem-evidence grep
 *
 * @returns {Promise<{
 *   ok: boolean,
 *   port: number,
 *   routes: object[],
 *   csvFiles: { clean: string, messy: string }[],
 *   warnings: string[],
 *   problemEvidence: { route: string, stats: { text: string, value: string }[] }[],
 *   mgInterludes: { route: string, pendingItems: number|null, kpiElements: string[] }[],
 * }>}
 */
async function preflight(serverUrl, routesToCheck = ['/'], playwrightPath = null, options = {}) {
  const {
    screenshotDir = path.join(process.cwd(), 'preflight-screenshots'),
    csvOutputDir  = path.join(process.cwd(), 'sample-data'),
    csvSpecs      = [],
    sourceRoot    = process.cwd(),
  } = options;

  head('='.repeat(56));
  head(' VIDEO RENDERER — PRE-FLIGHT CHECKS  (v6)');
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
        if (r.error)              warnings.push(`Visual check failed for ${r.route}: ${r.error}`);
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

  // ---- 9. CSV generation (clean + messy pairs) ----
  const csvFiles = generateMessyCSV(csvOutputDir, csvSpecs);

  // ---- 9b. Problem evidence collection (non-blocking) ----
  let problemEvidence = [];
  try {
    problemEvidence = collectProblemEvidence(routesToCheck, sourceRoot);
  } catch (e) {
    warn(`Problem evidence collection failed (non-blocking): ${e.message}`);
  }

  // ---- Build mgInterludes from visual results ----
  const mgInterludes = visualResults.map(r => ({
    route:        r.route,
    pendingItems: r.pendingItems ?? null,
    kpiElements:  r.kpiElements  ?? [],
  }));

  // ---- Summary ----
  const allRouteResults = routeResults.map(r => {
    const visual = visualResults.find(v => v.route === r.route) || {};
    return { ...r, ...visual };
  });

  printHealthSummary({
    serverOk:       serverResult.reachable,
    routeResults:   allRouteResults,
    ffmpegOk:       ffmpegResult.ok,
    diskOk:         diskResult.ok,
    csvFiles,
    warnings,
    problemEvidence,
    mgInterludes,
  });

  // Parse port from URL
  let port = 3000;
  try { port = parseInt(new URL(serverUrl).port || '3000', 10); } catch (_) {}

  const isOk = serverResult.reachable && ffmpegResult.ok && diskResult.ok;

  return {
    ok:              isOk,
    port,
    routes:          allRouteResults,
    csvFiles,
    warnings,
    problemEvidence,
    mgInterludes,
  };
}

module.exports = { preflight, generateMessyCSV };

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
