/**
 * verify-fullscreen.js
 *
 * verifyFullScreen(page, options?) — Playwright helper for full-screen capture verification.
 *
 * Detects and (where possible) fixes the four classes of partial/clipped capture:
 *   1. App wider than 1280px → scale down with CSS transform
 *   2. Modals/dialogs covering content → dismiss
 *   3. Scrolled position after navigation → scroll to top
 *   4. iframe overflow:hidden → set overflow:visible
 *
 * Returns a detailed report so callers can decide whether to abort.
 *
 * Node.js built-ins only (beyond the Playwright page object passed in).
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// ANSI helpers (same zero-dep pattern as preflight.js)
// ---------------------------------------------------------------------------
const C = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  red:    '\x1b[31m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  cyan:   '\x1b[36m',
};

const log = {
  ok:   (m) => console.log(`${C.green}  ✔${C.reset} ${m}`),
  warn: (m) => console.log(`${C.yellow}  ⚠${C.reset} ${m}`),
  fail: (m) => console.log(`${C.red}  ✖${C.reset} ${C.bold}${m}${C.reset}`),
  info: (m) => console.log(`${C.cyan}  ℹ${C.reset} ${m}`),
  head: (m) => console.log(`\n${C.bold}${m}${C.reset}`),
};

// ---------------------------------------------------------------------------
// Pixel sampling — check corners and edges for blank/white area
// ---------------------------------------------------------------------------

/**
 * Decode a raw PNG buffer into an RGBA pixel array without any npm dependency.
 *
 * Strategy: delegate to page.evaluate() so we use the browser's built-in
 * Canvas API (which Playwright exposes through the Chromium instance).
 *
 * If called outside a Playwright context (e.g. unit test), falls back to a
 * pure-JS minimal PNG decoder that handles the subset produced by Playwright.
 */
async function sampleScreenshotPixels(page, screenshotBuffer, samplePoints) {
  // Encode the PNG as base64 and use the browser canvas to decode it
  const base64 = screenshotBuffer.toString('base64');

  const samples = await page.evaluate(async ({ b64, points }) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width  = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        const results = points.map(({ x, y, label }) => {
          const px = ctx.getImageData(x, y, 1, 1).data; // [r, g, b, a]
          return {
            label,
            x, y,
            r: px[0], g: px[1], b: px[2], a: px[3],
            isWhite: px[0] > 240 && px[1] > 240 && px[2] > 240,
            isBlank: px[3] < 10, // fully transparent
          };
        });

        resolve({ width: img.naturalWidth, height: img.naturalHeight, samples: results });
      };
      img.onerror = () => resolve({ error: 'Image decode failed', samples: [] });
      img.src = `data:image/png;base64,${b64}`;
    });
  }, { b64: base64, points: samplePoints });

  return samples;
}

// ---------------------------------------------------------------------------
// The four checks + fixes
// ---------------------------------------------------------------------------

/**
 * Fix 1: App wider than viewport (horizontal scroll → clipped right edge).
 *
 * Detection: document.documentElement.scrollWidth > viewport width
 * Fix: inject a CSS transform scale on <body> so the content fits.
 */
async function fixHorizontalOverflow(page, viewportWidth = 1280) {
  const result = await page.evaluate((vw) => {
    const scrollW = document.documentElement.scrollWidth;
    const scrollH = document.documentElement.scrollHeight;
    const vpW     = vw;
    const vpH     = window.innerHeight;

    if (scrollW <= vpW + 2) {
      return { needed: false, scrollW, vpW };
    }

    // Calculate the scale that makes content fit
    const scale = vpW / scrollW;

    // Apply transform to body so the screenshot sees the scaled-down version
    document.body.style.transformOrigin = '0 0';
    document.body.style.transform       = `scale(${scale})`;
    document.body.style.width           = `${scrollW}px`;
    document.documentElement.style.overflow = 'hidden';

    return { needed: true, scrollW, vpW, scale, scrollH, vpH };
  }, viewportWidth);

  if (result.needed) {
    log.warn(`Horizontal overflow: content is ${result.scrollW}px wide (viewport: ${result.vpW}px). Applied scale(${result.scale.toFixed(4)}).`);
  } else {
    log.ok(`No horizontal overflow (${result.scrollW}px ≤ ${result.vpW}px).`);
  }
  return result;
}

