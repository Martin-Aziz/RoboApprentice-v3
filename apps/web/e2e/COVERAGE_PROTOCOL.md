# E2E Coverage Protocol Harness

This directory now includes a coverage-oriented Playwright harness with a machine-readable registry aligned to the autonomous browser testing protocol.

## What was added

- Shared registry model and DOM/network/storage scanners:
  - `e2e/support/coverage-registry.ts`
- Shared Playwright fixtures with automatic instrumentation and registry output:
  - `e2e/support/coverage-fixtures.ts`
- Shared auth helpers for deterministic test setup:
  - `e2e/support/auth-helpers.ts`
- Discovery suite:
  - `e2e/discovery.spec.ts`
- Auth matrix suite:
  - `e2e/auth-matrix.spec.ts`
- Failure injection suite:
  - `e2e/failure-injection.spec.ts`

## Registry artifact location

Each test writes a registry artifact to Playwright's test output folder:

- `test-results/playwright/artifacts/**/coverage-registry.json`

The registry includes core protocol sections:
- `ROUTES`
- `COMPONENTS`
- `FORMS`
- `BUTTONS`
- `MODALS`
- `DROPDOWNS`
- `TABLES`
- `API_CALLS`
- `AUTH_STATES`
- `USER_ROLES`
- `UNTESTED_ITEMS`
- `TEST_RESULTS`
- `CRITICAL_BUGS`
- storage and console telemetry

## Run commands

From `apps/web`:

```bash
pnpm exec playwright test --list
pnpm exec playwright test e2e/discovery.spec.ts
pnpm exec playwright test e2e/auth-matrix.spec.ts
pnpm exec playwright test e2e/failure-injection.spec.ts
```

## Optional deterministic run id

```bash
COVERAGE_RUN_ID=local-coverage-$(date +%Y%m%d-%H%M%S) pnpm exec playwright test e2e/discovery.spec.ts
```

## Notes

- Current scope intentionally targets implemented auth states in this codebase: anonymous and authenticated admin.
- Failure tests use safe, non-destructive injection patterns.
- Discovery loops stop after 3 consecutive stable scans with no newly discovered items.
