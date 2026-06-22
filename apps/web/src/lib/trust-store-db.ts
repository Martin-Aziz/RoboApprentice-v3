import { createHash, randomUUID } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import { dirname, join } from "path";
import type {
  Task,
  TaskApprovalDecision,
  TaskTrustRecord,
  TrustAuditEvent,
  TrustChecklistItem,
} from "@/lib/types";
import {
  buildTrustChecklist,
  recalculateTrustRecord,
  refreshSystemChecks,
} from "@/lib/trust-layer";

const TRUST_FILE = join(process.cwd(), ".aurevix-data", "task-trust-records.json");

declare global {
  // eslint-disable-next-line no-var
  var __aurevixTrustRecords: Record<string, TaskTrustRecord> | undefined;
  // eslint-disable-next-line no-var
  var __aurevixTrustRecordsLoaded: Promise<Record<string, TaskTrustRecord>> | undefined;
}

async function loadRecords(): Promise<Record<string, TaskTrustRecord>> {
  try {
    return JSON.parse(await readFile(TRUST_FILE, "utf-8")) as Record<string, TaskTrustRecord>;
  } catch {
    return {};
  }
}

async function records(): Promise<Record<string, TaskTrustRecord>> {
  if (globalThis.__aurevixTrustRecords) return globalThis.__aurevixTrustRecords;
  if (!globalThis.__aurevixTrustRecordsLoaded) {
    globalThis.__aurevixTrustRecordsLoaded = loadRecords().then((loaded) => {
      globalThis.__aurevixTrustRecords = loaded;
      return loaded;
    });
  }
  return globalThis.__aurevixTrustRecordsLoaded;
}

let writeQueue: Promise<unknown> = Promise.resolve();

function persist(store: Record<string, TaskTrustRecord>): void {
  writeQueue = writeQueue.then(async () => {
    await mkdir(dirname(TRUST_FILE), { recursive: true });
    await writeFile(TRUST_FILE, JSON.stringify(store, null, 2), "utf-8");
  }).catch((error) => {
    console.error("[trust-store-db] failed to persist trust records", error);
  });
}

export function policyHash(task: Task): string {
  return createHash("sha256")
    .update(JSON.stringify(task.policy ?? task.steps))
    .digest("hex")
    .slice(0, 16);
}

function auditEvent(
  record: Pick<TaskTrustRecord, "current_task_version" | "policy_hash">,
  event_type: TrustAuditEvent["event_type"],
  actor: string,
  summary: string,
  metadata?: TrustAuditEvent["metadata"],
): TrustAuditEvent {
  return {
    event_id: randomUUID(),
    event_type,
    actor,
    summary,
    created_at: new Date().toISOString(),
    task_version: record.current_task_version,
    policy_hash: record.policy_hash,
    metadata,
  };
}

export async function getTrustRecord(task: Task, currentVersion: number): Promise<TaskTrustRecord> {
  const store = await records();
  const now = new Date().toISOString();
  let record = store[task.id];

  if (!record) {
    const checklist = buildTrustChecklist(task, now);
    record = recalculateTrustRecord({
      trust_record_id: randomUUID(),
      task_id: task.id,
      current_task_version: currentVersion,
      policy_hash: policyHash(task),
      readiness_score: 0,
      gate_status: "blocked",
      gate_reason: "Validation evidence is incomplete.",
      checklist,
      approval: { status: "pending" },
      audit_log: [],
      created_at: now,
      updated_at: now,
    });
    record.audit_log = [
      auditEvent(record, "record_created", "Aurevix", "Trust record created for this task version."),
    ];
  } else if (record.current_task_version !== currentVersion || record.policy_hash !== policyHash(task)) {
    const previousVersion = record.current_task_version;
    record = recalculateTrustRecord({
      ...record,
      current_task_version: currentVersion,
      policy_hash: policyHash(task),
      checklist: refreshSystemChecks(task, record.checklist, now).map((item) =>
        item.source === "qualified-reviewer"
          ? {
              ...item,
              status: "pending",
              evidence: "Re-review required because the task version changed.",
              updated_at: now,
              updated_by: undefined,
            }
          : item,
      ),
      approval: { status: "pending" },
      updated_at: now,
    });
    record.audit_log = [
      ...record.audit_log,
      auditEvent(
        record,
        "task_version_changed",
        "Aurevix",
        `Task changed from version ${previousVersion} to version ${currentVersion}; prior approval was invalidated.`,
        { previous_version: previousVersion },
      ),
    ];
  } else {
    record = recalculateTrustRecord({
      ...record,
      checklist: refreshSystemChecks(task, record.checklist, now),
    });
  }

  store[task.id] = record;
  persist(store);
  return record;
}

