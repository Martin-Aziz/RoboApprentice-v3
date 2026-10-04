import type { PolicyReviewSummary, TaskPolicy, TaskStep, TaskStepGuard } from "./types";
import { HOME_WAYPOINT, ROBOT_KINEMATICS, distance3d, evaluateReachability } from "./robot-kinematics";

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function defaultPreconditions(step: TaskStep): string[] {
  const list = ["Target waypoint loaded"];
  if (step.action === "grip") list.push("Part visible at pickup location", "Gripper open before contact");
  if (step.action === "release") list.push("Placement surface confirmed", "Gripper holding part before release");
  if (step.action === "approach") list.push("Clear vertical clearance above contact point");
  if (step.requiresVision) list.push("Operator verifies vision-grounded target");
  return list;
}

function defaultFallback(step: TaskStep): string {
  if (step.action === "grip") return "Return to approach pose and re-attempt pickup";
  if (step.action === "release") return "Hold part, back out, and request placement review";
  if (step.requiresVision) return "Pause and require operator confirmation";
  return "Pause execution and request operator review";
}

export function deriveStepGuard(
  step: TaskStep,
  previous: TaskStep | undefined,
): TaskStepGuard {
  const reach = evaluateReachability(step.target);
  if (!reach.reachable) {
    return {
      type: "reachability",
      status: "blocked",
      reason: `Target is not reachable: ${reach.reason}.`,
    };
  }

  const floorMargin = step.target.z - ROBOT_KINEMATICS.minFloorClearance;
  if (floorMargin < 0.03 && step.action !== "home") {
    return {
      type: "clearance",
      status: "review",
      reason: `Only ${(floorMargin * 100).toFixed(1)}cm floor clearance at this step.`,
    };
  }

  const previousTarget = previous?.target ?? HOME_WAYPOINT;
  const segment = distance3d(previousTarget, step.target);
  if (segment > 0.9 && step.speed > 0.25) {
    return {
      type: "clearance",
      status: "review",
      reason: `Long ${(segment).toFixed(2)}m transfer at ${step.speed.toFixed(2)}m/s needs manual clearance review.`,
    };
  }

  if (step.requiresVision) {
    return {
      type: "vision",
      status: "review",
      reason: "This step depends on visual grounding and should be confirmed before deployment.",
    };
  }

  if ((step.action === "grip" || step.action === "release") && step.speed > ROBOT_KINEMATICS.speed.contactMax) {
    return {
      type: "contact",
      status: "review",
      reason: "Contact action exceeds the preferred guarded speed envelope.",
    };
  }

  return {
    type: "operator_review",
    status: "ok",
    reason: "Step is within the current heuristic validation envelope.",
  };
}

export function enrichStepReview(step: TaskStep, previous: TaskStep | undefined): TaskStep {
  const guard = step.guard ?? deriveStepGuard(step, previous);
  const base =
    guard.status === "blocked" ? 0.24 :
    guard.status === "review" ? 0.62 :
    0.86;
  const confidence = clamp01(
    base
      - (step.requiresVision ? 0.08 : 0)
      - ((step.action === "grip" || step.action === "release") ? 0.04 : 0),
  );

  return {
    ...step,
    confidence,
    preconditions: step.preconditions?.length ? step.preconditions : defaultPreconditions(step),
    fallbackLabel: step.fallbackLabel ?? defaultFallback(step),
    guard,
    reviewRequired: step.reviewRequired ?? guard.status !== "ok",
  };
}

export function summarizePolicyReview(policy: TaskPolicy): PolicyReviewSummary {
  const steps = policy.steps;
  const readySteps = steps.filter((step) => (step.guard?.status ?? "ok") === "ok").length;
  const reviewSteps = steps.filter((step) => (step.guard?.status ?? "ok") === "review").length;
  const blockedSteps = steps.filter((step) => (step.guard?.status ?? "ok") === "blocked").length;
  const visionSteps = steps.filter((step) => step.requiresVision).length;
  const averageConfidence =
    steps.length > 0
      ? Number((steps.reduce((sum, step) => sum + (step.confidence ?? 0.75), 0) / steps.length).toFixed(2))
      : 0;

  const headline =
    blockedSteps > 0
      ? "Blocked steps need correction before export"
      : reviewSteps > 0
        ? "Operator review required before deployment"
        : "Policy is ready for supervised validation";

  const recommendedAction =
    blockedSteps > 0
      ? "Adjust the unreachable or unsafe waypoints before generating controller code."
      : reviewSteps > 0
        ? "Review vision-grounded and low-clearance steps in the viewport, then record qualified evidence."
        : "Run the supervised validation flow and attach reviewer evidence before operation.";

  return {
    readySteps,
    reviewSteps,
    blockedSteps,
    visionSteps,
    averageConfidence,
    headline,
    recommendedAction,
  };
}
