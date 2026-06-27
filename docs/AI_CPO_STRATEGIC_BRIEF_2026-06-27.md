# AI-CPO Strategic Brief - Aurevix

Date: 2026-06-27  
Session type: Strategy mode  
Prompt source: Elite 14-phase AI Chief Product Officer framework  
Repo reviewed: `/Users/martin/Documents/RoboApprentice-v3`

## Strategic Situation Statement

Aurevix is building a browser-based robot teaching and deployment-readiness platform for SME factory operators, plant engineers, and system integrators in the industrial robotics software category. The product turns task demonstrations into robot motion steps, validates feasibility, generates controller code, and packages evidence around the resulting task. It competes indirectly with robot OEM teaching software, simulation/offline-programming tools, AI-native robot vendors, and hardware-agnostic robotics platforms. Current state: demo/MVP console with teach workflow, deterministic fallback, Anthropic/Ollama/Claude CLI interpretation path, codegen, feasibility simulation, risk-assessment draft API, deployment trust layer, automation passport, outcome pricing, gripper recommendations, and fixture design surfaces. The decision this session must answer: what should Aurevix concentrate on in the next 90 days so it can become strategically defensible rather than a nice AI demo? Key constraints: no physical robot connection in the MVP, safety outputs must not be represented as certified, the primary user is not a robotics engineer, and the repo already contains many adjacent modules that risk diluting the wedge. Confidence at start: MEDIUM, because product context is strong but customer discovery evidence is still assumed.

ASSUMED: current traction is pre-revenue or design-partner stage because the repo and README present a local demo/product prototype and do not include customer telemetry, pipeline, or contracts.

ASSUMED: the next practical decision is "what should we build and validate in the next 90 days" because the prompt did not provide a narrower board question.

SESSION TYPE: Strategy mode, because the problem and product direction are mostly understood, but the strategic focus among several plausible wedges is unresolved.

## Diagnosis

Aurevix will not win by being "AI that teaches robots from video." That phrase is too easy for a robot OEM, Standard Bots, Intrinsic, or Wandelbots to absorb. The structural constraint is trust transfer: factories do not merely need a generated robot program; they need a task record that a non-expert operator, a plant engineer, a safety reviewer, and an integrator can all inspect, approve, reuse, and defend after the AI has made a suggestion. The unserved space is the versioned task-evidence layer between "the robot can probably do this" and "this automation is allowed to run here."

## Guiding Policy

Aurevix should become the deployment evidence and task-portability layer for high-mix SME automation, starting with one narrow workflow: teach a task, simulate feasibility, generate a controller program, collect qualified review evidence, and export a version-bound automation passport.

This means Aurevix will not:

1. Try to become a universal robot operating system in the next 90 days.
2. Sell "fully autonomous robot programming" or imply safety certification.
3. Lead with a broad marketplace of grippers, fixtures, pricing models, and dashboards before the core trust loop proves repeatable.

## The Core Bet

IF Aurevix makes the deployment trust record and automation passport the center of the product, AND SME manufacturers value auditable deployment readiness more than another no-code robot-programming surface, AND integrators are willing to trial it on real candidate tasks without giving Aurevix direct robot control, THEN at least 60% of recruited design partners will complete one task from video/import to evidence-package export within 30 days of onboarding by 2026-09-30.

## Kill Conditions

This bet is wrong if:

- Fewer than 3 qualified design partners provide real or representative task videos by 2026-08-15.
- Less than 40% of design-partner tasks reach evidence-package export without founder-led handholding by 2026-09-30.
- Buyers consistently say the evidence package is "nice documentation" but not useful for approval, procurement, integrator handoff, or cross-site reuse by 2026-09-30.
- Integrators refuse to share enough task/process context to produce useful passports, even under anonymization, by 2026-10-15.

## Market Intelligence

Source confidence key: HIGH means directly sourced from company pages or current industry reporting; MEDIUM means inferred from product pages and market positioning; ESTIMATED means reasoned from category patterns and must be validated.

