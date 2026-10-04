# AI Research Prompt for Aurevix

You are an AI researcher conducting a rigorous technical research review of an existing application called **Aurevix**. Your job is not to produce generic robotics commentary. Your job is to analyze the actual product architecture, identify where its current technical approach is strong or weak, and produce a research-backed improvement roadmap grounded in **recent, high-quality academic sources**.

## Non-negotiable quality bar

- Use **peer-reviewed papers, top conference papers, strong arXiv preprints from recognized labs, academic books, survey papers, standards documents, and official technical documentation**.
- Prioritize work from **2022 onward** for fast-moving areas such as robot learning, vision-language models, imitation learning, monocular video understanding, robot foundation models, manipulation policy learning, differentiable simulation, grasping, and scene understanding.
- For foundational concepts, you may cite older landmark papers or books, but only when they are still the accepted baseline.
- Do **not** rely on blogspam, SEO articles, low-quality Medium posts, marketing pages, generic AI content farms, or unsourced opinion pieces.
- If a source is not obviously credible, exclude it.
- If you use arXiv, prefer papers that are either:
  - from highly credible institutions/labs,
  - later published at strong venues,
  - or already influential enough to matter.
- Whenever possible, prefer sources from venues such as:
  - `RSS`
  - `ICRA`
  - `IROS`
  - `CoRL`
  - `NeurIPS`
  - `ICML`
  - `CVPR`
  - `ICCV`
  - `ECCV`
  - `RA-L`
  - `Science Robotics`
  - `IJRR`
  - `T-RO`
  - `HRI`

## What Aurevix is

Aurevix is a browser-based robot teaching platform for non-roboticists. A human operator records a task demonstration video. The system interprets the task into discrete robot motion steps, builds a task policy, visualizes the policy in 3D, estimates feasibility, generates robot code, and exports deployment artifacts.

## What the current app actually does

You must ground your analysis in these implementation realities:

- Frontend stack: `Next.js 15`, `React 19`, `TypeScript`, `Three.js`
- Main operator flow: `apps/web/src/app/app/teach/page.tsx`
- Main interpretation route: `apps/web/src/app/api/tasks/[id]/interpret/route.ts`
- Policy post-processing: `apps/web/src/lib/policy-pipeline.ts`
- Scene extraction and validation: `apps/web/src/lib/scene-model.ts`
- Motion analysis from video: `apps/web/src/lib/video-motion.ts`
- Perception evidence contract: `apps/web/src/lib/perception-evidence.ts`
- Feasibility simulator: `apps/web/src/lib/feasibility-engine.ts`
- Kinematics heuristics: `apps/web/src/lib/robot-kinematics.ts`
- IK solver: `apps/web/src/lib/ik-solver.ts`
- Simulation export: `apps/web/src/lib/simulation.ts`
- 3D robot/workcell visualization: `apps/web/src/components/robot-viewport.tsx`
- Trust and deployment gating: `apps/web/src/lib/trust-layer.ts`

## Important implementation characteristics you must account for

Your review must explicitly consider that the current app:

- uses a **video-to-task pipeline** rather than kinesthetic teaching or direct teleoperation
- currently depends on **LLM/VLM-style interpretation** and a deterministic fallback
- extracts **stepwise waypoint policies**
- uses **heuristic policy repair**, including:
  - approach/retract insertion
  - gripper-state validation
  - contact-speed clamping
  - floor-collision checks
  - retiming with a jerk-limited or trapezoidal-style profile
- performs **lightweight motion analysis** from video using frame differencing and motion segmentation
- has a **structured perception evidence layer**, but advanced detectors/segmenters/trackers appear planned rather than fully integrated
- uses a **simplified analytic + iterative IK solver** and simplified reachability logic
- uses a **proxy-fidelity scene model** rather than full geometry-grounded digital twins
- exports a **matplotlib-based simulator artifact** and runs an in-app **Three.js policy replay**
- includes **feasibility estimation** for reach, payload, cycle time, and throughput
- includes **trust/safety/deployment review artifacts**, but not full certified safety validation

## Your mission

Produce a research report that answers:

