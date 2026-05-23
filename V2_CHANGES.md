# Aurevix V2 Changes

## Phase 0 - Preparation

- Forked the original project into the sibling `RoboApprentice-v2` directory.
- Reinitialized Git in the v2 directory so it has a fresh baseline commit only.
- Updated package identity to v2.

## Phase 1 - Auth removed

- Replaced user-facing login/register screens with demo-mode console redirects.
- Made the frontend auth store initialize with a synthetic demo user and Walldorf facility.
- Removed API 401 refresh/redirect behavior from the frontend API helper.
- Changed sidebar logout into reset-demo behavior.

## Phase 2 - Demo seeding

- Added seeded facilities, robots, skills, execution history, fallback policy steps, and demo video URL.
- Copied `Precision_Gripper.mp4` to `apps/web/public/demos/precision-gripper.mp4`.
- Replaced API/empty-state app pages with seeded data and live simulated execution updates.

## Phase 3 - New demo flow

- Rebuilt `/app/teach` as a single-screen demo with video, 3D replay, streaming interpretation, result actions, deploy modal, code export, PDF summary, and ROI drawer modal.
- Added a guaranteed fallback interpretation path when local Ollama is unavailable.

## Phase 4 - UI polish

- Replaced numeric developer sidebar labels with buyer-facing navigation.
- Added Cmd/Ctrl+K command palette for navigation, search, reset, locale switching, and ROI access.
- Added persistent light/dark theme toggle in settings.

## Phase 5 - Localization

- Installed `next-intl` and added locale message files.
- Added a lightweight locale provider with `en-US`, `en-GB`, `de-DE`, and `zh-CN` strings, region-aware hero copy, ROI labels, and formatting helpers.

## Phase 6 - ROI calculator

- Added first-class `/app/roi` calculator with region-aware defaults, live bar chart, PDF export, email capture confirmation, and encoded share links.
- Added `/roi/shared/[id]` read-only leave-behind route.

## Phase 7 - Fleet view

- Upgraded `/app/robots` with KPI cards, fleet grid, active alerts, sparklines, and simulated live execution highlights.
- Added `/app/robots/[id]` detail view with overview, skills, executions, and settings tabs.

## Phase 8 - Landing

- Rebuilt `/` around one CTA into the console/demo flow, regional hero copy, demo video, credibility region strip, and minimal footer.
