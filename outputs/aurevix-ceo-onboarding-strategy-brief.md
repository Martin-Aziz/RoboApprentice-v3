# Aurevix CEO Onboarding and Strategy Brief

Prepared for: incoming or virtual CEO / strategy agent  
Company: Aurevix by Agentic Convergent  
Date: 2026-07-02  
Source base: current RoboApprentice-v3 repository, existing Aurevix strategy brief, pitch stress-test, investor deck work, and repo screenshots.

## How to Use This Document

This document is meant to onboard a CEO-level strategist into Aurevix quickly. It is not a marketing brochure. It explains what the product is, what is actually implemented, why the company could be strategically defensible, what proof is still missing, and where the strategy should concentrate.

The central distinction to preserve is this:

**Aurevix should not be understood only as "AI video-to-robot-code." That is the visible wedge. The stronger company is the task evidence, approval, and portability layer for industrial automation.**

The virtual CEO should use this document to answer:

- What is Aurevix?
- Who is it for?
- What does the software currently do?
- Which functionality is core versus supporting?
- What are the possible moats?
- What benefits does each stakeholder receive?
- What should be validated before raising serious capital or scaling GTM?
- What should be built, hidden, or deferred over the next 90 days?

## Executive Summary

Aurevix is an AI-powered robot teaching and deployment-readiness platform. An operator demonstrates a manual task, usually through video. The system interprets the task into robot motion steps, builds a task policy, renders a 3D simulation, generates controller-specific code, and packages the task into a reusable skill or portable automation record.

The primary user is an SME factory operator, process technician, or plant team, not a robotics engineer. The economic buyer is likely the plant manager, operations owner, automation engineering lead, or integrator-facing decision maker who pays for recurring robot retasking, specialist programming, downtime, and integration work.

The product has a broad MVP surface today. It includes:

- Video demonstration intake and task interpretation.
- Streaming AI extraction of task steps.
- Fallback deterministic task generation for demo reliability.
- 3D robot replay and workcell visualization.
- Controller code generation for URScript, ROS 2 Python, ABB RAPID, FANUC KAREL, and pseudocode-style outputs.
- Deployment readiness and trust checklist.
- Version-bound trust records, qualified-reviewer evidence, approvals, rejections, and audit logs.
- Risk-assessment draft generation.
- Automation Passport export/import with robot-agnostic task intent and blocked deployment when translated waypoints are unreachable.
- Pre-purchase feasibility simulation.
- Gripper recommendation with technical fit scoring and affiliate disclosure.
- Fixture and jig design outputs with tolerance guidance and human-review disclaimers.
- ROI calculator and outcome-based pricing/value statement logic.
- Robot fleet, skills library, tasks, executions, workcell, billing, and settings screens.
- Local/demo persistence through browser storage, IndexedDB, JSON files, and in-memory server stores.

The most important strategic conclusion is that this breadth should not become the strategy. The strategic spine should be:

1. Create or import a task.
2. Interpret task intent.
3. Simulate feasibility.
4. Generate controller code.
5. Collect deployment evidence.
6. Require qualified human review.
7. Export a version-bound evidence package and Automation Passport.

Everything else should support that loop or be moved behind an advanced surface.

## The One-Sentence Company Thesis

Aurevix is the operator-readable deployment evidence and automation memory layer for high-mix factories: show a task once, turn it into robot-specific work, validate it before motion, and preserve the task as a portable, reviewable record across robots and sites.

## The Product in Plain English

Factory teams bought robots for flexibility, but many still need outside experts or specialist engineers every time a task changes. The visible pain is programming. The deeper pain is accountability: who knows what the task is, what the robot is allowed to do, what assumptions were made, what was checked, who approved it, and whether the task can be reused later.

Aurevix aims to let the factory team capture a task in the terms they already understand and then produce an artifact engineers and reviewers can inspect:

- Human demonstration.
- Structured task intent.
- Robot motion steps.
- Workcell assumptions.
- Feasibility and simulation outputs.
- Controller program.
- Missing evidence and blocker status.
- Qualified human review.
- Version history and approval state.
- Exportable task passport.

The best strategic framing is not "replace robot programmers." It is:

**Aurevix reduces calendar dependency for routine retasking while keeping human validation, integrators, and safety owners inside the loop.**

## Why This Problem Matters

The market pain is not simply that robot programming is difficult. It is that high-mix manufacturing creates too many small task changes for traditional integration workflows to handle efficiently.

The typical handoff today is fragile:

1. Operator knows how the task is done.
2. Engineer or integrator asks for context.
3. Context becomes a meeting, photos, notes, and assumptions.
4. A robot program is created in a specialist tool.
5. The safety or automation owner must decide whether the task can run.
6. Six months later, the reason behind the program may be unclear.

Aurevix can attack the handoff loss. The product should help teams preserve task knowledge as it moves from operator to engineer to reviewer to integrator to future reuse.

## Target Users and Stakeholders

### Operator or Process Technician

The operator knows the task but may not know robot programming. They want to demonstrate work without writing URScript, RAPID, KAREL, or ROS code.

Benefits:

