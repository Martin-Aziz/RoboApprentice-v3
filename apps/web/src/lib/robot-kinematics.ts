import type { GripperState, TaskStep, Waypoint } from "./types";

export const ROBOT_KINEMATICS = {
  upperArmLength: 1.4,
  lowerArmLength: 1.1,
  wristLength: 0.6,
  gripperTcpOffset: 0.18,
  baseRadius: 0.35,
  shoulderHeight: 0.3,
  minFloorClearance: 0.02,
  contactClearance: 0.07,
  workspace: {
    xMin: -0.8,
    xMax: 0.8,
    yMin: -0.8,
    yMax: 0.8,
    zMin: 0.02,
    zMax: 0.95,
  },
  speed: {
    min: 0.05,
    max: 0.5,
    contactMax: 0.1,
    approachMax: 0.14,
  },
} as const;

export const TCP_OFFSET =
  ROBOT_KINEMATICS.wristLength + ROBOT_KINEMATICS.gripperTcpOffset;

export const HOME_WAYPOINT: Waypoint = {
  x: 0,
  y: 0,
  z: 0.6,
  rx: 0,
  ry: 0,
  rz: 0,
};

export interface ArmPose {
  baseYaw: number;
  shoulder: number;
  elbow: number;
  wrist: number;
  toolYaw: number;
  gripperGap: number;
}

export interface ReachabilityResult {
  reachable: boolean;
  reason: string;
  planarReach: number;
  wristCenterHeight: number;
  shoulderDistance: number;
  clampedShoulderDistance: number;
  targetErrorMeters: number;
  floorClearanceMeters: number;
  envelopeMarginMeters: number;
}

