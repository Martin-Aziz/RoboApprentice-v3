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
  hook: 0,
  intent: 7.0,
  simulation: 15.2,
  payoff: 19.4,
  passport: 30.2,
  ownership: 42.0,
  safety: 53.0,
  roi: 64.0,
  close: 69.5,
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
    localStorage.setItem("aurevix_safe_demo_mode", "true");
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

async function actualAppStyle(page, caption, label, extras = "") {
  await page.evaluate(({ caption, label, extras }) => {
    localStorage.setItem("aurevix_safe_demo_mode", "true");
    localStorage.setItem("aurevix_locale", "en-US");
    document.getElementById("strategy-film-style")?.remove();
    document.getElementById("strategy-caption")?.remove();
    document.getElementById("strategy-label")?.remove();
    document.getElementById("strategy-extra")?.remove();
    const style = document.createElement("style");
    style.id = "strategy-film-style";
    style.textContent = `
      nextjs-portal,[data-nextjs-dev-tools-button],[data-nextjs-toast],[data-nextjs-dialog-overlay]{display:none!important}
      html,body{overflow-x:hidden!important}
      body{background:rgb(248 250 252)!important}
      main{scroll-behavior:auto!important}
      #strategy-caption{position:fixed;z-index:99990;left:50%;bottom:22px;transform:translateX(-50%);
        width:min(1180px,76vw);padding:12px 20px;border-radius:8px;background:rgb(15 23 42/.92);color:white;
        text-align:center;font:600 18px/1.35 Inter,Arial,sans-serif;box-shadow:0 12px 40px rgb(15 23 42/.24);pointer-events:none}
      #strategy-label{position:fixed;z-index:99990;right:24px;top:20px;padding:9px 13px;border-radius:999px;
        border:1px solid rgb(2 132 199/.35);background:rgb(255 255 255/.94);color:#0369a1;
        font:800 11px/1 ui-monospace,monospace;letter-spacing:.13em;text-transform:uppercase;pointer-events:none}
      #strategy-extra{position:fixed;z-index:99980;pointer-events:none}
      #strategy-extra>div{position:fixed}
      .strategy-card{border:1px solid rgb(203 213 225);background:rgb(255 255 255/.96);box-shadow:0 18px 60px rgb(15 23 42/.18);border-radius:12px;color:#0f172a}
      .strategy-mono{font:800 11px/1 ui-monospace,monospace;letter-spacing:.13em;text-transform:uppercase;color:#0284c7}
      .strategy-pill{display:inline-flex;align-items:center;border-radius:999px;background:#e0f2fe;color:#0369a1;border:1px solid #bae6fd;padding:8px 10px;font:800 10px/1 ui-monospace,monospace;letter-spacing:.12em;text-transform:uppercase}
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
    if (extras) {
      const extra = document.createElement("div");
      extra.id = "strategy-extra";
      extra.innerHTML = extras;
      document.body.appendChild(extra);
    }
  }, { caption, label, extras });
}

async function navigateActual(page, route, caption, label, extras = "") {
  await page.goto(`${SERVER}${route}`, { waitUntil: "domcontentloaded" });
  await sleep(900);
  await actualAppStyle(page, caption, label, extras);
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

async function clickRunWorkflow(page) {
  const button = page.getByTestId("auto-play-demo");
  if (await button.count()) {
    await button.first().click();
    return true;
  }
  return clickText(page, "Run workflow");
}

async function scrollToText(page, text) {
  const locator = page.getByText(text, { exact: false });
  const count = await locator.count();
  if (!count) return false;
  await locator.first().scrollIntoViewIfNeeded();
  await sleep(600);
  return true;
}

async function scrollDemoViewport(page, top = 420) {
  await page.evaluate(({ top }) => {
    const candidates = [
      document.scrollingElement,
      document.documentElement,
      document.body,
      ...Array.from(document.querySelectorAll("main, [class*='overflow'], [class*='scroll']")),
    ].filter(Boolean);
    for (const element of candidates) {
      if (element.scrollHeight > element.clientHeight) {
        element.scrollTop = top;
      }
    }
  }, { top });
  await sleep(500);
}

async function setCaption(page, caption, label) {
  await page.evaluate(({ caption, label }) => {
    const cap = document.getElementById("strategy-caption");
    if (cap) cap.textContent = caption;
    const badge = document.getElementById("strategy-label");
    if (badge) badge.textContent = label;
  }, { caption, label });
}

async function setVideoTime(page, second, play = false) {
  await page.evaluate(({ second, play }) => {
    const video = document.querySelector("video");
    if (!video) return;
    video.currentTime = second;
    video.muted = true;
    if (play) video.play().catch(() => {});
    else video.pause();
  }, { second, play });
}

async function addFocusCard(page, html) {
  await page.evaluate(({ html }) => {
    const old = document.getElementById("strategy-focus");
    old?.remove();
    const focus = document.createElement("div");
    focus.id = "strategy-focus";
    focus.style.position = "fixed";
    focus.style.zIndex = "99985";
    focus.style.pointerEvents = "none";
    focus.innerHTML = html;
    document.body.appendChild(focus);
  }, { html });
}

async function clearFocusCard(page) {
  await page.evaluate(() => document.getElementById("strategy-focus")?.remove());
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
      localStorage.setItem("aurevix_safe_demo_mode", "true");
      localStorage.setItem("aurevix_locale", "en-US");
    } catch {}
  });
  const page = await context.newPage();
  const start = Date.now();

  await navigateActual(
    page,
    "/app/teach",
    "Show it once. Review it before motion.",
    "Demo environment",
    `<div style="left:330px;top:86px;width:520px;padding:18px" class="strategy-card">
      <div class="strategy-mono">Input options</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:12px">
        <div style="padding:12px;border-radius:9px;background:#e0f2fe;border:1px solid #bae6fd"><b>Video</b><br><small>Worker demo</small></div>
        <div style="padding:12px;border-radius:9px;background:#f8fafc;border:1px solid #cbd5e1"><b>Photos</b><br><small>Same task</small></div>
        <div style="padding:12px;border-radius:9px;background:#f8fafc;border:1px solid #cbd5e1"><b>SOP</b><br><small>Work instruction</small></div>
      </div>
    </div>`,
  );
  await setVideoTime(page, 1, true);
  await at(start, 2.4, async () => {
    await setVideoTime(page, 12, false);
    await addFocusCard(page, `<div style="left:330px;top:86px;width:420px;padding:16px;border-radius:12px;border:1px solid #bae6fd;background:rgb(224 242 254/.96);box-shadow:0 18px 55px rgb(15 23 42/.18);color:#0f172a"><div style="font:800 11px/1 ui-monospace,monospace;letter-spacing:.14em;text-transform:uppercase;color:#0369a1">Phone video</div><div style="margin-top:8px;font-size:20px;font-weight:800">Manual task demonstration</div></div>`);
  });
  await at(start, 4.3, async () => {
    await setVideoTime(page, 28, false);
    await addFocusCard(page, `<div style="left:330px;top:86px;width:520px;padding:16px;border-radius:12px;border:1px solid #cbd5e1;background:rgb(255 255 255/.96);box-shadow:0 18px 55px rgb(15 23 42/.18);color:#0f172a"><div style="font:800 11px/1 ui-monospace,monospace;letter-spacing:.14em;text-transform:uppercase;color:#0284c7">Same task, other inputs</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px"><div style="padding:14px;border-radius:9px;background:#f8fafc;border:1px solid #cbd5e1"><b>Photo sequence</b><br><small>Task positions</small></div><div style="padding:14px;border-radius:9px;background:#f8fafc;border:1px solid #cbd5e1"><b>SOP</b><br><small>Work instruction</small></div></div></div>`);
  });
  await at(start, 6.1, async () => {
    await clearFocusCard(page);
    await setVideoTime(page, 34, false);
    await clickRunWorkflow(page);
    await setCaption(page, "Run workflow starts the interpretation and simulated replay.", "Run workflow");
    await addFocusCard(page, `<div style="left:342px;top:74px;width:560px;padding:14px;border-radius:12px;border:1px solid #bae6fd;background:rgb(224 242 254/.96);box-shadow:0 18px 55px rgb(15 23 42/.18);color:#0f172a"><b style="font-size:18px">Video selected</b><span style="margin-left:12px;font:800 11px/1 ui-monospace,monospace;color:#0369a1;letter-spacing:.14em;text-transform:uppercase">Run workflow clicked</span></div>`);
  });

  await at(start, scenes.intent, async () => {
    await setCaption(page, "Captures task intent — not just motion.", "Intent extraction");
    await addFocusCard(page, `<div style="left:280px;top:92px;width:520px;height:250px;border:3px solid #0284c7;border-radius:14px;box-shadow:0 0 0 9999px rgb(15 23 42/.06)"></div>
      <div style="right:110px;top:600px;width:720px;height:128px;border:3px solid #0d9488;border-radius:14px;box-shadow:0 18px 55px rgb(15 23 42/.16)"></div>`);
  });
  await at(start, 9.5, async () => {
    await setCaption(page, "What to pick, how to orient it, and where to place it.", "Intent · motion stages");
    await addFocusCard(page, `<div style="left:284px;top:96px;width:486px;height:210px;border:3px solid #0284c7;border-radius:14px;box-shadow:0 18px 55px rgb(15 23 42/.18)"></div>`);
  });
  await at(start, 12.2, async () => {
    await setCaption(page, "The active command changes as the replay advances through the task.", "Intent command changing");
    await addFocusCard(page, `<div style="right:88px;bottom:302px;width:1060px;height:95px;border:3px solid #0d9488;border-radius:14px;box-shadow:0 18px 55px rgb(15 23 42/.18)"></div>`);
  });

  await at(start, scenes.simulation, async () => {
    await clearFocusCard(page);
    await actualAppStyle(
      page,
      "Aurevix replays the policy in the UR5e workcell before anything physical moves.",
      "Simulation review",
    );
    await addFocusCard(page, `<div style="right:0;top:82px;width:1088px;height:570px;border:3px solid #0284c7;border-radius:16px;box-shadow:0 0 0 9999px rgb(15 23 42/.04)"></div>
      <div style="right:50px;top:120px;width:390px;padding:16px;border-radius:12px;border:1px solid #bae6fd;background:rgb(255 255 255/.95);box-shadow:0 18px 55px rgb(15 23 42/.16);color:#0f172a">
        <div style="font:800 11px/1 ui-monospace,monospace;letter-spacing:.14em;text-transform:uppercase;color:#0284c7">Live policy replay</div>
        <div style="margin-top:8px;font-size:18px;font-weight:800">UR5e motion, pose, joints, and task command</div>
      </div>`);
  });
  await at(start, 17.2, async () => {
    await setCaption(page, "The result is visible: robot, table, part, pose, joints, and sequence state are reviewable.", "Recreated workcell");
    await addFocusCard(page, `<div style="right:0;top:552px;width:1088px;height:98px;border:3px solid #0d9488;border-radius:14px;box-shadow:0 18px 55px rgb(15 23 42/.16)"></div>`);
  });

  await at(start, scenes.payoff, async () => {
    await clearFocusCard(page);
    await scrollToText(page, "Scene understanding");
    await scrollDemoViewport(page, 460);
    await actualAppStyle(
      page,
      "The final result includes a rebuilt scene, evidence notes, and a completed interpretation.",
      "Simulation result",
    );
    await addFocusCard(page, `<div style="right:0;top:82px;width:1088px;height:570px;border:3px solid #0284c7;border-radius:16px;box-shadow:0 0 0 9999px rgb(15 23 42/.04)"></div>
      <div style="right:150px;bottom:88px;width:860px;height:260px;border:3px solid #0d9488;border-radius:16px;box-shadow:0 18px 55px rgb(15 23 42/.16)"></div>`);
  });
  await at(start, 23.6, async () => {
    await scrollDemoViewport(page, 500);
    await setCaption(page, "Controller-ready output and the task record come after the replay, not as a black box.", "Review-ready output");
    await addFocusCard(page, `<div style="right:0;top:552px;width:1088px;height:98px;border:3px solid #0284c7;border-radius:14px;box-shadow:0 18px 55px rgb(15 23 42/.16)"></div>
      <div style="right:150px;bottom:88px;width:860px;height:260px;border:3px solid #0d9488;border-radius:16px;box-shadow:0 18px 55px rgb(15 23 42/.16)"></div>`);
  });
  await at(start, 27.0, async () => {
    await clearFocusCard(page);
    await navigateActual(
      page,
      "/app/export",
      "URScript, ROS 2, and report bundles make the handoff concrete.",
      "Controller-ready export",
      `<div style="right:44px;top:155px;width:520px;padding:20px" class="strategy-card">
        <div class="strategy-mono">URScript snippet</div>
        <pre style="margin:12px 0 0;padding:16px;border-radius:10px;background:#07111d;color:#dbeafe;font:700 14px/1.55 ui-monospace,monospace;white-space:pre-wrap">movej(q_pick, a=1.2, v=0.25)
set_tool_digital_out(0, True)
movel(p_place, a=0.8, v=0.15)
wait_digital_in(machine_ready, True)</pre>
      </div>`,
    );
    await addFocusCard(page, `<div style="left:330px;top:155px;width:520px;height:170px;border:3px solid #0284c7;border-radius:14px;box-shadow:0 0 0 9999px rgb(15 23 42/.04)"></div>`);
  });

  await at(start, scenes.passport, async () => {
    await clearFocusCard(page);
    await navigateActual(
      page,
      "/app/tasks",
      "One task record. Multiple robot brands.",
      "New example · Automation Passport",
      `<div style="right:44px;top:140px;width:560px;padding:22px" class="strategy-card">
        <div style="display:flex;justify-content:space-between;gap:16px;align-items:start">
          <div><div class="strategy-mono">Automation Passport</div><h2 style="margin:10px 0 0;font-size:30px;letter-spacing:-.04em">UR10e → ABB GoFa</h2></div>
          <span class="strategy-pill">New example</span>
        </div>
        <div style="display:grid;gap:10px;margin-top:16px;font-size:16px">
          <div style="display:flex;justify-content:space-between;border-bottom:1px solid #e2e8f0;padding-bottom:8px"><span>Source robot</span><b>UR10e</b></div>
          <div style="display:flex;justify-content:space-between;border-bottom:1px solid #e2e8f0;padding-bottom:8px"><span>Target robot</span><b>ABB GoFa CRB 15000</b></div>
          <div style="display:flex;justify-content:space-between;border-bottom:1px solid #e2e8f0;padding-bottom:8px"><span>Task intent</span><b>Preserved</b></div>
          <div style="display:flex;justify-content:space-between"><span>Feasibility checked</span><b style="color:#047857">✓</b></div>
          <div style="display:flex;justify-content:space-between"><span>Deployment gated for review</span><b style="color:#047857">✓</b></div>
        </div>
      </div>`,
    );
    await addFocusCard(page, `<div style="right:44px;top:140px;width:560px;height:332px;border:3px solid #0284c7;border-radius:16px;box-shadow:0 18px 55px rgb(15 23 42/.16)"></div>`);
  });
  await at(start, 37.5, async () => {
    await setCaption(page, "The new example is explicitly separate: UR10e source, ABB GoFa target.", "New example · re-plan");
    await addFocusCard(page, `<div style="right:70px;top:228px;width:500px;height:115px;border:3px solid #0d9488;border-radius:14px;box-shadow:0 18px 55px rgb(15 23 42/.16)"></div>`);
  });

  await at(start, scenes.ownership, async () => {
    await clearFocusCard(page);
    await navigateActual(
      page,
      "/app/teach",
      "Own routine retasking. Keep experts in the loop.",
      "Routine retasking",
      `<div style="right:44px;top:130px;width:540px;padding:20px" class="strategy-card">
        <div class="strategy-mono">Plain-English edit</div>
        <div style="margin-top:12px;padding:14px;border-radius:9px;background:#eff6ff;border:1px solid #bae6fd;font-size:17px">
          Place component beside fixture, then wait for machine-ready signal.
        </div>
        <div style="display:flex;gap:10px;margin-top:13px"><span class="strategy-pill">Save task version</span><span class="strategy-pill">Review needed</span><span class="strategy-pill">Evidence package</span></div>
      </div>`,
    );
  });
  await at(start, 47.0, async () => {
    await setCaption(page, "Routine changes become a saved version with review status and evidence.", "Save task version");
    await addFocusCard(page, `<div style="right:44px;top:238px;width:540px;height:112px;border:3px solid #0284c7;border-radius:14px;box-shadow:0 18px 55px rgb(15 23 42/.16)"></div>`);
  });
  await at(start, 50.2, async () => {
    await setCaption(page, "Experts stay in the loop through the evidence package, not every minor handoff.", "Evidence package");
    await addFocusCard(page, `<div style="right:160px;top:315px;width:190px;height:42px;border:3px solid #0d9488;border-radius:999px;box-shadow:0 18px 55px rgb(15 23 42/.16)"></div>`);
  });

  await at(start, scenes.safety, async () => {
    await clearFocusCard(page);
    if (taskId) {
      await navigateActual(
        page,
        `/app/tasks/${taskId}`,
        "Evidence first. Human-gated deployment.",
        "Deploy readiness",
      );
      await scrollToText(page, "Evidence before operation");
      await actualAppStyle(
        page,
        "Evidence first. Human-gated deployment.",
        "Deploy readiness",
        `<div style="right:42px;top:112px;width:430px;padding:18px" class="strategy-card">
          <div class="strategy-mono">Human verified</div>
          <div style="margin-top:12px;font-size:18px"><b>Reviewed by JM</b><br><span style="color:#475569">Jul 5, 2:15 PM</span></div>
          <div style="margin-top:14px;color:#047857;font-weight:900">✓ Simulation reviewed<br>✓ Risk assessment drafted<br>✓ Workcell safeguards checked</div>
          <div style="margin-top:14px" class="strategy-pill">🔒 Deployment gated for approval</div>
        </div>`,
      );
    }
  });
  await at(start, 57.0, async () => {
    await setCaption(page, "Simulation review, risk prompts, workcell checks, and human approval are explicit.", "Readiness checklist");
    await addFocusCard(page, `<div style="left:330px;top:455px;width:760px;height:380px;border:3px solid #0284c7;border-radius:16px;box-shadow:0 18px 55px rgb(15 23 42/.16)"></div>`);
  });
  await at(start, 60.5, async () => {
    await setCaption(page, "Human review is accountable before deployment approval.", "Human-gated approval");
    await addFocusCard(page, `<div style="right:42px;top:112px;width:430px;height:250px;border:3px solid #0d9488;border-radius:16px;box-shadow:0 18px 55px rgb(15 23 42/.16)"></div>`);
  });

  await at(start, scenes.roi, async () => {
    await clearFocusCard(page);
    await navigateActual(
      page,
      "/app/roi",
      "Save time per cell. Build automation memory.",
      "Business case",
    );
    await addFocusCard(page, `<div style="right:375px;top:205px;width:360px;height:190px;border:3px solid #0284c7;border-radius:16px;box-shadow:0 18px 55px rgb(15 23 42/.16)"></div>`);
  });
  await at(start, 66.6, async () => {
    await setCaption(page, "Less waiting, fewer repeated handoffs, and reusable task records compound over time.", "Automation memory");
    await addFocusCard(page, `<div style="right:285px;top:418px;width:520px;height:170px;border:3px solid #0d9488;border-radius:16px;box-shadow:0 18px 55px rgb(15 23 42/.16)"></div>`);
  });

  await at(start, scenes.close, async () => {
    await clearFocusCard(page);
    await page.goto(`${SERVER}/demo-end-v2.html`, { waitUntil: "load" });
    await page.evaluate(() => {
      document.querySelector("h1").innerHTML = "Enterprise Robot<br>Teaching";
      document.querySelector("p").textContent = "Bring one task. Get one record. Review it. Reuse it.";
      document.querySelector(".cta").textContent = "See It Work";
    });
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
