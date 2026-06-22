import type {
  DeploymentGateStatus,
  Task,
  TaskApprovalDecision,
  TaskTrustRecord,
  TrustChecklistItem,
} from "@/lib/types";

export const APPROVAL_READY_SCORE = 100;

function systemCheck(
  id: string,
  label: string,
  description: string,
  passed: boolean,
  evidence: string,
  now: string,
): TrustChecklistItem {
  return {
    id,
    label,
    description,
    status: passed ? "passed" : "failed",
    source: "system",
    required: true,
    weight: 15,
    evidence,
    updated_at: now,
    updated_by: "Aurevix validation pipeline",
  };
}

function reviewerCheck(
  id: string,
  label: string,
  description: string,
  weight: number,
  now: string,
): TrustChecklistItem {
  return {
    id,
    label,
    description,
    status: "pending",
    source: "qualified-reviewer",
    required: true,
    weight,
    evidence: "Awaiting qualified-person review.",
    updated_at: now,
  };
}

export function buildTrustChecklist(task: Task, now = new Date().toISOString()): TrustChecklistItem[] {
  const hasMotion = task.status === "done" && task.steps.length > 0 && Boolean(task.policy);
  const hasRobot = Boolean(task.robotModel ?? task.targetRobotModels?.[0]);

  return [
    systemCheck(
      "motion-policy",
      "Motion policy validated",
      "Aurevix produced a processed motion policy with executable task steps.",
      hasMotion,
      hasMotion
        ? `${task.steps.length} processed motion steps are attached to the current task version.`
        : "A completed task and processed motion policy are required.",
      now,
    ),
    systemCheck(
      "deployment-target",
      "Deployment target recorded",
      "The task record identifies the robot model used for readiness review.",
      hasRobot,
      hasRobot
        ? `Target robot: ${task.robotModel ?? task.targetRobotModels?.[0]}.`
        : "Select and record the target robot model.",
      now,
    ),
    reviewerCheck(
      "simulation-review",
      "Simulation reviewed",
      "A qualified reviewer confirmed reachability, collisions, cycle assumptions, and recovery behaviour.",
      15,
      now,
    ),
    reviewerCheck(
      "risk-assessment",
      "Risk assessment completed",
      "The editable risk draft was completed against the installed workcell and residual risks were accepted.",
      20,
      now,
    ),
    reviewerCheck(
      "workcell-safeguards",
      "Workcell safeguards verified",
      "Protective stops, interlocks, exclusion zones, tooling, payload, and emergency-stop behaviour were tested.",
      20,
      now,
    ),
    reviewerCheck(
      "supervised-trial",
      "Supervised trial passed",
      "The current task version completed a controlled supervised run with the expected quality outcome.",
      15,
      now,
    ),
  ];
}

export function refreshSystemChecks(
  task: Task,
  checklist: TrustChecklistItem[],
  now = new Date().toISOString(),
): TrustChecklistItem[] {
  const fresh = buildTrustChecklist(task, now);
  const freshById = new Map(fresh.map((item) => [item.id, item]));
  return checklist.map((item) =>
    item.source === "system" ? freshById.get(item.id) ?? item : item,
  );
}

export function readinessScore(checklist: TrustChecklistItem[]): number {
  const total = checklist.reduce((sum, item) => sum + item.weight, 0);
  if (!total) return 0;
  const passed = checklist
    .filter((item) => item.status === "passed")
    .reduce((sum, item) => sum + item.weight, 0);
  return Math.round((passed / total) * 100);
}

export function evaluateDeploymentGate(
  checklist: TrustChecklistItem[],
  approval: TaskApprovalDecision,
): { score: number; status: DeploymentGateStatus; reason: string } {
  const score = readinessScore(checklist);
  const failed = checklist.find((item) => item.required && item.status === "failed");
  const pending = checklist.find((item) => item.required && item.status === "pending");

  if (failed) {
    return { score, status: "blocked", reason: `${failed.label} has not passed.` };
  }
  if (pending) {
    return { score, status: "review-required", reason: `${pending.label} still requires evidence.` };
  }
  if (approval.status !== "approved") {
    return {
      score,
      status: approval.status === "rejected" ? "blocked" : "review-required",
      reason: approval.status === "rejected"
        ? "The current task version was rejected by its reviewer."
        : "All checks passed; qualified-person approval is still required.",
    };
  }
  return {
    score,
    status: "approved",
    reason: "The current task version passed every required check and has qualified-person approval.",
  };
}

export function recalculateTrustRecord(record: TaskTrustRecord): TaskTrustRecord {
  const gate = evaluateDeploymentGate(record.checklist, record.approval);
  return {
    ...record,
    readiness_score: gate.score,
    gate_status: gate.status,
    gate_reason: gate.reason,
  };
}
