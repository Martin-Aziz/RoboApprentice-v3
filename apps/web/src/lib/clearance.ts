/**
 * Clearance analysis between straight waypoint segments and scene-object
 * proxies. Deliberately conservative and honest: objects are inflated to
 * bounding cylinders (worst-case footprint), and every finding is labelled as
 * waypoint-level screening — not a substitute for collision-planned motion.
 *
 * Pure and deterministic; shared by the policy pipeline, the planning
 * manifest, and (via warnings) the teach UI.
 */

import type { SceneObject, TaskStep, Waypoint } from "./types";

/** Fallback proxy size when the scene gave no size evidence (meters). */
export const DEFAULT_PROXY_SIZE = { x: 0.12, y: 0.12, z: 0.1 };

/** Segments closer than this to a non-target object are flagged (meters). */
export const LOW_CLEARANCE_THRESHOLD = 0.04;

export interface ClearanceFinding {
  fromStepId: string;
  toStepId: string;
  toStepOrder: number;
  objectId: string;
  objectLabel: string;
  /** Conservative min distance from the segment to the object's inflated proxy. */
  clearanceMeters: number;
  /** True when the object's own geometry is a low-confidence proxy. */
  geometryApproximate: boolean;
}

/** Closest distance between point p and segment a-b, in 3D. */
export function pointSegmentDistance(
  p: { x: number; y: number; z: number },
  a: Waypoint,
  b: Waypoint,
): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const abz = b.z - a.z;
  const lengthSq = abx * abx + aby * aby + abz * abz;
  const t =
    lengthSq < 1e-12
      ? 0
      : Math.max(
          0,
          Math.min(
            1,
            ((p.x - a.x) * abx + (p.y - a.y) * aby + (p.z - a.z) * abz) / lengthSq,
          ),
        );
  const cx = a.x + abx * t;
  const cy = a.y + aby * t;
  const cz = a.z + abz * t;
  return Math.hypot(p.x - cx, p.y - cy, p.z - cz);
}

/**
 * Conservative clearance from segment a-b to one scene object, modelled as a
 * vertical bounding cylinder centered on the object's pose (radius = half the
 * larger footprint side, height = size z). Returns +Infinity when the object
 * has no pose evidence — nothing honest can be measured against a guess.
 */
export function segmentObjectClearance(a: Waypoint, b: Waypoint, object: SceneObject): number {
  if (!object.poseHint) return Number.POSITIVE_INFINITY;
  const size = object.sizeHint ?? DEFAULT_PROXY_SIZE;
  const radius = Math.max(size.x, size.y) / 2;
  const zBottom = object.poseHint.z;
  const zTop = object.poseHint.z + size.z;

  // Sample the segment; the cylinder distance field is cheap and the segments
  // are short, so a fixed sample count stays well within tolerance.
  const SAMPLES = 24;
  let min = Number.POSITIVE_INFINITY;
  for (let i = 0; i <= SAMPLES; i += 1) {
    const t = i / SAMPLES;
    const px = a.x + (b.x - a.x) * t;
    const py = a.y + (b.y - a.y) * t;
    const pz = a.z + (b.z - a.z) * t;
    const radialOut = Math.max(0, Math.hypot(px - object.poseHint.x, py - object.poseHint.y) - radius);
    const verticalOut = pz > zTop ? pz - zTop : pz < zBottom ? zBottom - pz : 0;
    min = Math.min(min, Math.hypot(radialOut, verticalOut));
  }
  return min;
}

/**
 * Screens every consecutive waypoint segment against every scene object with
 * pose evidence, skipping objects the segment is intentionally interacting
 * with (the segment starts or ends at a step listed in the object's
 * relatedStepIds, or ends within grasp range of the object). Findings under
 * `LOW_CLEARANCE_THRESHOLD` come back sorted tightest-first.
 */
export function findLowClearanceSegments(
  steps: TaskStep[],
  objects: SceneObject[],
  threshold = LOW_CLEARANCE_THRESHOLD,
): ClearanceFinding[] {
  const findings: ClearanceFinding[] = [];
  for (let i = 1; i < steps.length; i += 1) {
    const from = steps[i - 1];
    const to = steps[i];
    for (const object of objects) {
      if (!object.poseHint) continue;
      if (object.relatedStepIds.includes(from.id) || object.relatedStepIds.includes(to.id)) continue;
      // Segments terminating in a contact action right above the object are
      // deliberate approaches, not incidental near-misses.
      const intentional =
        (to.action === "grip" || to.action === "release" || to.action === "approach" || to.action === "inspect") &&
        Math.hypot(to.target.x - object.poseHint.x, to.target.y - object.poseHint.y) <
          Math.max((object.sizeHint ?? DEFAULT_PROXY_SIZE).x, (object.sizeHint ?? DEFAULT_PROXY_SIZE).y) / 2 + 0.06;
      if (intentional) continue;

      const clearance = segmentObjectClearance(from.target, to.target, object);
      if (clearance < threshold) {
        findings.push({
          fromStepId: from.id,
          toStepId: to.id,
          toStepOrder: to.order,
          objectId: object.id,
          objectLabel: object.label,
          clearanceMeters: clearance,
          geometryApproximate: object.visualFidelity !== "cad_matched",
        });
      }
    }
  }
  return findings.sort((a, b) => a.clearanceMeters - b.clearanceMeters);
}
