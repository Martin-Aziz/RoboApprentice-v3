const { chromium } = require("@playwright/test");
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const WIDTH = 1920;
const HEIGHT = 1080;
const FPS = 30;
const SERVER = "http://localhost:3000";
const AUDIO = process.env.AUDIO_PATH
  ? path.resolve(process.env.AUDIO_PATH)
  : path.join(__dirname, "..", "..", "Audio.mp3");
const TMP = path.join(__dirname, "video-tmp-strategy");
const RAW = path.join(__dirname, "Aurevix_Strategy_Demo_Raw.mp4");
const OUTPUT = path.join(__dirname, "Aurevix_Strategy_Demo_With_Audio.mp4");
const DURATION = Number(execSync(
  `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${AUDIO}"`,
  { encoding: "utf8" },
).trim());
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const scenes = {
  intake: 0,
  intent: 7.1,
  simulation: 14.7,
  robotProof: 21.9,
  multiBrand: 28.8,
  ownership: 39.2,
  trust: 50.3,
  roi: 58.2,
  close: 63.0,
  end: DURATION,
};

function elapsed(start) {
  return (Date.now() - start) / 1000;
}

async function at(start, second, action) {
  const wait = Math.max(0, second * 1000 - (Date.now() - start));
  if (wait) await sleep(wait);
  await action();
}

async function appStyle(page, caption, label) {
  await page.evaluate(({ caption, label }) => {
    localStorage.setItem("aurevix_safe_demo_mode", "false");
    localStorage.setItem("aurevix_locale", "en-US");
    document.getElementById("strategy-film-style")?.remove();
    document.getElementById("strategy-caption")?.remove();
    document.getElementById("strategy-label")?.remove();
    document.querySelectorAll("span").forEach((element) => {
      if ((element.textContent || "").trim().toLowerCase() === "safe demo mode") element.remove();
    });
    const style = document.createElement("style");
    style.id = "strategy-film-style";
    style.textContent = `
      nextjs-portal,[data-nextjs-dev-tools-button],[data-nextjs-toast],[data-nextjs-dialog-overlay]{display:none!important}
      html,body{overflow-x:hidden!important}
      #strategy-caption{position:fixed;z-index:99990;left:50%;bottom:22px;transform:translateX(-50%);
        width:min(1180px,76vw);padding:12px 20px;border-radius:8px;background:rgb(15 23 42/.9);color:white;
        text-align:center;font:500 18px/1.35 Inter,Arial,sans-serif;box-shadow:0 12px 40px rgb(15 23 42/.24);pointer-events:none}
      #strategy-label{position:fixed;z-index:99990;right:24px;top:20px;padding:9px 13px;border-radius:999px;
        border:1px solid rgb(2 132 199/.35);background:rgb(255 255 255/.9);color:#0369a1;
        font:700 11px/1 ui-monospace,monospace;letter-spacing:.13em;text-transform:uppercase;pointer-events:none}
    `;
    document.head.appendChild(style);
    const cap = document.createElement("div");
    cap.id = "strategy-caption";
    cap.textContent = caption;
    document.body.appendChild(cap);
    const badge = document.createElement("div");
    badge.id = "strategy-label";
    badge.textContent = label;
    document.body.appendChild(badge);
  }, { caption, label });
}

async function navigate(page, route, caption, label) {
  await page.goto(`${SERVER}${route}`, { waitUntil: "domcontentloaded" });
  await sleep(900);
  await appStyle(page, caption, label);
}

async function clickText(page, text) {
  const locator = page.getByText(text, { exact: false });
  const count = await locator.count();
  if (!count) return false;
  await locator.first().click();
  return true;
}

async function scrollToText(page, text) {
  const locator = page.getByText(text, { exact: false });
  const count = await locator.count();
  if (!count) return false;
  await locator.first().scrollIntoViewIfNeeded();
  await sleep(600);
  return true;
}

async function getTaskId() {
  const response = await fetch(`${SERVER}/api/tasks`);
  const tasks = await response.json();
  const preferred = tasks.find((task) => task.status === "done" && task.targetRobotModels?.length);
  return preferred?.task_id ?? tasks.find((task) => task.status === "done")?.task_id;
}

