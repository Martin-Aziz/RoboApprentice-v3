# Claude Fable Upgrade Prompt: Video Understanding and Realistic Robot Simulation

Use this file as a copy-paste prompt for Claude Fable / Claude Code when improving Aurevix. It is intentionally focused so the model does not need to rediscover the entire repository.

## Copy-Paste Prompt

You are working in `/Users/martin/Documents/RoboApprentice-v3`.

This project is Aurevix, an AI-powered robot teaching platform. Operators upload or run a video demonstration of a manual factory/warehouse task. The system must interpret the video into a precise multi-step robot policy, generate robot code, and show a realistic 3D simulation of the learned workflow.

Your mission is to take the video-understanding algorithm and the 3D robot simulation to the next level. Prioritize real factory videos with multiple objects, containers, fixtures, inspection steps, tool changes, and repeated pick/place operations. The output must be production-quality TypeScript/Next.js code with tests and browser verification.

### Product Goal

Make Aurevix feel like it can watch a real workcell demonstration and generate a believable robot simulation from it.

The current app already:
- Extracts sampled video frames and motion cues.
- Interprets steps through the SSE route.
- Builds a `TaskPolicy`.
- Plays the policy in a Three.js robot viewport.
- Infers simple destination props such as tote, inspection pad, final station, or fixture from step text.

Now improve it so the simulation becomes more accurate, more realistic, and more adaptive to whatever objects appear in the video.

### Primary Workstreams

1. Advanced video interpretation algorithm
   - Improve frame selection, temporal segmentation, motion reasoning, object persistence, and multi-stage task understanding.
   - Detect and preserve each meaningful warehouse/factory stage instead of collapsing repeated operations.
   - Track handled objects across pick, carry, place, inspection, and final station steps.
   - Distinguish source object, carried object, destination container, fixture, inspection surface, and final placement station.
   - Improve confidence/warnings when the video is ambiguous.
   - Keep provider-facing prompts strong, but keep user-visible UI language provider-neutral.

2. Scene understanding contract
   - Add a structured scene model if needed, for example `WorkcellScene`, `SceneObject`, `ObjectGeometryHint`, or similar.
   - The scene model should be derived from interpreted video evidence and attached to the policy or returned beside the policy.
   - It should include object category, approximate size, color/material hints, role, pickup/drop-off association, and confidence.
   - It must degrade gracefully: when uncertain, render a good proxy shape and expose a warning rather than hallucinating certainty.

3. Realistic Three.js simulation
   - Improve `RobotViewport` so it renders realistic workcell objects from the interpreted scene model.
   - Use procedural geometry proxies: totes, trays, bins, flat inspection pads, fixtures, rails, stations, cylinders, boxes, brackets, small machined parts, and generic unknown objects.
   - Use better materials, lighting, shadows, contact shadows, bevels/chamfers, labels/accents, and scale-appropriate placement.
   - Keep the robot motion policy as the source of truth, but make the surrounding scene visually match the interpreted task.
   - If the user uploads a different object, the simulator should render a plausible object of the right class, size, color, and role.
   - Do not attempt unsafe deployment claims. This remains a simulation and review tool.

4. Code quality and validation
   - Keep changes scoped to the files below unless a better structure clearly emerges.
   - Add or update tests for new algorithmic behavior.
   - Run typecheck and focused tests.
   - Run the local app in the browser and verify the teaching workflow with `warehouse-multistep.mp4`.

### Critical Files

Start here:
- `apps/web/src/lib/types.ts`  
  Defines `TaskStep`, `TaskPolicy`, and shared data shapes. Add scene-model types here if needed.

- `apps/web/src/app/api/tasks/[id]/interpret/route.ts`  
  Main SSE AI interpretation route. It builds prompts, sends video frames, parses streamed steps, returns policy/warnings/status.

- `apps/web/src/lib/video-frames.ts`  
  Server-side video frame extraction, adaptive keyframe selection, scene-cut/keyframe logic.

- `apps/web/src/lib/video-motion.ts`  
  Motion analysis from inter-frame differences. Improve segmentation, dominant motion, bounding boxes, object activity zones, and temporal summaries here.

- `apps/web/src/lib/policy-pipeline.ts`  
  Post-processing after AI output: approach/retract insertion, validation, normalization, retiming. Extend carefully if scene/objects should influence policy quality.

- `apps/web/src/components/robot-viewport.tsx`  
  Three.js simulation viewport. Improve procedural workcell/object generation, material realism, shape selection, object carry/drop behavior, and visual clarity here.

- `apps/web/src/app/app/teach/page.tsx`  
  Main teaching workflow UI. Keep user-facing language professional and provider-neutral.

Useful tests:
- `apps/web/src/__tests__/video-frames.test.ts`
- `apps/web/src/__tests__/policy-pipeline.test.ts`
- `apps/web/src/__tests__/teach-codegen.test.ts`

Current demo asset:
- `apps/web/public/demos/warehouse-multistep.mp4`
- Root copy: `warehouse-multistep.mp4`

### Current Architecture Summary

The teach workflow is:

1. `apps/web/src/app/app/teach/page.tsx`
   - Runs the demo workflow.
   - Creates a task through `POST /api/tasks`.
   - Streams interpretation through `POST /api/tasks/[id]/interpret`.
   - Stores streamed steps and final policy in state.
   - Sends the policy into `RobotViewport`.

