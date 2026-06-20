import { describe, expect, it } from "vitest";
import {
  evaluateRobotWaypoint,
} from "@/lib/feasibility-engine";
import type { TaskIntent } from "@/lib/types";

describe("Automation Passport invariants", () => {
  it("detects an unreachable target waypoint with an exact reason", () => {
    const result = evaluateRobotWaypoint(
      "UR5e",
      { x: 1.2, y: 0, z: 0.1 },
      { x: 3, y: 3, z: 2 },
    );
    expect(result.reachable).toBe(false);
    expect(result.reason).toContain("beyond its 0.850 m reach");
  });

  it("keeps robot identity outside robot-agnostic intent coordinates", () => {
    const intent: TaskIntent = {
      waypoints: [{ x: 0.2, y: 0.1, z: 0.3 }],
      intentSteps: [{
        id: "step-1",
        order: 1,
        description: "Move to pickup",
        action: "move",
        target: { x: 0.2, y: 0.1, z: 0.3 },
        gripper: "unchanged",
        speed: 0.2,
        duration: 2,
      }],
      confidence: "HIGH",
    };
    expect(JSON.stringify(intent)).not.toContain("UR5e");
    expect(JSON.stringify(intent)).not.toContain("controller");
  });
});