- Can show the work instead of translating it into robotics language.
- Gets a visual replay and named steps they recognize.
- Can see what is missing before handing the task to engineering.
- Feels less blocked by specialist availability.

Risk:

- They must not be made responsible for unsafe automation decisions.
- The UI must make clear that AI-generated output requires review.

### Plant Engineer or Automation Engineer

This user must decide whether a task is technically plausible, inspect generated steps, evaluate workcell assumptions, and prepare for deployment review.

Benefits:

- Receives a structured task record instead of raw video and vague notes.
- Can inspect waypoints, cycle assumptions, gripper/tool constraints, and controller code.
- Gets explicit blockers rather than a false "ready" claim.
- Can use the evidence package in internal approval or integrator discussions.

Risk:

- They will reject the product if it feels like black-box AI or demo choreography.

### Safety Owner or Qualified Reviewer

This person must determine whether a specific task version is acceptable within a specific workcell and safety process.

Benefits:

- Sees an evidence checklist, not just a generated program.
- Can record evidence for simulation review, risk assessment, safeguards, emergency behavior, and supervised trial.
- Can approve or reject the exact task version and policy hash.
- Gets an audit trail and evidence export.

Risk:

- Aurevix must never imply that it certifies safety or replaces the qualified person.

### Plant Manager or Operations Owner

This is often the economic buyer. They care about uptime, labor constraints, task-change lead time, and repeat integrator spend.

Benefits:

- Reduces dependence on the integrator calendar for routine task changes.
- Makes automation opportunities easier to evaluate.
- Converts vague automation ideas into reviewable task records.
- Creates a path to value-based pricing once outcomes are measurable.

Risk:

- They need proof of time saved, cost avoided, and deployment results.

### System Integrator

The integrator may be partner, channel, or competitor depending on framing. The best framing is not anti-integrator. The enemy is repetitive low-value reprogramming and poor task context.

Benefits:

- Receives more prepared task information.
- Can use task passports and evidence packages for scoping.
- Can focus on complex cell design, safety, hardware, and advanced deployment.
- May deliver more projects without being pulled into every small change.

Risk:

- If positioned as replacing integrators, Aurevix may create channel resistance.

## Current Product and Software Surface

### 1. Landing Page and App Shell

The app is a Next.js 15 frontend with a light industrial design system. The primary visual language is clean slate/white surfaces, cyan signal color, amber warning, green success, red error, mono telemetry, and HUD-style precision cards.

The app shell includes navigation for:

- Dashboard.
- ROI.
- Tasks.
- Library.
- Executions.
- Teach.
- Skills.
- Robots.
- Workcell.
- Billing.
- Settings.
- Admin pricing.

Strategic note: the breadth is impressive for demos but should be simplified for first-run customers. The CEO should ask which surfaces advance the core approval journey and which should be hidden until later.

### 2. Teach Workflow

The teaching workflow is the core product surface. It lets a user start from a demonstration, watch the task interpreted into steps, review a 3D robot replay, and export code or deployment-related artifacts.

Implemented elements include:

- Demo video selection/upload messaging.
- Streaming interpretation flow through `/api/tasks/[id]/interpret`.
- Cosmetic sequence progress while interpretation runs.
- Fallback scripted flow if the real API/network fails.
- Robot selection across demo robot types:
  - Universal Robots UR5e.
  - ABB GoFa CRB 15000.
  - KUKA KR 6 R900.
  - Techman TM12.
  - FANUC LR Mate 200iD.
  - Yaskawa Motoman GP12.
- Workcell configuration and tool changer configuration.
- Safe demo mode.
- Advanced controls.
- Deploy, export, and ROI modals.

Strategic note: this is the emotional "wow" surface, but it should lead into evidence and review rather than stopping at replay/code.

### 3. Task Interpretation

The intended flow is:

1. User creates a task.
2. User starts interpretation.
3. The server streams status and step events through SSE.
4. Each generated step becomes a `TaskStep`.
5. A final `TaskPolicy` is built with workspace bounds, cycle estimate, tool frame, and optional scene model.

Core data objects:

- `Task`.
- `TaskStep`.
- `TaskPolicy`.
- `WorkcellScene`.
- `SceneObject`.
- `TaskIntent`.

Strategic note: the interpretation should be described as "task intent extraction and constrained planning," not magical motion copying. The trustable version is neurosymbolic in spirit: AI proposes intent; deterministic constraints, simulation, codegen, and human approval bound deployment.

### 4. Task Policy and Motion Model

A task policy includes:

- Ordered steps.
- Tool frame.
- Workspace bounds.
- Estimated cycle seconds.
- Optional scene model.

Each step includes:

- Description.
- Action type such as move, approach, grip, release, rotate, wait, inspect, home.
- Target waypoint.
- Gripper state.
- Speed.
- Duration.
- Vision requirement flag.
- Notes.

Strategic note: policy is more than motion. It is the basis for code generation, simulation, trust record hashing, versioning, and approval invalidation.

### 5. 3D Robot and Workcell Visualization

The app includes Three.js-based robot visualization and replay. It can render different robot profiles and workcell states. The visualization helps non-experts inspect what the system believes the task is.

Benefits:

