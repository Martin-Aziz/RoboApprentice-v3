import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function captureScreenshots() {
  const outputDir = path.join(__dirname, 'app-screenshots-hd');

  // Create output directory
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    console.log('Navigating to http://localhost:3000...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle0', timeout: 30000 });

    console.log('Page loaded, waiting for render...');
    await page.waitForTimeout(2000);

    // Screenshot 1: Full homepage
    console.log('Capturing screenshot 1: Full homepage...');
    await page.screenshot({
      path: path.join(outputDir, '01-homepage-full.png'),
      fullPage: true
    });

    // Screenshot 2: Hero viewport
    console.log('Capturing screenshot 2: Hero viewport...');
    await page.screenshot({
      path: path.join(outputDir, '02-hero-viewport.png')
    });

    // Screenshot 3: Click "See it work in 30 seconds" button
    console.log('Clicking "See it work" button...');
    const seeItWorkBtn = await page.$('a[href="/app/teach"]');
    if (seeItWorkBtn) {
      await seeItWorkBtn.click();
      await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(2000);

      console.log('Capturing screenshot 3: Teach page...');
      await page.screenshot({
        path: path.join(outputDir, '03-teach-page-full.png'),
        fullPage: true
      });

      console.log('Capturing screenshot 4: Teach viewport...');
      await page.screenshot({
        path: path.join(outputDir, '04-teach-viewport.png')
      });
    }

    // Go back to homepage for another view
    console.log('Navigating back to homepage...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle0', timeout: 30000 });
    await page.waitForTimeout(1000);

    // Screenshot 5: Scrolled homepage
    console.log('Scrolling and capturing...');
    await page.evaluate(() => window.scrollBy(0, 400));
    await page.waitForTimeout(500);
    await page.screenshot({
      path: path.join(outputDir, '05-homepage-scrolled.png')
    });

    console.log(`\n✅ Screenshots captured successfully!`);
    console.log(`📁 Saved to: ${outputDir}\n`);

    const files = fs.readdirSync(outputDir).sort();
    console.log('Files:');
    files.forEach((file, i) => {
      const filePath = path.join(outputDir, file);
      const stats = fs.statSync(filePath);
      const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
      console.log(`  ${i + 1}. ${file} (${sizeMB} MB)`);
    });

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

captureScreenshots();
