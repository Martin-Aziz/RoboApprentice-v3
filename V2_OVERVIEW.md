# Aurevix V2 Overview

## What Changed And Why

V2 optimizes for speed of value perception. The demo no longer starts with authentication or empty product surfaces. It opens into a live-looking Walldorf plant with seeded robots, skills, executions, drift alerts, and realistic KPIs.

The teaching workflow was reorganized from a seven-step wizard into one demo-first screen: preloaded video, streaming interpretation, 3D robot replay, and a result panel with deploy, code export, and ROI actions.

Navigation labels were rewritten for plant managers and operations leaders. Internal module codes were removed. A command palette, locale selector, reset control, and light/dark settings were added.

The ROI calculator is now first-class because it is the strongest sales artifact. It produces regional savings, payback, three-year savings, PDF export, and an encoded share link that can be sent as a leave-behind.

## Demo Script

1. Open `/`.
2. Click "See it work in 30 seconds" or "Open Console".
3. On `/app`, point out 3 robots, 5 skills, live executions, cycles today, and the drift alert.
4. Open "Teach a robot".
5. Click "Auto-play demo".
6. Watch the seeded precision-gripper video, interpretation stream, and 3D replay.
7. When the result appears, click "Export code" and show URScript.
8. Click "Calculate ROI" and show annual savings in the selected locale.
9. Open `/app/roi`, adjust assumptions, download PDF, and create a share link.
10. Open `/app/robots`, show live fleet cards, then click into Assembly Cell 1.
11. Switch to German or Chinese to demonstrate regional readiness.
12. Reset demo data if needed.

## Customization For Verticals

To tailor the demo to a prospect:

- Replace `apps/web/public/demos/precision-gripper.mp4`.
- Update `DEMO_VIDEO_URL`, `FALLBACK_STEPS`, and `FALLBACK_POLICY` in `apps/web/src/lib/demo-seed.ts`.
- Rename seeded skills and robots to match the prospect's process: welding, inspection, packaging, kitting, or palletizing.
- Adjust ROI defaults in `apps/web/src/lib/roi.ts` for the vertical.

## Regional Considerations

- EU/Germany: lead with compliance, commissioning, and knowledge retention. The current German copy includes one English phrase, "compliance built in", intentionally left as a reviewer-friendly product phrase.
- USA: lead with programming-time reduction, throughput, and ROI.
- UK: lead with setup time and reduced dependency on contract programmers.
- China: lead with speed, information density, deployment, and protocol compatibility.

## What Is Still Missing

- No real backend persistence in the demo path.
- No real robot dispatch.
- No real email sending from ROI lead capture.
- Demo data persists only in the current browser localStorage.
- `next-intl` is installed and message files exist, but the v2 shell uses a lightweight local provider for speed; full route-level `next-intl` integration remains future work.

## Migration Path Back To V1 Architecture

The Rust API and Python ML service were preserved. To wire v2 UI back to the production architecture:

1. Replace `useDemoData()` reads with React Query calls to Rust API endpoints.
2. Store new deployed skills via `apps/api` rather than localStorage.
3. Replace simulated executions with real execution events from Redis/websocket/SSE.
4. Send ROI lead capture to a CRM or backend endpoint.
5. Keep the single-screen teach UI but route interpretation through the existing Next.js task APIs and local Ollama service.

## Technical Debt Accepted For V2

- The localization layer is intentionally lightweight to protect the demo timeline.
- The code export modal uses compact client-side generators for the demo, while server route handlers still expose the fuller codegen pipeline.
- Live fleet updates are simulated in-browser.

