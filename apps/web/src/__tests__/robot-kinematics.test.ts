import { describe, expect, it } from "vitest";
import type { TaskStep, Waypoint } from "@/lib/types";
import {
  calculateTrajectoryMetrics,
  evaluateReachability,
  forwardKinematics,
  solveArmPose,
} from "@/lib/robot-kinematics";

function waypoint(x: number, y: number, z: number): Waypoint {
  return { x, y, z, rz: 0 };
}

describe("robot kinematics", () => {
  it("solves a reachable TCP pose close to the requested waypoint", () => {
    const target = waypoint(0.45, 0.18, 0.16);
    const pose = solveArmPose(target, "open");
    const solved = forwardKinematics(pose);

    expect(solved.x).toBeCloseTo(target.x, 2);
    expect(solved.y).toBeCloseTo(target.y, 2);
    expect(solved.z).toBeCloseTo(target.z, 2);
  });

  it("flags floor and workspace violations", () => {
    expect(evaluateReachability(waypoint(0.3, 0.1, 0.12)).reachable).toBe(true);
    expect(evaluateReachability(waypoint(0.3, 0.1, 0.0)).reachable).toBe(false);
    expect(evaluateReachability(waypoint(1.1, 0.1, 0.12)).reachable).toBe(false);
  });

  it("summarizes path-level motion metrics", () => {
    const steps: TaskStep[] = [
      {
        id: "1",
        order: 1,
        description: "Move above part",
        action: "move",
        target: waypoint(0.3, 0, 0.3),
        gripper: "unchanged",
        speed: 0.2,
        duration: 2,
      },
      {
        id: "2",
        order: 2,
        description: "Grip part",
        action: "grip",
        target: waypoint(0.3, 0, 0.08),
        gripper: "closed",
        speed: 0.06,
        duration: 2,
        requiresVision: true,
      },
    ];

    const metrics = calculateTrajectoryMetrics(steps);

    expect(metrics.pathLengthMeters).toBeGreaterThan(0.5);
    expect(metrics.contactSteps).toBe(1);
    expect(metrics.visionSteps).toBe(1);
    expect(metrics.averageTcpSpeed).toBeGreaterThan(0);
  });
});