2. `apps/web/src/app/api/tasks/[id]/interpret/route.ts`
   - Extracts video frames via `extractVideoFrames`.
   - Builds motion summaries from `video-motion`.
   - Sends frames/text/motion evidence to the model.
   - Parses the returned JSON steps.
   - Finalizes a `TaskPolicy`.

3. `apps/web/src/components/robot-viewport.tsx`
   - Converts policy waypoints into Three.js robot motion.
   - Infers carry pairs from gripper closed/open transitions.
   - Renders carried workpieces and destination props.
   - Currently supports semantic destination proxies for fixture, tote/bin, inspection pad, and final station.

4. Code generation and exports:
   - `apps/web/src/lib/codegen.ts`
   - `apps/web/src/lib/teach-codegen.ts`
   - API route: `apps/web/src/app/api/tasks/[id]/codegen/route.ts`

### Desired Implementation Direction

Prefer a structured scene-understanding layer instead of only parsing natural-language step descriptions inside the renderer.

Suggested model:

```ts
export interface WorkcellScene {
  objects: SceneObject[];
  confidence: number;
  warnings: string[];
}

export interface SceneObject {
  id: string;
  role: "source" | "workpiece" | "destination" | "fixture" | "container" | "inspection_surface" | "tool" | "unknown";
  category: "box" | "bin" | "tote" | "tray" | "cylinder" | "bracket" | "machined_part" | "fixture" | "station" | "surface" | "unknown";
  label: string;
  colorHint?: string;
  materialHint?: "metal" | "plastic" | "rubber" | "wood" | "unknown";
  sizeHint?: { x: number; y: number; z: number };
  poseHint?: { x: number; y: number; z: number; yaw?: number };
  relatedStepIds: string[];
  confidence: number;
}
```

You may adjust this shape if a better TypeScript model fits the repo, but keep it compact and useful.

Renderer direction:
- Add a small procedural factory such as `buildSceneObjectMesh(object, materials)`.
- Use rounded boxes/chamfers where possible.
- Add object-specific proxies:
  - tote/bin: open container with walls and inner floor
  - tray: shallow open container
  - inspection surface: dark pad with scan/measurement marks
  - fixture: rails, pins, cradle, inlay
  - station: base plate with pegs or nest
  - machined part/bracket: metal block with notch/hole/boss
  - unknown: neutral proxy with label/accent
- Use object colors/material hints from scene model when available.
- Keep the scene stable during playback; do not rebuild expensive meshes every frame.

Algorithm direction:
- Improve `video-motion.ts` with more useful motion segments and object activity zones.
- Improve `video-frames.ts` to sample before/at/after motion peaks and scene cuts.
- Improve the interpretation prompt so the model outputs object/scene hints as well as robot steps.
- Validate the scene model: clamp sizes, reject impossible coordinates, cap object count, and warn on low confidence.
- Preserve multi-step tasks. Repeated pick/place operations should become separate steps unless they are obviously the same repeated cycle.

### Acceptance Criteria

The implementation is not done until:

- `warehouse-multistep.mp4` still runs through the browser teach workflow.
- The visible UI says provider-neutral professional messages only.
- The interpreter returns a policy with multiple distinct stages for the warehouse demo.
- The simulator renders differentiated objects for at least:
  - source/handled workpiece
  - tote/bin/container
  - inspection surface
  - final station or fixture
- The robot visibly carries objects between inferred locations.
- The simulator still works when scene hints are missing.
- TypeScript passes: `COREPACK_ENABLE_DOWNLOAD_PROMPT=0 corepack pnpm --filter @forge-mind/web-v3 typecheck`
- Focused tests pass: `COREPACK_ENABLE_DOWNLOAD_PROMPT=0 corepack pnpm --filter @forge-mind/web-v3 exec vitest run src/__tests__/video-frames.test.ts src/__tests__/policy-pipeline.test.ts src/__tests__/teach-codegen.test.ts`
- Add new tests if new pure functions are introduced.

### Guardrails

- Do not hardcode this only for `warehouse-multistep.mp4`.
- Do not make claims like "99% accurate" unless there is an evaluation dataset proving it.
- Do not expose provider names such as Claude Code in visible UI status messages.
- Do not break existing code generation exports.
- Do not replace the app architecture or introduce a large new framework.
- Keep the app usable even if the AI provider is unavailable.
- Avoid raw hardcoded CSS hex colors in UI components; use existing design variables where applicable.
- Three.js material colors are acceptable for 3D scene geometry.

### Browser Validation

After implementation:

1. Start the app:

```bash
COREPACK_ENABLE_DOWNLOAD_PROMPT=0 corepack pnpm --filter @forge-mind/web-v3 dev
```

2. Open:

```text
http://localhost:3000/app/teach
```

3. Click `Run workflow`.

4. Verify:
   - The video source is `/demos/warehouse-multistep.mp4`.
   - Analysis status is provider-neutral.
   - The result reaches a multi-stage policy.
   - The simulator shows differentiated objects, not one generic old fixture.
   - The result text still says `Task policy learned from video`.

### Final Response Required

When finished, report:
- What algorithmic changes were made.
- What scene/simulation changes were made.
- Which files changed.
- Typecheck/test/browser results.
- Any remaining limitations or next steps for true video-to-3D reconstruction.