- Makes AI interpretation visible.
- Helps reviewers catch obvious errors.
- Helps operators recognize their task.
- Creates a useful demo surface for investors and customers.

Limits:

- It is not equivalent to real-world deployment.
- It does not replace physical safety review, calibration, collision analysis, or robot commissioning.

### 6. Code Generation

The code generation layer can produce controller-oriented programs from a task policy.

Targets include:

- URScript.
- ROS 2 Python.
- ABB RAPID.
- FANUC KAREL.
- Pseudocode-style output.

Notable implementation details:

- Generated programs include a policy ID/hash for provenance.
- URScript uses `movel`, `movej`, gripper digital outputs, sleeps, and vision-check messages.
- ROS 2 Python creates a node skeleton with movement, gripper, and vision-check stubs.
- RAPID converts coordinates from meters to millimeters and generates `robtarget` declarations.
- FANUC KAREL is supported in the codegen surface.

Strategic note: codegen is necessary but not sufficient. It will likely commoditize faster than the evidence and approval workflow. The CEO should avoid making codegen the only moat.

### 7. Deployment Readiness Indicator

The UI has a deploy-readiness component with thresholds:

- 90% or above: validated / ready for supervised deployment.
- 80-89%: review / simulation review before deployment.
- Below 80%: not ready / re-demonstrate before deployment.

Important nuance:

- In the trust layer, readiness percentage is not model confidence.
- It is the weighted completion of explicit evidence checks.

Strategic note: this is one of the strongest concepts, but it must stay conservative and explainable. Readiness must never be marketed as automatic safety certification.

### 8. Deployment Trust Layer

This is one of the most strategically important modules.

The trust layer turns a generated task into a version-bound review record. It documents evidence and human decisions. It explicitly does not certify robot safety or replace the qualified person responsible for the installed workcell.

Trust checklist items include:

- Motion policy validated.
- Deployment target recorded.
- Simulation reviewed.
- Risk assessment completed.
- Workcell safeguards verified.
- Supervised trial passed.

Gate statuses:

- `blocked`.
- `review-required`.
- `approved`.

The system supports:

- SHA-256 policy fingerprinting.
- Task version binding.
- Reviewer evidence fields.
- Approval and rejection.
- Audit events.
- Evidence package export.
- Invalidating prior approval when the task or policy changes.

Moat relevance:

- A competitor can copy a checklist.
- It is harder to copy accumulated task histories, reviewer habits, integrator handoff templates, and customer-specific evidence expectations after they become routine.

### 9. Task Versions and Auditability

Tasks can have versions. Trust records bind approval to a current task version and policy hash. If a policy changes, the prior approval should become stale.

Strategic value:

- Prevents stale approvals.
- Makes the product credible in safety-adjacent environments.
- Creates an audit trail useful for plant engineers, integrators, and internal reviews.

Production gap:

- Local demo records are currently stored in simple files/JSON in parts of the app.
- Production needs durable append-only storage, authenticated actor identity, permissions, backups, and tamper-evident audit history.

### 10. Risk Assessment Drafting

The product can generate an editable collaborative-robot risk assessment draft. It includes plain-language review prompts and requires qualified-person sign-off.

Strategic value:

- Helps turn generated automation into reviewable deployment work.
- Supports the "evidence package" positioning.
- Builds buyer trust by acknowledging responsibility boundaries.

Required framing:

- It is a draft.
- It is not complete.
- It is not certified.
- A qualified person must review the installed workcell.

### 11. Automation Passport

The Automation Passport is the most important long-term platform concept.

It can export a deployed process as a privacy-stripped, robot-agnostic record. The passport preserves:

- Source task ID.
- Source robot model.
- Source organization.
- Task intent.
- Fixture specification, if available.
- Gripper recommendations, if available.
- Quality parameters.
- Sharing scope.
- Recipient organization or shared-link token.

It can then be imported into another target robot/workcell. Import checks:

- Access permissions and share token.
- Immutable source task intent.
- Waypoint translation into the target workcell.
- Reachability against target robot specs.
- Feasibility verdict.
- Blocked deployment if translated waypoints are unreachable.
- Controller program generation for the target robot if feasible.

Strategic value:

- Turns one task into reusable automation memory.
- Creates a neutral layer above robot brands.
- Could become the system of record for task intent, validation history, and approved reuse.
- Supports integrator handoff and cross-site learning.

Strategic warning:

- Do not sell "passport network" too early. Portability is credible only after source task records are trusted.

### 12. Pre-Purchase Feasibility Simulator

The feasibility engine estimates whether a task is feasible for a selected robot and workcell before hardware connection.

Inputs include:

- Task intent.
- Robot model.
- Payload.
- Workcell dimensions.

Outputs include:

- Feasible, marginal, or not feasible verdict.
- Blocking reason.
- Estimated cycle time.
- Estimated throughput per hour.
- Recommended alternate robot.
- Confidence and guidance.

Robot specifications currently include:

- UR5e.
- UR10e.
- UR16e.
- ABB GoFa CRB 15000.
- FANUC CRX-10iA.

Strategic value:

- Strong sales wedge for evaluating automation opportunities.
- Useful before a customer commits to deployment.
- Supports the "time-to-decision" value proposition.

