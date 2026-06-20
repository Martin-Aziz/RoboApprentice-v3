import type {
  RiskAssessmentDraft,
  RiskSection,
  TaskProgram,
} from "./types";

/**
 * Product screening thresholds requested for the ISO/TS 15066-oriented draft.
 * These are configurable triggers, not universal certification limits. A
 * qualified safety professional must verify the applicable limits and current
 * standards for the real application.
 */
export const ISO_TS_15066_SPEED_REVIEW_THRESHOLD_MPS = 0.25;
export const ISO_TS_15066_FORCE_REVIEW_THRESHOLD_N = 140;
export const OPERATOR_PROXIMITY_REVIEW_THRESHOLD_MM = 500;

export const RISK_ASSESSMENT_DISCLAIMER =
  "This document was auto-drafted by Aurevix as a starting point. It must be reviewed, completed, and signed by a qualified person before the robot is operated. It does not constitute a certified risk assessment.";

export type HazardType =
  | "speed"
  | "force"
  | "proximity"
  | "machine-tend"
  | "unexpected-movement"
  | "dropped-payload";

interface Hazard {
  type: HazardType;
  label: string;
  evidence: string;
  severity: "S1" | "S2" | "S3";
}

function section(
  section_number: string,
  title: string,
  auto_populated_content: string,
  requires_human_review: boolean,
  review_prompt: string,
): RiskSection {
  return {
    section_number,
    title,
    auto_populated_content,
    requires_human_review,
    review_prompt,
  };
}

export function identifyTaskHazards(program: TaskProgram): Hazard[] {
  const hazards: Hazard[] = [];
  const maxSpeed = Math.max(
    ...program.waypoints.map((waypoint) => waypoint.tcpSpeedMetersPerSecond),
    0,
  );

  if (maxSpeed > ISO_TS_15066_SPEED_REVIEW_THRESHOLD_MPS) {
    hazards.push({
      type: "speed",
      label: "Speed-related contact hazard",
      evidence: `Maximum programmed TCP speed is ${(maxSpeed * 1000).toFixed(0)} mm/s.`,
      severity: maxSpeed > 0.5 ? "S3" : "S2",
    });
  }
  if (
    program.gripperForceNewtons !== undefined &&
    program.gripperForceNewtons > ISO_TS_15066_FORCE_REVIEW_THRESHOLD_N
  ) {
    hazards.push({
      type: "force",
      label: "Clamping/crushing hazard at end-effector",
      evidence: `Configured gripper force is ${program.gripperForceNewtons.toFixed(0)} N.`,
      severity: program.gripperForceNewtons > 200 ? "S3" : "S2",
    });
  }
  if (
    program.operatorProximityMillimeters !== undefined &&
    program.operatorProximityMillimeters < OPERATOR_PROXIMITY_REVIEW_THRESHOLD_MM
  ) {
    hazards.push({
      type: "proximity",
      label: "Close-proximity contact hazard",
      evidence: `The nearest configured operator zone is ${program.operatorProximityMillimeters.toFixed(0)} mm from the motion path.`,
      severity: "S2",
    });
  }
  if (program.taskCategory === "machine-tend") {
    hazards.push({
      type: "machine-tend",
      label: "Entanglement hazard near machine spindle",
      evidence: "The deployed task is categorised as machine tending.",
      severity: "S3",
    });
  }

  hazards.push(
    {
      type: "unexpected-movement",
      label: "Unexpected robot movement hazard",
      evidence: "Applicable to all programmed robot motion.",
      severity: "S2",
    },
    {
      type: "dropped-payload",
      label: "Dropped payload hazard",
      evidence: `The task uses a ${program.gripperType || "configured"} end-effector to handle a payload.`,
      severity: "S2",
    },
  );
  return hazards;
}

