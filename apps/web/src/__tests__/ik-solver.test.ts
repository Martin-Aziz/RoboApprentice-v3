import { describe, expect, it } from "vitest";
import { solveCcdIk, type IKJoint } from "@/lib/ik-solver";
import type { Pose } from "@/lib/robot-viewport-types";

const CHAIN: IKJoint[] = [
  { name: "shoulder_pan_joint", value: 0, lower: -Math.PI * 2, upper: Math.PI * 2 },
  { name: "shoulder_lift_joint", value: 0, lower: -Math.PI, upper: Math.PI },
  { name: "elbow_joint", value: 0, lower: -Math.PI, upper: Math.PI },
  { name: "wrist_1_joint", value: 0, lower: -Math.PI * 2, upper: Math.PI * 2 },
  { name: "wrist_2_joint", value: 0, lower: -Math.PI * 2, upper: Math.PI * 2 },
  { name: "wrist_3_joint", value: 0, lower: -Math.PI * 2, upper: Math.PI * 2 },
];

function pose(x: number, y: number, z: number, rz = 0): Pose {
  return { position: { x, y, z }, rotation: { x: 0, y: Math.PI / 2, z: rz } };
}

describe("ik solver", () => {
  it("converges on an in-envelope target with sub-centimeter FK error", () => {
    const solution = solveCcdIk(CHAIN.map((j) => ({ ...j })), pose(0.35, 0.1, 0.15));
    expect(solution.converged).toBe(true);
    expect(solution.reachable).toBe(true);
    expect(solution.clampedForPreview).toBe(false);
    expect(solution.errorMeters).toBeLessThan(0.01);
  });

  it("reports out-of-reach targets as clamped previews with an honest error", () => {
    const solution = solveCcdIk(CHAIN.map((j) => ({ ...j })), pose(1.4, 0.9, 0.2));
    expect(solution.reachable).toBe(false);
    expect(solution.clampedForPreview).toBe(true);
    expect(solution.errorMeters).toBeGreaterThan(0.05);
  });

  it("flags below-floor targets as unreachable", () => {
    const solution = solveCcdIk(CHAIN.map((j) => ({ ...j })), pose(0.3, 0, -0.05));
    expect(solution.reachable).toBe(false);
    expect(solution.clampedForPreview).toBe(true);
  });

  it("respects joint limits", () => {
    const tight = CHAIN.map((j) => ({ ...j, lower: -0.5, upper: 0.5 }));
    const solution = solveCcdIk(tight, pose(-0.4, -0.3, 0.2, 2.5));
    for (const joint of tight) {
      expect(solution.joints[joint.name]).toBeGreaterThanOrEqual(joint.lower);
      expect(solution.joints[joint.name]).toBeLessThanOrEqual(joint.upper);
    }
  });

  it("routes tool yaw through wrist_3 relative to the pan angle", () => {
    const solution = solveCcdIk(CHAIN.map((j) => ({ ...j })), pose(0.4, 0, 0.2, 0.8));
    expect(solution.joints.wrist_3_joint).toBeCloseTo(0.8 - solution.joints.shoulder_pan_joint, 5);
  });

  it("is deterministic", () => {
    const a = solveCcdIk(CHAIN.map((j) => ({ ...j })), pose(0.3, 0.2, 0.3));
    const b = solveCcdIk(CHAIN.map((j) => ({ ...j })), pose(0.3, 0.2, 0.3));
    expect(a).toEqual(b);
  });
});