### Competitor Map

| Competitor | Stated position | Actual paid-for value | Where they are strong | Gap Aurevix can attack |
| --- | --- | --- | --- | --- |
| Standard Bots | AI-native industrial robots | Fast deployment through vertically integrated robot hardware and software | Raised $200M Series C at $1B valuation in June 2026; hardware + AI story is powerful. HIGH: [The Robot Report](https://www.therobotreport.com/standard-bots-raises-200m-expand-u-s-manufacturing-footprint/) | Hardware lock-in. They are less likely to be neutral task evidence across mixed robot fleets. MEDIUM |
| Wandelbots NOVA | Robot-agnostic physical AI / robotics OS | Developer platform, robot control abstraction, simulation-to-real, fleet orchestration | Hardware-agnostic OS, Python/TypeScript SDKs, NVIDIA/Isaac workflows, edge/cloud platform. HIGH: [Wandelbots NOVA](https://www.wandelbots.com/wandelbots-nova), [Product Description](https://www.wandelbots.com/product-description-wandelbots-nova) | Too platform/developer-heavy for the median SME operator; Aurevix can be the approval-ready task artifact layer, not the OS. MEDIUM |
| RoboDK | Robot simulation and offline programming | Affordable multi-brand simulation and code generation | Clear pricing: Professional permanent license listed at $3,995. HIGH: [RoboDK pricing](https://robodk.com/pricing) | Strong engineering tool, weaker operator-to-approval narrative and evidence workflow. MEDIUM |
| Universal Robots PolyScope X | Human-friendly cobot software | Fast UR-only programming and deployment | Browser-based, accessible programming built around UR ecosystem. HIGH: [Universal Robots](https://www.universal-robots.com/products/polyscope-x/) | OEM-specific. Cross-vendor task lineage and neutral evidence remain open. MEDIUM |
| Intrinsic Flowstate | Developer environment for production-grade robotics | Sim-to-real automation development backed by Alphabet/NVIDIA ecosystem | All-in-one developer environment from design to deployment. HIGH: [Intrinsic Flowstate](https://www.intrinsic.ai/flowstate) | Likely developer/integrator-first, not SME operator-first trust record. MEDIUM |
| READY Robotics / ForgeOS | Former robot-agnostic OS | Historic warning, not active competitor | ForgeOS was known as a robot-agnostic OS; READY shut down in 2024, and Standard Bots acquired IP. HIGH: [shutdown](https://www.therobotreport.com/ready-robotics-maker-of-forgeos-shuts-down/), [IP acquisition](https://www.therobotreport.com/standard-bots-acquires-ready-robotics-ip-advance-ai-robot-training/) | Caution: "universal OS" is not automatically a winning wedge. The wedge must attach to an urgent buyer workflow. HIGH |

### Feature Map and Opportunity Scores

Scoring uses the prompt's formula: Opportunity Score = Importance + max(Importance - Satisfaction, 0). Scores are ESTIMATED until design partners validate them.

| Gap | Importance | Current satisfaction | Opportunity score | Why it matters |
| --- | ---: | ---: | ---: | --- |
| Version-bound deployment evidence package | 9 | 3 | 15 | AI-generated robot code creates a review problem, not just a programming problem. |
| Robot-agnostic task passport for reuse | 8 | 3 | 13 | High-mix SME automation needs reuse across cells, sites, and robot models. |
| Operator-readable risk/review prompts | 8 | 4 | 12 | Safety reviewers need editable, non-certifying drafts with clear human responsibility. |
| Pre-purchase task feasibility from demo video | 8 | 5 | 11 | Useful sales wedge, but can become a commodity as simulation/AI improves. |
| Outcome measurement tied to deployed tasks | 7 | 4 | 10 | Buyer value, but it depends on the trust loop existing first. |

### Pricing Map

| Player | Pricing model | Where it breaks for Aurevix's ICP |
| --- | --- | --- |
| RoboDK | Published professional permanent license at $3,995. HIGH | Easy to understand, but an SME still needs robotics expertise and approval process discipline. |
| Wandelbots NOVA | License agreements, cloud/edge deployment, consumption-based features described publicly. HIGH | Likely too implementation-heavy for small factories unless an integrator packages it. |
| Standard Bots | Hardware-led sales; public pricing is not the strategic anchor. MEDIUM | Attractive if the customer standardizes on Standard Bots hardware; weaker for mixed installed bases. |
| Universal Robots | Robot/OEM ecosystem economics. MEDIUM | Works well inside UR; breaks when the plant has ABB/FANUC/KUKA/Yaskawa/UR mix. |
| Aurevix recommended test | Design-partner subscription + per-approved-task evidence package; later outcome-based optionality. ESTIMATED | Do not charge for "AI generations." Charge for deployable, reviewable task records and reuse. |

### UX Pattern Map

Common patterns in the category: 3D workcell visualization, robot path timeline, controller code export, simulation before real execution, teach pendant or visual programming, and status badges for robot state.

Conspicuously wrong pattern: most tools still center the robot/program as the object of work. Aurevix should center the task record: intent, evidence, version, approval state, controller outputs, workcell assumptions, and portability.

### Commodity Collapse List

Features likely to become cheap or table stakes within 12-18 months:

- Basic video-to-step summarization.
- Generic URScript/ROS 2/pseudocode generation.
- Simple 3D replay of motion paths.
- Chat-based explanation of a robot program.
- Basic gripper suggestion from payload/material fields.

Features that become more valuable because AI commoditizes the above:

- Proof that a generated program was reviewed against a specific workcell version.
- Audit trail of who approved which task and which policy hash.
- Cross-robot task lineage and blocked-deployment reasons.
- Dataset of task outcomes tied to evidence quality.

## First-Principles Excavation

Stated problem: SME factory operators need to teach robots new tasks without robotics expertise.

Why? Because high-mix work creates too many low-volume tasks for scarce robot programmers to manually code.

Why? Because the economics of traditional integration favor stable, repeated, well-specified automation cells.

Why? Because every new task carries hidden work: feasibility, tool choice, fixture assumptions, safety review, controller-specific translation, supervised trial, and change management.

Why? Because plants do not buy "a robot path"; they buy confidence that a task can be run without breaking the cell, injuring people, or becoming a maintenance burden.

Why? Because the bottleneck is not only programming skill; it is deployment trust across people with different accountability: operator, engineer, integrator, safety reviewer, and economic buyer.

REAL PROBLEM: The granularity of robot teaching tools is mismatched to the granularity of deployment accountability. Tools produce programs; factories approve tasks.

Anti-hypothesis: This reasoning is wrong if SME buyers primarily care about lowest-cost robot programming and do not value evidence packages, version lineage, or task portability enough to pay or change workflow.

Minimum test: Give 5 integrators or plant engineers two outputs from the same task video: a generated robot program alone, and a generated program plus trust record/passport. Ask which they would send into an approval meeting, what is still missing, and whether they would pay for the second artifact.

Discovery pre-mortem:

- Buyers like the story but still require integrators to redo the work in their own tools.
- The trust record is too generic to change approval behavior.
- Cross-robot portability is technically impressive but not used because cells are too context-specific.
- The product tries to serve operators, engineers, and integrators equally and becomes too complex for all three.
- The AI-generated starting point is not accurate enough to earn the right to own the review workflow.

WOOP:

- Wish: In 90 days, Aurevix has a repeatable design-partner workflow from task demonstration to evidence export.
- Outcome: A plant engineer can say, "I cannot run this yet, but I can see exactly what has been checked, what is missing, and what changed since the last version."
- Obstacle: The product may still feel like a demo console with many modules rather than one serious approval workflow.
- Plan: If a workflow step does not directly advance task approval or task reuse, hide it behind advanced mode or remove it from the first-run path.

## War Council Synthesis

Product manager: The team is close to mistaking module breadth for product strategy. The outcome is not "generate a skill." The outcome is "a task reaches qualified review with fewer handoffs and fewer unknowns."

Behavioral scientist: The behavior change is large. Operators must trust an AI interpretation; engineers must trust operator-provided evidence; safety reviewers must trust that the tool does not overclaim. Fogg B=MAP breaks at Ability if the first-run workflow has too many choices, and at Motivation if buyers see it as another toy demo.

Enterprise buyer: The budget likely comes from automation engineering, integrator services, or operational excellence, not generic SaaS. The economic buyer says no if Aurevix cannot reduce integration hours, accelerate feasibility decisions, or improve audit readiness.

Investor: The $100M ARR path is not individual operators making robot skills. It is becoming the task evidence system of record for high-mix automation across integrators, mid-market manufacturers, and eventually OEM ecosystems.

Competitor red hat - Wandelbots: If Aurevix gets traction, Wandelbots would position NOVA Cloud as the governance layer and absorb task approval into its platform. Aurevix should avoid competing as a lower-level robot OS and instead win on operator-first, evidence-first task records that can sit above or beside platforms.

Systems architect: The dangerous data-model decision is treating a task as mutable generated content rather than a versioned record with policy hash, workcell assumptions, robot target, review evidence, and lineage. The repo's trust-layer types already point in the right direction.

UX researcher: Do not over-weight power users. The median user does not want a generalized robotics workbench; they want to know what to do next and whether the task is allowed to progress.

ACH result: The strongest surviving hypothesis is not "Aurevix should be the easiest robot programming tool." That is inconsistent with OEM, Standard Bots, and Intrinsic pressure. The stronger hypothesis is "Aurevix should be the operator-readable task approval and portability layer for AI-assisted automation."

## Outcome-Driven Opportunity Map

| Desired outcome | Importance | Satisfaction | Opportunity | Decision |
| --- | ---: | ---: | ---: | --- |
| Minimize the time it takes to decide whether a manual task is automation-worthy | 8 | 5 | 11 | Table-stakes wedge |
| Minimize the time it takes to convert a task demonstration into reviewable robot steps | 8 | 4 | 12 | Keep |
| Minimize the uncertainty around what evidence is missing before deployment | 9 | 3 | 15 | Core |
| Minimize the time it takes for a safety reviewer to understand task assumptions | 9 | 4 | 14 | Core |
| Minimize the rework needed when moving a task to a different robot/workcell | 8 | 3 | 13 | Core after first trust loop |
| Minimize the risk of stale approvals after task changes | 9 | 3 | 15 | Core |
| Minimize controller-specific programming effort | 7 | 5 | 9 | Supporting |
| Minimize gripper/tool selection uncertainty | 6 | 4 | 8 | Supporting/advanced |
| Minimize fixture design ambiguity | 6 | 4 | 8 | Supporting/advanced |
| Minimize billing disputes around outcome pricing | 5 | 4 | 6 | Defer |

## Creative Divergence

| Concept | Core philosophy | Primary action | Moat | Business model | Disappoints | Score |
| --- | --- | --- | --- | --- | --- | ---: |
| Evidence-first deployment layer | Factories approve tasks, not code | Complete missing evidence until a task is review-ready | Workflow lock-in + audit history + task lineage | Subscription + per-approved-task/evidence package | Users wanting one-click autonomy | 4.45 |
| Automation passport network | Reusable task records become portable industrial IP | Export/import task passports | Data flywheel + indirect network effects among integrators | Per-seat + passport sharing/translation | Single-cell users | 4.05 |
| AI robot teaching toy/demo | Video becomes impressive robot replay | Upload and watch | Weak | Low-cost SaaS | Serious buyers | 2.35 |
| Integrator copilot | Integrators generate docs/code faster | Prepare customer deliverables | Relationship/process data | Seat-based integrator tool | Operators | 3.55 |
| Marketplace recommender | Tooling/fixtures/robots suggested from task | Browse recommended equipment | Affiliate/commercial data | Affiliate + lead-gen | Buyers who need approval workflow | 2.75 |
| Outcome-pricing proof layer | Pay for verified automation outcome | Measure cycles and value | Billing data + trust | Outcome fees | Early buyers without integrations | 3.10 |
| Hardware-neutral robot OS | Abstract all robots under one runtime | Build apps against one API | Integration depth | Enterprise platform | SMEs | 2.80 |
| Safety documentation accelerator | Generate editable review drafts | Complete risk worksheet | Compliance workflow | Doc generation + review seats | Users focused on codegen | 3.65 |

Top two advanced: Evidence-first deployment layer and Automation passport network. The second depends on the first; portability is not credible until the source task is trusted.

## Radical Simplification Audit

The first-run product should be:

1. Create/import task.
2. Interpret into task intent and motion steps.
3. Simulate feasibility against selected robot/workcell.
4. Generate controller program.
5. Show deployment trust checklist.
6. Collect qualified review evidence.
7. Export evidence package and passport.

Move behind advanced mode for the first 90 days:

- ROI calculator.
- Outcome pricing admin.
- Gripper marketplace-style browsing.
- Fixture STL generation unless directly attached to a missing deployment check.
- Broad robot fleet dashboard.
- Billing screens.
- Multi-language surface polish unless needed for a design partner.

Cognitive-load budget:

| User action | Cost |
| --- | ---: |
| Name/import task | 8 |
| Select robot/workcell | 10 |
| Review interpreted steps | 14 |
| Review simulation/feasibility | 14 |
| Generate/export controller code | 8 |
| Complete trust checklist | 22 |
| Export evidence/passport | 8 |
| Understand remaining blockers | 10 |
| Total | 94 |

The product is already near the cognitive limit. Every visible module that is not in this sequence should justify its existence against this budget.

## Engineering Reality Check

Evidence-first deployment layer:

- Data model simplicity: 4/5. The repo already has Task, TaskVersion, TaskTrustRecord, checklist, approval, audit event, and evidence export types.
- Integration surface: 4/5 for MVP. It can work without direct robot hardware by producing review artifacts and code outputs.
- AI inference cost: 4/5. Interpretation is bounded per task; deterministic fallback exists.
- Scalability at 100x: 3/5. JSON/local persistence must move to append-only DB, authenticated actors, and durable object storage.
- Regulatory exposure: 2/5. Not because it certifies safety, but because buyers will treat it as safety-adjacent. Disclaimers and qualified-person gates are non-negotiable.
- 90-day MVP: feasible with 1-2 engineers if scope is ruthlessly narrowed to the trust loop.

Automation passport network:

- Data model simplicity: 3/5. Passport export/import exists, but real workcell context and provenance will become complex.
- Integration surface: 3/5. Useful without hardware only if design partners accept simulation-derived portability checks.
- Moat at scale: 4/5, but delayed.
- 90-day MVP: feasible only as a companion export/import proof, not as a network.

AI cost estimate: ESTIMATED. At 100 active users each processing 10 tasks/month, task-level LLM inference likely remains manageable if frames/transcripts are bounded. The non-linear cost risk appears when video processing becomes high-frame, high-resolution, or iterative with many failed interpretations.

## Moat Architecture

Selected moat 1: Workflow lock-in through versioned deployment evidence.

WHY 1: A task approval depends on workcell-specific assumptions, reviewer evidence, and current policy hash.  
WHY 2: Once those are captured, recreating them in another tool costs time and introduces liability ambiguity.  
WHY 3: Every task change invalidates or updates the approval state, creating a living record rather than a static export.  
WHY 4: Plant engineers and integrators start using the record as the handoff object.  
WHY 5: Aurevix's product model binds AI interpretation, simulation, controller code, human review, and version lineage into one task artifact.

Evidence this moat is accumulating: repeat exports per account, reviewer comments attached to task versions, imported passports, and customers asking to preserve historical approvals during task edits.

Time to manifest: 3-6 months after real design-partner use.

Copyability test: A competitor can copy checklists. It is harder to copy accumulated task histories, reviewer habits, integrator handoff templates, and customer-specific evidence expectations once those become part of plant routine.

Selected moat 2: Proprietary task-outcome dataset.

WHY 1: Each deployment produces structured task intent, feasibility results, evidence completeness, approval status, controller target, and outcome data.  
WHY 2: That dataset is not available in public robot programming corpora because it combines operational context and review decisions.  
WHY 3: It can improve task recommendations, risk prompts, gripper/fixture suggestions, and portability predictions.  
WHY 4: Better recommendations reduce approval friction and failed trials.  
WHY 5: Aurevix owns the loop from task creation to evidence to outcome, not just code generation.

Evidence this moat is accumulating: increasing first-pass approval rate, fewer missing-evidence loops, better feasibility calibration against supervised trial outcomes.

Time to manifest: 6-12 months.

Copyability test: A well-funded competitor needs access to many real SME task workflows and the permission to observe approval outcomes, not just model weights.

## Temporal Robustness

Scenario A - AI gets 10x better: Basic interpretation and codegen commoditize. The trust record gets stronger because more generated content needs review, provenance, and approval boundaries.

Scenario B - dominant competitor enters: Wandelbots/Intrinsic can win the platform layer; Standard Bots can win hardware-native simplicity. Aurevix survives if it owns operator-readable evidence and neutral task portability above specific robot stacks.

Scenario C - regulation tightens: This likely helps Aurevix if the product remains non-certifying, audit-friendly, and explicit about qualified human responsibility. It hurts if any UI implies automated certification.

Scenario D - market does not develop: Early warning signals are weak design-partner task volume, evidence exports not used in real review meetings, and customers preferring integrator PDFs over Aurevix records.

Invest only in bets that survive at least 3 of 4 scenarios: deployment trust, task lineage, passport export/import, and outcome calibration survive. Generic chat/codegen does not.

## User Journey Obsession Map

Operator:

- Pre-awareness: "This task is repetitive but nobody has time to program it."
- First contact: "Can I show it instead of coding it?"
- Activation: Sees their task converted into named robot steps and a replay they recognize.
- First week: Shares the task record with an engineer rather than a video alone.
- Friction: Fear that the AI will overclaim or make them responsible for unsafe automation.
- Delight: "It tells me what is missing before I embarrass myself in front of engineering."

Plant engineer:

- Pre-awareness: Drowning in small automation requests and incomplete task descriptions.
- First contact: "Is this artifact technically inspectable?"
- Activation: Sees feasibility, workcell assumptions, generated program, and review blockers in one record.
- First week: Uses evidence package in an internal approval or integrator discussion.
- Friction: Distrusts unverified AI output.
- Delight: Version changes automatically invalidate stale approval.

System integrator:

- Pre-awareness: Qualification and scoping eat margin before project approval.
- First contact: "Can this reduce discovery and documentation effort?"
- Activation: Imports/exports a task passport and sees exactly what must be rechecked.
- First week: Uses the passport to quote a job or compare robots.
- Friction: Fears losing services revenue or being boxed into shallow tooling.
- Delight: The artifact makes the customer more prepared, not less dependent on expertise.

Economic buyer:

- Pre-awareness: Labor shortage, high integration cost, and automation backlog.
- First contact: "Does this reduce time-to-decision or deployment risk?"
- Activation: Sees a task move from vague opportunity to reviewable deployment record.
- First month: Asks why every candidate automation task is not captured this way.
- Friction: No proof of ROI without real deployment data.
- Delight: Evidence package turns automation from a black box into a governed pipeline.

## Competitive Wargaming

OpenAI enters directly: They win generic multimodal interpretation and natural-language robot reasoning. Aurevix holds only if it has domain-specific task evidence, workcell lineage, and customer review habits. The credible commitment is to sign 3-5 design partners around evidence-package workflows, not model novelty.

Wandelbots or Intrinsic absorbs the space: They win developer platform and real robot execution. Aurevix should integrate/export rather than fight on OS depth. The credible commitment is a neutral task passport schema and evidence package that can be consumed beside their platforms.

YC startup launches with simpler UX: They win first impressions. Aurevix responds by simplifying to one approval journey and removing module sprawl from first run.

Schelling point: "The PDF/JSON evidence package you bring to the robot deployment review." To become the default, Aurevix must make the artifact easier to trust than a folder of videos, screenshots, and integrator notes.

## Cross-Industry Pattern Transfer

Stripe: Progressive complexity disclosure. Apply by making the simple path "task to evidence package" and hiding advanced robot/programming controls until needed. Two-week test: prototype a single-column task readiness flow and measure whether design partners understand next action without onboarding.

Linear: Opinionated defaults. Apply by deciding the evidence checklist and default review sequence instead of asking users to configure it. Two-week test: watch 5 users complete a task with no settings screen.

Costco: Curation as trust. Apply by recommending one next action, one robot target, and one blocker rather than showing every possible analysis. Two-week test: compare "full dashboard" vs "one blocker at a time" in user comprehension.

Figma: Multiplayer as native state. Apply by making operator, engineer, and reviewer roles visible on the same task record. Two-week test: simulate a handoff where one user records task context and another signs evidence.

Bloomberg: Expertise moat. Apply carefully. Do not make the UI dense for operators, but let integrators gain speed through repeatable passport/evidence templates.

## Strategic Priority Stack - Next 90 Days

1. Make the deployment trust loop the product spine.
   Why this first: without an approval-worthy task record, every other module is a feature demo. Scope: task version, policy hash, blocker reason, evidence checklist, reviewer fields, export package, and stale-approval invalidation.

2. Recruit and run 3-5 design-partner task reviews.
   Dependency: must use the trust loop. Target participants: one plant engineer, one system integrator, one operations/economic buyer per account if possible. Measure completion to evidence export and what gets used in the real review conversation.

3. Collapse the first-run UI to one journey.
   Dependency: informed by the trust loop. Move ROI, billing, marketplace-like recommender, and broad fleet views behind advanced mode or secondary nav until the task reaches review-ready state.

4. Formalize the Automation Passport as a neutral artifact.
   Dependency: trust loop. Define source task, robot model, workcell assumptions, immutable intent, quality parameters, fixture/gripper references, unreachable waypoint checks, and provenance. Do not sell this as a network yet.

5. Add instrumentation for the core bet.
   Track: task created, interpretation completed, simulation reviewed, evidence check completed, approval decision, evidence exported, passport exported/imported, design-partner handoff completed.

## The Unkillable Core

The unkillable core is not the model, the 3D replay, or controller codegen. It is the version-bound task record that says: here is what the human demonstrated, here is what the AI inferred, here is the robot/workcell assumption, here is what was checked, here is what is still blocked, here is who reviewed it, and here is the portable artifact that can be re-evaluated elsewhere.

## Challenger Teach

Here is what is happening in your factory that you probably do not realize: your automation backlog is not stuck only because robot programming is hard. It is stuck because every candidate task loses context as it moves from operator to engineer to integrator to safety review. A video becomes a meeting, the meeting becomes a quote, the quote becomes a program, and the program becomes a risky tribal-memory artifact. The implication is that "AI-generated robot code" solves the most visible part of the problem while leaving the deployment accountability problem untouched. Aurevix is built differently because it treats the task record, not the robot program, as the product: every generated motion plan carries its assumptions, evidence, version lineage, human review state, and portability boundary.

## Decisions Log

| Decision | Why |
| --- | --- |
| Lead with deployment evidence, not AI codegen | Codegen commoditizes; approval workflows compound. |
| Keep "not certified / qualified review required" language | Safety-adjacent products lose trust if they overclaim. |
| Treat Automation Passport as second-order wedge | Portability needs trusted source records first. |
| Defer outcome pricing from the first-run path | It is valuable after deployment evidence exists, distracting before. |
| Avoid universal robot OS positioning | READY/ForgeOS is a cautionary example; Wandelbots already owns the stronger platform narrative. |
| Keep gripper/fixture modules as supporting evidence | Useful when tied to a missing review check; distracting as standalone marketplace. |

## Assumptions Ranked by Strategic Dependency

1. HIGH dependency: Plant engineers/integrators value evidence packages enough to change workflow.
2. HIGH dependency: AI-derived task steps are accurate enough to start review, even if not final.
3. HIGH dependency: Safety-conscious, non-certifying framing increases trust rather than reducing buyer excitement.
4. MEDIUM dependency: Cross-robot task portability matters before a customer has many deployed tasks.
5. MEDIUM dependency: Design partners will share enough real task context to validate this without direct hardware integration.
6. LOW dependency: Outcome-based pricing is a near-term differentiator.

## Continuous Improvement Score

| Quality dimension | Score | Improvement target |
| --- | ---: | --- |
| Diagnosis specificity | 9 | Validate with buyer quotes. |
| Solution novelty | 8 | Stronger if task passport becomes a recognized artifact. |
| Moat causal depth | 8 | Needs real usage data. |
| User journey granularity | 8 | Needs observed user sessions. |
| Competitive defensibility | 7 | Depends on speed to evidence-workflow adoption. |
| Temporal robustness | 9 | Trust layer survives AI/model/platform shifts. |
| Falsifiability | 9 | 90-day kill conditions are observable. |
| Pattern transfer originality | 8 | Needs prototype tests. |

Overall self-assessed quality score: 8.25/10.

## Completion Report

AI-CPO SESSION COMPLETE

Session type: Strategy  
Phases completed: 0-14 in compressed strategic-brief form  
Core bet: Aurevix wins by becoming the versioned deployment-evidence and task-passport layer for AI-assisted robot automation.  
Top strategic priority: make the deployment trust loop the product spine.  
Kill condition to watch: design partners do not use evidence packages in real review or integrator handoff conversations by 2026-09-30.  
Next run trigger: after 3 design-partner reviews, a major competitor move, or 2026-09-30.

## Source Notes

- Standard Bots funding and valuation: [The Robot Report](https://www.therobotreport.com/standard-bots-raises-200m-expand-u-s-manufacturing-footprint/)
- Wandelbots NOVA positioning and platform scope: [NOVA](https://www.wandelbots.com/wandelbots-nova), [NOVA Product Description](https://www.wandelbots.com/product-description-wandelbots-nova)
- READY Robotics / ForgeOS cautionary evidence: [shutdown](https://www.therobotreport.com/ready-robotics-maker-of-forgeos-shuts-down/), [IP acquisition](https://www.therobotreport.com/standard-bots-acquires-ready-robotics-ip-advance-ai-robot-training/)
- RoboDK pricing: [RoboDK pricing](https://robodk.com/pricing)
- Universal Robots PolyScope X: [Universal Robots](https://www.universal-robots.com/products/polyscope-x/)
- Intrinsic Flowstate: [Intrinsic](https://www.intrinsic.ai/flowstate)
- Robotics trend/safety context: [Robotics Tomorrow on IFR trends](https://www.roboticstomorrow.com/content.php?post=25983), [All About Industries on IFR trends](https://www.all-about-industries.com/five-ifr-trends-why-robotics-needs-more-software-in-2026-a-8938d6718454406e9263a6e78ce3021e/)
