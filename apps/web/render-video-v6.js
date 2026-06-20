const { chromium } = require("@playwright/test");
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const CAPTURE_W = 1920, CAPTURE_H = 1080;
const W = 1280, H = 720;
const SRV = "http://localhost:3000";
const ROOT = path.join(__dirname, "..", "..");
const AUDIO = path.join(ROOT, "Audio new .mp3");
const TMP = path.join(__dirname, "video-tmp-v6");
const RAW = path.join(__dirname, "Aurevix_Demo_v6_raw.mp4");
const OUT = path.join(ROOT, "Aurevix_Demo_3m03s.mp4");
const TARGET = 183.666938;
const APP_SCALE = 1;
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function clean(page) {
  await page.evaluate((appScale) => {
    localStorage.setItem("aurevix_safe_demo_mode", "false");
    localStorage.setItem("aurevix_locale", "en-US");
    const style = document.createElement("style");
    style.id = "film-clean";
    style.textContent = `
      nextjs-portal,[data-nextjs-dev-tools-button],[data-nextjs-toast]{display:none!important}
      html{scroll-behavior:smooth;background:rgb(248 250 252)}
      body{overflow-x:hidden}
      body>div:first-child{zoom:${appScale};width:${100 / appScale}%}
      #film-vignette{position:fixed;inset:0;z-index:99990;pointer-events:none;box-shadow:inset 0 0 100px rgba(2,8,23,.18)}
      #film-chip{position:fixed;top:20px;left:50%;z-index:99993;transform:translateX(-50%) translateY(-18px);opacity:0;
        padding:8px 17px;border-radius:999px;background:rgba(2,8,23,.82);border:1px solid rgba(56,189,248,.42);
        color:white;font:700 11px/1 Inter,Arial;letter-spacing:.16em;text-transform:uppercase;backdrop-filter:blur(14px);
        transition:.45s cubic-bezier(.2,.8,.2,1)}
      #film-chip.on{opacity:1;transform:translateX(-50%) translateY(0)}
      #film-card{position:fixed;right:28px;bottom:28px;z-index:99993;width:365px;opacity:0;transform:translateY(22px) scale(.97);
        padding:14px 16px;border-radius:12px;background:linear-gradient(145deg,rgba(2,8,23,.88),rgba(15,23,42,.82));
        border:1px solid rgba(125,211,252,.35);box-shadow:0 22px 70px rgba(2,8,23,.34);backdrop-filter:blur(18px);
        color:white;transition:.55s cubic-bezier(.16,1,.3,1)}
      #film-card.on{opacity:1;transform:none} #film-kicker{color:#7dd3fc;font:700 10px/1 Inter;letter-spacing:.2em;text-transform:uppercase}
      #film-title{font:700 17px/1.18 Inter;margin-top:7px} #film-body{font:400 11px/1.45 Inter;color:rgba(255,255,255,.66);margin-top:6px}
      #film-wipe{position:fixed;inset:0;z-index:99999;pointer-events:none;background:#07111d;transform:translateX(-101%)}
      #film-cursor{position:fixed;z-index:99997;width:18px;height:18px;border:2px solid white;border-radius:50%;pointer-events:none;
        box-shadow:0 0 0 5px rgba(2,132,199,.22),0 4px 20px rgba(0,0,0,.4);left:1040px;top:90px;transition:left .65s cubic-bezier(.2,.8,.2,1),top .65s cubic-bezier(.2,.8,.2,1)}
      #film-focus{position:fixed;z-index:99991;pointer-events:none;border:2px solid rgba(125,211,252,.95);border-radius:50%;
        background:radial-gradient(circle,rgba(125,211,252,.08) 0%,rgba(56,189,248,.025) 52%,transparent 72%);
        box-shadow:0 0 0 7px rgba(56,189,248,.10),0 0 28px rgba(56,189,248,.35);
        opacity:0;transform:scale(.72);transition:all .55s cubic-bezier(.16,1,.3,1)}
      #film-focus.on{opacity:1;transform:none}
      .film-ripple{position:fixed;z-index:99996;width:16px;height:16px;border:2px solid #38bdf8;border-radius:50%;pointer-events:none;
        animation:ripple .65s ease-out forwards}@keyframes ripple{to{transform:scale(4);opacity:0}}
    `;
    document.head.appendChild(style);
    for (const id of ["film-vignette","film-chip","film-card","film-wipe","film-cursor","film-focus"]) {
      if (document.getElementById(id)) continue;
      const el=document.createElement("div"); el.id=id; document.body.appendChild(el);
    }
    document.getElementById("film-card").innerHTML='<div id="film-kicker"></div><div id="film-title"></div><div id="film-body"></div>';
  }, APP_SCALE);
}

