# Fixture and Jig Designer

The Fixture and Jig Designer turns basic part geometry and pick requirements into a tolerance-controlled fabrication brief. It generates STL geometry only for simple recessed nests and V-blocks.

Every UI, API response, STL download, and PDF displays or carries this notice:

> This fixture design is a starting point. Have a qualified person verify dimensions before production use.

## Geometry assumptions

### NEST

- Intended for rectangular parts picked from the top.
- The printable model consists of a base floor and four locating walls.
- Pocket clearance is the larger of 0.25 mm or the required repeatability value.
- Pocket depth is limited so at least 1 mm of the part remains exposed.
- M6 mounting-hole dimensions are included in the specification, but holes are not cut into the simple STL. Drill after verifying the target tooling-plate pattern.

### V-BLOCK

- Used for cylindrical parts regardless of pick face.
- The STL uses a 90-degree cradle formed by two closed triangular prisms on a base.
- Diameter is conservatively inferred from the smaller of bounding-box width and height.
- The written specification includes an end-stop and mounting details; those are commissioned or added after checking the actual part.

### RAIL and CUSTOM

Rectangular side-pick parts produce a RAIL fabrication brief. Irregular, bottom-pick, or unknown geometry produces CUSTOM. Neither receives generated geometry. The STL endpoint remains disabled and the design requires qualified human review.

## Material selection

The rule order is:

1. Repeatability below 0.5 mm or cycle force above 50 N: `ALUMINIUM`
2. Environment above 60 C: `ABS_3DPRINT`
3. Otherwise: `PLA_3DPRINT`

Steel remains available in the data model for future fixture types and explicitly selected heavy-duty designs. The initial decision tree does not automatically select steel without additional load, wear, and environment evidence.

## Tolerances

Every generated dimension is a `{ nominal_mm, tolerance_mm }` pair. The designer never emits a bare nominal. The general tolerance is at least 0.1 mm and otherwise follows the requested repeatability.

This is deliberately conservative: robot repeatability is not the same as fixture manufacturing tolerance. A qualified person must establish the final tolerance stack across the part, fixture, gripper, tooling plate, sensing system, and robot calibration.

## STL generation and validation

`apps/web/scripts/generate-fixture-stl.py` uses NumPy and explicit triangular meshes; no CAD kernel is required. Before writing a binary STL, it checks that every undirected triangle edge occurs exactly twice. If the manifold check fails, the API removes the geometry link and returns the written specification with low confidence and mandatory human review.

## Extending fixture types

1. Add the type to `FixtureType`.
2. Add an explicit decision-tree branch in `fixture-designer.ts`.
3. Define all specification dimensions with tolerances.
4. If geometry is safe and parametric, add a closed-mesh generator and manifold test.
5. Add unit coverage for selection, dimensions, material, and geometry fallback.
6. Update the PDF and UI labels without weakening the verification notice.

## API

`POST /api/v1/tasks/{task_id}/fixture-design`

Required input:

- `part_geometry.shape`
- `part_geometry.bounding_box.length_mm`
- `part_geometry.bounding_box.width_mm`
- `part_geometry.bounding_box.height_mm`

Optional inputs include pick face, repeatability, maximum cycle force, environment temperature, and a known gripper specification.

Downloads:

- `/api/v1/fixture-designs/{fixture_id}/specification`
- `/api/v1/fixture-designs/{fixture_id}/stl`

The structured output is stored under `.aurevix-data/fixture-designs` and linked to its task.