export interface TrajectoryMetrics {
  pathLengthMeters: number;
  maxSegmentMeters: number;
  cycleSeconds: number;
  contactSteps: number;
  visionSteps: number;
  unreachableSteps: number;
  minClearanceMeters: number;
  averageTcpSpeed: number;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function distance3d(a: Waypoint, b: Waypoint): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function xyDistance(a: Waypoint, b: Waypoint): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function gapForGripper(gripper: GripperState): number {
  if (gripper === "closed") return 0;
  if (gripper === "open") return 1;
  return 0.5;
}

function wristCenterForTarget(target: Waypoint): {
  planarReach: number;
  wristCenterHeight: number;
  shoulderRelativeHeight: number;
  shoulderDistance: number;
} {
  const planarReach = Math.hypot(target.x, target.y);
  const wristCenterHeight = target.z + TCP_OFFSET;
  const shoulderRelativeHeight =
    wristCenterHeight - ROBOT_KINEMATICS.shoulderHeight;
  const shoulderDistance = Math.hypot(planarReach, shoulderRelativeHeight);

  return {
    planarReach,
    wristCenterHeight,
    shoulderRelativeHeight,
    shoulderDistance,
  };
}

export function evaluateReachability(target: Waypoint): ReachabilityResult {
  const {
    planarReach,
    wristCenterHeight,
    shoulderRelativeHeight,
    shoulderDistance,
  } = wristCenterForTarget(target);

  const minReach = Math.abs(
    ROBOT_KINEMATICS.upperArmLength - ROBOT_KINEMATICS.lowerArmLength,
  );
  const maxReach =
    ROBOT_KINEMATICS.upperArmLength + ROBOT_KINEMATICS.lowerArmLength;
  const clampedShoulderDistance = clamp(
    shoulderDistance,
    minReach,
    maxReach,
  );
  const floorClearanceMeters =
    target.z - ROBOT_KINEMATICS.minFloorClearance;

  const workspace = ROBOT_KINEMATICS.workspace;
  const outsideWorkspace =
    target.x < workspace.xMin ||
    target.x > workspace.xMax ||
    target.y < workspace.yMin ||
    target.y > workspace.yMax ||
    target.z < workspace.zMin ||
    target.z > workspace.zMax;

  const beyondEnvelope =
    shoulderDistance > maxReach || shoulderDistance < minReach;
  const targetErrorMeters = Math.abs(
    shoulderDistance - clampedShoulderDistance,
  );
  const envelopeMarginMeters = Math.min(
    maxReach - shoulderDistance,
    shoulderDistance - minReach,
  );

  let reason = "inside calibrated workspace";
  if (target.z < ROBOT_KINEMATICS.minFloorClearance) {
    reason = "below floor clearance";
  } else if (beyondEnvelope) {
    reason =
      shoulderDistance > maxReach
        ? "outside arm reach envelope"
        : "inside folded-arm singularity zone";
  } else if (outsideWorkspace) {
    reason = "outside configured workcell bounds";
  } else if (shoulderRelativeHeight < -0.2) {
    reason = "requires an aggressive downward wrist posture";
  }

  return {
    reachable:
      floorClearanceMeters >= 0 &&
      !beyondEnvelope &&
      !outsideWorkspace &&
      shoulderRelativeHeight >= -0.2,
    reason,
    planarReach,
    wristCenterHeight,
    shoulderDistance,
    clampedShoulderDistance,
    targetErrorMeters,
    floorClearanceMeters,
    envelopeMarginMeters,
  };
}

export function solveArmPose(
  target: Waypoint,
  gripper: GripperState = "unchanged",
): ArmPose {
  const {
    planarReach,
    shoulderRelativeHeight,
    shoulderDistance,
  } = wristCenterForTarget(target);
  const minReach =
    Math.abs(ROBOT_KINEMATICS.upperArmLength - ROBOT_KINEMATICS.lowerArmLength) +
    0.001;
  const maxReach =
    ROBOT_KINEMATICS.upperArmLength + ROBOT_KINEMATICS.lowerArmLength - 0.001;
  const scale =
    shoulderDistance > 0
      ? clamp(shoulderDistance, minReach, maxReach) / shoulderDistance
      : 1;
  const radial = planarReach * scale;
  const vertical = shoulderRelativeHeight * scale;
  const l1 = ROBOT_KINEMATICS.upperArmLength;
  const l2 = ROBOT_KINEMATICS.lowerArmLength;
  const d2 = radial * radial + vertical * vertical;
  const cosElbow = clamp((d2 - l1 * l1 - l2 * l2) / (2 * l1 * l2), -1, 1);
  const elbowStandard = Math.acos(cosElbow);
  const shoulderStandard =
    Math.atan2(vertical, radial || 0.0001) -
    Math.atan2(l2 * Math.sin(elbowStandard), l1 + l2 * cosElbow);
  const shoulder = Math.PI / 2 - shoulderStandard;
  const elbow = -elbowStandard;

  return {
    baseYaw: Math.atan2(target.y, target.x),
    shoulder,
    elbow,
    wrist: Math.PI + shoulder + elbow,
    toolYaw: target.rz ?? 0,
    gripperGap: gapForGripper(gripper),
  };
}

export function forwardKinematics(pose: ArmPose): Waypoint {
  const l1 = ROBOT_KINEMATICS.upperArmLength;
  const l2 = ROBOT_KINEMATICS.lowerArmLength;
  const radial =
    l1 * Math.sin(pose.shoulder) +
    l2 * Math.sin(pose.shoulder + pose.elbow);
  const wristCenterHeight =
    ROBOT_KINEMATICS.shoulderHeight +
    l1 * Math.cos(pose.shoulder) +
    l2 * Math.cos(pose.shoulder + pose.elbow);
  const tcpZ = wristCenterHeight - TCP_OFFSET;

  return {
    x: radial * Math.cos(pose.baseYaw),
    y: radial * Math.sin(pose.baseYaw),
    z: tcpZ,
    rz: pose.toolYaw,
  };
}

export function calculateTrajectoryMetrics(
  steps: TaskStep[],
): TrajectoryMetrics {
  let previous = HOME_WAYPOINT;
  let pathLengthMeters = 0;
  let maxSegmentMeters = 0;
  let minClearanceMeters = Number.POSITIVE_INFINITY;
  let unreachableSteps = 0;

  for (const step of steps) {
    const segment = distance3d(previous, step.target);
    pathLengthMeters += segment;
    maxSegmentMeters = Math.max(maxSegmentMeters, segment);
    minClearanceMeters = Math.min(
      minClearanceMeters,
      step.target.z - ROBOT_KINEMATICS.minFloorClearance,
    );
    if (!evaluateReachability(step.target).reachable) {
      unreachableSteps += 1;
    }
    previous = step.target;
  }

  const cycleSeconds = steps.reduce((sum, step) => sum + step.duration, 0);

  return {
    pathLengthMeters,
    maxSegmentMeters,
    cycleSeconds,
    contactSteps: steps.filter(
      (step) => step.action === "grip" || step.action === "release",
    ).length,
    visionSteps: steps.filter((step) => step.requiresVision).length,
    unreachableSteps,
    minClearanceMeters:
      minClearanceMeters === Number.POSITIVE_INFINITY
        ? 0
        : minClearanceMeters,
    averageTcpSpeed: cycleSeconds > 0 ? pathLengthMeters / cycleSeconds : 0,
  };
}