async function card(page,kicker,title,body,ms=0){
  await page.evaluate(({kicker,title,body})=>{document.getElementById("film-kicker").textContent=kicker;document.getElementById("film-title").textContent=title;document.getElementById("film-body").textContent=body;document.getElementById("film-card").classList.add("on")},{kicker,title,body});
  if(ms) await sleep(ms);
}
async function hideCard(page){await page.evaluate(()=>document.getElementById("film-card")?.classList.remove("on"))}
async function chip(page,text){await page.evaluate(t=>{const e=document.getElementById("film-chip");e.textContent=t;e.classList.add("on")},text)}
async function move(page,x,y,click=false){
  await page.evaluate(({x,y,click})=>{const c=document.getElementById("film-cursor");c.style.left=x+"px";c.style.top=y+"px";if(click){const r=document.createElement("div");r.className="film-ripple";r.style.left=(x-8)+"px";r.style.top=(y-8)+"px";document.body.appendChild(r);setTimeout(()=>r.remove(),700)}},{x,y,click});
  await sleep(700);
}
async function focus(page,x,y,size=86,ms=0){
  await page.evaluate(({x,y,size})=>{const e=document.getElementById("film-focus");Object.assign(e.style,{left:(x-size/2)+"px",top:(y-size/2)+"px",width:size+"px",height:size+"px"});e.classList.add("on")},{x,y,size});
  if(ms) await sleep(ms);
}
async function clearFocus(page){await page.evaluate(()=>document.getElementById("film-focus")?.classList.remove("on"))}
async function nav(page,url){
  await page.goto(url,{waitUntil:"domcontentloaded"}); await sleep(900); await clean(page);
}
async function clickText(page,text){
  const loc=page.getByText(text,{exact:false}); const n=await loc.count();
  if(!n) return false; await loc.first().click(); return true;
}
async function scroll(page,y){await page.evaluate(v=>window.scrollTo({top:v,behavior:"smooth"}),y);await sleep(1200)}
async function at(page,start,seconds,fn){
  const due=start+seconds*1000-Date.now(); if(due>0) await sleep(due); await fn();
}