Limit:

- Uses simplified kinematic and payload assumptions.
- Needs validation against real robot/workcell outcomes.

### 13. Gripper and Peripheral Recommender

The gripper recommender ranks end-effectors based on technical fit.

Inputs include:

- Robot model.
- Payload.
- Part material.
- Part surface.
- Pick type.
- Required grip force.
- Cycle time.

Scoring factors include:

- Payload capacity with a 30% safety margin.
- Cycle fit.
- Material/surface/pick compatibility.
- Grip force.
- Manufacturer reliability score.

The module includes an affiliate disclosure:

> Aurevix may earn a referral fee from some of these links. Recommendations are based solely on technical fit for your task.

Strategic value:

- Useful as a supporting deployment check.
- Helps non-experts understand tooling requirements.
- Could produce referral or partner economics later.

Strategic warning:

- Should not become a marketplace-first strategy before the trust loop is proven.
- Affiliate status must never affect recommendations.

### 14. Fixture and Jig Designer

The fixture designer produces fixture requirements and specification outputs based on task intent, part geometry, pick face, repeatability, force, and temperature.

It can produce:

- Nest fixture.
- V-block fixture.
- Rail/custom written brief.
- Material recommendation such as PLA 3D print, ABS 3D print, aluminium, or steel.
- Dimensional tolerance guidance.
- Manufacturing notes.
- STL eligibility for simple geometries.

It includes a verification disclaimer:

> This fixture design is a starting point. Have a qualified person verify dimensions before production use.

Strategic value:

- Strong supporting module for task readiness.
- Helps identify physical constraints that block automation.
- Useful in evidence package if tied to review checklist.

Strategic warning:

- Fixture design can become a separate product rabbit hole. Keep it subordinate to "what evidence is missing before this task is deployable?"

### 15. ROI Calculator

The ROI module estimates savings from reduced programming time and avoided commissioning/integration costs.

Inputs include:

- Number of robots.
- Tasks per robot per shift.
- Shifts per day.
- Operating days per year.
- Current programming hours.
- Aurevix programming hours.
- Operator hourly rate.
- Tasks reprogrammed per year.

Outputs include:

- Annual hours saved.
- Annual savings.
- Payback months.
- Three-year savings.
- Current versus Aurevix programming cost.

Strategic value:

- Useful for sales conversations and buyer education.
- Helps link the product to replacement budgets.

Strategic warning:

- Defaults are assumptions. They must be replaced with design-partner evidence before investor or customer claims.

### 16. Outcome-Based Pricing and Value Statements

The codebase includes logic for outcome-based billing/value measurement.

Key ideas:

- Customer confirms an integrator-cost baseline.
- Qualifying deployments generate avoided-cost logic.
- Outcome fee is a percentage of cost avoided.
- Monthly floor and cap limit billing.
- Incomplete outcome data is excluded and flagged for manual review.
- Value statements are immutable.

Default constants in code include:

- 10 successful cycles as a qualifying threshold.
- $8,000 default integrator baseline.
- 15% default outcome share.
- $199 minimum monthly fee.
- $2,000 maximum monthly cap.

Strategic value:

- Aligns pricing with customer value.
- Differentiates from per-seat or per-generation SaaS pricing.
- Could reduce adoption friction if customers distrust software subscriptions.

Strategic warning:

- Outcome pricing is administratively complex.
- It requires instrumentation, dispute handling, cycle verification, and clear definitions.
- It should probably be deferred from the first-run path until deployment evidence exists.

### 17. Skills Library

The system packages learned tasks into skills. A skill includes:

- Name.
- Description.
- Language.
- Confidence.
- Status.
- Run count.
- Success count.
- Creation and update metadata.
- Last execution time.
- Mean cycle.
- Drift alert.

Strategic value:

- Gives the customer a reusable automation library.
- Supports repeat execution, monitoring, and lifecycle management.
- Becomes stronger when skills are tied to trust records and passports.

### 18. Robot Fleet Management

The robots surface models facility robots with:

- Brand and model.
- Status such as offline, idle, busy, running, error, e-stopped.
- IP address.
- Last seen time.
- Metrics such as uptime, cycles today, and mean cycle.
- Current skill.

Strategic value:

- Helps show how tasks relate to real robot assets.
- Useful for demonstrations and future production management.

Production gap:

- The MVP does not currently provide real hardware connectivity.

### 19. Executions

Skill executions track:

- Skill ID.
- Robot ID.
- Status.
- Start/completion.
- Parts processed.
- Error message.
- Cycle time.
- Quality score.

Strategic value:

- Required for outcome measurement and continuous improvement.
- Needed to prove ROI and calibrate readiness.

Production gap:

- Needs real execution telemetry or integration with customer systems.

### 20. Workcell Configuration

The product includes workcell configuration concepts:

- Dimensions.
- Origin.
- Fixture offset.
- Tool frame.
- Gripper type.
- Tool changer stations.

Strategic value:

- Prevents generic AI output from ignoring physical context.
- Supports feasibility, simulation, passport import, and deployment review.

### 21. Localization

The app supports locale codes:

