import type {
  FeasibilityResult,
  RobotModel,
  SimulationRequest,
  Waypoint,
} from "./types";

export interface RobotSpecification {
  model: RobotModel;
  reachMeters: number;
  payloadKg: number;
  maxTcpSpeedMetersPerSecond: number;
}

/**
 * Public manufacturer headline ratings. Keep this catalog as the single source
 * of truth for pre-purchase simulation; see docs/FEASIBILITY_SIMULATOR.md.
 */
export const ROBOT_SPECIFICATIONS: Record<RobotModel, RobotSpecification> = {
  UR5e: {
    model: "UR5e",
    reachMeters: 0.85,
    payloadKg: 5,
    maxTcpSpeedMetersPerSecond: 1,
  },
  UR10e: {
    model: "UR10e",
    reachMeters: 1.3,
    payloadKg: 12.5,
    maxTcpSpeedMetersPerSecond: 1,
  },
  UR16e: {
    model: "UR16e",
    reachMeters: 0.9,
    payloadKg: 16,
    maxTcpSpeedMetersPerSecond: 1,
  },
  "ABB GoFa CRB 15000": {
    model: "ABB GoFa CRB 15000",
    reachMeters: 0.95,
    payloadKg: 10,
    maxTcpSpeedMetersPerSecond: 1,
  },
  "FANUC CRX-10iA": {
    model: "FANUC CRX-10iA",
    reachMeters: 1.249,
    payloadKg: 10,
    maxTcpSpeedMetersPerSecond: 1,
  },
};

const HOME: Waypoint = { x: 0, y: 0, z: 0.45 };
const COLLABORATIVE_PLANNING_SPEED_MPS = 0.25;
const CONTACT_SPEED_MPS = 0.1;
const CONSERVATIVE_MARGIN = 1.2;
const UPTIME_FACTOR = 0.85;
const MARGINAL_UTILIZATION = 0.9;

