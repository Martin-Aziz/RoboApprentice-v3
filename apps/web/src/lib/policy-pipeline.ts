import type { SceneObject, TaskPolicy, TaskStep, Waypoint, WorkcellScene } from "./types";
import { randomUUID } from "crypto";
import {
  HOME_WAYPOINT,
  ROBOT_KINEMATICS,
  distance3d,
  evaluateReachability,
  xyDistance,
} from "./robot-kinematics";
import { DEFAULT_PROXY_SIZE, findLowClearanceSegments } from "./clearance";

/**
 * AUREVIX policy pipeline — post-processing for extracted task policies.
 * Validates, enriches, and optimizes the policy before code generation.
 */

/** Categories whose contact point sits inside a cavity below a rim. */
const OPEN_TOP_CATEGORIES = new Set<SceneObject["category"]>(["tote", "bin", "tray"]);

/**
 * Shape-aware approach clearance for a contact step: when the contact happens
 * at/inside a known open-top container, the approach must clear the container
 * rim (object top + margin), not just the generic contact clearance above the
 * contact point. Falls back to the generic clearance when no scene evidence
 * applies.
 */
export function approachHeightForContact(
  contact: TaskStep,
  scene: WorkcellScene | undefined,
): number {
  const generic = ROBOT_KINEMATICS.contactClearance;
  if (!scene) return generic;
  for (const object of scene.objects) {
    if (!object.poseHint) continue;
    const size = object.sizeHint ?? DEFAULT_PROXY_SIZE;
    const related = object.relatedStepIds.includes(contact.id);
    const overFootprint =
      Math.hypot(contact.target.x - object.poseHint.x, contact.target.y - object.poseHint.y) <
      Math.max(size.x, size.y) / 2 + 0.02;
    if (!related && !overFootprint) continue;
    if (!OPEN_TOP_CATEGORIES.has(object.category)) continue;
    const rimZ = object.poseHint.z + size.z;
    const required = rimZ + 0.03 - contact.target.z;
    if (required > generic) return required;
  }
  return generic;
}

export function insertApproachRetract(steps: TaskStep[], scene?: WorkcellScene): TaskStep[] {
  const enriched: TaskStep[] = [];

  const isContactStep = (step: TaskStep) =>
    step.action === "grip" || step.action === "release";

  const hasSafeApproach = (
    previous: TaskStep | undefined,
    contact: TaskStep,
    approachHeight: number,
  ) =>
    Boolean(
      previous &&
        previous.action === "approach" &&
        xyDistance(previous.target, contact.target) <= 0.035 &&
        previous.target.z >= contact.target.z + approachHeight * 0.65,
    );

  const hasClearanceMove = (
    next: TaskStep | undefined,
    contact: TaskStep,
    approachHeight: number,
  ) =>
    Boolean(
      next &&
        next.target.z >= contact.target.z + approachHeight * 0.65 &&
        distance3d(next.target, contact.target) >= approachHeight * 0.5,
    );

  steps.forEach((step, idx) => {
    const previous = steps[idx - 1];
    const next = steps[idx + 1];
    const APPROACH_HEIGHT = isContactStep(step)
      ? approachHeightForContact(step, scene)
      : ROBOT_KINEMATICS.contactClearance;

    if (isContactStep(step) && !hasSafeApproach(previous, step, APPROACH_HEIGHT)) {
      const approachTarget: Waypoint = {
        x: step.target.x,
        y: step.target.y,
        z: Math.min(
          step.target.z + APPROACH_HEIGHT,
          ROBOT_KINEMATICS.workspace.zMax,
        ),
        rx: step.target.rx,
        ry: step.target.ry,
        rz: step.target.rz,
      };

      const approachStep: TaskStep = {
        id: randomUUID(),
        order: step.order + 0.5, // Will be renumbered
        description: `Approach for ${step.action}`,
        action: "approach",
        target: approachTarget,
        gripper: "unchanged",
        speed: Math.min(
          ROBOT_KINEMATICS.speed.approachMax,
          Math.max(ROBOT_KINEMATICS.speed.min, step.speed * 0.65),
        ),
        duration: 2,
        requiresVision: false,
      };

      enriched.push(approachStep);
    }

    enriched.push(step);

    if (isContactStep(step) && !hasClearanceMove(next, step, APPROACH_HEIGHT)) {
      const liftTarget: Waypoint = {
        x: step.target.x,
        y: step.target.y,
        z: Math.min(
          step.target.z + APPROACH_HEIGHT,
          ROBOT_KINEMATICS.workspace.zMax,
        ),
        rx: step.target.rx,
        ry: step.target.ry,
        rz: step.target.rz,
      };

      enriched.push({
        id: randomUUID(),
        order: step.order + 0.75,
        description:
          step.action === "grip"
            ? "Lift clear after grip"
            : "Retract clear after release",
        action: "move",
        target: liftTarget,
        gripper: "unchanged",
        speed: Math.min(0.18, Math.max(0.08, step.speed * 1.5)),
        duration: 2,
        requiresVision: false,
      });
    }
  });

  // Renumber all steps sequentially
  return enriched.map((s, i) => ({ ...s, order: i + 1 }));
}

