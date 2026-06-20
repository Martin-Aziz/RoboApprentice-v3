const { chromium } = require('./node_modules/.pnpm/playwright@1.60.0/node_modules/playwright');
const fs = require('fs');
const path = require('path');

const screenshotsDir = '/Users/martin/Documents/RoboApprentice-v3/docs/screenshots';

// Ensure screenshots directory exists
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

const pages = [
  { name: '01-home', url: 'http://localhost:3000' },
  { name: '02-dashboard', url: 'http://localhost:3000/app' },
  { name: '03-roi', url: 'http://localhost:3000/app/roi' },
  { name: '04-tasks', url: 'http://localhost:3000/app/tasks' },
  { name: '05-library', url: 'http://localhost:3000/app/library' },
  { name: '06-executions', url: 'http://localhost:3000/app/executions' },
  { name: '07-teach', url: 'http://localhost:3000/app/teach' },
  { name: '08-skills', url: 'http://localhost:3000/app/skills' },
  { name: '09-robots', url: 'http://localhost:3000/app/robots' },
  { name: '10-workcell', url: 'http://localhost:3000/app/workcell' },
  { name: '11-settings', url: 'http://localhost:3000/app/settings' },
  { name: '12-billing', url: 'http://localhost:3000/app/billing' },
  { name: '13-export', url: 'http://localhost:3000/app/export' },
];

async function captureScreenshots() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  const results = [];

  for (const { name, url } of pages) {
    try {
      console.log(`Navigating to: ${url}`);
      await page.goto(url, { waitUntil: 'networkidle', timeout: 10000 });

      // Wait a bit for any animations to complete
      await page.waitForTimeout(1000);

      // Get the full height needed to capture all content
      const fullHeight = await page.evaluate(() => document.body.scrollHeight);
      await page.setViewportSize({ width: 1920, height: Math.min(fullHeight + 100, 4000) });

      const screenshotPath = path.join(screenshotsDir, `${name}.png`);
      await page.screenshot({
        path: screenshotPath,
        fullPage: true,
        type: 'png',
      });

      results.push({ name, url, status: 'success', file: `${name}.png` });
      console.log(`✓ ${name}: ${screenshotPath}`);
    } catch (error) {
      results.push({ name, url, status: 'failed', error: error.message });
      console.log(`✗ ${name}: ${error.message}`);
    }
  }

  await browser.close();

  // Print summary
  console.log('\n=== Screenshot Capture Summary ===');
  results.forEach((result) => {
    const icon = result.status === 'success' ? '✓' : '✗';
    console.log(`${icon} ${result.name}: ${result.status}`);
    if (result.message) console.log(`  → ${result.message}`);
    if (result.error) console.log(`  → ${result.error}`);
  });

  const successCount = results.filter((r) => r.status === 'success').length;
  console.log(
    `\nTotal: ${successCount}/${results.length} screenshots captured successfully`
  );
  console.log(`Saved to: ${screenshotsDir}`);
}

captureScreenshots().catch(console.error);