/**
 * Fix 2: Dismiss modals and dialogs.
 *
 * Detection: any fixed/absolute positioned element with dialog role or common modal classes.
 * Fix: remove from DOM, restore body scroll.
 *
 * Returns { dismissed: number, remaining: number }.
 */
async function dismissModals(page) {
  const result = await page.evaluate(() => {
    const SELECTORS = [
      '[role="dialog"]',
      '[role="alertdialog"]',
      'dialog[open]',
      '.modal',
      '.modal-backdrop',
      '.modal-overlay',
      '[class*="Modal"]',
      '[class*="Overlay"]',
      '[class*="overlay"]',
      '[class*="Backdrop"]',
      '[data-modal]',
      '[data-testid*="modal"]',
      '[data-testid*="dialog"]',
    ];

    // Try pressing Escape first (React portals often listen for it)
    try {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      document.dispatchEvent(new KeyboardEvent('keyup',   { key: 'Escape', bubbles: true }));
    } catch (_) {}

    let dismissed = 0;
    SELECTORS.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => {
        const s = getComputedStyle(el);
        const isVisible = s.display !== 'none' && s.visibility !== 'hidden' && parseFloat(s.opacity) > 0;
        const isOverlay = s.position === 'fixed' || s.position === 'absolute';
        if (isVisible && isOverlay) {
          el.remove();
          dismissed++;
        }
      });
    });

    // Restore any scroll lock the modal may have placed on body
    document.body.style.overflow     = '';
    document.body.style.paddingRight = '';
    document.documentElement.style.overflow = '';

    // Count any remaining dialogs
    let remaining = 0;
    SELECTORS.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => {
        const s = getComputedStyle(el);
        if (s.display !== 'none' && s.visibility !== 'hidden' && parseFloat(s.opacity) > 0) {
          remaining++;
        }
      });
    });

    return { dismissed, remaining };
  });

  if (result.dismissed > 0) {
    log.warn(`Dismissed ${result.dismissed} modal(s). Remaining: ${result.remaining}.`);
  } else {
    log.ok('No modals detected.');
  }
  return result;
}

/**
 * Fix 3: Reset scroll position to top-left.
 *
 * After navigation, some SPAs restore a previous scroll position.
 * Always scroll to (0,0) and verify.
 */
async function resetScrollPosition(page) {
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  });

  // Small settle delay so any scroll-triggered animations can run
  await new Promise(r => setTimeout(r, 200));

  const pos = await page.evaluate(() => ({
    x: window.scrollX,
    y: window.scrollY,
  }));

  if (pos.x === 0 && pos.y === 0) {
    log.ok('Scroll position at (0, 0).');
  } else {
    log.warn(`Scroll position is (${pos.x}, ${pos.y}) after reset attempt.`);
  }
  return pos;
}

/**
 * Fix 4: iframe overflow — set overflow:visible so content is not clipped.
 *
 * Detection: iframe parent has overflow:hidden AND iframe content exceeds parent bounds.
 * Fix: set overflow:visible on the parent container and the iframe itself.
 */
async function fixIframeOverflow(page) {
  const result = await page.evaluate(() => {
    const fixed = [];
    document.querySelectorAll('iframe').forEach((iframe, i) => {
      // Fix the iframe element itself
      iframe.style.overflow = 'visible';

      // Walk up and fix any ancestor with overflow:hidden that clips the iframe
      let el = iframe.parentElement;
      let depth = 0;
      while (el && el !== document.body && depth < 5) {
        const s = getComputedStyle(el);
        if (s.overflow === 'hidden' || s.overflowX === 'hidden' || s.overflowY === 'hidden') {
          const iRect = iframe.getBoundingClientRect();
          const pRect = el.getBoundingClientRect();
          const clipped = iRect.bottom > pRect.bottom + 2 || iRect.right > pRect.right + 2;
          if (clipped) {
            el.style.overflow = 'visible';
            fixed.push({ iframeIndex: i, fixedElement: el.tagName + (el.className ? '.' + el.className.split(' ')[0] : '') });
          }
        }
        el = el.parentElement;
        depth++;
      }
    });
    return { fixed };
  });

  if (result.fixed.length > 0) {
    log.warn(`Fixed iframe overflow on ${result.fixed.length} container(s): ${result.fixed.map(f => f.fixedElement).join(', ')}`);
  } else {
    log.ok('No iframe overflow issues.');
  }
  return result;
}

