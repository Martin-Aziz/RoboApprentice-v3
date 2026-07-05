/**
 * Planning manifest — an adapter-ready JSON artifact bridging Aurevix task
 * policies to a future MoveIt integration (PlanningScene / MoveIt Task
 * Constructor). It flattens everything a motion planner needs into one
 * declarative document: robot model, task steps, scene objects with simple
 * collision primitives, approach/retract constraints, gripper transitions,
 * and honest confidence/warning metadata.
 *
 * Pure and server/browser-safe: no I/O, deterministic, unit-testable.
 */

import type {
  GripperState,
  SceneObject,
  TaskPolicy,
  TaskStep,
  WorkcellScene,
} from "./types";
import { resolveSceneForPolicy } from "./scene-model";

export const PLANNING_MANIFEST_VERSION = "1.0";

/** Simple collision primitive in the robot base frame (meters). */
export interface CollisionPrimitive {
  objectId: string;
  /** MoveIt shape_msgs-compatible primitive type. */
  type: "box" | "cylinder";
  /** Box: [x, y, z] extents. Cylinder: [height, radius]. */
  dimensions: number[];
  pose: { x: number; y: number; z: number; yaw: number };
  /** Whether the planner may touch this object (workpieces yes, fixtures no). */
  allowedContact: boolean;
}

export interface ApproachRetractConstraint {
  stepId: string;
  stepOrder: number;
  kind: "approach" | "retract";
  /** Contact step this constraint protects. */
  contactStepId: string;
  /** Required minimum vertical clearance above the contact point, meters. */
  minClearanceMeters: number;
  maxSpeedMetersPerSecond: number;
}

export interface GripperTransition {
  stepId: string;
  stepOrder: number;
  action: "grip" | "release";
  from: GripperState;
  to: GripperState;
  timestampSecondsInCycle: number;
}

export interface PlanningManifestObject {
  id: string;
  label: string;
  role: SceneObject["role"];
  category: SceneObject["category"];
  confidence: number;
  geometrySource?: SceneObject["geometrySource"];
  visualFidelity?: SceneObject["visualFidelity"];
  reviewRequiredReason?: string;
  trackId?: string;
}

export interface PlanningManifest {
  version: string;
  generatedAt: string;
  robotModel: string;
  toolFrame: string;
  estimatedCycleSeconds: number;
  steps: Array<{
    id: string;
    order: number;
    description: string;
    action: TaskStep["action"];
    target: TaskStep["target"];
    gripper: GripperState;
    speed: number;
    duration: number;
    requiresVision: boolean;
  }>;
  sceneObjects: PlanningManifestObject[];
  collisionPrimitives: CollisionPrimitive[];
  approachRetractConstraints: ApproachRetractConstraint[];
  gripperTransitions: GripperTransition[];
  workspaceBounds?: TaskPolicy["workspaceBounds"];
  confidence: {
    scene: number;
    sceneSource: WorkcellScene["source"];
    objectsNeedingReview: number;
  };
  warnings: string[];
}

const DEFAULT_OBJECT_SIZE = { x: 0.1, y: 0.1, z: 0.08 };
const CONTACT_ROLES = new Set<SceneObject["role"]>(["workpiece", "source"]);

function collisionPrimitiveFor(object: SceneObject): CollisionPrimitive | null {
  if (!object.poseHint) return null;
  const size = object.sizeHint ?? DEFAULT_OBJECT_SIZE;
  const isCylinder = object.category === "cylinder";
  return {
    objectId: object.id,
    type: isCylinder ? "cylinder" : "box",
    dimensions: isCylinder
      ? [size.z, Math.max(size.x, size.y) / 2]
      : [size.x, size.y, size.z],
    pose: {
      x: object.poseHint.x,
      y: object.poseHint.y,
      z: object.poseHint.z + size.z / 2,
      yaw: object.poseHint.yaw ?? 0,
    },
    allowedContact: CONTACT_ROLES.has(object.role),
  };
}

function isContactAction(step: TaskStep): step is TaskStep & { action: "grip" | "release" } {
  return step.action === "grip" || step.action === "release";
}