function riskReductionFor(hazard: Hazard): string {
  switch (hazard.type) {
    case "speed":
      return "Implement speed and separation monitoring per ISO/TS 15066 Table 1.";
    case "force":
      return "Verify contact force limits per ISO/TS 15066 Annex A.";
    case "proximity":
      return "Define and mark collaborative workspace boundary.";
    case "machine-tend":
      return "Ensure machine interlocks prevent spindle movement during robot access.";
    case "unexpected-movement":
      return "Validate protective stops, restart behaviour, and controlled recovery procedures.";
    case "dropped-payload":
      return "Verify end-effector retention, payload rating, and a safe exclusion area beneath the load.";
  }
}

export class RiskAssessmentGenerator {
  generate(program: TaskProgram): RiskAssessmentDraft {
    if (!program.taskId || !program.taskName) {
      throw new Error("Task ID and task name are required.");
    }
    if (!program.waypoints.length) {
      throw new Error("Motion waypoint data is required to draft the assessment.");
    }

    const hazards = identifyTaskHazards(program);
    const dimensions = program.workcellDimensions
      ? `${program.workcellDimensions.x} m x ${program.workcellDimensions.y} m x ${program.workcellDimensions.z} m`
      : "[Workcell dimensions require human review]";
    const hazardContent = hazards
      .map((hazard) => `${hazard.label}: ${hazard.evidence}`)
      .join("\n");
    const riskContent = hazards
      .map(
        (hazard, index) =>
          `${index + 1}. ${hazard.label}\nSeverity: ${hazard.severity} (automated preliminary label based on available speed/force/task data)\nProbability: [REQUIRES HUMAN REVIEW]\nDetectability: [REQUIRES HUMAN REVIEW]\nRisk level: ____________________`,
      )
      .join("\n\n");

    const sections: RiskSection[] = [
      section(
        "1",
        "Task Description",
        `Task: ${program.taskName}\nCategory: ${program.taskCategory}\nRobot model: ${program.robotModel}\nWorkcell dimensions: ${dimensions}\nSummary: ${program.taskSummary || "[Task summary requires human review]"}`,
        !program.taskSummary || !program.workcellDimensions,
        "Confirm the task boundary, intended use, foreseeable misuse, workcell dimensions, and operating environment.",
      ),
      section(
        "2",
        "Hazard Identification",
        hazardContent,
        true,
        "Confirm each detected hazard against the real workcell and add only hazards observed during the on-site assessment.",
      ),
      section(
        "3",
        "Risk Estimation",
        riskContent,
        true,
        "For every hazard, determine probability, detectability, and the final risk level using your organisation's approved EN ISO 12100 method.",
      ),
      section(
        "4",
        "Risk Reduction Measures",
        hazards.map((hazard) => `${hazard.label}: ${riskReductionFor(hazard)}`).join("\n"),
        true,
        "Verify that each proposed control is suitable, implemented, validated, and documented for the actual installation.",
      ),
      section(
        "5",
        "Residual Risk Statement",
        "After risk reduction measures are implemented and validated, document any remaining hazards, required warnings, training, personal protective equipment, and operating restrictions.\n\nResidual risks accepted: ____________________\nConditions of acceptance: ____________________",
        true,
        "A qualified person must confirm that residual risks are acceptable before operation.",
      ),
      section(
        "6",
        "Approval and Sign-Off",
        `${RISK_ASSESSMENT_DISCLAIMER}\n\nTask: ${program.taskName}\nDate: ${new Date().toISOString().slice(0, 10)}\nRobot model: ${program.robotModel}\nSite: ${program.siteName || "[Site name required]"}\n\nReviewer name: ____________________\nRole / qualification: ____________________\nSignature: ____________________\nDate: ____________________`,
        true,
        "A qualified person must complete all blank fields, confirm the assessment covers the installed system, and sign before operation.",
      ),
    ];

    return {
      task_id: program.taskId,
      generated_at: new Date().toISOString(),
      robot_model: program.robotModel,
      task_category: program.taskCategory,
      sections,
    };
  }
}
