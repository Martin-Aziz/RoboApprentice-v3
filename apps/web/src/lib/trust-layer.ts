import type {
  DeploymentGateStatus,
  Task,
  TaskApprovalDecision,
  TaskTrustRecord,
  TrustChecklistItem,
} from "@/lib/types";
import { summarizePolicyReview } from "@/lib/policy-review";

export const APPROVAL_READY_SCORE = 100;

export type ReadinessState = "blocked" | "review-required" | "supervised-ready";

export function readinessState(score: number): ReadinessState {
  if (score < 80) return "blocked";
  if (score < 90) return "review-required";
  return "supervised-ready";
}

export function isExportable(score: number): boolean {
  return readinessState(score) !== "blocked";
}

function systemCheck(
  id: string,
  label: string,
  description: string,
  passed: boolean,
  evidence: string,
  now: string,
  weight = 15,
): TrustChecklistItem {
  return {
    id,
    label,
    description,
    status: passed ? "passed" : "failed",
    source: "system",
    required: true,
    weight,
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
  const review = task.policy ? summarizePolicyReview(task.policy) : null;
  const policyReady = review !== null && review.blockedSteps === 0;

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
      15,
    ),
    systemCheck(
      "policy-guardrails",
      "Policy guardrails clear",
      "Reachability, review flags, and operator guardrails were evaluated for every generated step.",
      policyReady,
      review === null
        ? "Generate a processed policy so the system can evaluate step guardrails."
        : review.blockedSteps === 0
          ? review.reviewSteps > 0
            ? `${review.reviewSteps} step(s) still require operator review before approval.`
            : "No blocked steps were found in the current policy review summary."
          : `${review.blockedSteps} step(s) are blocked and must be corrected before deployment.`,
      now,
      15,
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
      10,
    ),
    reviewerCheck(
      "simulation-review",
      "Simulation reviewed",
      "A qualified reviewer confirmed the visual replay, step guardrails, cycle assumptions, and recovery behaviour.",
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
      15,
      now,
    ),
    reviewerCheck(
      "supervised-trial",
      "Supervised trial passed",
      "The current task version completed a controlled supervised run with the expected quality outcome.",
      10,
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
