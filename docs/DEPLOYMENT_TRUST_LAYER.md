# Deployment Trust Layer

The Aurevix deployment trust layer turns a generated task into a version-bound review record. It documents evidence and human decisions; it does not certify robot safety or replace the qualified person responsible for the installed workcell.

## Product workflow

1. Aurevix creates or imports a task and processed motion policy.
2. The trust record binds itself to the current task version and a SHA-256 policy fingerprint.
3. System checks verify that processed motion and a deployment target exist.
4. A qualified reviewer records evidence for:
   - simulation review;
   - completed workcell risk assessment;
   - safeguards and emergency behaviour;
   - supervised trial outcome.
5. Approval becomes available only after every required check passes.
6. Approval or rejection is appended to the task audit history.
7. Any new task version or changed policy fingerprint invalidates the prior approval and resets human checks for review.
8. The deployment evidence package exports the task, checks, decision, audit history, and complete version lineage.

## Persistence

Local demo records are stored server-side in:

```text
apps/web/.aurevix-data/task-trust-records.json
```

There is no UI or API operation that removes or rewrites audit events. For production, replace the JSON persistence seam in `src/lib/trust-store-db.ts` with an append-only database table and authenticated actor identities.

## API

### Read the trust record

```http
GET /api/tasks/{taskId}/trust
```

### Record reviewer evidence

```http
PATCH /api/tasks/{taskId}/trust
Content-Type: application/json

{
  "action": "update-check",
  "check_id": "simulation-review",
  "status": "passed",
  "evidence": "Collision-free simulation reviewed against workcell revision C.",
  "actor": "Reviewer name"
}
```

### Approve or reject the current version

```http
PATCH /api/tasks/{taskId}/trust
Content-Type: application/json

{
  "action": "decide",
  "status": "approved",
  "reviewer_name": "Reviewer name",
  "reviewer_role": "Plant safety engineer",
  "qualification": "Authorised machinery risk assessor",
  "comments": "Approved for supervised production within the documented limits."
}
```

### Export the evidence package

```http
GET /api/tasks/{taskId}/trust/evidence
```

The response is a downloadable JSON package with the task record, current policy fingerprint, checklist, approval, audit events, and version history.

## Gate semantics

- `blocked`: a required system check failed or the current version was rejected.
- `review-required`: required reviewer evidence or qualified approval is missing.
- `approved`: every required check passed and a qualified person approved the exact current task version.

The readiness percentage is not model confidence. It is the weighted completion of the explicit evidence checklist shown in the UI.