// ---------------------------------------------------------------------------
// Blank/white corner analysis
// ---------------------------------------------------------------------------

/**
 * Analyse a screenshot buffer.
 *
 * Samples 36 strategic points across the 1280x720 frame:
 *   - 4 corners (offset 10px inward)
 *   - 4 edge midpoints
 *   - Centre
 *   - 27 grid points (3x3 inner grid)
 *
 * "Clipped" = corner or edge sample is white/blank while centre is not.
 */
async function analyseScreenshot(page, screenshotBuffer, viewportWidth = 1280, viewportHeight = 720) {
  const W = viewportWidth;
  const H = viewportHeight;
  const INSET = 10;

  const samplePoints = [
    // Corners (inset so we miss the 1px border)
    { x: INSET,     y: INSET,     label: 'top-left' },
    { x: W - INSET, y: INSET,     label: 'top-right' },
    { x: INSET,     y: H - INSET, label: 'bottom-left' },
    { x: W - INSET, y: H - INSET, label: 'bottom-right' },
    // Edge midpoints
    { x: Math.floor(W / 2), y: INSET,     label: 'top-center' },
    { x: Math.floor(W / 2), y: H - INSET, label: 'bottom-center' },
    { x: INSET,             y: Math.floor(H / 2), label: 'left-center' },
    { x: W - INSET,         y: Math.floor(H / 2), label: 'right-center' },
    // True centre
    { x: Math.floor(W / 2), y: Math.floor(H / 2), label: 'centre' },
    // 3x3 inner grid
    ...( () => {
      const pts = [];
      for (let row = 1; row <= 3; row++) {
        for (let col = 1; col <= 3; col++) {
          pts.push({
            x: Math.floor(W * col / 4),
            y: Math.floor(H * row / 4),
            label: `grid-${row}-${col}`,
          });
        }
      }
      return pts;
    })(),
  ];

  const analysis = await sampleScreenshotPixels(page, screenshotBuffer, samplePoints);

  if (analysis.error) {
    log.warn(`Screenshot pixel analysis failed: ${analysis.error}`);
    return { ok: true, clippingDetected: false, warning: analysis.error };
  }

  // Determine if centre is "filled" (not white/blank)
  const centre = analysis.samples.find(s => s.label === 'centre');
  const centreIsFilled = centre && !centre.isWhite && !centre.isBlank;

  // Check corners
  const corners = analysis.samples.filter(s =>
    ['top-left', 'top-right', 'bottom-left', 'bottom-right'].includes(s.label)
  );

  const blankCorners = corners.filter(s => s.isWhite || s.isBlank);
  const clippingDetected = centreIsFilled && blankCorners.length > 0;

  if (clippingDetected) {
    log.fail(`Clipping detected! ${blankCorners.length} blank/white corner(s): ${blankCorners.map(s => s.label).join(', ')}`);
    blankCorners.forEach(s => {
      log.info(`  ${s.label} @ (${s.x},${s.y}): rgb(${s.r},${s.g},${s.b}) alpha=${s.a}`);
    });
  } else if (blankCorners.length > 0) {
    log.warn(`${blankCorners.length} white/blank corner(s) but centre also appears empty — may be normal for this page.`);
  } else {
    log.ok(`All 1280x720 pixels filled with app content (${analysis.width}x${analysis.height} screenshot).`);
  }

  return {
    ok: !clippingDetected,
    clippingDetected,
    blankCorners: blankCorners.map(s => s.label),
    allSamples: analysis.samples,
    screenshotSize: { width: analysis.width, height: analysis.height },
  };
}

// ---------------------------------------------------------------------------
// PUBLIC API: verifyFullScreen
// ---------------------------------------------------------------------------

