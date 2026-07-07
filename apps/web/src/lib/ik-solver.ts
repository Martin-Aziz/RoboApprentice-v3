import type { Pose } from "@/lib/robot-viewport-types";

export interface IKJoint {
  name: string;
  value: number;
  lower: number;
  upper: number;
}

export interface IKSolution {
  joints: Record<string, number>;
  /** Target is inside the arm's envelope AND the solver converged on it. */
  reachable: boolean;
  /** Real FK position error of the returned joint set, meters. */
  errorMeters: number;
  /** True when the solver hit its iteration budget without converging. */
  converged: boolean;
  iterations: number;
  /**
   * True when the returned joints point at a clamped stand-in for an
   * out-of-envelope target. The preview may still render, but the pose must
   * not be presented as a planned, reachable configuration.
   */
  clampedForPreview: boolean;
}

/**
 * UR5e-style chain geometry (meters). d1 shoulder height, a2/a3 arm link
 * lengths, d5+d6 wrist-to-TCP stack. Matches the published UR5e DH table
 * closely enough for preview kinematics without a URDF parse.
 */
const CHAIN = {
  d1: 0.1625,
  a2: 0.425,
  a3: 0.3922,
  wrist: 0.0997 + 0.0996 + 0.06, // wrist_2 + wrist_3 + gripper stand-off
} as const;

const MAX_REACH = CHAIN.a2 + CHAIN.a3;
const MIN_REACH = Math.abs(CHAIN.a2 - CHAIN.a3);
const CONVERGENCE_TOLERANCE = 0.004; // meters
const MAX_ITERATIONS = 32;

function clamp(value: number, lower: number, upper: number) {
  return Math.max(lower, Math.min(upper, value));
}

interface JointVector {
  pan: number;
  lift: number;
  elbow: number;
  wrist1: number;
  wrist2: number;
  wrist3: number;
}

/**
 * Forward kinematics of the TCP for the simplified chain: pan about z, then a
 * planar 2R arm (lift/elbow) in the pan plane, with the wrist stack pointing
 * the tool straight down (wrist1 compensates lift+elbow so the tool z-axis
 * stays vertical, which matches the top-down grasps this product plans).
 */
function forwardTcp(j: JointVector): { x: number; y: number; z: number } {
  // Radial (in the pan plane) and vertical positions of the wrist center.
  const r =
    CHAIN.a2 * Math.sin(j.lift) + CHAIN.a3 * Math.sin(j.lift + j.elbow);
  const zWrist =
    CHAIN.d1 +
    CHAIN.a2 * Math.cos(j.lift) +
    CHAIN.a3 * Math.cos(j.lift + j.elbow);
  // wrist1 is solved so the tool points down; TCP hangs `wrist` below.
  const z = zWrist - CHAIN.wrist;
  return { x: r * Math.cos(j.pan), y: r * Math.sin(j.pan), z };
}

function positionError(j: JointVector, target: { x: number; y: number; z: number }): number {
  const p = forwardTcp(j);
  return Math.hypot(p.x - target.x, p.y - target.y, p.z - target.z);
}

/** Analytic planar 2R solution for the wrist center, elbow-up branch. */
function analyticSeed(target: { x: number; y: number; z: number }): {
  seed: JointVector;
  withinEnvelope: boolean;
} {
  const pan = Math.atan2(target.y, target.x);
  const radial = Math.hypot(target.x, target.y);
  const zWrist = target.z + CHAIN.wrist - CHAIN.d1;
  const dist = Math.hypot(radial, zWrist);
  const clampedDist = clamp(dist, MIN_REACH + 1e-4, MAX_REACH - 1e-4);
  const withinEnvelope = Math.abs(dist - clampedDist) < 1e-6;

  const scale = dist > 1e-9 ? clampedDist / dist : 1;
  const r = radial * scale;
  const v = zWrist * scale;

  const cosElbow = clamp(
    (r * r + v * v - CHAIN.a2 ** 2 - CHAIN.a3 ** 2) / (2 * CHAIN.a2 * CHAIN.a3),
    -1,
    1,
  );
  const elbow = Math.acos(cosElbow); // elbow-up
  // Angles measured from vertical (z-up), matching forwardTcp.
  const lift =
    Math.atan2(r, v) -
    Math.atan2(CHAIN.a3 * Math.sin(elbow), CHAIN.a2 + CHAIN.a3 * Math.cos(elbow));

  return {
    seed: { pan, lift, elbow, wrist1: -(lift + elbow), wrist2: 0, wrist3: 0 },
    withinEnvelope,
  };
}

