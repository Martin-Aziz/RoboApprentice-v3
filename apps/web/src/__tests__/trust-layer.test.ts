import { describe, expect, it } from "vitest";
import {
  buildTrustChecklist,
  evaluateDeploymentGate,
  readinessScore,
} from "@/lib/trust-layer";
import type { Task } from "@/lib/types";

function task(patch: Partial<Task> = {}): Task {
  return {
    id: "task-1",
    facility_id: "facility-1",
    title: "Load CNC",
    videoUrl: "video.mp4",
    status: "done",
    steps: [{
      id: "step-1",
      order: 1,
      description: "Move to part",
      action: "move",
      target: { x: 0.2, y: 0.1, z: 0.3 },
      gripper: "unchanged",
      speed: 0.2,
      duration: 2,
    }],
    policy: {
      steps: [],
      toolFrame: "tcp_default",
      estimatedCycleSeconds: 2,
    },
    robotModel: "UR5e",
    createdAt: "2026-06-22T00:00:00Z",
    updatedAt: "2026-06-22T00:00:00Z",
    ...patch,
  };
}

describe("deployment trust layer", () => {
  it("makes readiness an explainable weighted checklist", () => {
    const checklist = buildTrustChecklist(task());
    expect(readinessScore(checklist)).toBe(30);
    expect(checklist.filter((item) => item.source === "system").every((item) => item.status === "passed")).toBe(true);
  });

  it("blocks when a system requirement fails", () => {
    const checklist = buildTrustChecklist(task({ policy: undefined }));
    const gate = evaluateDeploymentGate(checklist, { status: "pending" });
    expect(gate.status).toBe("blocked");
    expect(gate.reason).toContain("Motion policy validated");
  });

  it("requires qualified approval even after every check passes", () => {
    const checklist = buildTrustChecklist(task()).map((item) => ({ ...item, status: "passed" as const }));
    expect(evaluateDeploymentGate(checklist, { status: "pending" }).status).toBe("review-required");
    expect(evaluateDeploymentGate(checklist, { status: "approved" }).status).toBe("approved");
  });
});
