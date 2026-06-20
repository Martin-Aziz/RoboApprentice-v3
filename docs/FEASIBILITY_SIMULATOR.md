# Pre-Purchase Feasibility Simulator

The simulator estimates whether a video-derived task fits a virtual cobot before hardware is connected or purchased. It does not call a robot controller and must not be treated as a safety validation or final cell design.

## Kinematic assumptions

- Waypoints use metres in the robot-base coordinate frame.
- Reach is conservatively approximated as a spherical envelope from the robot base to the tool centre point. Joint limits, wrist orientation, singularities, tool length, cable routing, fixtures, and collision geometry are not yet modelled.
- Payload is compared with the manufacturer's headline payload rating. The submitted payload should include the handled part; operators should also allow for gripper/tool weight.
- A task becomes `MARGINAL` at 90% of rated reach or payload. It becomes `NOT_FEASIBLE` above either rating.
- Optional workcell dimensions are treated as a base-centred box: `x` and `y` are full width/depth, and `z` is height above the base plane.
- Recommendations are ranked only by the smallest excess reach and payload capacity that fits the task. Brand preference, price, commercial relationships, and availability are not inputs.

## Cycle-time assumptions

- Segment time is Euclidean waypoint distance divided by the lowest of the inferred speed, robot speed limit, and conservative collaborative planning cap.
- Free collaborative motion is capped at 0.25 m/s and short contact moves at 0.10 m/s.
- ISO/TS 15066 does not define one universal safe robot speed. A real deployment requires a task-specific risk assessment using forces, pressures, separation distances, tooling, and body-region exposure.
- Grip, release, and wait durations inferred by the video pipeline are added to motion time.
- A 20% conservative margin is added to every estimate.
- Throughput is `floor(3600 / cycle_seconds × 0.85)`.

## Updating robot specifications

Edit `apps/web/src/lib/feasibility-engine.ts` and update `ROBOT_SPECIFICATIONS`. Each entry contains:

- `reachMeters`
- `payloadKg`
- `maxTcpSpeedMetersPerSecond`

Use the current manufacturer datasheet for the exact model and revision. Add or update engine tests whenever a rating changes. The current catalog uses headline reach/payload values for UR5e, UR10e, UR16e, ABB GoFa CRB 15000, and FANUC CRX-10iA.

## API

`POST /api/v1/simulate/feasibility` accepts multipart form data:

- `video`: MP4, MOV, M4V, or WebM, maximum 100 MB
- `robot_model`: one supported model name
- `payload_kg`: positive number
- `workcell_dimensions`: optional JSON object such as `{"x":1.5,"y":1.2,"z":1.8}`

The upload is stored in a temporary directory only for interpretation and deleted after the request. The endpoint reuses the existing video-to-task-intent pipeline and returns `FeasibilityResult` JSON.
