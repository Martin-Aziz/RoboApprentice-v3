import { chromium } from './apps/web/node_modules/@playwright/test/index.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const screenshotDir = path.join(__dirname, 'app-screenshots-hd');

// Ensure directory exists
if (!fs.existsSync(screenshotDir)) {
  fs.mkdirSync(screenshotDir, { recursive: true });
}

async function main() {
  const browser = await chromium.launch();
  const context = await browser.createContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();

  try {
    console.log('📱 Navigating to http://localhost:3000...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    console.log('📸 Capturing screenshot 1: Homepage hero...');
    await page.screenshot({
      path: path.join(screenshotDir, '01-homepage-hero.png'),
      fullPage: false
    });

    console.log('📸 Capturing screenshot 2: Full homepage...');
    await page.screenshot({
      path: path.join(screenshotDir, '02-homepage-full.png'),
      fullPage: true
    });

    console.log('📸 Capturing screenshot 3: Scrolled view...');
    await page.evaluate(() => window.scrollBy(0, 500));
    await page.waitForTimeout(500);
    await page.screenshot({
      path: path.join(screenshotDir, '03-homepage-scrolled.png'),
      fullPage: false
    });

    // Navigate to teach console
    console.log('🔗 Navigating to /app/teach...');
    const teachBtn = page.locator('a[href="/app/teach"]').first();
    if (await teachBtn.isVisible()) {
      await teachBtn.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      console.log('📸 Capturing screenshot 4: Teach page viewport...');
      await page.screenshot({
        path: path.join(screenshotDir, '04-teach-viewport.png'),
        fullPage: false
      });

      console.log('📸 Capturing screenshot 5: Teach page full...');
      await page.screenshot({
        path: path.join(screenshotDir, '05-teach-full.png'),
        fullPage: true
      });

      // Scroll down on teach page
      console.log('📸 Capturing screenshot 6: Teach page scrolled...');
      await page.evaluate(() => window.scrollBy(0, 400));
      await page.waitForTimeout(500);
      await page.screenshot({
        path: path.join(screenshotDir, '06-teach-scrolled.png'),
        fullPage: false
      });
    }

    console.log('\n✅ Screenshot capture complete!\n');
    const files = fs.readdirSync(screenshotDir).sort();
    console.log(`📁 Saved ${files.length} screenshots to: ${screenshotDir}\n`);
    files.forEach((f, i) => {
      const sz = (fs.statSync(path.join(screenshotDir, f)).size / 1024 / 1024).toFixed(2);
      console.log(`   ${i + 1}. ${f} (${sz} MB)`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main();
