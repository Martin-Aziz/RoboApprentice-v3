import { describe, expect, it } from "vitest";
import { buildManifest, buildPythonSimulator } from "@/lib/simulation";
import type { TaskPolicy, TaskStep, WorkcellScene } from "@/lib/types";

function step(id: string, order: number, action: TaskStep["action"], gripper: TaskStep["gripper"], z: number): TaskStep {
  return {
    id,
    order,
    description: `${action} step ${order}`,
    action,
    target: { x: 0.3, y: 0.1 * order, z },
    gripper,
    speed: 0.15,
    duration: 2,
  };
}

const scene: WorkcellScene = {
  source: "video",
  confidence: 0.7,
  warnings: [],
  objects: [
    {
      id: "tote-1",
      role: "container",
      category: "tote",
      label: "gray tote",
      relatedStepIds: ["s3"],
      confidence: 0.7,
      sizeHint: { x: 0.4, y: 0.3, z: 0.25 },
      poseHint: { x: 0.3, y: 0.3, z: 0 },
      visualFidelity: "proxy",
    },
    {
      id: "shaft-1",
      role: "workpiece",
      category: "cylinder",
      label: "steel shaft",
      relatedStepIds: ["s2"],
      confidence: 0.6,
      sizeHint: { x: 0.05, y: 0.05, z: 0.2 },
      poseHint: { x: 0.3, y: 0.1, z: 0 },
      visualFidelity: "proxy",
    },
  ],
};

const policy: TaskPolicy = {
  toolFrame: "tcp_default",
  estimatedCycleSeconds: 8,
  steps: [
    step("s1", 1, "approach", "unchanged", 0.2),
    step("s2", 2, "grip", "closed", 0.1),
    step("s3", 3, "release", "open", 0.15),
  ],
  scene,
};

describe("simulation manifest", () => {
  it("emits format 1.1 with the scene attached", () => {
    const manifest = buildManifest(policy, "Test task");
    expect(manifest.format_version).toBe("1.1");
    expect(manifest.scene.source).toBe("video");
    expect(manifest.review.headline).toBeTruthy();
    expect(manifest.review.validation_scope).toContain("heuristic kinematic screening");
    expect(manifest.scene.objects).toHaveLength(2);
    expect(manifest.scene.objects[0]).toMatchObject({
      id: "tote-1",
      category: "tote",
      visual_fidelity: "proxy",
    });
    expect(manifest.waypoints).toHaveLength(3);
  });
});

describe("python simulator export", () => {
  const py = buildPythonSimulator(policy, "Test task");

  it("embeds scene objects with class-specific shapes", () => {
    expect(py).toContain('"shape": "open_box"'); // tote renders without top
    expect(py).toContain('"shape": "cylinder"');
    expect(py).toContain("gray tote");
  });

  it("tracks carried payload across the grip/release window", () => {
    expect(py).toContain("CARRY_PAIRS");
    expect(py).toContain("(1, 2),"); // pick at step index 1, place at index 2
    expect(py).toContain("payload");
  });

  it("colors motion phases and annotates contact events", () => {
    expect(py).toContain("PHASE_COLORS");
    expect(py).toContain("segment_phase");
    expect(py).toContain("grip");
  });

  it("carries an explicit honesty caution", () => {
    expect(py).toContain("not a collision-planned path");
    expect(py).toContain("PROXY_OBJECT_COUNT = 2");
    expect(py).toContain("REVIEW_HEADLINE");
  });

  it("remains syntactically balanced python (no template artifacts)", () => {
    expect(py).not.toContain("${");
    expect(py).not.toContain("undefined");
  });
});
