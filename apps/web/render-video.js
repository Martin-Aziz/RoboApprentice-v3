const { chromium } = require("/Users/martin/node_modules/@playwright/test");
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const FX = require("./public/fx");

const W = 1280;
const H = 720;
const SRV = "http://localhost:3000";
const OUT = path.join(__dirname, "Aurevix_Demo_Video.mp4");
const AUDIO = path.join(__dirname, "..", "..", "audio_for_demo.mp3");
const OUT_AUDIO = path.join(__dirname, "Aurevix_Demo_Video_With_Audio.mp4");
const TMP = path.join(__dirname, "video-tmp-raw");

// Aurevix brand: signal-cyan #0284C7 = rgb(2, 132, 199)
FX.setBrand("#0284C7", 2, 132, 199);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function seed(page) {
  await page.evaluate(() => {
    try {
      localStorage.setItem("aurevix_safe_demo_mode", "true");
      localStorage.setItem("aurevix_locale", "en-US");
      localStorage.setItem("forge_access_token", "demo-token");
      localStorage.setItem("northgate_guide_dismissed", "true");
      localStorage.setItem("aurevix_demo_store", JSON.stringify({ state: { hasSeenWelcome: true }, version: 0 }));
      localStorage.setItem("aurevix_auth_store", JSON.stringify({
        state: {
          user: { id: "demo", firstName: "Demo", lastName: "User", role: "ADMIN", email: "demo@aurevix.local" },
          accessToken: "demo-token",
          isAuthenticated: true,
        },
        version: 0,
      }));
    } catch {}
  }).catch(() => {});
}

async function killModal(page) {
  await seed(page);
  await page.evaluate(() => {
    document.querySelectorAll("[role='dialog'] button, button").forEach((btn) => {
      const text = (btn.textContent || btn.getAttribute("aria-label") || "").toLowerCase();
      if (text.includes("skip") || text.includes("close") || text.includes("dismiss") || text.includes("know")) btn.click();
    });
  }).catch(() => {});
  await cleanupChrome(page);
}

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
        const looksLikeDevOverlay =
          text === "1 issue" ||
          /^\\d+ issues?$/.test(text) ||
          text.includes("next.js") ||
          text.includes("build error");
        if (looksLikeDevOverlay) el.remove();
      });
    };

    cleanupDoc(document);
    if (!window.__aurevixRecorderCleanupTimer) {
      window.__aurevixRecorderCleanupTimer = window.setInterval(() => cleanupDoc(document), 500);
    }
    const frame = document.getElementById("app");
    if (frame?.contentDocument) {
      cleanupDoc(frame.contentDocument);
      if (frame.contentWindow && !frame.contentWindow.__aurevixRecorderCleanupTimer) {
        frame.contentWindow.__aurevixRecorderCleanupTimer = frame.contentWindow.setInterval(
          () => cleanupDoc(frame.contentDocument),
          500,
        );
      }
    }
  }).catch(() => {});
}

async function nav(page, url) {
  await page.evaluate((nextUrl) => {
    const frame = document.getElementById("app");
    if (frame) frame.src = nextUrl;
  }, url);
  for (let i = 0; i < 60; i += 1) {
    const loaded = await page.evaluate(() => {
      const frame = document.getElementById("app");
      return frame?.contentDocument?.readyState === "complete";
    }).catch(() => false);
    if (loaded) break;
    await sleep(250);
  }
  await sleep(900);
  await cleanupChrome(page);
  await page.evaluate(() => {
    const frame = document.getElementById("app");
    if (!frame?.contentWindow || !frame.contentDocument) return;
    try {
      frame.contentWindow.localStorage.setItem("aurevix_safe_demo_mode", "true");
      frame.contentWindow.localStorage.setItem("aurevix_locale", "en-US");
      frame.contentWindow.localStorage.setItem("forge_access_token", "demo-token");
    } catch {}
    if (!frame.contentDocument.getElementById("aurevix-video-cleanup")) {
      const style = frame.contentDocument.createElement("style");
      style.id = "aurevix-video-cleanup";
      style.textContent = `
        aside > div:nth-child(2),
        aside > div:last-child { display: none !important; }
        aside nav { padding-top: 18px !important; }
      `;
      frame.contentDocument.head.appendChild(style);
    }
    frame.contentDocument.querySelectorAll("[role='dialog'] button, button").forEach((btn) => {
      const text = (btn.textContent || btn.getAttribute("aria-label") || "").toLowerCase();
      if (text.includes("skip") || text.includes("close") || text.includes("dismiss") || text.includes("know")) btn.click();
    });
  }).catch(() => {});
  await cleanupChrome(page);
  await sleep(400);
}

