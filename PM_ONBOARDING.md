# Aurevix — Product Manager Onboarding

> Internal name in code: **FORGE MIND** (legacy). Public/demo name: **Aurevix**. You'll see both — same product.

This document is everything you need to know before your first week managing this product. Read it end to end before touching the backlog.

---

## 1. The Problem

Industrial automation — putting a robot arm to work on a repetitive task in a factory — is broken for small and mid-size manufacturers.

- A typical robotic cell integration costs **$10,000–$20,000** and takes **4–8 weeks**, because a specialist integrator has to manually program waypoints, conditions, and I/O logic for every single task.
- Retraining the same robot for a new part or product line costs nearly as much as the original integration. There is no reuse.
- Result: **250,000+ SME manufacturers** in North America alone can't justify the cost/time, so they skip automation entirely and fall further behind larger competitors who can afford in-house robotics teams.

The quote that captures it: *"We bought the robot. It sat in the corner for six months waiting for the integrator."*

The buyer is **not** a robotics engineer. It's a production manager or line operator who knows the task by hand but has no programming background.

---

## 2. The Solution

Aurevix replaces manual robot programming with **video-guided teaching**:

1. **Show** — An operator records a short video of themselves doing the task by hand (pick a part, rotate it, place it in a fixture, etc.).
2. **Interpret** — Aurevix's AI pipeline watches the video, extracts the discrete motion steps, and proposes a structured task sequence (motion, gripper, tool-change, inspection, wait-for-signal, operator-confirmation steps).
3. **Review & refine** — The operator sees every step laid out in plain production language, can reorder/rename/replace any step, and watches a 3D replay of the interpreted motion on a virtual version of their actual robot before anything touches the floor.
4. **Deploy** — The reviewed sequence becomes a versioned, reusable **skill**, exportable as URScript, ROS 2 Python, ABB RAPID, FANUC Karel, or human-readable pseudocode/PDF, and deployable to a real or simulated robot.
5. **Operate & improve** — Once live, the skill is tracked across the fleet: run count, success rate, cycle time, and drift alerts (signs the skill's performance is degrading and needs re-teaching).

Tagline used in the demo: *"Show it once. Run it on repeat."*

No code. No integrator. Target: teach a cobot a new task in **under 3 hours**, not 4–8 weeks.

---

## 3. Who Uses It (and how to talk to them)

- **Primary user / operator**: SME factory floor staff or production manager. Not a coder, not a robotics expert. Every UI decision should assume this person — plain language over technical jargon, visual confirmation over trust-the-black-box.
- **Secondary user / decision maker**: plant manager or owner evaluating ROI before buying. This is who the ROI calculator and cost/cycle-time metrics are aimed at.
- **Adjacent persona**: a systems integrator or controls engineer who wants the *exported code* (URScript/ROS2/RAPID/Karel) to drop into an existing engineering workflow rather than rely on the no-code path entirely.

---

## 4. Product Surface (what exists today, walking through the app)

The active build is the Next.js web app at `apps/web`. Pages, what they're for, what a user does there:

| Page | Purpose |
|---|---|
| **Dashboard** | Facility overview: robots online, total skills, drift alerts, cycles today, recent executions. Entry point and CTA into Teach. |
| **Teach** (`/app/teach`) — the core workflow | Upload/record a demo video → AI interprets it into a step sequence (motion, wait-for-signal, gripper, tool-change, inspection, operator-confirm) → operator edits steps → 3D replay shows the interpreted policy on the chosen robot model → deploy, export code, or run ROI. |
| **Tasks** | Cloud library of in-progress/completed interpretation jobs (pending/processing/done/error), each versioned. |
| **Skills** | The reusable automation library — every finished, deployable skill, with confidence score, status (draft/training/ready/archived), run count, success rate, mean cycle time. |
| **Skill detail** | Per-skill drill-down: 3D visualization, waypoint list, exportable code, execution history, version history. |
| **Robots** (fleet) | Multi-robot dashboard: status, uptime, current skill, cycle metrics, drift alerts per robot. |
| **Robot detail** | Per-robot overview, live visualization, assigned skills, execution log, hardware/URDF settings. |
| **Workcell setup** | One-time physical cell configuration: gripper type/model/payload, I/O port mapping, automatic tool-changer stations. Skills get validated against this config before deploy. |
| **Library** | Curated "proven template" skills (pick-and-place, etc.) operators can clone as a starting point instead of teaching from scratch. |
| **Executions** | Full historical log of every skill run, exportable as CSV — this is the audit trail. |
| **ROI calculator** | Sales/justification tool: time and cost saved vs. manual integration. |
| **Export** | Generates downloadable bundles — URScript, ROS 2 package, PDF report — for ready skills. |
| **Settings** | Facility info, locale/units, dark mode, "Safe Demo Mode" (cached fallback if the live AI pipeline is unavailable — important for trade-show/offline demos). |

**Core data objects** (see `apps/web/src/lib/types.ts`):
- **Skill** — the unit of reuse. Has confidence score, status, run/success counts, mean cycle time, drift alert.
- **Task / TaskStep / TaskPolicy** — the in-progress teaching session: ordered steps (move/approach/grip/release/rotate/wait/inspect/home) with waypoints, speed, duration, gripper state.
- **Robot** — fleet entity: brand/model/status/IP/uptime/current skill.
- **SkillExecution** — one run of a skill on a robot: status, timing, quality score.
- **Facility** — the customer's site.

**Supported robot brands** (already modeled): Universal Robots, ABB, KUKA, Techman, FANUC, Yaskawa.

---

## 5. Current Technical Reality vs. Long-Term Architecture

Be aware these are two different things — don't confuse pitch-deck architecture with what's actually running:

- **What's actually live (MVP)**: Next.js 15 / React 19 frontend only. No login (auth is a deliberate passthrough placeholder). Persistence is **browser-local** (IndexedDB / localStorage) — there is no shared backend database yet. AI interpretation can run against a local Ollama LLM or a scripted deterministic fallback when no LLM is available ("Safe Demo Mode"). Three.js renders the robot replay; `urdf-loader` drives real robot kinematic models.
- **What's designed but not built/connected**: a Rust (Axum) API for real-time robot control, a Python FastAPI ML service (Whisper transcription + MiniLM embeddings), PostgreSQL + pgvector for semantic skill search, Redis for queueing/rate-limiting, MinIO/Cloudflare R2 for video storage. These exist as architecture decisions (`DECISIONS.md`) and a skeleton (`apps/ml-service/`), not as a working production system.
- **Implication for you as PM**: the demo and current MVP can convincingly show the teaching/review/export workflow end-to-end, but there is no multi-user backend, no real auth, no cloud persistence, and no live robot hardware integration yet. Any roadmap claim about real-time fleet control, true multi-facility SaaS, or hardware deployment needs new backend work — it is not just "polish" on what exists.
- The camera feed for live recording is a placeholder (no real camera capture wired up yet).

---

## 6. Market & Business Model (from the investor pitch — treat as hypotheses to validate, not settled fact)

- **Market**: global cobot market ~$2.1B (2024) → ~$12.3B (2030), ~34% CAGR. SAM: facilities with 1–20 cobots in North America + Europe (~50,000 facilities).
- **Beachhead**: Tier-2/Tier-3 automotive suppliers in the US Midwest (10,000+ facilities).
- **Pricing model proposed**: SaaS, per-robot/month ($400–500), tiered by facility count, plus onboarding services and a future skill marketplace.
- **Competitors named**: Wandelbots, Fuzzy Logic, and traditional integrators. Aurevix's claimed differentiation: video-guided teaching (vs. manual no-code teaching elsewhere), semantic skill search, SME-accessible pricing.
- **Caveat**: this is pitch-deck framing for fundraising, not validated against real customer interviews as far as the codebase shows. Treat pricing tiers, LTV/CAC, and TAM math as a starting hypothesis to pressure-test, not a finished GTM plan.

---

## 7. What's Explicitly Unfinished (don't be surprised by these)

- Auth/login is disabled by design (passthrough middleware) — no real user accounts yet.
- Camera capture is a placeholder; demos rely on pre-recorded/uploaded video.
- The Python ML service is not wired into the live app — Ollama (local LLM) handles interpretation, with a deterministic scripted fallback for offline reliability.
- No real hardware connectivity — "deploying" a skill to a robot is currently simulated.
- Skill confidence score starts at 0 on creation and is meant to be computed from accumulated execution feedback over time — that learning loop isn't built yet.

---

## 8. Where to Look Next

- `apps/web/src/lib/types.ts` — read this before discussing any data-model change.
- `apps/web/src/app/app/teach/page.tsx` — the core workflow; most feature requests will land here.
- `apps/web/src/app/api/tasks/[id]/interpret/route.ts` — the AI interpretation pipeline (SSE streaming).
- `DECISIONS.md` — architecture decision records for the planned backend.
- `PITCH.md` — the investor narrative (market, pricing, competitive positioning).
- `demo prompt /aurevix-demo-audio-script-v6.md` — the voiceover script for the current product demo video; good for understanding how the product is pitched externally in its own words.

---

## 9. First Questions a New PM Should Be Asking

1. Who are the actual pilot customers (the "2 pilot LOIs" mentioned in the pitch deck) and what specifically did they ask to see before signing a real contract?
2. What's the real plan and timeline for the backend (auth, persistence, real robot connectivity) — is the cloud architecture in `DECISIONS.md` still the plan, or has direction shifted toward something leaner?
3. How is "quality score" / skill confidence actually meant to be computed once execution feedback starts flowing in?
4. Is the per-robot/month SaaS pricing still the working hypothesis, or has it shifted based on pilot conversations?
5. What's the minimum viable hardware integration needed to move from "simulated deploy" to a real pilot robot running a taught skill on the floor?