export async function updateTrustCheck(
  task: Task,
  currentVersion: number,
  input: {
    check_id: string;
    status: TrustChecklistItem["status"];
    evidence: string;
    actor: string;
  },
): Promise<TaskTrustRecord> {
  const store = await records();
  let record = await getTrustRecord(task, currentVersion);
  const target = record.checklist.find((item) => item.id === input.check_id);
  if (!target) throw new Error("Trust check not found.");
  if (target.source === "system") throw new Error("System checks cannot be manually changed.");
  if (!input.evidence.trim()) throw new Error("Evidence is required for reviewer checks.");

  const now = new Date().toISOString();
  record = recalculateTrustRecord({
    ...record,
    approval: record.approval.status === "approved" ? { status: "pending" } : record.approval,
    checklist: record.checklist.map((item) =>
      item.id === input.check_id
        ? {
            ...item,
            status: input.status,
            evidence: input.evidence.trim(),
            updated_at: now,
            updated_by: input.actor,
          }
        : item,
    ),
    updated_at: now,
  });
  record.audit_log = [
    ...record.audit_log,
    auditEvent(
      record,
      "check_updated",
      input.actor,
      `${target.label} marked ${input.status}.`,
      { check_id: input.check_id, status: input.status },
    ),
  ];
  store[task.id] = record;
  persist(store);
  return record;
}

export async function decideApproval(
  task: Task,
  currentVersion: number,
  input: {
    status: "approved" | "rejected";
    reviewer_name: string;
    reviewer_role: string;
    qualification: string;
    comments: string;
  },
): Promise<TaskTrustRecord> {
  const store = await records();
  let record = await getTrustRecord(task, currentVersion);
  if (!input.reviewer_name.trim() || !input.reviewer_role.trim() || !input.qualification.trim()) {
    throw new Error("Reviewer name, role, and qualification are required.");
  }
  if (input.status === "approved" && record.checklist.some((item) => item.required && item.status !== "passed")) {
    throw new Error("Every required check must pass before approval.");
  }
  if (input.status === "rejected" && !input.comments.trim()) {
    throw new Error("A rejection reason is required.");
  }

  const approval: TaskApprovalDecision = {
    ...input,
    reviewer_name: input.reviewer_name.trim(),
    reviewer_role: input.reviewer_role.trim(),
    qualification: input.qualification.trim(),
    comments: input.comments.trim(),
    decided_at: new Date().toISOString(),
    task_version: currentVersion,
    policy_hash: record.policy_hash,
  };
  record = recalculateTrustRecord({
    ...record,
    approval,
    updated_at: approval.decided_at!,
  });
  record.audit_log = [
    ...record.audit_log,
    auditEvent(
      record,
      input.status === "approved" ? "approval_granted" : "approval_rejected",
      input.reviewer_name,
      input.status === "approved"
        ? `Qualified-person approval granted for task version ${currentVersion}.`
        : `Task version ${currentVersion} rejected: ${input.comments.trim()}`,
    ),
  ];
  store[task.id] = record;
  persist(store);
  return record;
}

export async function markRiskDraftGenerated(
  task: Task,
  currentVersion: number,
): Promise<TaskTrustRecord> {
  const store = await records();
  let record = await getTrustRecord(task, currentVersion);
  record = {
    ...record,
    audit_log: [
      ...record.audit_log,
      auditEvent(
        record,
        "risk_draft_generated",
        "Aurevix risk-assessment generator",
        "Editable risk-assessment draft generated; qualified review remains required.",
      ),
    ],
    updated_at: new Date().toISOString(),
  };
  store[task.id] = record;
  persist(store);
  return record;
}