async function main() {
  if (!fs.existsSync(AUDIO)) throw new Error(`Missing audio file: ${AUDIO}`);
  fs.rmSync(TMP, { recursive: true, force: true });
  fs.mkdirSync(TMP, { recursive: true });
  execSync(`curl -fsS ${SERVER}/app/teach >/dev/null`);
  const taskId = await getTaskId();
  if (!taskId) throw new Error("No completed task record is available for the trust-layer scene.");

  const browser = await chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--ignore-gpu-blocklist",
      "--enable-gpu-rasterization",
      "--use-angle=metal",
      "--enable-unsafe-swiftshader",
    ],
  });
  const context = await browser.newContext({
    viewport: { width: WIDTH, height: HEIGHT },
    recordVideo: { dir: TMP, size: { width: WIDTH, height: HEIGHT } },
  });
  await context.addInitScript(() => {
    try {
      localStorage.setItem("aurevix_safe_demo_mode", "false");
      localStorage.setItem("aurevix_locale", "en-US");
    } catch {}
  });
  const page = await context.newPage();
  const start = Date.now();

  await page.goto(`${SERVER}/demo-intake-v2.html`, { waitUntil: "load" });
  await page.evaluate(() => {
    if (typeof window.playIntro === "function") window.playIntro();
  });

  await at(start, scenes.intent, async () => {
    await navigate(
      page,
      "/app/teach",
      "Aurevix reads the demonstration and turns it into plain-language task stages.",
      "Intent extraction",
    );
    await clickText(page, "Run workflow");
  });

  await at(start, scenes.simulation, async () => {
    await appStyle(
      page,
      "Review the generated policy and robot motion before anything physical moves.",
      "Simulation review",
    );
  });

  await at(start, scenes.robotProof, async () => {
    await page.goto(`${SERVER}/demo-robot-proof-v2.html`, { waitUntil: "load" });
  });

  await at(start, scenes.multiBrand, async () => {
    await navigate(
      page,
      "/app/teach",
      "One task can be reviewed across supported robot families before controller export.",
      "Multi-brand planning",
    );
    const select = page.getByLabel("Robot model");
    const count = await select.count();
    if (count === 1) {
      for (const model of ["abb_gofa", "kuka_kr6", "techman_tm12", "fanuc_lr_mate", "yaskawa_gp12"]) {
        await select.selectOption(model);
        await sleep(2100);
      }
    }
  });

  await at(start, scenes.ownership, async () => {
    await navigate(
      page,
      "/app/teach",
      "Operators can inspect and adjust the task sequence in plain language. Generated controller logic remains available when engineers need it.",
      "Your team owns the task",
    );
    await clickText(page, "Edit advanced logic");
    await scrollToText(page, "Multi-step workflow");
  });

  await at(start, scenes.trust, async () => {
    await navigate(
      page,
      `/app/tasks/${taskId}`,
      "Every deployment decision is tied to explicit evidence, the exact task version, and qualified-person approval.",
      "Deployment trust layer",
    );
    await scrollToText(page, "Evidence before operation");
  });

  await at(start, scenes.roi, async () => {
    await navigate(
      page,
      "/app/roi",
      "Model the savings per cell and give engineering and operations one shared business case.",
      "ROI per cell",
    );
  });

  await at(start, scenes.close, async () => {
    await page.goto(`${SERVER}/demo-end-v2.html`, { waitUntil: "load" });
  });

  await at(start, scenes.end + 0.25, async () => {});
  console.log(`Captured ${elapsed(start).toFixed(2)} seconds`);
  await context.close();
  await browser.close();

  const webm = fs.readdirSync(TMP).find((file) => file.endsWith(".webm"));
  if (!webm) throw new Error("Playwright did not produce a WebM recording.");
  const recording = path.join(TMP, webm);

  execSync(
    `ffmpeg -y -i "${recording}" -vf "scale=${WIDTH}:${HEIGHT}:flags=lanczos,fps=${FPS},eq=contrast=1.015:saturation=1.01,unsharp=5:5:0.25:5:5:0" ` +
    `-t ${DURATION} -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p -movflags +faststart "${RAW}"`,
    { stdio: "inherit" },
  );
  execSync(
    `ffmpeg -y -i "${RAW}" -i "${AUDIO}" -filter_complex "[1:a]loudnorm=I=-16:TP=-1.5:LRA=11[a]" ` +
    `-map 0:v:0 -map "[a]" -t ${DURATION} -c:v copy -c:a aac -b:a 192k -movflags +faststart "${OUTPUT}"`,
    { stdio: "inherit" },
  );
  fs.rmSync(TMP, { recursive: true, force: true });
  console.log(`Final video: ${OUTPUT}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