1. What parts of Aurevix are technically promising and aligned with modern research?
2. What parts are too heuristic, too brittle, too low-fidelity, or likely to fail in real industrial deployment?
3. What recent research could meaningfully improve each subsystem?
4. Which improvements are realistic in the short term for a product like this, and which belong to a longer-term research roadmap?
5. Where should Aurevix prefer classical robotics methods, where should it prefer modern learned approaches, and where should it combine both?

## Required evaluation areas

You must structure your analysis around these areas.

### 1. Demonstration understanding from video

Study the state of the art for:

- learning from human video demonstrations
- video-to-action / video-to-robot-policy pipelines
- task segmentation from demonstration videos
- temporal action parsing
- multimodal task grounding
- instruction extraction from video + language
- robot learning from third-person video
- world models or action abstractions for manipulation from demonstration

Answer:

- How strong is Aurevix’s current step-extraction approach relative to the literature?
- What are the main failure modes of using an LLM/VLM plus schema-constrained JSON extraction?
- What newer methods could better infer action phases, contact events, subgoals, object roles, and intent?
- Should the app move toward:
  - vision-language prompting only,
  - fine-tuned task parsers,
  - action-segmentation models,
  - robot foundation models,
  - latent plan extraction,
  - or hybrid symbolic-neural pipelines?

### 2. Perception and scene understanding

Study recent research on:

- open-vocabulary detection
- segmentation for robot manipulation
- video object tracking
- object-centric world models
- monocular depth estimation
- pose estimation from RGB video
- grounding object roles in task execution
- uncertainty estimation for scene reconstruction

Relate this directly to Aurevix’s current pattern:

- motion segmentation with ffmpeg-derived frame differencing
- scene-object extraction into a structured `WorkcellScene`
- proxy geometry with confidence values and review flags
- future-facing placeholders for detectors, masks, trackers, and depth

Answer:

- What are the best modern perception stacks for this use case?
- Which methods are robust enough for industrial tabletop/workcell tasks?
- How should Aurevix represent uncertainty, partial observability, and low-confidence geometry?
- What is the best path from proxy scene objects toward higher-fidelity workcell modeling without making the system too heavy?

### 3. Manipulation planning and policy representation

Study research on:

- task and motion planning
- skill abstraction
- behavior trees
- symbolic planning for manipulation
- waypoint generation from demonstrations
- contact-rich manipulation representations
- manipulation skill libraries
- reusable policy transfer across robots

Evaluate whether Aurevix’s current `TaskPolicy` style representation is:

- too shallow,
- appropriately pragmatic,
- or missing key abstractions such as force phases, uncertainty guards, preconditions/effects, grasp hypotheses, or retry logic.

Answer:

- What richer policy representation would be academically and product-wise strongest?
- Should the app represent skills as waypoint chains, option policies, behavior trees, task graphs, diffusion policies, language-conditioned skill programs, or something else?
- What is the best representation if the product must remain understandable to non-expert operators?

### 4. Kinematics, IK, reachability, and motion validation

Study:

- modern IK methods for industrial manipulators
- damped least squares, optimization-based IK, differentiable IK, collision-aware IK
- singularity handling
- constrained motion planning
- retiming and time-parameterization
- collision checking for simplified digital workcells

Compare the literature against Aurevix’s current approach:

- simplified analytic + iterative IK
- envelope-based reachability
- hand-built workcell bounds
- simple collision checks
- retiming heuristics

Answer:

- What are the biggest technical limitations here?
- Which parts should stay simple and deterministic?
- Which parts need major upgrades to be credible for deployment planning?
- Would libraries such as `Pinocchio`, `MoveIt`, `Drake`, `Tesseract`, `cuRobo`, or differentiable-robotics stacks materially improve this product?

### 5. Simulation and digital twin fidelity

Study:

- lightweight simulation for operator review
- manipulation simulation fidelity requirements
- digital twins for robotic cell validation
- contact simulation
- sim-to-real considerations
- scene proxying vs CAD-grounded planning
- uncertainty-aware simulation

Directly assess Aurevix’s current simulation strategy:

