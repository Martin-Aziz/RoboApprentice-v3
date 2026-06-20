import { describe, expect, it } from "vitest";
import {
  identifyTaskHazards,
  RiskAssessmentGenerator,
} from "@/lib/risk-assessment-generator";
import type { TaskProgram } from "@/lib/types";

function program(patch: Partial<TaskProgram> = {}): TaskProgram {
  return {
    taskId: "task-1",
    taskName: "Load inspection fixture",
    taskSummary: "Pick a component and place it in the inspection fixture.",
    robotModel: "UR5e",
    taskCategory: "pick-place",
    waypoints: [{ x: 0.2, y: 0.1, z: 0.2, tcpSpeedMetersPerSecond: 0.2 }],
    gripperType: "electric parallel",
    gripperForceNewtons: 100,
    workcellDimensions: { x: 1.5, y: 1.2, z: 1.8 },
    operatorProximityMillimeters: 800,
    siteName: "Plant 1",
    ...patch,
  };
}

describe("RiskAssessmentGenerator hazard rules", () => {
  it("flags speed above 250 mm/s", () => {
    const hazards = identifyTaskHazards(program({
      waypoints: [{ x: 0, y: 0, z: 0.2, tcpSpeedMetersPerSecond: 0.251 }],
    }));
    expect(hazards.some((hazard) => hazard.type === "speed")).toBe(true);
  });

  it("flags gripper force above 140 N", () => {
    const hazards = identifyTaskHazards(program({ gripperForceNewtons: 141 }));
    expect(hazards.some((hazard) => hazard.type === "force")).toBe(true);
  });

  it("flags operator proximity below 500 mm", () => {
    const hazards = identifyTaskHazards(program({ operatorProximityMillimeters: 499 }));
    expect(hazards.some((hazard) => hazard.type === "proximity")).toBe(true);
  });

  it("flags machine-tending entanglement", () => {
    const hazards = identifyTaskHazards(program({ taskCategory: "machine-tend" }));
    expect(hazards.some((hazard) => hazard.type === "machine-tend")).toBe(true);
  });

  it("always includes unexpected movement and dropped payload", () => {
    const hazards = identifyTaskHazards(program());
    expect(hazards.map((hazard) => hazard.type)).toEqual(
      expect.arrayContaining(["unexpected-movement", "dropped-payload"]),
    );
  });

  it("marks risk estimation and sign-off for human review", () => {
    const draft = new RiskAssessmentGenerator().generate(program());
    expect(draft.sections.find((item) => item.section_number === "3")?.requires_human_review).toBe(true);
    expect(draft.sections.find((item) => item.section_number === "6")?.auto_populated_content).toContain("does not constitute a certified risk assessment");
  });
});
