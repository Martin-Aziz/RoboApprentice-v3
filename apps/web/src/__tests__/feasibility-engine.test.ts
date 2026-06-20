import { describe, expect, it } from "vitest";
import { FeasibilityEngine } from "@/lib/feasibility-engine";
import type { SimulationRequest } from "@/lib/types";

const engine = new FeasibilityEngine();

function request(overrides: Partial<SimulationRequest> = {}): SimulationRequest {
  return {
    task_intent: {
      waypoints: [
        { x: 0.35, y: -0.1, z: 0.15 },
        { x: 0.2, y: 0.2, z: 0.25 },
      ],
      approximateSpeeds: [0.2, 0.2],
      operationDelaysSeconds: 2,
      confidence: "HIGH",
    },
    robot_model: "UR5e",
    payload_kg: 2,
    ...overrides,
  };
}

describe("FeasibilityEngine", () => {
  it("returns a conservative feasible estimate and 85% uptime throughput", () => {
    const result = engine.simulate(request());

    expect(result.verdict).toBe("FEASIBLE");
    expect(result.blocking_reason).toBeNull();
    expect(result.estimated_cycle_time_seconds).toBeGreaterThan(0);
    expect(result.estimated_throughput_per_hour).toBe(
      Math.floor((3600 / result.estimated_cycle_time_seconds) * 0.85),
    );
  });

  it("marks a task marginal near the selected robot's reach limit", () => {
    const result = engine.simulate(
      request({
        task_intent: {
          waypoints: [{ x: 0.78, y: 0, z: 0 }],
          confidence: "HIGH",
        },
      }),
    );

    expect(result.verdict).toBe("MARGINAL");
    expect(result.guidance).toContain("reach limit");
    expect(result.recommended_robot).not.toBeNull();
  });

  it("rejects a payload above the robot rating", () => {
    const result = engine.simulate(request({ payload_kg: 6 }));

    expect(result.verdict).toBe("NOT_FEASIBLE");
    expect(result.blocking_reason).toContain("rated for 5 kg");
    expect(result.guidance).toContain("higher payload");
  });

  it("preserves low task-intent confidence in the result", () => {
    const result = engine.simulate(
      request({
        task_intent: {
          waypoints: [{ x: 0.3, y: 0, z: 0.2 }],
          confidence: "LOW",
        },
      }),
    );

    expect(result.confidence).toBe("LOW");
    expect(result.verdict).toBe("FEASIBLE");
  });
});
