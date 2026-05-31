const { chromium } = require("/Users/martin/node_modules/@playwright/test");
const path = require("path");

const W = 1280;
const H = 720;
const SRV = "http://localhost:3000";
const SHOT = path.join(__dirname, "video-preflight-teach.png");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function cleanupChrome(page) {
  await page.evaluate(() => {
    const cleanupDoc = (doc) => {
      if (!doc?.body) return;
      if (!doc.getElementById("aurevix-recorder-cleanup")) {
        const style = doc.createElement("style");
        style.id = "aurevix-recorder-cleanup";
        style.textContent = `
          nextjs-portal,
          [data-nextjs-dialog-overlay],
          [data-nextjs-toast],
          [data-nextjs-dev-tools-button],
          [data-nextjs-dev-tools-button-wrapper],
          [data-nextjs-build-error],
          [data-nextjs-terminal],
          [data-nextjs-errors-dialog],
          [aria-label*="Next.js"],
          [aria-label*="NextJS"],
          [aria-label*="Issue"],
          [aria-label*="issue"] {
            display: none !important;
            visibility: hidden !important;
            pointer-events: none !important;
          }
        `;
        doc.head?.appendChild(style);
      }

      doc.querySelectorAll(
        "nextjs-portal, [data-nextjs-dialog-overlay], [data-nextjs-toast], [data-nextjs-dev-tools-button], [data-nextjs-dev-tools-button-wrapper], [data-nextjs-build-error], [data-nextjs-terminal], [data-nextjs-errors-dialog]",
      ).forEach((el) => el.remove());

      doc.querySelectorAll("span").forEach((el) => {
        if ((el.textContent || "").toLowerCase().includes("safe demo")) el.remove();
      });

      doc.querySelectorAll("body *").forEach((el) => {
        const text = (el.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
        if (!text || text.length > 80) return;
        const style = doc.defaultView?.getComputedStyle(el);
        if (!style || style.position !== "fixed") return;
        if (text === "1 issue" || /^\\d+ issues?$/.test(text) || text.includes("next.js") || text.includes("build error")) {
          el.remove();
        }
      });
    };

    cleanupDoc(document);
    const frame = document.getElementById("app");
    if (frame?.contentDocument) cleanupDoc(frame.contentDocument);
  });
}

async function main() {
  const browser = await chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-web-security",
      "--ignore-gpu-blocklist",
      "--enable-gpu-rasterization",
      "--use-angle=metal",
      "--enable-unsafe-swiftshader",
    ],
  });
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  await page.goto(`${SRV}/full-video.html`, { waitUntil: "load" });
  await page.evaluate((url) => {
    const frame = document.getElementById("app");
    if (frame) frame.src = url;
  }, `${SRV}/app/teach`);

  for (let i = 0; i < 80; i += 1) {
    const ready = await page.evaluate(() => {
      const frame = document.getElementById("app");
      return frame?.contentDocument?.readyState === "complete";
    }).catch(() => false);
    if (ready) break;
    await sleep(250);
  }

  await sleep(2500);
  await cleanupChrome(page);
  await sleep(500);

  const result = await page.evaluate(() => {
    const frame = document.getElementById("app");
    const doc = frame?.contentDocument;
    const appRect = frame?.getBoundingClientRect();
    const text = `${document.body.innerText || ""}\n${doc?.body?.innerText || ""}`;
    const canvas = doc?.querySelector("canvas");
    const fallbackVisible = /WebGL is unavailable|capture-safe mode/i.test(text);
    const forbiddenVisible = /\\b\\d+ issues?\\b|demo environment|sample data|safe demo/i.test(text);
    const canvasRect = canvas?.getBoundingClientRect();
    const gl = canvas?.getContext("webgl2") || canvas?.getContext("webgl");
    const debug = gl?.getExtension("WEBGL_debug_renderer_info");
    const renderer = debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : "webgl-context-present";
    return {
      appRect: appRect && {
        left: Math.round(appRect.left),
        top: Math.round(appRect.top),
        right: Math.round(appRect.right),
        bottom: Math.round(appRect.bottom),
        width: Math.round(appRect.width),
        height: Math.round(appRect.height),
      },
      canvasRect: canvasRect && {
        width: Math.round(canvasRect.width),
        height: Math.round(canvasRect.height),
      },
      renderer,
      canvasFound: Boolean(canvas),
      fallbackVisible,
      forbiddenVisible,
      cropped: !appRect || appRect.left < -1 || appRect.top < -1 || appRect.right > 1281 || appRect.bottom > 721,
    };
  });

  await page.screenshot({ path: SHOT, fullPage: false });
  await browser.close();

  const failures = [];
  if (result.cropped) failures.push("app iframe is cropped");
  if (!result.canvasFound) failures.push("robot canvas was not found");
  if (!result.renderer) failures.push("WebGL renderer was not available");
  if (result.fallbackVisible) failures.push("WebGL fallback text is visible");
  if (result.forbiddenVisible) failures.push("dev/demo labels are visible");

  console.log(JSON.stringify({ ok: failures.length === 0, screenshot: SHOT, failures, ...result }, null, 2));
  if (failures.length) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
