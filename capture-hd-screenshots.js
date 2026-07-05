const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function captureScreenshots() {
  const outputDir = path.join(__dirname, 'app-screenshots-hd');

  // Create output directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const browser = await chromium.launch();
  const context = await browser.createContext({
    viewport: { width: 1920, height: 1080 }, // HD resolution
  });
  const page = await context.newPage();

  try {
    console.log('Navigating to http://localhost:3000...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

    console.log('Page loaded, waiting for full render...');
    await page.waitForTimeout(2000);

    // Screenshot 1: Full homepage
    console.log('Capturing screenshot 1: Full homepage...');
    await page.screenshot({
      path: path.join(outputDir, '01-homepage-full.png'),
      fullPage: true,
      scale: 'device'
    });

    // Screenshot 2: Hero section (viewport height)
    console.log('Capturing screenshot 2: Hero section...');
    await page.screenshot({
      path: path.join(outputDir, '02-hero-section.png'),
      scale: 'device'
    });

    // Screenshot 3: Click "Open Console" button and wait for page load
    console.log('Clicking "Open Console" button...');
    const openConsoleBtn = await page.locator('a[href="/app"]').first();
    if (await openConsoleBtn.isVisible()) {
      await openConsoleBtn.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      console.log('Capturing screenshot 3: Console page...');
      await page.screenshot({
        path: path.join(outputDir, '03-console-page.png'),
        fullPage: true,
        scale: 'device'
      });

      // Screenshot 4: Console viewport
      console.log('Capturing screenshot 4: Console viewport...');
      await page.screenshot({
        path: path.join(outputDir, '04-console-viewport.png'),
        scale: 'device'
      });

      // Screenshot 5: Try to scroll and capture more of the console
      console.log('Scrolling and capturing screenshot 5...');
      await page.evaluate(() => window.scrollBy(0, 500));
      await page.waitForTimeout(500);
      await page.screenshot({
        path: path.join(outputDir, '05-console-scrolled.png'),
        scale: 'device'
      });
    }

    console.log(`\n✅ Screenshots captured successfully!`);
    console.log(`📁 Saved to: ${outputDir}`);
    console.log(`\nScreenshots:`);
    const files = fs.readdirSync(outputDir).sort();
    files.forEach((file, i) => {
      const filePath = path.join(outputDir, file);
      const stats = fs.statSync(filePath);
      console.log(`  ${i + 1}. ${file} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
    });

  } catch (error) {
    console.error('Error capturing screenshots:', error);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

captureScreenshots();
