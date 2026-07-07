# Claude Fable Upgrade Prompt: Accuracy, Algorithms, and Simulation Fidelity

Use this as the main copy-paste prompt for Claude Fable / Claude Code when you want maximum effort on Aurevix's teaching intelligence, motion accuracy, and 3D simulation quality.

It is grounded in the current codebase at `/Users/martin/Documents/RoboApprentice-v3`, so the agent should improve the real weak points instead of doing a vague redesign.

## Copy-Paste Prompt

You are working in `/Users/martin/Documents/RoboApprentice-v3`.

This is Aurevix, an AI robot-teaching platform. A factory operator demonstrates a manual task with video, and the system interprets it into a robot policy, generates executable robot code, validates feasibility, and renders a convincing 3D simulation.

Your mission is to upgrade the product with maximum seriousness and depth, especially in:

- algorithmic accuracy
- motion interpretation accuracy
- scene understanding accuracy
- kinematic plausibility
- collision honesty
- simulation fidelity
- shape diversity and workcell realism

Do not give a lightweight polish pass. Treat this like an applied robotics + simulation improvement sprint inside the existing architecture.

## What The Current Repo Already Has

The current app is not empty. It already has:

- a real interpretation route in `apps/web/src/app/api/tasks/[id]/interpret/route.ts`
- a strong provider prompt that emits both motion steps and a scene object model
- post-processing in `apps/web/src/lib/policy-pipeline.ts`
- reachability and simple kinematics in `apps/web/src/lib/robot-kinematics.ts`
- a separate simplified IK helper in `apps/web/src/lib/ik-solver.ts`
- a planning manifest adapter in `apps/web/src/lib/planning-manifest.ts`
- a basic simulation manifest + matplotlib simulator in `apps/web/src/lib/simulation.ts`
- a Three.js teaching replay in `apps/web/src/components/robot-arm.tsx`
- fallback scene derivation from step text in `apps/web/src/lib/scene-model.ts`

So this is an upgrade task, not a greenfield task.

## Real Weaknesses You Must Address

These are repo-grounded limitations visible in the current implementation:

1. The standalone IK approximation is too crude.
   - `apps/web/src/lib/ik-solver.ts` currently guesses joint angles from planar heuristics and a fixed reach constant.
   - It is not a true iterative solver and does not meaningfully use chain geometry beyond joint limits.
   - Improve it into a real iterative or analytic approximation with better convergence, orientation handling, and error reporting.

2. The policy pipeline is safe but still simplistic.
   - `apps/web/src/lib/policy-pipeline.ts` inserts vertical approach/retract moves and applies basic retiming.
   - It does not reason about scene-object geometry, lateral clearances, obstacle avoidance, object-specific contact offsets, or shape-aware approach vectors.
   - Upgrade it without breaking determinism.

3. Scene derivation still falls back to semantic guesses.
   - `apps/web/src/lib/scene-model.ts` does a good job staying honest, but fallback scene creation is still text-driven and approximate.
   - Improve the evidence-grounded path and strengthen validation, object association, and object geometry estimation.

4. The 3D replay is visually strong but kinematically simplified.
   - `apps/web/src/components/robot-arm.tsx` renders a smoothed Catmull-Rom trajectory through waypoints.
   - That is visually pleasing, but not equivalent to a physically planned robot path and can imply arcs or clearances the real policy never proved.
   - Improve the visualization so it is both readable and honest about what is planned versus inferred.

5. The exported Python simulator is very basic.
   - `apps/web/src/lib/simulation.ts` currently linearly interpolates points and plots waypoints.
   - It does not represent scene objects, carried payload state, tool orientation evolution, contact phases, collision envelopes, or timing realism.
   - Make it a much better review artifact.

6. Shape diversity is still limited by proxy assumptions.
   - The product needs to handle boxes, trays, bins, totes, cylinders, brackets, machined parts, fixtures, surfaces, rails, and ambiguous unknown objects with believable procedural geometry.
   - The simulator should visibly improve when different object classes are inferred.

## Non-Negotiable Product Goals

The upgraded system should:

- infer task stages more accurately from video evidence
- preserve distinct stages instead of collapsing them
- produce more believable waypoints and contact sequencing
- render more diverse and more realistic workcell objects
- remain honest when evidence is weak
- improve collision and reachability review value
- stay usable even when no perfect reconstruction is possible

The user should feel: "this is much closer to a real robot teaching and simulation system."

## Files You Must Read First

Read these before editing:

- `apps/web/src/lib/types.ts`
- `apps/web/src/app/api/tasks/[id]/interpret/route.ts`
- `apps/web/src/lib/scene-model.ts`
- `apps/web/src/lib/policy-pipeline.ts`
- `apps/web/src/lib/robot-kinematics.ts`
- `apps/web/src/lib/ik-solver.ts`
- `apps/web/src/lib/planning-manifest.ts`
- `apps/web/src/lib/simulation.ts`
- `apps/web/src/components/robot-arm.tsx`
- `apps/web/src/app/app/teach/page.tsx`

Also inspect relevant tests in:

- `apps/web/src/__tests__/policy-pipeline.test.ts`
- `apps/web/src/__tests__/robot-kinematics.test.ts`
- `apps/web/src/__tests__/scene-model.test.ts`
- `apps/web/src/__tests__/planning-manifest.test.ts`