async function main(){
  fs.rmSync(TMP,{recursive:true,force:true}); fs.mkdirSync(TMP,{recursive:true});
  execSync(`curl -sf ${SRV}/app/teach >/dev/null`);
  const browser=await chromium.launch({headless:true,args:["--no-sandbox","--enable-unsafe-swiftshader","--ignore-gpu-blocklist"]});
  const context=await browser.newContext({viewport:{width:CAPTURE_W,height:CAPTURE_H},recordVideo:{dir:TMP,size:{width:CAPTURE_W,height:CAPTURE_H}}});
  const page=await context.newPage(); const start=Date.now();

  await page.goto(`${SRV}/demo-title-v6.html`,{waitUntil:"load"});
  await at(page,start,8,async()=>nav(page,`${SRV}/app/workcell`));
  await chip(page,"01 · Configure the workcell");
  await card(page,"Production context","Automation begins with the real cell","Robot, gripper, I/O and safety constraints become part of the generated policy.");
  await focus(page,1160,470,135);

  await at(page,start,20,async()=>{await scroll(page,420);await focus(page,1420,605,125);await move(page,1450,620,true)});
  await at(page,start,31,async()=>nav(page,`${SRV}/app/teach`));
  await chip(page,"02 · Teach by demonstration");
  await card(page,"Video + intent","A task operators already understand","The demonstration supplies motion; the sequence editor captures the production logic around it.");
  await focus(page,1160,240,125);

  await at(page,start,43,async()=>{await scroll(page,390);await focus(page,800,575,120);await card(page,"Decision logic","Real tasks contain conditions","Signal gates, inspection results, retries and abort paths are visible before execution.")});
  await at(page,start,55,async()=>{await scroll(page,800);await focus(page,800,650,120);await card(page,"Automatic tool change","One skill can coordinate multiple tools","Aurevix carries the selected docking station into generated robot logic.")});

  await at(page,start,66,async()=>{await scroll(page,0);await focus(page,835,70,110);await move(page,835,70,true);await clickText(page,"Run workflow");await card(page,"Live interpretation","Eight sampled video frames → Claude Code","The locally installed Claude CLI analyses the actual demonstration and streams robot steps back into Aurevix.")});
  await at(page,start,76,async()=>{await page.getByText("Interpretation",{exact:true}).scrollIntoViewIfNeeded();await focus(page,975,650,125);});
  await at(page,start,84,async()=>{await page.getByText("Interpretation",{exact:true}).scrollIntoViewIfNeeded();await focus(page,975,760,125);await card(page,"Review before deployment","The generated policy stays inspectable","Watch generated steps, robot motion, joint angles, end-effector pose and interpreted intent together.")});
  await at(page,start,99,async()=>{await scroll(page,0);await page.getByLabel("Robot model").selectOption("abb_gofa");await focus(page,1170,100,110);await move(page,1170,100,true);await card(page,"Robot-independent intent","Preview against another robot model","The same task can be evaluated across supported robot families before controller export.")});

  await at(page,start,112,async()=>{await page.getByText("Pick Bracket A learned",{exact:false}).waitFor({state:"visible",timeout:45000}).catch(()=>{});await page.getByText("Pick Bracket A learned",{exact:false}).scrollIntoViewIfNeeded().catch(()=>{});await focus(page,1100,790,125);await card(page,"Policy ready","Generated from the live local analysis","Waypoints, cycle estimate, confidence and sequence context are collected into one reviewable result.")});
  await at(page,start,124,async()=>{await move(page,1260,835,true);await clickText(page,"Export code");await focus(page,960,500,130);await card(page,"Engineering handoff","Controller-ready code, not a dead-end mockup","Export packages include motion, digital I/O gates, tool changes and bounded retry behaviour.")});
  await at(page,start,137,async()=>{await focus(page,960,215,105);await move(page,975,245,true);await clickText(page,"ROS 2 Python");await card(page,"Multiple targets","URScript and ROS 2","The generated state machine remains readable, reviewable and downloadable.")});
  await at(page,start,148,async()=>{await page.getByLabel("Close modal").click().catch(()=>{});await clickText(page,"Calculate ROI");await focus(page,1120,530,130);await card(page,"Build the business case","Connect engineering output to operational value","Model labor, shifts, cycle time, cell cost and payback before committing to deployment.")});

  await at(page,start,159,async()=>{
    await page.evaluate(()=>localStorage.setItem("aurevix_safe_demo_mode","true")).catch(()=>{});
    await page.goto(`${SRV}/app`,{waitUntil:"domcontentloaded"}); await sleep(900);
    await page.evaluate(()=>localStorage.setItem("aurevix_safe_demo_mode","true")); await page.reload({waitUntil:"domcontentloaded"}); await clean(page);
  });
  await chip(page,"03 · Operate and improve");
  await card(page,"Factory operating view","Skills become measurable production assets","Fleet status, executions, cycle performance and drift alerts keep learned automation visible.");
  await focus(page,1120,450,130);
  await at(page,start,171,async()=>{
    await nav(page,`${SRV}/demo-title-v6.html`);
    await page.evaluate(()=>{
      ["film-cursor","film-focus","film-card","film-chip","film-vignette","film-wipe"].forEach(id=>document.getElementById(id)?.remove());
    });
  });
  await at(page,start,182.9,async()=>{});

  await context.close(); await browser.close();
  const webm=fs.readdirSync(TMP).find(f=>f.endsWith(".webm"));
  execSync(`ffmpeg -y -i "${path.join(TMP,webm)}" -vf "scale=${W}:${H}:flags=lanczos,fps=25,eq=contrast=1.025:saturation=1.02,unsharp=5:5:0.35:5:5:0" -t ${TARGET} -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p -movflags +faststart "${RAW}"`,{stdio:"inherit"});
  execSync(`ffmpeg -y -i "${RAW}" -i "${AUDIO}" -filter_complex "[1:a]loudnorm=I=-16:TP=-1.5:LRA=11,apad[a]" -map 0:v -map "[a]" -t ${TARGET} -c:v copy -c:a aac -b:a 192k -movflags +faststart "${OUT}"`,{stdio:"inherit"});
  fs.rmSync(TMP,{recursive:true,force:true});
  console.log(OUT);
}
main().catch(e=>{console.error(e);process.exit(1)});
