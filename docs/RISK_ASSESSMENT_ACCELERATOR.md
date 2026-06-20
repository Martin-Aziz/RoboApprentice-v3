# Risk Assessment Accelerator

The Risk Assessment Accelerator creates an editable Word draft from deployed task motion and workcell data. It removes the blank page; it does not approve, certify, or replace a site-specific risk assessment.

## Required disclaimer

Every UI, API error/download response, and generated document uses this notice:

> This document was auto-drafted by Aurevix as a starting point. It must be reviewed, completed, and signed by a qualified person before the robot is operated. It does not constitute a certified risk assessment.

This wording deliberately avoids implying completeness. Motion data cannot establish real-world probability, detectability, safeguarding performance, foreseeable misuse, or whether residual risk is acceptable. Those decisions remain with a qualified reviewer.

## Screening thresholds

Named constants are in `apps/web/src/lib/risk-assessment-generator.ts`:

- `ISO_TS_15066_SPEED_REVIEW_THRESHOLD_MPS = 0.25`
- `ISO_TS_15066_FORCE_REVIEW_THRESHOLD_N = 140`
- `OPERATOR_PROXIMITY_REVIEW_THRESHOLD_MM = 500`

These values are product screening triggers specified for this feature. They are not represented as universal safe limits. ISO/TS 15066 contact limits depend on contact type and body region, while safe collaborative speed depends on the complete application and risk-reduction method. A qualified person must verify the current edition of ISO/TS 15066, EN ISO 12100, applicable national requirements, and the installed workcell.

## Updating thresholds

1. Verify the proposed value against the current controlled standards available to your safety/compliance team.
2. Change the named constant in `risk-assessment-generator.ts`; never add a numeric comparison directly inside a hazard rule.
3. Update the source comment and this document with the reason and date.
4. Update the boundary tests in `risk-assessment-generator.test.ts`.
5. Render a sample `.docx` and confirm the new evidence appears in the hazard and risk-estimation sections.

## DOCX generation

The API route stores the structured `RiskAssessmentDraft` in `.aurevix-data/risk-assessment-drafts.json`, then invokes:

`apps/web/scripts/build-risk-assessment-docx.py`

The builder uses `python-docx` and produces editable OOXML compatible with Microsoft Word and LibreOffice. Yellow content cells indicate mandatory human review. The disclaimer appears on page 1 and in every page footer.

Set `AUREVIX_PYTHON` to the Python executable containing `python-docx` in hosted environments.

## API

`POST /api/v1/tasks/{task_id}/risk-assessment/draft`

The route requires an existing task with motion steps and a robot model. Optional JSON fields include:

- `taskCategory`
- `robotModel`
- `siteName`
- `gripperType`
- `gripperForceNewtons`
- `operatorProximityMillimeters`
- `workcellDimensions`

The successful response is a downloadable `.docx`. Review-section names and the disclaimer are also returned as response headers so the UI can show the completion checklist.