/**
 * Iterative damped coordinate-descent refinement over (lift, elbow): perturb
 * each joint with a finite difference, take the error-reducing step, shrink
 * the step size as the error shrinks. Deterministic; converges in a handful of
 * iterations from the analytic seed for in-envelope targets.
 */
function refine(
  seed: JointVector,
  target: { x: number; y: number; z: number },
): { joints: JointVector; error: number; iterations: number; converged: boolean } {
  const j = { ...seed };
  let error = positionError(j, target);
  let stepSize = 0.06;
  let iterations = 0;

  for (; iterations < MAX_ITERATIONS && error > CONVERGENCE_TOLERANCE; iterations += 1) {
    let improved = false;
    for (const key of ["lift", "elbow"] as const) {
      const original = j[key];
      for (const direction of [1, -1]) {
        j[key] = original + direction * stepSize;
        const candidate = positionError(j, target);
        if (candidate < error - 1e-9) {
          error = candidate;
          improved = true;
          break;
        }
        j[key] = original;
      }
      // Keep the tool vertical as the arm posture changes.
      j.wrist1 = -(j.lift + j.elbow);
    }
    if (!improved) stepSize *= 0.5;
    if (stepSize < 1e-5) break;
  }

  return { joints: j, error, iterations, converged: error <= CONVERGENCE_TOLERANCE };
}

/**
 * Solves the six-axis chain for a TCP pose: analytic elbow-up seed plus
 * deterministic iterative refinement against real forward kinematics.
 * Orientation: the tool z-axis is held vertical (top-down grasp convention);
 * the target's z-rotation drives wrist_3 (tool yaw) and its y-rotation offsets
 * wrist_2. Reports the true FK error and whether the returned joints are a
 * converged solution or a clamped preview stand-in.
 */
export function solveCcdIk(chain: IKJoint[], targetPose: Pose): IKSolution {
  const target = {
    x: targetPose.position.x,
    y: targetPose.position.y,
    z: targetPose.position.z,
  };

  const { seed, withinEnvelope } = analyticSeed(target);
  const { joints: refined, error, iterations, converged } = refine(seed, target);

  // Orientation handling: yaw about the vertical tool axis, and a bounded
  // wrist_2 offset when the requested tool pitch deviates from straight-down.
  refined.wrist3 = clamp(targetPose.rotation.z - refined.pan, -Math.PI, Math.PI);
  refined.wrist2 = clamp(targetPose.rotation.y - Math.PI / 2, -Math.PI / 2, Math.PI / 2);

  const ordered = [
    refined.pan,
    refined.lift,
    refined.elbow,
    refined.wrist1,
    refined.wrist2,
    refined.wrist3,
  ];

  let limitClamped = false;
  const joints = Object.fromEntries(
    chain.map((joint, index) => {
      const raw = ordered[index] ?? joint.value;
      const clamped = clamp(raw, joint.lower, joint.upper);
      if (Math.abs(clamped - raw) > 1e-6) limitClamped = true;
      return [joint.name, clamped];
    }),
  );

  const aboveFloor = target.z >= 0.02;
  const reachable = withinEnvelope && aboveFloor && converged && !limitClamped;

  return {
    joints,
    reachable,
    errorMeters: error,
    converged,
    iterations,
    clampedForPreview: !withinEnvelope || limitClamped || !aboveFloor,
  };
}