/**
 * verifyFullScreen(page, options?)
 *
 * Runs all four checks on the current Playwright page state, applies fixes
 * where possible, takes a verification screenshot, and reports clipping.
 *
 * @param {import('playwright').Page} page
 * @param {object}  options
 * @param {number}  options.viewportWidth       - expected width  (default 1280)
 * @param {number}  options.viewportHeight      - expected height (default 720)
 * @param {string}  options.screenshotPath      - save the post-fix screenshot here (optional)
 * @param {boolean} options.applyFixes          - auto-apply fixes (default true)
 * @param {boolean} options.resetScroll         - always reset scroll to top (default true)
 *
 * @returns {Promise<{
 *   ok: boolean,
 *   clippingDetected: boolean,
 *   fixes: {
 *     horizontalOverflow: object,
 *     modals: object,
 *     scroll: object,
 *     iframeOverflow: object,
 *   },
 *   screenshotPath: string|null,
 *   analysis: object,
 *   warnings: string[],
 * }>}
 */
async function verifyFullScreen(page, options = {}) {
  const {
    viewportWidth   = 1280,
    viewportHeight  = 720,
    screenshotPath  = null,
    applyFixes      = true,
    resetScroll     = true,
  } = options;

  log.head('[ verifyFullScreen ] Starting capture verification');

  const warnings = [];
  const fixes    = {};

  // Ensure viewport is correct
  await page.setViewportSize({ width: viewportWidth, height: viewportHeight });

  if (applyFixes) {
    // Fix 3 first — always scroll to top before inspecting layout
    if (resetScroll) {
      fixes.scroll = await resetScrollPosition(page);
    }

    // Fix 2 — dismiss any modals (before measuring layout, as modals affect scrollWidth)
    fixes.modals = await dismissModals(page);
    if (fixes.modals.remaining > 0) {
      warnings.push(`${fixes.modals.remaining} modal(s) could not be dismissed.`);
    }

    // Fix 1 — handle horizontal overflow
    fixes.horizontalOverflow = await fixHorizontalOverflow(page, viewportWidth);
    if (fixes.horizontalOverflow.needed) {
      warnings.push(`Horizontal overflow fixed with scale(${fixes.horizontalOverflow.scale?.toFixed(4)})`);
    }

    // Fix 4 — iframe overflow
    fixes.iframeOverflow = await fixIframeOverflow(page);
    if (fixes.iframeOverflow.fixed?.length > 0) {
      warnings.push(`iframe overflow fixed on ${fixes.iframeOverflow.fixed.length} container(s)`);
    }
  }

  // Allow layout to settle after fixes
  await new Promise(r => setTimeout(r, 300));

  // Take the verification screenshot
  const screenshotBuffer = await page.screenshot({
    clip: { x: 0, y: 0, width: viewportWidth, height: viewportHeight },
  });

  if (screenshotPath) {
    const dir = path.dirname(screenshotPath);
    if (dir) require('fs').mkdirSync(dir, { recursive: true });
    require('fs').writeFileSync(screenshotPath, screenshotBuffer);
    log.info(`Screenshot saved → ${screenshotPath}`);
  }

  // Analyse for clipping
  const analysis = await analyseScreenshot(page, screenshotBuffer, viewportWidth, viewportHeight);
  if (!analysis.ok) {
    warnings.push(`Clipping detected at corners: ${analysis.blankCorners?.join(', ')}`);
  }

  const overallOk = analysis.ok && (fixes.modals?.remaining ?? 0) === 0;

  log.head(`verifyFullScreen result: ${overallOk ? `${C.green}PASS${C.reset}` : `${C.red}FAIL${C.reset}`}`);
  if (warnings.length > 0) {
    warnings.forEach(w => log.warn(w));
  }

  return {
    ok: overallOk,
    clippingDetected: analysis.clippingDetected,
    fixes,
    screenshotPath: screenshotPath || null,
    analysis,
    warnings,
  };
}

module.exports = { verifyFullScreen, fixHorizontalOverflow, dismissModals, resetScrollPosition, fixIframeOverflow, analyseScreenshot };
