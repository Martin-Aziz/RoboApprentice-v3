import { describe, expect, it } from "vitest";
import { buildPlanningManifest, PLANNING_MANIFEST_VERSION } from "@/lib/planning-manifest";
import type { SceneObject, TaskPolicy, TaskStep } from "@/lib/types";

function step(partial: Partial<TaskStep> & { id: string; order: number }): TaskStep {
  return {
    description: `step ${partial.order}`,
    action: "move",
    target: { x: 0.3, y: 0, z: 0.3 },
    gripper: "unchanged",
    speed: 0.2,
    duration: 2,
    ...partial,
  };
}

const STEPS: TaskStep[] = [
  step({ id: "s1", order: 1, action: "home", target: { x: 0.28, y: 0, z: 0.52 }, gripper: "open" }),
  step({ id: "s2", order: 2, action: "approach", target: { x: 0.4, y: -0.2, z: 0.16 }, speed: 0.1 }),
  step({ id: "s3", order: 3, action: "grip", target: { x: 0.4, y: -0.2, z: 0.08 }, gripper: "closed", speed: 0.06 }),
  step({ id: "s4", order: 4, action: "move", target: { x: 0.4, y: -0.2, z: 0.24 } }),
  step({ id: "s5", order: 5, action: "approach", target: { x: 0.1, y: 0.25, z: 0.18 }, speed: 0.1 }),
  step({ id: "s6", order: 6, action: "release", target: { x: 0.1, y: 0.25, z: 0.09 }, gripper: "open", speed: 0.06 }),
  step({ id: "s7", order: 7, action: "home", target: { x: 0.28, y: 0, z: 0.52 }, gripper: "open" }),
];

const OBJECTS: SceneObject[] = [
  {
    id: "obj-1",
    role: "workpiece",
    category: "machined_part",
    label: "aluminum part",
    relatedStepIds: ["s3"],
    sizeHint: { x: 0.06, y: 0.05, z: 0.04 },
    poseHint: { x: 0.4, y: -0.2, z: 0 },
    confidence: 0.7,
    trackId: "zone-track-1",
    geometrySource: "primitive",
    visualFidelity: "proxy",
  },
  {
    id: "obj-2",
    role: "container",
    category: "cylinder",
    label: "round nest",
    relatedStepIds: ["s6"],
    sizeHint: { x: 0.12, y: 0.12, z: 0.08 },
    poseHint: { x: 0.1, y: 0.25, z: 0, yaw: 0.4 },
    confidence: 0.4,
    reviewRequiredReason: "low confidence",
    geometrySource: "derived",
    visualFidelity: "proxy",
  },
  {
    id: "obj-3",
    role: "unknown",
    category: "unknown",
    label: "no pose object",
    relatedStepIds: [],
    confidence: 0.3,
  },
];

function makePolicy(): TaskPolicy {
  return {
    steps: STEPS,
    toolFrame: "tcp_default",
    estimatedCycleSeconds: 14,
    workspaceBounds: { xMin: 0.1, xMax: 0.4, yMin: -0.2, yMax: 0.25, zMin: 0.08, zMax: 0.52 },
    scene: { objects: OBJECTS, confidence: 0.55, warnings: ["scene warning"], source: "video" },
  };
}

describe("buildPlanningManifest", () => {
  it("emits versioned manifest with steps, scene objects, and metadata", () => {
    const manifest = buildPlanningManifest(makePolicy(), "UR5e", { generatedAt: "2026-07-05T00:00:00Z" });
    expect(manifest.version).toBe(PLANNING_MANIFEST_VERSION);
    expect(manifest.generatedAt).toBe("2026-07-05T00:00:00Z");
    expect(manifest.robotModel).toBe("UR5e");
    expect(manifest.steps).toHaveLength(7);
    expect(manifest.sceneObjects).toHaveLength(3);
    expect(manifest.confidence.scene).toBe(0.55);
    expect(manifest.confidence.sceneSource).toBe("video");
    expect(manifest.confidence.objectsNeedingReview).toBe(1);
    expect(manifest.warnings).toContain("scene warning");
  });

  it("builds collision primitives only for posed objects, with correct shapes", () => {
    const manifest = buildPlanningManifest(makePolicy(), "UR5e");
    expect(manifest.collisionPrimitives).toHaveLength(2);

    const box = manifest.collisionPrimitives.find((p) => p.objectId === "obj-1")!;
    expect(box.type).toBe("box");
    expect(box.dimensions).toEqual([0.06, 0.05, 0.04]);
    expect(box.pose.z).toBeCloseTo(0.02); // centre lifted by half height
    expect(box.allowedContact).toBe(true); // workpiece may be touched

    const cylinder = manifest.collisionPrimitives.find((p) => p.objectId === "obj-2")!;
    expect(cylinder.type).toBe("cylinder");
    expect(cylinder.dimensions).toEqual([0.08, 0.06]); // [height, radius]
    expect(cylinder.pose.yaw).toBe(0.4);
    expect(cylinder.allowedContact).toBe(false); // container is an obstacle

    expect(manifest.warnings.join(" ")).toContain("no pose evidence");
  });

  it("derives approach/retract constraints around every contact step", () => {
    const manifest = buildPlanningManifest(makePolicy(), "UR5e");
    const grips = manifest.approachRetractConstraints.filter((c) => c.contactStepId === "s3");
    expect(grips.map((c) => c.kind).sort()).toEqual(["approach", "retract"]);
    const approach = grips.find((c) => c.kind === "approach")!;
    expect(approach.stepId).toBe("s2");
    expect(approach.minClearanceMeters).toBeCloseTo(0.08);
    expect(approach.maxSpeedMetersPerSecond).toBeLessThanOrEqual(0.12);
  });

  it("tracks gripper transitions with cycle timestamps", () => {
    const manifest = buildPlanningManifest(makePolicy(), "UR5e");
    expect(manifest.gripperTransitions).toEqual([
      expect.objectContaining({ stepId: "s3", action: "grip", from: "open", to: "closed" }),
      expect.objectContaining({ stepId: "s6", action: "release", from: "closed", to: "open" }),
    ]);
    const [grip, release] = manifest.gripperTransitions;
    expect(release.timestampSecondsInCycle).toBeGreaterThan(grip.timestampSecondsInCycle);
  });

  it("falls back to a derived scene and warns that geometry is placeholder", () => {
    const policy = { ...makePolicy(), scene: undefined };
    const manifest = buildPlanningManifest(policy, "UR5e");
    expect(manifest.confidence.sceneSource).toBe("derived");
    expect(manifest.warnings.join(" ")).toContain("placeholders");
    expect(manifest.sceneObjects.length).toBeGreaterThan(0);
  });
});
