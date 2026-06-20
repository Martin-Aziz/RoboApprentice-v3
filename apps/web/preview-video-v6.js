const { chromium } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "video-preview-v6");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function style(page, x, y) {
  await page.evaluate(({ x, y }) => {
    const root = document.body.firstElementChild;
    root.style.zoom = "0.52";
    root.style.width = "192.4%";
    const old = document.getElementById("preview-film-style");
    old?.remove();
    const style = document.createElement("style");
    style.id = "preview-film-style";
    style.textContent = `
      nextjs-portal,[data-nextjs-dev-tools-button]{display:none!important}
      #preview-halo{position:fixed;z-index:99999;width:86px;height:86px;border:2px solid #38bdf8;border-radius:50%;
        box-shadow:0 0 0 7px rgba(56,189,248,.1),0 0 28px rgba(56,189,248,.35);
        left:${x - 43}px;top:${y - 43}px;pointer-events:none}
    `;
    document.head.appendChild(style);
    document.getElementById("preview-halo")?.remove();
    const halo = document.createElement("div");
    halo.id = "preview-halo";
    document.body.appendChild(halo);
  }, { x, y });
}

async function main() {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto("http://localhost:3000/app/teach", { waitUntil: "domcontentloaded" });
  await sleep(1800);
  await style(page, 790, 70);
  await page.screenshot({ path: path.join(OUT, "01-full-page-run-workflow.png") });

  await page.getByText("Run workflow", { exact: false }).first().click();
  await sleep(9000);
  await page.getByText("Interpretation", { exact: true }).scrollIntoViewIfNeeded();
  await style(page, 660, 360);
  await page.screenshot({ path: path.join(OUT, "02-streaming-generated-steps.png") });

  await sleep(18000);
  await page.getByText("Pick Bracket A learned", { exact: false }).scrollIntoViewIfNeeded();
  await style(page, 720, 500);
  await page.screenshot({ path: path.join(OUT, "03-complete-generated-policy.png") });
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