- English US.
- English UK.
- German.
- Spanish.
- Simplified Chinese.
- Japanese.

Strategic value:

- Important for factory adoption across regions.
- Helpful for operator-first positioning.

Strategic warning:

- Localization should not outrank core proof in the next 90 days unless a design partner requires it.

### 22. Demo Mode and Fallbacks

The product includes deterministic fallback behavior and demo data seeding. This is useful because live AI interpretation and local services can fail during demos.

Strategic value:

- Keeps demos reliable.
- Allows sales and investor walkthroughs without fragile infrastructure.

Strategic warning:

- The CEO must separate demo reliability from production readiness.

## Technical Architecture

### Frontend

- Next.js 15 App Router.
- React 19.
- TypeScript strict.
- Tailwind CSS v4.
- shadcn/ui components customized to Aurevix.
- Three.js / robot viewport.
- React local state and React Query patterns.
- Zustand for auth/session store in the original architecture.

### Backend/API

The active MVP uses Next.js route handlers for server-side routes:

- Task creation.
- Task interpretation.
- Code generation.
- Simulation downloads.
- Feedback.
- Trust record read/update/evidence export.
- Task versions.
- Demo video upload.
- Billing/value statements.
- Pricing admin.
- Passport export/import/share.
- Feasibility simulation.
- Gripper recommendations.
- Fixture design and downloads.
- Risk-assessment draft.

The repo also contains Rust API and Python ML-service scaffolding, but the MVP surface primarily uses the web app and local/route-handler logic.

### AI Backend

The intended local backend is Ollama through environment variables:

- `OLLAMA_URL`.
- `OLLAMA_MODEL`.

The product also has deterministic fallback behavior. Strategy should not depend on one model provider.

### Persistence

Current persistence is mixed and demo-oriented:

- localStorage.
- IndexedDB via `idb`.
- In-memory task store in some server routes.
- JSON files for trust records/passports in local demo mode.
- Database-like store modules for future durable persistence.

Production requirements:

- Durable database.
- Authenticated users and organizations.
- Access control.
- Audit integrity.
- Object storage for videos, exports, evidence packages, and generated documents.
- Backup and recovery.
- Customer data rights and deletion policy.

## Current State Classification

### Implemented Enough for Demo / Product Narrative

- Teaching workflow.
- Demo video interpretation flow.
- 3D simulation/replay.
- Multi-target code generation.
- Task policy model.
- Deploy-readiness UI.
- Trust checklist logic.
- Automation Passport export/import logic.
- Feasibility simulation.
- Gripper recommendation.
- Fixture design.
- ROI/value measurement concepts.
- Risk draft generation.
- Product screens and navigation.

### Needs Design-Partner Validation

- Actual before/after task retasking time.
- Whether generated steps are accurate enough to start review.
- Whether plant engineers use evidence packages in real conversations.
- Whether safety owners trust the review workflow.
- Whether integrators treat the artifact as useful.
- Whether task passports reduce reuse/replanning work.
- Whether customers will share data rights.
- Whether outcome pricing reduces or increases sales friction.

### Not Yet Production-Ready

- Real robot hardware connectivity.
- Production-grade auth and roles.
- Durable audit storage.
- Real customer telemetry.
- Verified safety process integration.
- Robust video perception across messy factory environments.
- Multi-tenant security.
- SOC 2 / enterprise procurement posture.
- Production support model.
- Legal terms for data rights, liability, and training use.

## Moat Architecture

### Moat 1: Versioned Deployment Evidence Workflow

Aurevix can become the place where a task moves from idea to reviewable deployment artifact.

Why it can compound:

- Each task version has policy, evidence, reviewer decisions, and history.
- Approval is tied to a policy hash.
- Changes invalidate stale approval.
- Reviewers and integrators begin using Aurevix records as the handoff object.
- Customers develop internal habits around the workflow.

Copyability:

- Checklists are easy to copy.
- Customer-specific evidence history, reviewer behavior, and handoff expectations are harder to copy after adoption.

### Moat 2: Automation Passport and Task Memory

The Automation Passport can become a portable task-intent artifact across robots, workcells, organizations, and integrators.

Why it can compound:

- It stores intent, constraints, quality parameters, robot context, and provenance.
- It enables reuse and re-evaluation instead of starting from scratch.
- It can become the factory's automation memory layer.

Copyability:

- A competitor can create a passport schema.
- It is harder to copy trusted historical passports attached to real deployments and reviews.

### Moat 3: Proprietary Task-Outcome Dataset

If customers permit data use, Aurevix can accumulate a dataset that combines:

- Task videos.
- Extracted intent.
- Motion policies.
- Feasibility results.
- Generated code target.
- Evidence completeness.
- Approval outcomes.
- Supervised trial results.
- Execution outcomes.
- Failure reasons.

This dataset is more valuable than generic robot code because it includes operational context and human review decisions.

Risks:

- Requires data rights.
- Requires real deployment volume.
- Takes 6-12 months or more to become meaningful.

### Moat 4: Cross-Vendor Neutrality Above the Runtime

Robot OEMs benefit from lock-in. Integrators benefit from services. A neutral task layer can sit above robot runtimes without trying to replace them.

