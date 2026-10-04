import { chromium, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(REPO_ROOT, "screenshots/2026-07-10");
const HIDE_ANIMATIONS = `*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;transition-duration:0s!important;transition-delay:0s!important;caret-color:transparent!important}`;
const captured: Array<[string,string,string]> = [];

async function settle(page: Page) {
  await page.waitForLoadState("networkidle");
  if (await page.locator("[data-robot-viewport]").count()) {
    await page.waitForFunction(() => (window as Window & {__robotViewportReady?:boolean}).__robotViewportReady === true, undefined, { timeout: 15_000 }).catch(() => undefined);
    await page.waitForTimeout(750);
  }
  await page.waitForTimeout(250);
}
async function shot(page: Page, n: number, slug: string, description: string, change: string) {
  await settle(page); const name = `${String(n).padStart(2,"0")}-${slug}.png`;
  await page.screenshot({ path:path.join(OUT,name), fullPage:true }); captured.push([name,description,change]); console.log(`captured ${name}`);
}
async function go(page: Page, route: string) { await page.goto(`${BASE}${route}`); await page.addStyleTag({content:HIDE_ANIMATIONS}).catch(()=>undefined); }

(async()=>{
  await mkdir(OUT,{recursive:true});
  const browser=await chromium.launch(); const context=await browser.newContext({viewport:{width:1920,height:1080},deviceScaleFactor:2,reducedMotion:"reduce",colorScheme:"light"});
  await context.addInitScript(()=>{try{localStorage.setItem("aurevix.safeDemoMode","true");localStorage.setItem("aurevix.salesMode","false");}catch{}});
  const page=await context.newPage();
  const simple: Array<[number,string,string,string,string]> = [
    [1,"home","/","Public marketing homepage","Evidence-led automation-memory positioning"],[2,"overview","/app","Workspace overview","Awaiting review replaces cycles telemetry"],[3,"robots","/app/robots","Robot fleet","Machine-tending demo replaces welding"],[4,"my-skills","/app/skills","My Skills","68% skill is BLOCKED"],[5,"task-records","/app/tasks","Task Records","Automation Memory framing"],
  ];
  for(const [n,s,r,d,c] of simple){await go(page,r);await shot(page,n,s,d,c);}
  const tasks=await page.evaluate(async()=>await (await fetch("/api/tasks")).json() as Array<{task_id:string;originPassportId?:string|null}>); const imported=tasks.find(t=>t.originPassportId);
  await go(page, imported?`/app/tasks/${imported.task_id}`:"/app/tasks"); await shot(page,6,"task-record-detail-passport","Imported task record detail","Structured Automation Passport lineage card");
  await go(page,"/app/review");await shot(page,7,"review-approvals-queue","Awaiting review queue","New qualified-review surface");
  await page.getByRole("tab",{name:"Blocked"}).click();await shot(page,8,"review-approvals-blocked","Blocked review queue","Blocked evidence state");
  await page.getByRole("tab",{name:"Awaiting review"}).click();await page.getByRole("button",{name:"Open review"}).first().click();await shot(page,9,"review-approvals-detail","Review detail","Expanded checklist and policy binding");
  await go(page,"/app/review");await page.getByRole("tab",{name:"Stale approvals"}).click();await shot(page,10,"review-approvals-stale","Stale approvals","Policy-change invalidation surfaced");
  const rest: Array<[number,string,string,string,string]>=[[11,"skill-templates","/app/library","Skill Templates","Supported and unsupported task boundary"],[12,"teach-from-video","/app/teach","Teach from video","Reviewable teaching workflow"],[13,"workcell-setup","/app/workcell","Workcell setup","Workcell review surface"],[14,"code-export","/app/export","Code export","Only three exportable skills selected"]];
  for(const [n,s,r,d,c] of rest){await go(page,r);await shot(page,n,s,d,c);}
  await page.getByText("Place Connector (drift detected)").click();await shot(page,15,"code-export-blocked-attempt","Blocked export attempt","Inline readiness explanation and review link");
  await go(page,"/app/executions");await shot(page,16,"execution-history","Execution history","Machine-tending data replaces welding");
  await go(page,"/app/settings");await shot(page,17,"settings","Settings","Sales mode toggle defaults off");
  await page.getByLabel("Sales mode").check();await go(page,"/app/roi");await shot(page,18,"roi-calculator-sales-mode","ROI calculator in Sales mode","Illustrative-assumptions footnote");
  await go(page,"/app/billing");await shot(page,19,"billing-value-sales-mode","Billing and value in Sales mode","Illustrative-assumptions footnote");
  const rows=captured.map(([f,d,c])=>`| [${f}](./${f}) | ${d} | ${c} |`).join("\n");
  await writeFile(path.join(OUT,"README.md"),`# Aurevix screenshot set — 2026-07-10\n\nChromium, 1920×1080 viewport, device scale factor 2, full-page PNG, Safe Demo Mode enabled.\n\n| File | Page | Change versus previous set |\n|---|---|---|\n${rows}\n`);
  await browser.close(); console.log(`done — ${OUT}`);
})().catch(error=>{console.error(error);process.exitCode=1;});
