# Claude Fable Production Fix Prompt: Demo-Ready in 2 Days

Use this prompt when Claude Fable / Claude Code has already implemented the first upgrade pass, but left caveats such as:

- limited IK orientation handling
- conservative collision checks without detours
- monocular proxy scene fidelity
- missing live browser verification

This prompt is intentionally forceful. The goal is not theoretical robot-grade planning for every case. The goal is a production-ready, reliable, high-confidence demo build for Aurevix in two days that works end to end on the real workflow.

## Copy-Paste Prompt

You are working in `/Users/martin/Documents/RoboApprentice-v3`.

This is a hardening sprint, not an exploration sprint.

You already implemented a first pass, but your own report still listed these remaining limitations:

1. IK still effectively favors a vertical/top-down tool assumption.
2. Clearance checking is conservative and warns about risky straight segments, but does not fix them.
3. Scene geometry is still monocular-proxy quality.
4. The teach flow was not fully driven in the browser in this session.

These are now demo blockers. You must reduce or eliminate them enough that the product is dependable for a live demo in 2 days.

You are not allowed to stop at caveats this time. You must turn those caveats into concrete mitigations, code improvements, and verification steps that make the software demo-safe and production-ready for the constrained Aurevix workflow.

## What “Production-Ready” Means Here

It does NOT mean:

- full industrial certification
- universal robot-task coverage
- perfect 3D reconstruction from monocular video
- full MoveIt-class planning across arbitrary cells

It DOES mean:

- the constrained demo flow works reliably from start to finish
- the UI and outputs are consistent and believable
- the system does not visibly fall apart on the demo video
- the simulator renders differentiated workcell objects and believable motion
- the path preview is honest and useful
- risky or uncertain parts are handled gracefully, not with broken output
- the workflow is verified in a browser, not only by tests
- fallback paths remain stable if AI/provider behavior varies

## Your Job

Take the existing implementation and close the gap between “promising technical upgrade” and “reliable live-demo software.”

You must focus on the real code, not on writing more strategy prose.

## Files To Inspect First

Read these first:

- `apps/web/src/lib/ik-solver.ts`
- `apps/web/src/components/robot-viewport.tsx`
- `apps/web/src/lib/policy-pipeline.ts`
- `apps/web/src/lib/planning-manifest.ts`
- `apps/web/src/lib/scene-model.ts`
- `apps/web/src/lib/simulation.ts`
- `apps/web/src/app/api/tasks/[id]/interpret/route.ts`
- `apps/web/src/app/app/teach/page.tsx`
- `apps/web/src/lib/demo-seed.ts`

Also inspect tests:

- `apps/web/src/__tests__/ik-solver.test.ts`
- `apps/web/src/__tests__/policy-pipeline.test.ts`
- `apps/web/src/__tests__/policy-pipeline-scene.test.ts`
- `apps/web/src/__tests__/planning-manifest.test.ts`
- `apps/web/src/__tests__/simulation.test.ts`

## Required Fixes

### 1. Replace “limitation” with constrained, practical orientation support

Do not leave the report saying orientation is a limitation.

You do NOT need universal arbitrary 6-DOF industrial IK for this demo. But you DO need robust support for the orientations the product is likely to show in the demo and nearby tasks.

Implement a constrained production solution:

- support explicit grasp/posture modes such as:
  - `top_down`
  - `side_pick`
  - `angled_insert`
- derive or store the intended posture mode per step or per contact segment where appropriate
- improve `ik-solver.ts` so orientation is part of the actual solution scoring, not just an afterthought
- return richer diagnostics:
  - position error
  - orientation error
  - joint-limit margin
  - singularity or near-singularity warning
- if a pose is reachable only after clamping or fallback, surface that honestly in warnings and viewport overlays

Important:

- prefer a stable, deterministic solver over a clever but fragile one
- demo reliability matters more than mathematical elegance
- do not regress current reachable cases

### 2. Upgrade collision review into collision mitigation