The key is altitude:

- Do not become a universal robot OS.
- Do not fight the OEM runtime.
- Capture and validate task intent, then export into the runtime.

### Moat 5: Trustworthy Safety-Adjacent Positioning

Many AI robotics companies will overclaim autonomy. Aurevix can differentiate by being conservative:

- Human-gated.
- Evidence-linked.
- Non-certifying.
- Audit-friendly.
- Explicit about qualified review.

This may sound less flashy, but it is more credible in industrial markets.

### Moat 6: Integrator Handoff Layer

If positioned correctly, Aurevix can make integrators more efficient rather than obsolete.

Potential value:

- Better customer task intake.
- Faster scoping.
- Evidence package for quote and review.
- Passport for reuse.
- Less time spent on repetitive context gathering.

### Moat 7: Operator-First UX for a Technical Workflow

Most robotics tools are built for engineers or developers. Aurevix can win if it keeps the operator path simple while preserving technical depth behind the scenes.

The product should answer:

- What did I show?
- What did the system infer?
- What is blocked?
- Who needs to review?
- What can I export?
- What changed since last version?

## Benefits by Buyer and Use Case

### For SME Manufacturers

- Faster retasking of existing robot assets.
- Less dependence on outside specialists for routine changes.
- Better internal automation knowledge capture.
- More confidence before spending on integration.
- Easier handoff between operator, engineer, reviewer, and integrator.

### For Plant Engineers

- Structured task input.
- Faster feasibility review.
- Generated code starting point.
- Clear evidence gaps.
- Audit history.
- Version control for task changes.

### For Safety and Compliance Reviewers

- Reviewable evidence checklist.
- Explicit qualified-person responsibility.
- Clear approval/rejection decision.
- Stale approval invalidation.
- Exportable evidence package.

### For Integrators

- Better task briefs.
- Faster quoting and feasibility work.
- Reusable handoff artifact.
- Possible channel revenue.
- Reduced low-value repetitive reprogramming.

### For Investors

- Concrete wedge.
- Hardware-neutral software.
- AI tailwind without model-only dependency.
- Evidence workflow that survives AI commoditization.
- Potential data moat.
- Expansion from one task to task library to passport network to automation memory layer.

## Strategic Positioning

### Good Positioning

- "The deployment evidence and task-portability layer for high-mix automation."
- "Show a task once. Review it before motion. Reuse the approved task record."
- "Aurevix helps factories own routine task changes without removing human validation."
- "The task record, not the generated code, is the product."

### Risky Positioning

- "Fully autonomous robot programming."
- "No safety review needed."
- "Works for all robots and all tasks."
- "Video directly becomes production motion."
- "Integrator replacement."
- "Universal robot OS."

### Investor-Ready Reframe

The consensus product is no-code robot programming. The non-consensus company is the memory layer for industrial automation. Factories do not just need robots to move; they need a durable record of what was taught, validated, changed, approved, and reused.

## Initial ICP and GTM Hypothesis

The initial ICP should be narrow:

- High-mix SME factory.
- Already owns cobots or industrial robot cells.
- Has recurring task-change pain.
- Has limited internal robotics capacity.
- Uses or pays integrators.
- Has an operations owner who feels downtime and retasking delay.
- Has a plant engineer or safety owner willing to review generated artifacts.

Likely first buyer map:

- Economic buyer: plant manager, operations owner, or automation engineering manager.
- Daily user: process technician or automation engineer.
- Validator: plant engineer, safety owner, or qualified reviewer.
- Blocker: IT/OT, procurement, incumbent integrator, safety process.
- Influencer/channel: system integrator or automation consultant.

The first GTM motion should be design-partner led, not broad self-serve SaaS.

## Design Partnership Proof Required

The first signed design partnership is a real signal, but it is not enough by itself. It should be converted into an investor-grade validation memo.

The memo should answer:

- Is it paid or unpaid?
- Is the scope written?
- Is the deployment date scheduled?
- Is the partner referenceable?
- What exact robot model is involved?
- What gripper/tooling is involved?
- What task is being taught?
- What is the current baseline retasking time/cost?
- What is the target Aurevix-assisted time/cost?
- What are the success criteria?
- Who is the safety owner?
- What evidence artifact will be produced?
- What data rights does Aurevix receive?
- What will count as failure?

Top proof metric:

**One constrained real task moves from demonstration to generated plan, simulation, human review, and supervised deployment evidence with measured before/after time and failure count.**

## Competitive Landscape

Aurevix competes indirectly with several categories:

### Robot OEM Tools

Examples:

- Universal Robots PolyScope.
- ABB RobotStudio.
- FANUC ROBOGUIDE.
- KUKA.Sim.

Strengths:

- Native ecosystem control.
- Reliable inside their own brand.
- Trusted by existing customers.

Aurevix opening:

- Cross-vendor task memory.
- Operator-first task capture.
- Neutral review artifact.

### Offline Programming and Simulation Tools

Example:

- RoboDK.

Strengths:

- Multi-brand simulation and programming.
- Existing engineering user base.

Aurevix opening:

