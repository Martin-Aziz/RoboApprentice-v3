import { describe, expect, it } from "vitest";
import type { TaskPolicy, TaskStep, Waypoint } from "@/lib/types";
import { processPolicyPipeline } from "@/lib/policy-pipeline";

function target(x: number, y: number, z: number): Waypoint {
  return { x, y, z, rz: 0 };
}

function step(partial: Partial<TaskStep> & Pick<TaskStep, "action" | "target">): TaskStep {
  return {
    id: partial.id ?? crypto.randomUUID(),
    order: partial.order ?? 1,
    description: partial.description ?? `${partial.action} step`,
    gripper: partial.gripper ?? "unchanged",
    speed: partial.speed ?? 0.2,
    duration: partial.duration ?? 2,
    requiresVision: partial.requiresVision ?? false,
    ...partial,
  };
}

describe("policy pipeline", () => {
  it("adds terminal home poses and safe contact clearances", () => {
    const raw: TaskPolicy = {
      toolFrame: "tcp_default",
      estimatedCycleSeconds: 8,
      steps: [
        step({
          order: 1,
          action: "move",
          target: target(0.35, 0.1, 0.25),
        }),
        step({
          order: 2,
          action: "grip",
          target: target(0.35, 0.1, 0.08),
          gripper: "closed",
          speed: 0.3,
        }),
        step({
          order: 3,
          action: "release",
          target: target(0.1, -0.2, 0.08),
          gripper: "open",
          speed: 0.25,
        }),
      ],
    };

    const { policy, errors } = processPolicyPipeline(raw);

    expect(errors).toEqual([]);
    expect(policy.steps[0].action).toBe("home");
    expect(policy.steps.at(-1)?.action).toBe("home");
    expect(policy.steps[0].gripper).toBe("open");
    expect(policy.steps.at(-1)?.gripper).toBe("open");
    expect(policy.steps.some((s) => s.description.includes("Approach for grip"))).toBe(true);
    expect(policy.steps.some((s) => s.description.includes("Approach for release"))).toBe(true);
    expect(policy.steps.some((s) => s.description.includes("Lift clear after grip"))).toBe(true);
    expect(
      policy.steps
        .filter((s) => s.action === "grip" || s.action === "release")
        .every((s) => s.speed <= 0.1),
    ).toBe(true);
    expect(policy.estimatedCycleSeconds).toBeGreaterThan(raw.estimatedCycleSeconds);
    expect(policy.workspaceBounds?.zMin).toBeCloseTo(0.08);
  });

  it("normalizes existing terminal home poses to an open gripper", () => {
    const raw: TaskPolicy = {
      toolFrame: "tcp_default",
      estimatedCycleSeconds: 4,
      steps: [
        step({
          order: 1,
          action: "home",
          target: target(0, 0, 0.6),
          gripper: "unchanged",
        }),
        step({
          order: 2,
          action: "home",
          target: target(0, 0, 0.6),
          description: "Return to home position",
          gripper: "unchanged",
        }),
      ],
    };

    const { policy } = processPolicyPipeline(raw);

    expect(policy.steps[0].gripper).toBe("open");
    expect(policy.steps.at(-1)?.gripper).toBe("open");
    expect(policy.steps.at(-1)?.description).toContain("gripper open");
  });
});