export function ensureTerminalHomeSteps(steps: TaskStep[]): TaskStep[] {
  const sorted = [...steps].sort((a, b) => a.order - b.order);
  const makeHome = (description: string, order: number): TaskStep => ({
    id: randomUUID(),
    order,
    description,
    action: "home",
    target: HOME_WAYPOINT,
    gripper: "open",
    speed: 0.3,
    duration: 2,
    requiresVision: false,
  });

  if (!sorted[0] || sorted[0].action !== "home") {
    sorted.unshift(makeHome("Move to calibrated home pose", 0));
  } else {
    sorted[0] = { ...sorted[0], gripper: "open" };
  }

  const last = sorted[sorted.length - 1];
  if (!last || last.action !== "home") {
    sorted.push(makeHome("Return to calibrated home pose", sorted.length + 1));
  } else {
    sorted[sorted.length - 1] = {
      ...last,
      description: last.description.toLowerCase().includes("gripper open")
        ? last.description
        : `${last.description} with gripper open`,
      gripper: "open",
    };
  }

  return sorted.map((step, index) => ({ ...step, order: index + 1 }));
}

/**
 * Validate gripper state consistency.
 * Ensure gripper can't "grip" without opening first, and can't double-close.
 */
export function validateGripperState(steps: TaskStep[]): {
  valid: boolean;
  steps: TaskStep[];
  errors: string[];
} {
  const errors: string[] = [];
  let gripperState = "open"; // Start open

  steps.forEach((s, i) => {
    if (s.action === "grip") {
      if (gripperState === "closed") {
        errors.push(
          `Step ${s.order}: grip attempted while already closed`,
        );
      }
      gripperState = "closed";
    } else if (s.action === "release") {
      if (gripperState === "open") {
        errors.push(
          `Step ${s.order}: release attempted while already open`,
        );
      }
      gripperState = "open";
    }
    // Update expected state from gripper field
    if (s.gripper === "closed") gripperState = "closed";
    if (s.gripper === "open") gripperState = "open";
  });

  return {
    valid: errors.length === 0,
    steps,
    errors,
  };
}

/**
 * Clamp speeds near contact points (grip/release).
 * Ensures safe, controlled gripper operations.
 */
export function clampContactSpeeds(steps: TaskStep[]): TaskStep[] {
  return steps.map((s) => {
    if (s.action === "grip" || s.action === "release") {
      return { ...s, speed: Math.min(s.speed, ROBOT_KINEMATICS.speed.contactMax) };
    }
    return s;
  });
}

/**
 * Check for collisions with workspace floor.
 * Flags waypoints that drop below z=0.02m as unreachable/dangerous.
 */
export function checkFloorCollision(
  steps: TaskStep[],
): { safe: boolean; issues: Array<{ step: TaskStep; issue: string }> } {
  const issues: Array<{ step: TaskStep; issue: string }> = [];

  steps.forEach((s) => {
    if (s.target.z < ROBOT_KINEMATICS.minFloorClearance) {
      issues.push({
        step: s,
        issue: `Target height ${s.target.z.toFixed(3)}m below safe floor clearance (${ROBOT_KINEMATICS.minFloorClearance.toFixed(2)}m)`,
      });
    }
  });

  return { safe: issues.length === 0, issues };
}

/**
 * Simple trapezoidal velocity profile retiming.
 * Computes travel time assuming trapezoidal accel/decel profile per segment.
 * v_max per segment is already in the policy; we just compute duration.
 */
export function retimeWithTrapezoidal(
  steps: TaskStep[],
  maxAccel = 0.2,
): TaskStep[] {
  return retimeWithJerkLimitedProfile(steps, maxAccel);
}

export function retimeWithJerkLimitedProfile(
  steps: TaskStep[],
  maxAccel = 0.28,
  maxJerk = 1.2,
): TaskStep[] {
  let prevPos = HOME_WAYPOINT;
  let totalTime = 0;

  return steps.map((s) => {
    const dist = distance3d(s.target, prevPos);
    const v_max = Math.max(ROBOT_KINEMATICS.speed.min, s.speed);
    let duration: number;

    if (dist < 0.001) {
      duration = s.action === "wait" ? s.duration : 1;
    } else if (dist < (v_max * v_max) / maxAccel) {
      duration = 2 * Math.sqrt(dist / maxAccel);
    } else {
      const accelTime = v_max / maxAccel;
      const accelDistance = (v_max * v_max) / maxAccel;
      duration = 2 * accelTime + (dist - accelDistance) / v_max;
    }

    const jerkSettle = Math.min(0.6, v_max / maxJerk);
    const contactSettle =
      s.action === "grip" || s.action === "release" ? 0.5 : 0;
    duration = Math.max(Math.ceil(duration + jerkSettle + contactSettle), s.duration);
    totalTime += duration;
    prevPos = s.target;

    return { ...s, duration };
  });
}

/**
 * Compute reachability for a simple 2-link arm + yaw.
 * Returns true if target is within the arm's reach envelope.
 */
export function isReachable(target: Waypoint): boolean {
  return evaluateReachability(target).reachable;
}