## Upgrade Directions

### 1. Interpretation and Evidence Fusion

Improve the video-to-policy path in `interpret/route.ts` and related evidence utilities.

Goals:

- better multi-stage temporal segmentation
- better association between motion events and grip/release steps
- better object persistence across frames
- stronger use of motion zones and frame-to-frame evidence
- stronger consistency between step descriptions and scene-object labels
- better confidence and warning output

Important:

- do not simply make the prompt longer
- improve the algorithmic post-checks too
- validate that the number of pick/place cycles matches the evidence
- preserve separate stages when objects, destinations, or action contexts change

### 2. Better Scene Geometry and Shape Modeling

Improve the scene model so it can drive better rendering and planning.

The scene layer should support:

- object role
- object category
- approximate size
- approximate pose
- object confidence
- evidence grounding metadata
- geometry fidelity metadata
- enough information to produce distinct procedural geometry

Add or refine shape-aware fields if needed, for example:

- symmetry hints
- open-top container hints
- cavity depth
- handle or flange hints
- fixture support type
- flatness / cylindricality / aspect ratio hints

But keep the data model compact and practical.

### 3. Shape-Aware Procedural Simulation

Upgrade the Three.js workcell rendering so the app can create many different believable objects instead of only generic proxies.

The simulator should be able to render plausible variants of:

- open tote
- deep bin
- shallow tray
- cardboard box
- cylindrical can or shaft
- bracket / L-bracket
- machined block with cutout or hole
- fixture nest
- V-block or rail support
- inspection surface
- generic station
- unknown object proxy

Use procedural geometry, grouped primitives, bevel/chamfer tricks, layered materials, and stable transforms.

Important:

- do not make the scene noisy or game-like
- do make it feel premium, precise, and industrial
- keep rendering efficient
- avoid rebuilding heavy geometry every frame

### 4. Motion, IK, and Kinematic Plausibility

Improve the motion pipeline so it is more believable and more useful for review.

Specifically:

- replace or substantially improve the crude IK approximation in `ik-solver.ts`
- improve error metrics and reachability explanations
- keep a distinction between reachable-with-confidence and clamped-for-preview
- account for orientation more carefully
- improve transition smoothing without visually inventing unsafe clearance
- if using interpolation, annotate or separate:
  - planned waypoint path
  - display smoothing path
  - inferred carry arc

Do not silently fake physically valid paths where none were planned.

### 5. Better Collision and Clearance Review

Improve collision-related usefulness across:

- `policy-pipeline.ts`
- `planning-manifest.ts`
- `simulation.ts`
- Three.js visualization

Goals:

- shape-aware contact offsets
- better approach/retract generation
- clearance checks against scene-object proxies
- explicit warnings when the path is only waypoint-valid, not collision-planned
- better display of risk areas, low-clearance segments, and low-confidence object geometry

### 6. Better Exported Simulation Artifact

Upgrade `apps/web/src/lib/simulation.ts` so the exported simulator becomes a stronger review artifact.

It should ideally include:

- scene objects
- object classes and dimensions
- carried-object state across grip/release windows
- richer timing
- different motion colors or phases
- explicit caution labels when geometry is approximate
- optional orientation / yaw display
- contact event annotations

It should still be easy to run locally.

## Engineering Constraints

- Keep the current Next.js / TypeScript architecture.
- Do not introduce a giant new framework.
- Do not break code generation routes.
- Do not hardcode to one demo video.
- Do not overclaim accuracy where the evidence is weak.
- Prefer honest simulation over fake precision.
- Preserve fallback behavior when AI or perception is incomplete.

## Design Constraints

- Use existing design variables for UI where appropriate.
- Keep the Aurevix visual language precise, light, and industrial.
- No random neon sci-fi redesign.
- Improve realism through geometry, materials, lighting, and motion clarity.

## Implementation Expectations

You should:

1. inspect the existing code carefully
2. propose the smallest architecture changes that unlock major quality gains
3. implement real code, not only notes
4. add or update tests
5. run typecheck
6. run focused tests
7. if practical, run the teaching flow locally and verify behavior

## Acceptance Criteria

The work is only done if the following become materially better:

- policy stage segmentation
- object-role consistency
- scene-object diversity
- simulation realism
- honesty of confidence / warnings
- kinematic plausibility
- exported simulation usefulness

And all of this must remain compatible with the existing teach workflow.

## Concrete Review Targets

When reviewing your own output, explicitly answer:

1. Did I improve true algorithmic reasoning, or only the prompt text?
2. Did I improve simulation fidelity, or only cosmetics?
3. Can the system now represent more object shapes and workcell types?
4. Did I reduce hallucinated certainty?
5. Did I make the path preview more honest about what is planned versus inferred?
6. Did I preserve app stability and existing exports?

## Final Response Format

When you finish, report:

- what you changed in the interpreter
- what you changed in scene modeling
- what you changed in IK / kinematics / path logic
- what you changed in 3D rendering and shapes
- what tests you added or updated
- typecheck/test/browser results
- remaining limitations for true robot-grade planning

Do not give a vague summary. Be precise and technical.