- Less engineer-first.
- More focused on operator-to-approval workflow.
- Evidence and task lineage, not just program generation.

### Hardware-Native AI Robot Companies

Example:

- Standard Bots.

Strengths:

- Full-stack hardware/software.
- Strong demo simplicity.
- Data flywheel on their own deployments.

Aurevix opening:

- Brownfield installed base.
- Does not require buying one vendor's robot.
- Neutral task layer across existing cells.

### Hardware-Agnostic Robotics Platforms

Examples:

- Wandelbots NOVA.
- Intrinsic Flowstate.

Strengths:

- Developer platforms.
- Robot control abstraction.
- Simulation-to-real workflows.
- Enterprise ecosystem.

Aurevix opening:

- Operator-readable task capture.
- Evidence package and approval workflow.
- SME/high-mix workflow rather than developer platform.

### Integrators

Strengths:

- Trust.
- Local relationships.
- Safety/process knowledge.
- Hardware deployment capability.

Aurevix opening:

- Make integrators faster.
- Reduce repetitive low-value task changes.
- Provide better intake and review artifacts.

## Core Risks

### Risk 1: The Product Is Seen as a Demo, Not a Deployment Tool

Cause:

- Too much focus on video magic and 3D replay.
- Not enough proof of accuracy, review, and real task outcomes.

Mitigation:

- Make trust record and evidence export the product spine.

### Risk 2: Accuracy and Perception Fail in Real Factories

Cause:

- Lighting, occlusion, reflective parts, bad camera angle, ambiguous intent, fixture changes.

Mitigation:

- Constrained task grammar.
- Clear confidence.
- Re-demonstration guidance.
- Human review.
- Narrow year-one task boundaries.

### Risk 3: Safety and Liability Blowback

Cause:

- Buyer believes Aurevix certified a task.
- UI overstates readiness.

Mitigation:

- Non-certifying language.
- Qualified-person gates.
- Evidence-based readiness.
- Explicit disclaimers.

### Risk 4: Cross-Vendor Support Becomes Services Debt

Cause:

- Every robot, controller version, I/O setup, gripper, and workcell edge case becomes support work.

Mitigation:

- Constrained supported workflows.
- Clear target robots.
- Integrator channel.
- Export-first rather than direct-control-first.

### Risk 5: Integrator Channel Conflict

Cause:

- Messaging attacks integrators too directly.

Mitigation:

- Frame Aurevix as anti-calendar-dependency, not anti-integrator.
- Define what integrators still own.

### Risk 6: Moat Depends on Data Rights Not Yet Secured

Cause:

- Customers may not allow cross-customer training or outcome data use.

Mitigation:

- Make data rights part of design-partner agreements.
- Offer privacy-stripped, scoped learning rights.

### Risk 7: Outcome Pricing Is Too Complex Too Early

Cause:

- Cycle counting, dispute resolution, and baseline validation are hard.

Mitigation:

- Start with subscription/design-partner pricing.
- Use value statements as proof before billing on outcomes.

## What to Build Next

### Priority 1: Make the Trust Loop the Main Product

The product should open into one path:

1. Create/import task.
2. Interpret into task intent.
3. Simulate feasibility.
4. Generate controller program.
5. Complete trust checklist.
6. Export evidence package.
7. Export Automation Passport.

Any screen that does not advance this path should be secondary.

### Priority 2: Design-Partner Proof Package

Create a one-page proof memo template and fill it for the signed design partner.

Must include:

- Partner profile.
- Paid/scoped/scheduled/referenceable status.
- Task and robot details.
- Baseline.
- Aurevix result.
- Evidence package.
- Safety owner.
- Data rights.
- Next milestone.

### Priority 3: Instrument the Core Journey

Track:

- Task created.
- Interpretation completed.
- Simulation reviewed.
- Controller code generated.
- Trust record opened.
- Evidence check completed.
- Approval/rejection decision.
- Evidence package exported.
- Passport exported.
- Passport imported.
- Design-partner handoff completed.

### Priority 4: Simplify First-Run UI

Hide or move behind advanced mode:

- Broad fleet dashboard.
- Billing admin.
- Outcome pricing.
- ROI unless needed in sales mode.
- Gripper marketplace.
- Fixture generation unless tied to missing deployment evidence.
- Multi-language polish unless required by partner.

### Priority 5: Define Year-One Task Boundaries

Aurevix should explicitly refuse or defer tasks that are too unsafe, variable, or hard to validate.

Good initial task families:

- Pick and place.
- Machine tending with constrained part presentation.
- Simple inspection positioning.
- Packaging/case movement within safe payload/reach limits.
- Repetitive fixture-based manipulation.

Likely defer:

- Welding.
- High-speed cutting.
- Human-close tasks without strong guarding.
- Deformable objects.
- Reflective/transparent parts without controlled sensing.
- Heavy payloads near limits.
- Tasks requiring complex force feedback.

## Strategic Questions for the Virtual CEO

