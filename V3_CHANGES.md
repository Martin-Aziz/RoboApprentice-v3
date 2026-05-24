# Aurevix V3 Changes

## Fix pass - 2026-05-24

### 3D viewport calibration
- Revalidated the robot viewport in browser.
- Kept the demo cell as a table-mounted UR5e and added a visible mount plate.
- Added table legs so the work surface reads as a real 0.75m-high table instead of a floating slab.
- Kept policy target Z values relative to the table/base surface.
- Confirmed the full 8-step workflow completes with zero collision warnings.
- Replaced the visible arm motion with a single target-driven rig so the gripper fingers, not a waypoint marker or mid-link joint, reach the taught box contact point.
- Reduced waypoint/active marker prominence so overlays no longer read as a second robot arm.

### Export code quality
- Replaced the simple teach-page export snippets with production-structured URScript.
- Added policy provenance, safety constants, TCP setup, gripper helpers, guarded motion wrappers, per-step comments, and verification checkpoints.
- Replaced the simple ROS 2 class snippet with a typed node scaffold using dataclass step definitions and adapter hooks for MoveIt 2/gripper integration.
- Captured refreshed export screenshots for URScript and ROS 2.

## Fix pass - 2026-05-23

### Problem 1 fixed: Robot arm geometry now renders
- Built procedural UR5e arm from Three.js primitives
- 6 links with correct DH dimensions
- PBR materials: grey body, dark joint covers, blue accents
- Two-finger gripper with tip detail
- End-effector coordinate frame axes
- Trajectory curve with velocity coloring (green->amber->red)
- Waypoint sphere markers
- Ghost trail of recent positions
- Three-point lighting with soft shadows

### Problem 2 fixed: Collision detection calibrated
- Home position no longer triggers false collision
- Depth reporting is physically accurate
- Minimum reportable depth is 5mm (noise floor)
- Robot mounting configuration documented

### Problem 3 fixed: ROI calculator math corrected
- 3-year savings formula corrected (was negative, now positive)
- Payback period formula corrected
- Decimal separator respects locale

### Problem 4 fixed: Locale decimal consistency
- en-US inputs use period decimal separator
- de-DE / es-ES inputs use comma decimal separator
- Defaults are locale-aware

## Phase 0 - Fork Verification

- Created `RoboApprentice-v3` as a sibling copy of `RoboApprentice-v2`.
- Excluded generated and heavy artifacts from the copy: `node_modules`, `.next`, `target`, caches, test results, TypeScript build info, `pnpm-lock.yaml`, and `.git`.
- Initialized fresh git history in v3 with a single baseline commit.
- Verified the v3 working directory, app folders, baseline commit count, and clean v2 status.
- Updated root and web package names from `-v2` to `-v3`.

## Phase 1 - Demo Framing Removed

- Removed `/login` and `/register` routes from the web app.
- Replaced fake account UI with an anonymous browser session identity.
- Removed visible demo-mode language, fake email/name strings, and demo reset labels from the UI.
- Updated the landing page CTA language to present the product as a no-login console.

## Phase 2 - IndexedDB Persistence

- Added IndexedDB schema in `apps/web/src/lib/db.ts` using `idb`.
- Added first-visit workspace seeding for one facility, three robots, five skills, execution history, and policy records.
- Replaced localStorage-backed workspace data with repository functions and React Query queries.
- Added an execution simulator that persists execution records and robot/skill counters to IndexedDB while the app is open.

## Phase 3 - URDF-Based 3D Simulation

- Added `urdf-loader` and `three-mesh-bvh`.
- Added lightweight URDF robot definitions for UR5e, KUKA KR 6 R900, and Techman TM12 under `apps/web/public/robots/`.
- Added `RobotViewport` with URDF loading, joint limits, trajectory markers, workcell primitives, end-effector pose readout, joint sliders, camera presets, and collision warning logic.
- Added a deterministic CCD-style IK approximation in `apps/web/src/lib/ik-solver.ts`.
- Wired the viewport into teach, robot detail, skill detail, and workcell pages.

## Phase 4 - Page Completeness

- Reworked sidebar navigation into workspace/content/analysis/configuration groups.
- Added execution history, workcell setup, code export, and skill detail routes.
- Expanded the command palette actions and locale switching.

## Phase 7 - Localization Expanded

- Added Spanish (`es-ES`) and Japanese (`ja-JP`) to the UI locale list.
- Added a translation audit script at `apps/web/scripts/audit-translations.js`.

## Phase 6 - Browser Testing

- Added `apps/web/e2e/v3-integration.spec.ts`.
- Installed Playwright Chromium locally and verified the v3 flow in Chromium.
- Captured viewport screenshots under `apps/web/test-results/viewport/`.
- Verified all main app routes return HTTP 200 with the production server.
- Verified web typecheck, production build, translation audit, Rust `cargo check`, and Python compile.

## Known Limitations

- URDF models are production-structured but use primitive visual geometry rather than downloaded manufacturer mesh packages. This keeps first paint fast and preserves real joint hierarchy/limits, but final industrial visual fidelity requires swapping in verified mesh assets.
- Collision detection currently checks robot target trajectory against floor/table workcell primitives. Full self-collision and mesh-depth collision needs a more complete BVH collision pass.
- Lighthouse and Safari/Firefox manual verification were not completed in this implementation pass.