Do not stop at “this segment is risky.”

For the constrained demo, when a path segment is too close to an obstacle proxy:

- synthesize a safer detour or elevated retract waypoint when possible
- prefer simple deterministic avoidance over complex global planning
- keep the inserted path interpretable and explainable
- store whether a segment is:
  - direct
  - lifted-for-clearance
  - detoured-around-obstacle
  - still unverified

The pipeline should do more than warn:

- use collision primitives from the scene
- check segment-to-primitive proximity
- raise vertical clearance or insert a bridge waypoint when a straight line crosses a risky envelope
- only leave a warning when no simple safe detour is available

Update:

- `policy-pipeline.ts`
- `planning-manifest.ts`
- visualization in `robot-viewport.tsx`
- simulation export in `simulation.ts`

The operator should be able to SEE which segments were adjusted for safety.

### 3. Improve proxy-geometry quality without lying

Do not try to fake perfect monocular reconstruction.

Instead, make the proxy scene clearly better and more stable:

- improve object-class inference consistency
- improve size and aspect-ratio estimation
- add shape hints that drive better procedural geometry
- make object pose and scale more stable across the demo
- make uncertain objects visibly lower-confidence but still useful

Add practical shape descriptors where useful, for example:

- `aspectRatioClass`
- `openTop`
- `cavityDepthHint`
- `handleLike`
- `supportType`
- `profileHint`

Then use them to produce visibly different:

- tote
- tray
- deep bin
- box
- cylinder
- bracket
- machined block
- fixture nest
- V-block / rail support
- inspection pad
- station platform
- unknown proxy

The scene should look intentional and industrial, not random or game-like.

### 4. Make the simulator honest and impressive at the same time

The current product can look good while still over-implying path certainty.

Fix that.

In the Three.js viewport and exported simulation:

- separate planned waypoints from display smoothing
- distinguish validated segments vs inferred-smoothed segments
- visualize carry state more clearly
- show collision/risk overlays where relevant
- show low-confidence scene objects in a different visual language
- keep the experience premium, not cluttered

The result should help a reviewer understand:

- what is definitely planned
- what was adjusted by the pipeline
- what is only approximate

### 5. Browser verification is mandatory

You are not done until you run the real app.

You must:

1. start the app locally
2. open the actual teach flow in a browser
3. run the workflow using the real demo path
4. verify the interpretation result
5. verify the scene rendering
6. verify the motion replay
7. verify exports if relevant

Use the existing demo asset:

- `/demos/warehouse-multistep.mp4`

Verify at minimum:

- the workflow completes
- the interpreted policy is multi-stage
- the viewport renders multiple differentiated objects
- collision-aware path adjustments do not break playback
- the UI stays provider-neutral and coherent
- no obvious runtime exceptions occur

If something fails, fix it and rerun.

## Hard Constraints

- do not redesign the whole app
- do not introduce a heavy new robotics framework
- do not break code generation
- do not hardcode behavior only for one exact video
- do not hide limitations with marketing language
- do not stop at “future work”

## Reliability Bias

When choosing between:

- a broader but fragile solution
- a narrower but reliable constrained solution

choose the reliable constrained solution for the demo.

The product must work.

## Deliverables

You must produce:

1. real code changes
2. updated tests
3. passing typecheck
4. passing focused tests
5. a verified browser run
6. a concise final report with evidence

## Acceptance Criteria

The work is done only if all of the following are true:

- orientation handling is materially better than “vertical only”
- collision review now performs at least simple deterministic mitigation
- object-shape diversity is visibly better
- the viewport is more honest about planned vs inferred motion
- exported simulation is more informative
- the teach flow was actually run in a browser
- the demo path works end to end

## Final Response Requirements

Your final response must include:

- which limitations were truly fixed
- which were reduced through constrained production mitigations
- which files changed
- exact test/typecheck results
- exact browser verification results
- any remaining risk stated plainly

Do not answer with only architecture notes or “next steps.” Ship the fixes and verify them.
