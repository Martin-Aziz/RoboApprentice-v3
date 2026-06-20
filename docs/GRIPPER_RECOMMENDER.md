# Gripper and Peripheral Recommender

The recommender ranks end-effectors only by technical fit. Affiliate tags, referral relationships, pricing, inventory, and manufacturer preference are not scoring inputs.

Every recommendation surface displays:

> Aurevix may earn a referral fee from some of these links. Recommendations are based solely on technical fit for your task.

## Catalogue

The seed catalogue is:

`apps/web/src/data/gripper-catalogue.json`

Each entry must contain the complete `GripperSpec` shape, including:

- Robot compatibility
- Rated payload
- Material, surface, and pick suitability
- Minimum cycle or actuation time
- Maximum gripping force
- Manufacturer product and enquiry URLs
- Manufacturer image/product-imagery URL
- `source`
- `estimated_fields`

Use the exact manufacturer model variant. Do not copy distributor values when a manufacturer datasheet is available.

Some products are configurable systems rather than a single fixed tool. For those entries, put each derived screening value in `estimated_fields`. The UI explicitly labels those fields as estimated. A value must never be presented as confirmed when the linked source does not state it.

## Adding a gripper

1. Obtain the current manufacturer datasheet or official product page.
2. Add the JSON entry with a stable lowercase ID.
3. Record the exact source URL.
4. Add every inferred or application-dependent field to `estimated_fields`.
5. Add robot models only where an integration package or technically valid adapter exists.
6. Run the recommender unit tests and TypeScript check.
7. Test a task that should match and one that must be rejected.

## Affiliate tags

Set `affiliate_tag` to the approved referral identifier, or leave it `null`.

The UI appends a non-null tag as the `ref` query parameter. Affiliate status is never passed to the recommender and must not be added to `MANUFACTURER_RELIABILITY_SCORES`.

## Filtering

A candidate must pass all known hard requirements:

1. The task robot appears in `compatible_robot_models`.
2. Rated payload is at least `task payload × 1.3`.
3. Known material appears in `suitable_materials`.
4. Known surface appears in `suitable_surfaces`.
5. Known pick type appears in `suitable_pick_types`.
6. For mechanical grippers, available grip force meets the requested maximum force.

Unknown material, surface, or pick direction does not exclude candidates; it lowers recommendation confidence instead.

If no catalogue product qualifies, the API returns an empty list and explains that Aurevix will not force an unsuitable recommendation.

## Scoring

Qualifying candidates receive a 0–1 score:

- Payload margin: 30%
- Cycle-time fit: 25%
- Known material/surface/pick confidence: 25%
- Grip-force fit: 10%
- Manufacturer reliability: 10%

The initial manufacturer reliability scores are deliberately equal at `0.9`. They are admin-editable constants in `apps/web/src/lib/gripper-recommender.ts` and may only be changed using objective field-reliability evidence.

## API

`GET /api/v1/tasks/{task_id}/gripper-recommendations`

Optional refinement query parameters:

- `payload_kg`
- `material`
- `surface`
- `pick_type`
- `cycle_time_seconds`
- `robot_model`

The response includes `recommendations`, a plain-language `explanation`, and the mandatory affiliate `disclosure`.