async function iframeClick(page, matcher) {
  await page.evaluate((needle) => {
    const frame = document.getElementById("app");
    if (!frame?.contentDocument) return;
    const lower = needle.toLowerCase();
    for (const el of frame.contentDocument.querySelectorAll("button, a[href], [role='button']")) {
      const text = (el.textContent || el.getAttribute("aria-label") || "").toLowerCase();
      if (text.includes(lower)) {
        el.click();
        return;
      }
    }
  }, matcher);
  await sleep(900);
}

async function setIframeInput(page, label, value) {
  await page.evaluate(({ label, value }) => {
    const frame = document.getElementById("app");
    if (!frame?.contentDocument) return;
    const lower = label.toLowerCase();
    const labels = Array.from(frame.contentDocument.querySelectorAll("label"));
    const owner = labels.find((el) => (el.textContent || "").toLowerCase().includes(lower));
    const input = owner?.querySelector("input");
    if (!input) return;
    input.focus();
    input.value = String(value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, { label, value });
  await sleep(500);
}

async function scrollIframe(page, dy, ms = 1200) {
  const steps = Math.max(1, Math.round(ms / 80));
  for (let i = 0; i < steps; i += 1) {
    await page.evaluate((delta) => {
      const frame = document.getElementById("app");
      if (frame?.contentDocument) {
        (frame.contentDocument.scrollingElement || frame.contentDocument.body).scrollTop += delta;
      }
    }, dy / steps);
    await sleep(80);
  }
}

async function chip(page, text, cls = "") {
  await page.evaluate(({ text, cls }) => {
    const el = document.getElementById("chip");
    if (!el) return;
    el.textContent = text;
    el.className = `chip ${cls}`;
    el.style.opacity = "1";
  }, { text, cls });
}

async function hideChip(page) {
  await page.evaluate(() => {
    const el = document.getElementById("chip");
    if (el) el.style.opacity = "0";
  });
}

// Upgraded: bounce-in entry + shimmer on active callout
async function show(page, id, dir) {
  await page.evaluate((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.add("show");
  }, id);
  await FX.bounceIn(page, id);
  await FX.addShimmer(page, id);
}

async function hide(page, id) {
  await page.evaluate((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove("show");
    setTimeout(() => {
      if (el) el.style.animation = "none";
    }, 500);
  }, id);
}

function type(page, elId, text, wpm = 250) {
  const ms = Math.round(60000 / (wpm * 5));
  page.evaluate((id) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = "<span class=\"cursor\"></span>";
  }, elId).then(() => {
    let i = 0;
    const tick = () => {
      if (i >= text.length) {
        page.evaluate((id) => document.getElementById(id)?.querySelector(".cursor")?.remove(), elId).catch(() => {});
        return;
      }
      page.evaluate(({ id, ch }) => {
        const el = document.getElementById(id);
        if (!el) return;
        const cur = el.querySelector(".cursor");
        const span = document.createElement("span");
        span.textContent = ch;
        el.insertBefore(span, cur);
      }, { id: elId, ch: text[i] }).then(() => {
        i += 1;
        setTimeout(tick, ms + (Math.random() > .85 ? 55 : 0));
      }).catch(() => {});
    };
    tick();
  }).catch(() => {});
}

async function progressBar(page, fillId, pctId, target, durationMs) {
  const steps = 30;
  const delay = durationMs / steps;
  for (let i = 1; i <= steps; i += 1) {
    const pct = Math.round((target * i) / steps);
    await page.evaluate(({ fillId, pctId, pct }) => {
      const fill = document.getElementById(fillId);
      const label = document.getElementById(pctId);
      if (fill) fill.style.width = `${pct}%`;
      if (label) label.textContent = `${pct}%`;
    }, { fillId, pctId, pct });
    await sleep(delay);
  }
}

async function activateStep(page, calloutId, stepIndex) {
  await page.evaluate(({ calloutId, stepIndex }) => {
    const callout = document.getElementById(calloutId);
    if (!callout) return;
    callout.querySelectorAll(".step-dot").forEach((dot, index) => {
      dot.className = `step-dot${index < stepIndex ? " done" : index === stepIndex ? " active" : " pending"}`;
    });
    callout.querySelectorAll(".step-txt").forEach((txt, index) => {
      txt.className = `step-txt${index < stepIndex ? " done" : index === stepIndex ? " active" : ""}`;
    });
  }, { calloutId, stepIndex });
}

// Fade in from black on the current page (call right after page.goto)
async function fadeFromBlackOnLoad(page, ms = 350) {
  await page.evaluate((fadeMs) => {
    let ov = document.getElementById("fx-transition-overlay");
    if (!ov) {
      ov = document.createElement("div");
      ov.id = "fx-transition-overlay";
      ov.style.cssText = "position:fixed;inset:0;background:#000;pointer-events:none;z-index:99995;opacity:1;transition:none;";
      document.body.appendChild(ov);
    }
    ov.style.opacity = "1";
    ov.style.transition = "none";
    void ov.offsetHeight;
    ov.style.transition = `opacity ${fadeMs}ms ease`;
    requestAnimationFrame(() => { ov.style.opacity = "0"; });
  }, ms);
  await page.waitForTimeout(ms + 50);
}

// Upgraded: fade transitions + cursor + particles + scramble title
async function useCaseTitle(page, num, total, title, sub, stats) {
  await FX.fadeToBlack(page, 300);
  await page.goto(`${SRV}/use-case-title.html`, { waitUntil: "load" });
  await cleanupChrome(page);
  await page.evaluate(({ num, total, title, sub, stats }) => {
    document.getElementById("ucNum").textContent = `Use Case ${num} of ${total}`;
    document.getElementById("ucTitle").textContent = title;
    document.getElementById("ucSub").textContent = sub;
    document.getElementById("ucStats").innerHTML = stats.map((item) =>
      `<div class="stat"><div class="sv">${item.v}</div><div class="sl">${item.l}</div></div>`
    ).join("");
  }, { num, total, title, sub, stats });
  // Start scramble and cursor, then fade in simultaneously
  await FX.initCursor(page);
  await FX.particles(page, true);
  FX.scramble(page, "ucTitle", title, 1000).catch(() => {});
  await fadeFromBlackOnLoad(page, 350);
  await sleep(4500);

  await FX.fadeToBlack(page, 300);
  await page.goto(`${SRV}/full-video.html`, { waitUntil: "load" });
  await fadeFromBlackOnLoad(page, 300);
  await FX.initCursor(page);
  await cleanupChrome(page);
  await killModal(page);
  await sleep(700);
}

async function main() {
  fs.rmSync(TMP, { recursive: true, force: true });
  fs.mkdirSync(TMP, { recursive: true });

  console.log("Pre-flight...");
  execSync(`curl -sf ${SRV}/ >/dev/null`);
  execSync(`curl -sf ${SRV}/title-card.html >/dev/null`);
  execSync(`curl -sf ${SRV}/use-case-title.html >/dev/null`);
  execSync(`curl -sf ${SRV}/full-video.html >/dev/null`);
  execSync("ffmpeg -version", { stdio: "pipe" });

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
  const context = await browser.newContext({
    viewport: { width: W, height: H },
    recordVideo: { dir: TMP, size: { width: W, height: H } },
  });
  await context.addInitScript(() => {
    const originalError = console.error;
    console.error = (...args) => {
      if (String(args[0] || "").includes("THREE.WebGLRenderer")) return;
      originalError(...args);
    };
  });
  const page = await context.newPage();

  // ── Scene 0: Product title card ───────────────────────────────────────────
  console.log("[0] Product title");
  await page.goto(`${SRV}/title-card.html`, { waitUntil: "load" });
  await FX.initCursor(page);
  await FX.particles(page, true);
  // Scramble the app name reveal (fire-and-forget — 900ms animation)
  FX.scramble(page, "app-name", "Aurevix", 900).catch(() => {});
  await sleep(7000);

  // ── Use Case 1: Teach and export ──────────────────────────────────────────
  console.log("[1] Teach and export");
  await useCaseTitle(page, 1, 2, "Teach and export", "A factory operator records the task. Aurevix turns it into robot motion, code, and a reusable skill.", [
    { v: "Days", l: "before" },
    { v: "Minutes", l: "after" },
    { v: "1 task", l: "input" },
    { v: "AI", l: "generation" },
  ]);

  await chip(page, "Aurevix", "exec");
  await nav(page, `${SRV}/app/teach`);

  // Before — pain callout with spotlight focus
  await show(page, "uc1L", "right");
  type(page, "uc1Lt", "Traditional robot programming can take days to weeks, with specialist engineers involved before a single new task is proven.");
  await FX.spotlight(page, true);
  await sleep(6200);
  await FX.spotlight(page, false);
  await hide(page, "uc1L");
  await sleep(700);

  // Execution — arrow points to Run workflow, then click rings
  await show(page, "uc1R", "left");
  type(page, "uc1Rt", "Running the bundled multi-task robot demonstration. The workflow builds sequence gates, waypoints, and a replayable policy.");
  await sleep(600);
  await FX.arrow(page, 540, 470, "down");
  await sleep(500);
  await FX.hideArrow(page);
  await FX.clickTargetRings(page, 540, 470);
  await iframeClick(page, "Run workflow");
  for (let step = 0; step < 4; step += 1) {
    await activateStep(page, "uc1R", step);
    await sleep(2100);
  }
  await page.evaluate(() => {
    const frame = document.getElementById("app");
    if (!frame?.contentDocument) return false;
    const panel = frame.contentDocument.querySelector("[data-testid='result-panel']");
    panel?.scrollIntoView({ block: "center", behavior: "smooth" });
    return Boolean(panel);
  });
  await sleep(3500);
  await hide(page, "uc1R");
  await sleep(700);

  // Result callout with success effects
  await show(page, "uc1Res", "left");
  type(page, "uc1Rest", "The result panel is now live: 4.2 second cycle estimate, generated waypoints, and export actions for URScript, ROS 2, and a PDF summary.");
  await FX.successPulse(page, 880, 430);
  await FX.confetti(page);
  await sleep(3400);

  // Export clicks with target rings
  await FX.clickTargetRings(page, 830, 490);
  await iframeClick(page, "Export code");
  await sleep(1600);
  await FX.clickTargetRings(page, 760, 480);
  await iframeClick(page, "ROS 2 Python");
  await sleep(1700);
  await FX.clickTargetRings(page, 860, 480);
  await iframeClick(page, "PDF Summary");
  await sleep(1700);
  await hide(page, "uc1Res");
  await hideChip(page);
  await sleep(900);

  // ── Use Case 2: ROI before integration ───────────────────────────────────
  console.log("[2] ROI");
  await useCaseTitle(page, 2, 2, "ROI before integration", "Build the business case with operator-led teaching, AI-assisted policy generation, and payback math.", [
    { v: "$10K+", l: "cell cost risk" },
    { v: "Weeks", l: "integration risk" },
    { v: "AI", l: "assisted" },
    { v: "Minutes", l: "analysis" },
  ]);

  await chip(page, "ROI Calculator", "exec");
  await nav(page, `${SRV}/app/roi`);

  // Before — pain callout with spotlight
  await show(page, "uc2L", "right");
  type(page, "uc2Lt", "Before Aurevix, teams often need a specialist estimate before they can even decide whether a pilot is worth the integration cost.");
  await FX.spotlight(page, true);
  await sleep(5800);
  await FX.spotlight(page, false);
  await hide(page, "uc2L");
  await sleep(700);

  // Execution — progress bar + scroll with scroll hint
  await show(page, "uc2R", "left");
  type(page, "uc2Rt", "Changing the teaching assumptions live: traditional programming stays high, Aurevix teaching drops to a short operator-led session.");
  await setIframeInput(page, "Current programming time", 40);
  await setIframeInput(page, "Aurevix programming time", 0.5);
  await FX.scrollHint(page, true);
  await Promise.all([
    progressBar(page, "uc2prog", "uc2pct", 100, 6200),
    (async () => {
      await sleep(300);
      await FX.scrollHint(page, false);
      await sleep(1200);
      await scrollIframe(page, 260, 1700);
      await sleep(1200);
      await scrollIframe(page, 220, 1500);
    })(),
  ]);
  await hide(page, "uc2R");
  await sleep(700);

  // Result callout with confetti
  await show(page, "uc2Res", "left");
  type(page, "uc2Rest", "The output is a shareable sales artifact: hours saved, payback period, three-year savings, and a PDF-ready ROI analysis.");
  await FX.confetti(page);
  await FX.successPulse(page, 880, 430);
  await FX.clickTargetRings(page, 460, 560);
  await iframeClick(page, "Share link");
  await sleep(4300);
  await hide(page, "uc2Res");
  await hideChip(page);
  await sleep(900);

  // ── Final: Impact summary ─────────────────────────────────────────────────
  console.log("[Final] Summary");
  await FX.fadeToBlack(page, 300);
  await page.goto(`${SRV}/title-card.html`, { waitUntil: "load" });
  await FX.initCursor(page);
  await FX.particles(page, true);
  await fadeFromBlackOnLoad(page, 300);
  await sleep(3200);

  await FX.fadeToBlack(page, 300);
  await page.goto(`${SRV}/full-video.html`, { waitUntil: "load" });
  await fadeFromBlackOnLoad(page, 300);
  await FX.initCursor(page);
  await chip(page, "Aurevix", "exec");
  await nav(page, `${SRV}/app/teach`);
  await show(page, "sumA", "right"); await sleep(3400);
  await show(page, "sumB", "left"); await sleep(3400);
  await hide(page, "sumA"); await sleep(700);
  await show(page, "sumC", "right"); await sleep(3400);
  await hide(page, "sumB"); await sleep(700);
  await show(page, "sumD", "left"); await sleep(3400);
  await hide(page, "sumC"); await hide(page, "sumD"); await hideChip(page);
  await sleep(14500);

  console.log("Stopping recorder...");
  await context.close();
  await browser.close();

  const webm = fs.readdirSync(TMP).find((file) => file.endsWith(".webm"));
  if (!webm) throw new Error("No WebM recording found.");

  // Encode with sharpening only — no color grading, keeps screen natural
  console.log("Encoding H.264...");
  execSync(
    `ffmpeg -y -i "${path.join(TMP, webm)}" -vf "scale=${W}:${H},fps=30,${FX.grades.sharpen}" -c:v libx264 -preset fast -crf 18 -pix_fmt yuv420p -movflags +faststart "${OUT}"`,
    { stdio: "inherit" },
  );
  if (fs.existsSync(AUDIO)) {
    console.log("Adding narration audio...");
    execSync(
      `ffmpeg -y -i "${OUT}" -i "${AUDIO}" -c:v copy -c:a aac -b:a 192k -shortest "${OUT_AUDIO}"`,
      { stdio: "inherit" },
    );
  }
  fs.rmSync(TMP, { recursive: true, force: true });
  console.log(`Done: ${OUT}`);
  if (fs.existsSync(OUT_AUDIO)) console.log(`Done with audio: ${OUT_AUDIO}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
