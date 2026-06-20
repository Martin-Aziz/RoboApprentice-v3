# Automation Passport

Automation Passport transfers robot process intent between sites and robot brands without copying source-site operational metadata.

## Data model decisions

`TaskIntent` is the portable source of truth. It contains robot-agnostic waypoints and intent-step semantics: action, description, target, speed, duration, vision requirement, and gripper state. It does not contain:

- Robot model or serial number
- Site or facility identity
- Source workcell origin, camera position, or fixture placement
- Controller code

`PassportExport` adds only the minimum transfer context: source robot model for the import diff, optional fixture interface design, tooling recommendations, quality targets, sharing controls, and provenance identifiers.

The target workcell origin is supplied during import. Import deep-clones the intent, translates the cloned waypoints into a new target policy, validates every result, and generates a new controller program. The stored passport intent is never edited.

## Re-planning and controller targets

- Universal Robots models generate URScript.
- ABB GoFa generates RAPID.
- FANUC CRX generates Karel.
- Other future models fall back to the ROS 2 Python seam.

The import reuses `FeasibilityEngine` and performs an additional waypoint-by-waypoint reach/workcell check. If any waypoint fails, the API returns HTTP 409 with exact waypoint indices and reasons. No task or controller program is created, and deployment remains blocked.

## Provenance chain

Imported tasks store two immutable fields:

- `originPassportId`: the passport used for import
- `parentTaskId`: the source task recorded by that passport

Application updates copy these fields forward unchanged. `createImportedTask` is the only local-MVP write path that initially sets them. The SQL migration adds equivalent provenance columns for the hosted database architecture.

Example:

`Task A / Site 1 -> Passport P -> Task B / Site 2`

Task B stores `originPassportId=P` and `parentTaskId=A`.

## Privacy stripping

Export reconstructs intent from task steps or uses an existing robot-agnostic intent. It does not serialize the source `Task`, workcell configuration, controller program, facility ID, organisation-private task metadata, site name, camera position, or robot serial numbers.

Fixture exports are reduced to interface geometry, tolerance, and reviewer notes. Shareable-link tokens are stored separately from task intent and are required for cross-organisation import.

## Sharing scopes

- `PRIVATE`: source organisation only.
- `ORGANISATION`: one recipient organisation or an administratively linked organisation.
- `SHARED_LINK`: import requires the generated token.

The “Shared with us” API returns passport summaries only. It never exposes the source organisation’s task library.

Admins link organisations using:

`POST /api/v1/organisations/link`

## APIs

- `POST /api/v1/tasks/{task_id}/passport/export`
- `POST /api/v1/passport/{passport_id}/import`
- `GET /api/v1/passports/shared?organisation_id=...`
- `POST /api/v1/organisations/link`

Successful imports return a new task ID and a controller target. Blocked imports return the source/target robot diff, adjusted-waypoint count, and unreachable-waypoint list.