function distance(a: Waypoint, b: Waypoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

export function radialReach(point: Waypoint): number {
  return Math.hypot(point.x, point.y, point.z);
}

export function evaluateRobotWaypoint(
  robotModel: RobotModel,
  point: Waypoint,
  workcellDimensions?: SimulationRequest["workcell_dimensions"],
): { reachable: boolean; reason: string; distanceMeters: number; reachMeters: number } {
  const spec = ROBOT_SPECIFICATIONS[robotModel];
  const distanceMeters = radialReach(point);
  if (distanceMeters > spec.reachMeters) {
    return {
      reachable: false,
      reason: `Waypoint is ${distanceMeters.toFixed(3)} m from the target robot base, beyond its ${spec.reachMeters.toFixed(3)} m reach.`,
      distanceMeters,
      reachMeters: spec.reachMeters,
    };
  }
  if (workcellDimensions && !fitsWorkcell(point, workcellDimensions)) {
    return {
      reachable: false,
      reason: "Waypoint falls outside the target workcell bounding box.",
      distanceMeters,
      reachMeters: spec.reachMeters,
    };
  }
  return {
    reachable: true,
    reason: "Waypoint is inside the target reach and workcell envelope.",
    distanceMeters,
    reachMeters: spec.reachMeters,
  };
}

function fitsWorkcell(point: Waypoint, dimensions: NonNullable<SimulationRequest["workcell_dimensions"]>): boolean {
  return (
    Math.abs(point.x) <= dimensions.x / 2 &&
    Math.abs(point.y) <= dimensions.y / 2 &&
    point.z >= 0 &&
    point.z <= dimensions.z
  );
}

function estimateCycleSeconds(request: SimulationRequest, spec: RobotSpecification): number {
  const { waypoints, approximateSpeeds = [], operationDelaysSeconds = 0 } = request.task_intent;
  let previous = HOME;
  let motionSeconds = 0;

  waypoints.forEach((waypoint, index) => {
    const requestedSpeed = approximateSpeeds[index] ?? COLLABORATIVE_PLANNING_SPEED_MPS;
    const isContactMove = index > 0 && distance(previous, waypoint) < 0.1;
    const safeCap = isContactMove ? CONTACT_SPEED_MPS : COLLABORATIVE_PLANNING_SPEED_MPS;
    const speed = Math.max(0.05, Math.min(requestedSpeed, safeCap, spec.maxTcpSpeedMetersPerSecond));
    motionSeconds += distance(previous, waypoint) / speed;
    previous = waypoint;
  });

  motionSeconds += distance(previous, HOME) / COLLABORATIVE_PLANNING_SPEED_MPS;
  return Math.max(1, (motionSeconds + Math.max(0, operationDelaysSeconds)) * CONSERVATIVE_MARGIN);
}

function selectRecommendation(request: SimulationRequest): RobotModel | null {
  const requiredReach = Math.max(...request.task_intent.waypoints.map(radialReach), 0);
  const candidates = Object.values(ROBOT_SPECIFICATIONS)
    .filter((spec) => spec.model !== request.robot_model)
    .filter((spec) => spec.reachMeters >= requiredReach && spec.payloadKg >= request.payload_kg)
    .sort((a, b) => {
      const aExcess = (a.reachMeters - requiredReach) + (a.payloadKg - request.payload_kg) / 20;
      const bExcess = (b.reachMeters - requiredReach) + (b.payloadKg - request.payload_kg) / 20;
      return aExcess - bExcess || a.model.localeCompare(b.model);
    });
  return candidates[0]?.model ?? null;
}

export class FeasibilityEngine {
  simulate(request: SimulationRequest): FeasibilityResult {
    const spec = ROBOT_SPECIFICATIONS[request.robot_model];
    if (!spec) throw new Error(`Unsupported robot model: ${request.robot_model}`);
    if (!request.task_intent.waypoints.length) throw new Error("Task intent contains no motion waypoints.");

    const furthestReach = Math.max(...request.task_intent.waypoints.map(radialReach));
    const cycleSeconds = estimateCycleSeconds(request, spec);
    const roundedCycleSeconds = Number(cycleSeconds.toFixed(1));
    const throughput = Math.floor((3600 / roundedCycleSeconds) * UPTIME_FACTOR);
    const base = {
      estimated_cycle_time_seconds: roundedCycleSeconds,
      estimated_throughput_per_hour: throughput,
      confidence: request.task_intent.confidence,
    };

    if (request.payload_kg > spec.payloadKg) {
      return {
        ...base,
        verdict: "NOT_FEASIBLE",
        blocking_reason: `The ${request.robot_model} is rated for ${spec.payloadKg} kg, but this task requires ${request.payload_kg} kg before allowing for a gripper.`,
        recommended_robot: selectRecommendation(request),
        guidance: "Choose a robot with a higher payload rating or reduce the combined part-and-tool weight.",
      };
    }

    if (furthestReach > spec.reachMeters) {
      return {
        ...base,
        verdict: "NOT_FEASIBLE",
        blocking_reason: `The furthest task position is about ${furthestReach.toFixed(2)} m from the robot base, beyond the ${request.robot_model}'s ${spec.reachMeters.toFixed(2)} m reach.`,
        recommended_robot: selectRecommendation(request),
        guidance: "Move the robot base closer to the task or choose a model with more reach.",
      };
    }

    if (
      request.workcell_dimensions &&
      request.task_intent.waypoints.some((point) => !fitsWorkcell(point, request.workcell_dimensions!))
    ) {
      return {
        ...base,
        verdict: "NOT_FEASIBLE",
        blocking_reason: "At least one task position falls outside the workcell dimensions you provided.",
        recommended_robot: null,
        guidance: "Increase the available workcell space or reposition the task fixtures.",
      };
    }

    const reachUtilization = furthestReach / spec.reachMeters;
    const payloadUtilization = request.payload_kg / spec.payloadKg;
    if (reachUtilization >= MARGINAL_UTILIZATION || payloadUtilization >= MARGINAL_UTILIZATION) {
      const reachIsTighter = reachUtilization >= payloadUtilization;
      return {
        ...base,
        verdict: "MARGINAL",
        blocking_reason: null,
        recommended_robot: selectRecommendation(request),
        guidance: reachIsTighter
          ? "The task is close to the robot's reach limit. Move the base closer or use a model with more reach."
          : "The task is close to the payload limit. Include the gripper weight and consider a higher-capacity model.",
      };
    }

    return {
      ...base,
      verdict: "FEASIBLE",
      blocking_reason: null,
      recommended_robot: null,
      guidance: null,
    };
  }
}