/**
 * Builds the adapter-ready planning manifest from an interpreted policy.
 * The manifest is intentionally conservative: proxy geometry stays labelled
 * as such, and anything low-confidence surfaces in `warnings` rather than
 * being silently promoted to trusted collision geometry.
 */
export function buildPlanningManifest(
  policy: TaskPolicy,
  robotModel: string,
  opts: { generatedAt?: string } = {},
): PlanningManifest {
  const scene = resolveSceneForPolicy(policy);
  const steps = policy.steps;
  const warnings: string[] = [...scene.warnings];

  const collisionPrimitives = scene.objects
    .map(collisionPrimitiveFor)
    .filter((p): p is CollisionPrimitive => p !== null);

  const withoutPose = scene.objects.length - collisionPrimitives.length;
  if (withoutPose > 0) {
    warnings.push(`${withoutPose} scene object(s) have no pose evidence and were excluded from collision geometry.`);
  }

  // Approach/retract constraints around every contact step: the step just
  // before is its approach, the step just after its retract (the policy
  // pipeline guarantees these exist).
  const approachRetractConstraints: ApproachRetractConstraint[] = [];
  steps.forEach((step, index) => {
    if (!isContactAction(step)) return;
    const before = steps[index - 1];
    const after = steps[index + 1];
    if (before) {
      approachRetractConstraints.push({
        stepId: before.id,
        stepOrder: before.order,
        kind: "approach",
        contactStepId: step.id,
        minClearanceMeters: Math.max(before.target.z - step.target.z, 0.03),
        maxSpeedMetersPerSecond: Math.min(before.speed, 0.12),
      });
    }
    if (after) {
      approachRetractConstraints.push({
        stepId: after.id,
        stepOrder: after.order,
        kind: "retract",
        contactStepId: step.id,
        minClearanceMeters: Math.max(after.target.z - step.target.z, 0.03),
        maxSpeedMetersPerSecond: Math.min(after.speed, 0.2),
      });
    }
  });

  // Gripper transitions with their time offset into the cycle.
  const gripperTransitions: GripperTransition[] = [];
  let elapsed = 0;
  let gripperState: GripperState = "open";
  for (const step of steps) {
    elapsed += step.duration;
    if (isContactAction(step)) {
      const to: GripperState = step.action === "grip" ? "closed" : "open";
      gripperTransitions.push({
        stepId: step.id,
        stepOrder: step.order,
        action: step.action,
        from: gripperState,
        to,
        timestampSecondsInCycle: elapsed,
      });
      gripperState = to;
    } else if (step.gripper !== "unchanged") {
      gripperState = step.gripper;
    }
  }

  const objectsNeedingReview = scene.objects.filter((o) => o.reviewRequiredReason).length;
  if (scene.source === "derived") {
    warnings.push("Scene geometry was derived from step text, not video perception — treat all collision primitives as placeholders.");
  }

  return {
    version: PLANNING_MANIFEST_VERSION,
    generatedAt: opts.generatedAt ?? new Date().toISOString(),
    robotModel,
    toolFrame: policy.toolFrame,
    estimatedCycleSeconds: policy.estimatedCycleSeconds,
    steps: steps.map((step) => ({
      id: step.id,
      order: step.order,
      description: step.description,
      action: step.action,
      target: step.target,
      gripper: step.gripper,
      speed: step.speed,
      duration: step.duration,
      requiresVision: Boolean(step.requiresVision),
    })),
    sceneObjects: scene.objects.map((object) => ({
      id: object.id,
      label: object.label,
      role: object.role,
      category: object.category,
      confidence: object.confidence,
      geometrySource: object.geometrySource,
      visualFidelity: object.visualFidelity,
      reviewRequiredReason: object.reviewRequiredReason,
      trackId: object.trackId,
    })),
    collisionPrimitives,
    approachRetractConstraints,
    gripperTransitions,
    workspaceBounds: policy.workspaceBounds,
    confidence: {
      scene: scene.confidence,
      sceneSource: scene.source,
      objectsNeedingReview,
    },
    warnings,
  };
}