function computeWorkspaceBounds(steps: TaskStep[]): TaskPolicy["workspaceBounds"] {
  if (steps.length === 0) return undefined;
  const xs = steps.map((s) => s.target.x);
  const ys = steps.map((s) => s.target.y);
  const zs = steps.map((s) => s.target.z);
  return {
    xMin: Math.min(...xs),
    xMax: Math.max(...xs),
    yMin: Math.min(...ys),
    yMax: Math.max(...ys),
    zMin: Math.min(...zs),
    zMax: Math.max(...zs),
  };
}

/**
 * Cross-checks the policy's pick/place cycle count against the perception
 * events extracted from the video. A grip in the policy with no grasp-like
 * event behind it (or vice versa) is exactly the hallucination/omission class
 * the interpreter is most prone to, so mismatches surface as explicit
 * warnings rather than being silently accepted.
 */
export function crossCheckCycleCount(
  steps: TaskStep[],
  events: Array<{ type: string }> | undefined,
): string[] {
  if (!events || events.length === 0) return [];
  const graspEvents = events.filter((e) => e.type === "grasp_candidate").length;
  const releaseEvents = events.filter((e) => e.type === "release_candidate").length;
  if (graspEvents === 0 && releaseEvents === 0) return [];

  const gripSteps = steps.filter((s) => s.action === "grip").length;
  const releaseSteps = steps.filter((s) => s.action === "release").length;
  const warnings: string[] = [];
  if (gripSteps !== graspEvents) {
    warnings.push(
      `Policy has ${gripSteps} grip step(s) but motion evidence suggests ${graspEvents} grasp event(s) — verify no pick cycle was invented or dropped.`,
    );
  }
  if (releaseSteps !== releaseEvents) {
    warnings.push(
      `Policy has ${releaseSteps} release step(s) but motion evidence suggests ${releaseEvents} release event(s) — verify placement count against the video.`,
    );
  }
  return warnings;
}

/**
 * Full policy pipeline — orchestrates all validations and enrichments.
 * When a validated scene is provided, approach heights become shape-aware
 * (container rims) and every free-motion segment is screened against the
 * scene-object proxies for low clearance.
 */
export function processPolicyPipeline(
  policy: TaskPolicy,
  scene?: WorkcellScene,
): {
  policy: TaskPolicy;
  warnings: string[];
  errors: string[];
} {
  const warnings: string[] = [];
  const errors: string[] = [];

  // 1. Ensure terminal home poses, then insert approach/retract moves.
  let steps = ensureTerminalHomeSteps(policy.steps);
  steps = insertApproachRetract(steps, scene);

  // 2. Validate gripper state
  const gripCheck = validateGripperState(steps);
  if (!gripCheck.valid) {
    errors.push(...gripCheck.errors);
  }

  // 3. Clamp contact speeds
  steps = clampContactSpeeds(steps);

  // 4. Check floor collisions
  const floorCheck = checkFloorCollision(steps);
  if (!floorCheck.safe) {
    errors.push(
      ...floorCheck.issues.map(
        (issue) =>
          `Step ${issue.step.order}: ${issue.issue}`,
      ),
    );
  }

  // 5. Check reachability and segment continuity.
  steps.forEach((s) => {
    const reach = evaluateReachability(s.target);
    if (!reach.reachable) {
      warnings.push(
        `Step ${s.order}: ${reach.reason}; target error ${reach.targetErrorMeters.toFixed(3)}m`,
      );
    }
  });

  steps.forEach((s, index) => {
    const previous = index === 0 ? HOME_WAYPOINT : steps[index - 1].target;
    const segment = distance3d(previous, s.target);
    if (segment > 0.9 && s.speed > 0.25) {
      warnings.push(
        `Step ${s.order}: long ${segment.toFixed(2)}m segment at ${s.speed.toFixed(2)}m/s; review clearance before deployment`,
      );
    }
  });

  // 6. Screen free-motion segments against scene-object proxies. Honest by
  // construction: these are waypoint-level checks against approximate
  // geometry, and the warning text says so.
  if (scene && scene.objects.length > 0) {
    const findings = findLowClearanceSegments(steps, scene.objects);
    for (const finding of findings.slice(0, 5)) {
      warnings.push(
        `Step ${finding.toStepOrder}: segment passes ${(finding.clearanceMeters * 100).toFixed(1)}cm from "${finding.objectLabel}"${finding.geometryApproximate ? " (approximate proxy geometry)" : ""} — review clearance; path is waypoint-valid only, not collision-planned.`,
      );
    }
  }

  // 7. Retime with a conservative jerk-limited profile.
  steps = retimeWithJerkLimitedProfile(steps);

  // Compute new cycle time
  const estimatedCycleSeconds = steps.reduce((sum, s) => sum + s.duration, 0);

  const enrichedPolicy: TaskPolicy = {
    ...policy,
    steps,
    scene: scene ?? policy.scene,
    workspaceBounds: computeWorkspaceBounds(steps),
    estimatedCycleSeconds,
  };

  return { policy: enrichedPolicy, warnings, errors };
}