1. Should Aurevix lead with operator-owned retasking or deployment evidence?
2. Which buyer owns the budget in the first ten deals?
3. Which task family is narrow enough to prove in 90 days but valuable enough to matter?
4. Are integrators channel, customer, or competitor in the first GTM motion?
5. What data rights must every design-partner agreement include?
6. What minimum evidence makes a design partner investor-grade?
7. Which product modules should be hidden until after trust-loop completion?
8. What is the right pricing wedge before outcome pricing is practical?
9. What exact safety language must appear everywhere?
10. What benchmark proves the technology is more than demo choreography?
11. What metric makes the seed round obvious?
12. Should Automation Passport be branded as the core product now or introduced after trust-loop validation?

## Suggested 90-Day Operating Plan

### Days 1-14

- Convert the signed design partnership into a written validation plan.
- Pick one task family.
- Define success criteria.
- Define safety owner and review process.
- Simplify product demo to the trust loop.
- Draft data-rights language.

### Days 15-45

- Run the first real/representative task through the workflow.
- Record baseline retasking time and Aurevix-assisted time.
- Generate code, simulation, trust checklist, and evidence export.
- Collect reviewer feedback.
- Document every failure reason.
- Remove UI steps that confuse design-partner users.

### Days 46-75

- Repeat with 2-4 more design partners or tasks.
- Compare missing-evidence patterns.
- Improve task grammar and blocker guidance.
- Formalize Automation Passport schema and export.
- Test whether integrators can use the evidence package to quote or review.

### Days 76-90

- Produce investor-grade proof pack:
  - before/after metric,
  - failure analysis,
  - sample evidence package,
  - reviewer quote if permitted,
  - task boundaries,
  - pricing signal,
  - data-rights status,
  - next 12-month milestone plan.

## Metrics That Matter

### Product Activation

- Percent of task videos that produce a reviewable task policy.
- Time from video upload to first task policy.
- Percent of users who understand the next action without onboarding.

### Technical Quality

- Step interpretation accuracy.
- Waypoint correction rate.
- Code-export correctness.
- Feasibility prediction versus supervised trial.
- Failure reason distribution.

### Trust Workflow

- Percent of tasks reaching evidence-package export.
- Percent of tasks blocked for valid reasons.
- Time from task creation to review-ready state.
- Number of stale approvals invalidated correctly.
- Reviewer completion rate.

### Business Proof

- Baseline retasking time versus Aurevix-assisted time.
- Integrator hours avoided or reduced.
- Number of paid deployments.
- ACV / pilot fee.
- Support hours per deployment.
- Sales cycle length.

### Moat Development

- Number of task records.
- Number of passports exported/imported.
- Number of approved task versions.
- Data-rights coverage.
- Reuse rate of prior task records.
- Improvement in first-pass approval over time.

## What Not to Do

- Do not claim full autonomy.
- Do not imply safety certification.
- Do not claim every robot/task is production-ready.
- Do not lead with top-down TAM before bottom-up wedge math.
- Do not position as anti-integrator.
- Do not let ROI, billing, grippers, fixtures, and dashboards distract from task approval.
- Do not confuse demo-mode success with field proof.
- Do not burn flagship investor intros before quantified deployment proof.

## CEO-Level Summary of the Moat

The defensible object is the task record.

It contains what the human demonstrated, what the AI inferred, what robot/workcell assumptions were used, what controller code was generated, what simulation showed, what evidence is missing, who reviewed it, what version was approved, what changed later, and how the task can be re-evaluated elsewhere.

If Aurevix owns that object across many tasks and factories, it can become the automation memory layer for high-mix industrial work. If it only owns a nice video-to-code demo, it will be copied or absorbed by better-funded robotics platforms.

## CEO-Level Decision

The recommended strategy is:

**Make Aurevix the deployment evidence and Automation Passport platform for high-mix SME factories, starting with a narrow video-to-task retasking workflow and proving one real task through simulation, human review, code export, and evidence package before scaling.**

The next CEO should judge every product, sales, and fundraising decision by one question:

**Does this help a real factory turn a demonstrated task into a trusted, reviewable, reusable automation record?**

If yes, it belongs near the core. If no, it is either later-stage expansion or distraction.

## Source Notes and Confidence

High confidence:

- Repo structure and implemented modules from `AGENTS.md`, `README.md`, `apps/web/src/lib/types.ts`, and source files.
- Trust layer semantics from `docs/DEPLOYMENT_TRUST_LAYER.md` and `apps/web/src/lib/trust-layer.ts`.
- Automation Passport behavior from `apps/web/src/lib/automation-passport.ts`.
- Code generation targets from `apps/web/src/lib/codegen.ts`.
- Feasibility, gripper, fixture, ROI, and value measurement logic from corresponding source files.

Medium confidence:

- Strategic recommendations from `docs/AI_CPO_STRATEGIC_BRIEF_2026-06-27.md`.
- Investor objections and design-partner proof needs from `docs/pitch-stress-test.md`.
- Competitive positioning from prior internal strategy notes; verify current public competitor claims before external use.

Founder verification required:

- Paid/scoped/scheduled/referenceable status of first design partnership.
- Exact robot, task, gripper, baseline, success criteria, deployment date, and safety owner.
- Data rights for learning from design-partner videos, validation results, failures, and outcomes.
- Pricing, pilot fee, expected ACV, gross margin, support load, and round ask.
