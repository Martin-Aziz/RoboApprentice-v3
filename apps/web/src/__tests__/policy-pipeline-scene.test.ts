import { describe, expect, it } from "vitest";
import {
  approachHeightForContact,
  crossCheckCycleCount,
  processPolicyPipeline,
} from "@/lib/policy-pipeline";
import { ROBOT_KINEMATICS } from "@/lib/robot-kinematics";
import type { TaskPolicy, TaskStep, WorkcellScene } from "@/lib/types";

function step(id: string, order: number, action: TaskStep["action"], gripper: TaskStep["gripper"], target: TaskStep["target"]): TaskStep {
  return {
    id,
    order,
    description: `${action} step ${order}`,
    action,
    target,
    gripper,
    speed: 0.15,
    duration: 2,
  };
}

describe("shape-aware approach heights", () => {
  const toteScene: WorkcellScene = {
    source: "video",
    confidence: 0.7,
    warnings: [],
    objects: [
      {
        id: "tote-1",
        role: "container",
        category: "tote",
        label: "deep tote",
        relatedStepIds: ["release-1"],
        confidence: 0.7,
        sizeHint: { x: 0.4, y: 0.3, z: 0.3 },
        poseHint: { x: 0.3, y: 0.2, z: 0 },
      },
    ],
  };

  it("raises the approach above a deep container rim", () => {
    // Release deep inside the tote (z=0.05); rim is at 0.3.
    const contact = step("release-1", 1, "release", "open", { x: 0.3, y: 0.2, z: 0.05 });
    const height = approachHeightForContact(contact, toteScene);
    expect(height).toBeCloseTo(0.3 + 0.03 - 0.05, 5);
    expect(height).toBeGreaterThan(ROBOT_KINEMATICS.contactClearance);
  });

  it("keeps the generic clearance for contacts away from containers", () => {
    const contact = step("grip-1", 1, "grip", "closed", { x: -0.3, y: -0.2, z: 0.08 });
    expect(approachHeightForContact(contact, toteScene)).toBe(ROBOT_KINEMATICS.contactClearance);
  });
});

describe("scene-aware pipeline warnings", () => {
  it("warns when a free segment slices a scene object", () => {
    const obstacleScene: WorkcellScene = {
      source: "video",
      confidence: 0.7,
      warnings: [],
      objects: [
        {
          id: "fixture-1",
          role: "fixture",
          category: "fixture",
          label: "tall fixture",
          relatedStepIds: [],
          confidence: 0.8,
          sizeHint: { x: 0.15, y: 0.15, z: 0.5 },
          poseHint: { x: 0.3, y: 0, z: 0 },
        },
      ],
    };
    const policy: TaskPolicy = {
      toolFrame: "tcp_default",
      estimatedCycleSeconds: 6,
      steps: [
        step("s1", 1, "move", "unchanged", { x: 0.1, y: 0, z: 0.1 }),
        step("s2", 2, "move", "unchanged", { x: 0.5, y: 0, z: 0.1 }),
      ],
    };
    const { warnings } = processPolicyPipeline(policy, obstacleScene);
    expect(warnings.some((w) => w.includes("tall fixture") && w.includes("waypoint-valid only"))).toBe(true);
  });
});

describe("evidence cycle cross-check", () => {
  const steps = [
    step("s1", 1, "grip", "closed", { x: 0.3, y: 0, z: 0.1 }),
    step("s2", 2, "release", "open", { x: 0.3, y: 0.3, z: 0.1 }),
  ];

  it("is silent when policy cycles match the evidence", () => {
    const events = [{ type: "grasp_candidate" }, { type: "release_candidate" }];
    expect(crossCheckCycleCount(steps, events)).toHaveLength(0);
  });

  it("warns on grip/grasp count mismatch", () => {
    const events = [
      { type: "grasp_candidate" },
      { type: "grasp_candidate" },
      { type: "release_candidate" },
    ];
    const warnings = crossCheckCycleCount(steps, events);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("2 grasp event(s)");
  });

  it("is silent when no motion evidence exists", () => {
    expect(crossCheckCycleCount(steps, undefined)).toHaveLength(0);
    expect(crossCheckCycleCount(steps, [{ type: "motion_peak" }])).toHaveLength(0);
  });
});
