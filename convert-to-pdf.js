const { chromium } = require('./node_modules/.pnpm/playwright@1.60.0/node_modules/playwright');
const path = require('path');

async function convertHtmlToPdf() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  const files = [
    { html: '/tmp/1.html', pdf: '/Users/martin/Documents/RoboApprentice-v3/docs/files/1-cofounder-briefing.pdf', title: 'Cofounder Briefing' },
    { html: '/tmp/2.html', pdf: '/Users/martin/Documents/RoboApprentice-v3/docs/files/2-demo-video-script.pdf', title: 'Demo Video Script' },
    { html: '/tmp/3.html', pdf: '/Users/martin/Documents/RoboApprentice-v3/docs/files/3-seo-geo-website-playbook.pdf', title: 'SEO/Geo Website Playbook' },
  ];

  for (const { html, pdf, title } of files) {
    try {
      const filePath = `file://${html}`;
      await page.goto(filePath, { waitUntil: 'networkidle' });

      await page.pdf({
        path: pdf,
        format: 'A4',
        margin: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' },
        printBackground: true,
      });

      console.log(`✓ ${title}: ${pdf}`);
    } catch (error) {
      console.log(`✗ ${title}: ${error.message}`);
    }
  }

  await browser.close();

  // Verify files
  const fs = require('fs');
  console.log('\n=== Conversion Summary ===');
  for (const { pdf, title } of files) {
    if (fs.existsSync(pdf)) {
      const size = fs.statSync(pdf).size;
      const sizeMb = (size / 1024 / 1024).toFixed(2);
      console.log(`✓ ${title}: ${sizeMb} MB`);
    } else {
      console.log(`✗ ${title}: File not found`);
    }
  }
}

convertHtmlToPdf().catch(console.error);
