# Aurevix V3 Overview

## What V3 Is

For product leaders: Aurevix v3 is the no-login product console for teaching industrial robots from human demonstrations. It persists a local workspace in the browser, shows a live production fleet, and turns a demonstration into robot policy, code, simulation, and ROI context. It is positioned as usable software, not marketing collateral.

For engineers: v3 keeps the Next.js/Rust/FastAPI architecture while moving the primary runtime data path into IndexedDB. The frontend uses repository functions plus React Query over local stores, with a stable anonymous session id. The 3D surface is now URDF-driven with joint limits, trajectory playback, end-effector readout, and workcell collision warnings.

## What Changed From V2

- Removed visible login, registration, fake account, and demo-mode surfaces.
- Replaced localStorage skill persistence with IndexedDB stores for session, facilities, robots, skills, executions, demonstrations, policies, and ROI analyses.
- Added first-visit seeding as normal workspace initialization.
- Added a URDF-based `RobotViewport` and lightweight robot URDF assets.
- Added execution history, workcell setup, export, and skill detail pages.
- Expanded localization from four locales to six.

## 90-Second Demo Script

1. Open `/` and click Open Console.
2. Show Overview: three robots, live cycles, drift alert, recent executions.
3. Open Teach a robot and start the workflow.
4. Point out the URDF viewport, trajectory, joint panel, pose readout, and collision indicator.
5. Deploy the learned skill and open Skills to show persistence.
6. Open ROI and switch locale to DE, ES, ZH, or JA to show regional formatting.

## Vertical Customization

Robot models live in `apps/web/public/robots/`. Add a URDF folder, register it in `RobotViewport`, and map fleet robot models to that type. Demonstration videos live under `apps/web/public/demos/`; replace or add videos and adjust the teach page policy copy for the target industry.

## Regional Considerations

- US: emphasize fast payback and labor leverage.
- UK: emphasize reduced dependency on contract robot programmers.
- Germany/EU: emphasize standardization, documentation, and regulatory readiness.
- China: emphasize throughput and protocol compatibility.
- Spain/Latin America: emphasize programming speed and lower deployment cost.
- Japan: emphasize precision, standard work, and low-friction production rollout.

## Technical Architecture

IndexedDB is opened by `apps/web/src/lib/db.ts`. `useSessionStore.initialize()` creates or loads the anonymous session, then seeds the workspace if no facility exists. Repository files under `apps/web/src/lib/repositories/` are the only direct database access layer for app data.

`RobotViewport` loads URDF files with `urdf-loader`, extracts revolute joints and limits, and applies target joint values through the parsed joint hierarchy. `ik-solver.ts` provides a constrained CCD-style approximation that returns joint values and reachability metadata for target poses.

## Known Limitations

- Current URDF visual assets use primitive geometry, not manufacturer mesh packages.
- Collision detection covers workcell primitives and trajectory target points, not full robot self-collision.
- Lighthouse targets and Safari/Firefox manual verification remain to be completed.

## Cloud Integration Path

The Rust API remains in `apps/api`. To move from local-first to cloud-backed mode, replace repository calls in `apps/web/src/lib/repositories/` with `api.ts` calls or add sync functions that mirror IndexedDB records to API endpoints. Authentication can be reintroduced in the Rust API without changing the current no-login UI contract.
