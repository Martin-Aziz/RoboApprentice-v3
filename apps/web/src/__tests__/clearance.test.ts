import { describe, expect, it } from "vitest";
import {
  findLowClearanceSegments,
  pointSegmentDistance,
  segmentObjectClearance,
} from "@/lib/clearance";
import type { SceneObject, TaskStep, Waypoint } from "@/lib/types";

function target(x: number, y: number, z: number): Waypoint {
  return { x, y, z };
}

function step(id: string, order: number, action: TaskStep["action"], t: Waypoint): TaskStep {
  return {
    id,
    order,
    description: `${action} step`,
    action,
    target: t,
    gripper: "unchanged",
    speed: 0.2,
    duration: 2,
  };
}

function object(partial: Partial<SceneObject>): SceneObject {
  return {
    id: "obj-1",
    role: "fixture",
    category: "box",
    label: "test box",
    relatedStepIds: [],
    confidence: 0.8,
    ...partial,
  };
}

describe("clearance geometry", () => {
  it("computes point-segment distance", () => {
    expect(pointSegmentDistance({ x: 0, y: 1, z: 0 }, target(-1, 0, 0), target(1, 0, 0))).toBeCloseTo(1);
    expect(pointSegmentDistance({ x: 3, y: 0, z: 0 }, target(-1, 0, 0), target(1, 0, 0))).toBeCloseTo(2);
  });

  it("returns infinity for objects with no pose evidence", () => {
    const clearance = segmentObjectClearance(target(0, 0, 0.3), target(0.5, 0, 0.3), object({}));
    expect(clearance).toBe(Number.POSITIVE_INFINITY);
  });

  it("measures near-zero clearance for a segment passing through an object", () => {
    const obstacle = object({
      poseHint: { x: 0.25, y: 0, z: 0 },
      sizeHint: { x: 0.2, y: 0.2, z: 0.3 },
    });
    const clearance = segmentObjectClearance(target(0, 0, 0.1), target(0.5, 0, 0.1), obstacle);
    expect(clearance).toBe(0);
  });

  it("flags low-clearance segments but not deliberate approaches", () => {
    const obstacle = object({
      id: "obstacle",
      poseHint: { x: 0.25, y: 0, z: 0 },
      sizeHint: { x: 0.2, y: 0.2, z: 0.3 },
    });
    const steps = [
      step("s1", 1, "move", target(0, 0, 0.1)),
      step("s2", 2, "move", target(0.5, 0, 0.1)), // slices through obstacle
      step("s3", 3, "approach", target(0.25, 0, 0.35)), // deliberate approach above it
    ];
    const findings = findLowClearanceSegments(steps, [obstacle]);
    expect(findings).toHaveLength(1);
    expect(findings[0].toStepId).toBe("s2");
    expect(findings[0].clearanceMeters).toBe(0);
    expect(findings[0].geometryApproximate).toBe(true);
  });

  it("skips objects related to the segment's own steps", () => {
    const workpiece = object({
      id: "wp",
      role: "workpiece",
      relatedStepIds: ["s2"],
      poseHint: { x: 0.25, y: 0, z: 0 },
      sizeHint: { x: 0.2, y: 0.2, z: 0.3 },
    });
    const steps = [
      step("s1", 1, "move", target(0, 0, 0.1)),
      step("s2", 2, "move", target(0.5, 0, 0.1)),
    ];
    expect(findLowClearanceSegments(steps, [workpiece])).toHaveLength(0);
  });
});