- manifest export
- straight-line waypoint interpolation
- matplotlib simulation artifact
- in-browser Three.js visualization
- proxy objects and proxy collision geometry

Answer:

- What can the current simulator validly claim, and what can it not validly claim?
- What is the minimum simulation fidelity required for trustworthy pre-deployment review?
- How should the app distinguish between:
  - visual review,
  - kinematic feasibility,
  - collision plausibility,
  - cycle-time estimation,
  - and physically realistic execution validation?
- What recent research or tooling best bridges lightweight UX with stronger backend validation?

### 6. Robot code generation and cross-robot portability

Study:

- robot program synthesis
- language-to-robot-code systems
- robot-agnostic skill representations
- task transfer across manipulators
- code generation verification

Answer:

- How should Aurevix separate task semantics from robot-specific execution details?
- What is the best research-backed intermediate representation for generating URScript, ROS 2 Python, RAPID, KAREL, or other robot programs?
- How should generated code be validated before deployment?

### 7. Human factors, operator UX, and explainability

Study:

- human-robot interaction for non-expert robot programming
- explainability in robot teaching systems
- operator trust in AI-assisted automation
- mixed-initiative robot programming
- correction interfaces for demonstration-based teaching

Evaluate the product design implications of:

- asking non-experts to trust AI-generated steps
- replaying task policies in 3D
- surfacing confidence, warnings, and review gates

Answer:

- What evidence presentation is most useful for a factory operator?
- What kind of correction loop should the app expose?
- How should uncertainty and confidence be shown so operators neither overtrust nor underuse the system?

### 8. Safety, assurance, and industrial readiness

Study:

- standards-aware robot risk assessment
- assurance cases for learning-enabled robotic systems
- human oversight in robot deployment approval
- trust calibration in safety-critical automation

Relate this to Aurevix’s:

- trust layer
- deployment gate
- risk-assessment draft generation
- reviewer sign-off concept

Answer:

- What should remain manual by design?
- Where can AI assist safely without overstating certainty?
- What research exists on assurance patterns for systems that mix learned interpretation with deterministic execution layers?

## Source-selection instructions

For every major claim, give sources. For every subsystem, prioritize:

1. recent survey paper or strong benchmark paper
2. strongest recent primary papers
3. one or two foundational references if still necessary
4. relevant standards or official framework docs where engineering practice matters

For each source, include:

- title
- authors
- year
- venue
- URL
- why it matters specifically for Aurevix

## Required output format

Produce your report in this exact structure.

### A. Executive summary

- 1-2 pages
- highest-value conclusions only
- top 10 research-backed improvements ranked by expected product impact

### B. System decomposition

Break Aurevix into concrete subsystems and summarize:

- what it currently does
- what methods it appears to use
- what assumptions it makes
- where it is technically brittle

### C. Research review by subsystem

For each subsystem above:

- summarize the best recent literature
- compare Aurevix’s current approach against it
- identify gaps
- recommend the strongest upgrade options

### D. Improvement roadmap

Split recommendations into:

- `0-6 weeks`
- `6 weeks-3 months`
- `3-9 months`
- `9+ months / research bets`

For each item include:

- improvement
- why it matters
- implementation complexity
- product risk
- research risk
- dependencies
- expected user-visible gain

### E. Evidence table

Create a table with columns:

- `Subsystem`
- `Current Aurevix approach`
- `Best recent research direction`
- `Recommended action`
- `Confidence in recommendation`
- `Key sources`

### F. Source appendix

Provide a curated bibliography grouped by topic.

## Additional constraints

- Be specific about what Aurevix should **not** do.
- Distinguish clearly between:
  - improvements that are academically exciting,
  - improvements that are practical for this product now,
  - and improvements that are likely overkill.
- If a modern research direction is impressive but operationally fragile, say so.
- If classical robotics is the better answer in a subsystem, say so plainly.
- If a subsystem needs benchmarking, propose concrete benchmark designs.
- If you infer missing implementation details, label them as inference rather than fact.

## Final instruction

Do not give me a generic literature review on robotics. Give me a **research-backed technical critique and upgrade roadmap for Aurevix as it exists today**.
