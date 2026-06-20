import { randomUUID } from "crypto";
import type {
  DimensionWithTolerance,
  FixtureDesignOutput,
  FixtureMaterial,
  FixtureRequirement,
  FixtureSpecDocument,
  FixtureType,
  GripperSpec,
  PartBoundingBox,
  TaskIntent,
} from "./types";

export const FIXTURE_VERIFICATION_DISCLAIMER =
  "This fixture design is a starting point. Have a qualified person verify dimensions before production use.";

function validDimension(value: number | undefined, label: string): number {
  if (!Number.isFinite(value) || (value as number) <= 0) {
    throw new Error(`${label} must be a positive dimension in millimetres.`);
  }
  return value as number;
}

function materialFor(
  repeatabilityMm: number,
  forceN: number,
  temperatureC: number,
): FixtureMaterial {
  if (repeatabilityMm < 0.5 || forceN > 50) return "ALUMINIUM";
  if (temperatureC > 60) return "ABS_3DPRINT";
  return "PLA_3DPRINT";
}

function dimension(nominal_mm: number, tolerance_mm: number): DimensionWithTolerance {
  return { nominal_mm: Number(nominal_mm.toFixed(2)), tolerance_mm };
}

export function deriveFixtureRequirement(
  intent: TaskIntent,
  gripper?: GripperSpec,
): FixtureRequirement {
  const box = intent.partGeometry?.boundingBox;
  if (!box) throw new Error("Part bounding-box geometry is required.");
  const repeatability = intent.requiredRepeatabilityMm ?? 1;
  const force =
    intent.requiredGripForceNewtons?.max ??
    (gripper && gripper.max_grip_force_n > 0 ? gripper.max_grip_force_n : 0);
  const temperature = intent.environmentTemperatureC ?? 25;
  return {
    part_bounding_box: {
      length_mm: validDimension(box.length_mm, "Part length"),
      width_mm: validDimension(box.width_mm, "Part width"),
      height_mm: validDimension(box.height_mm, "Part height"),
    },
    required_pick_face:
      intent.pickPosition?.face && intent.pickPosition.face !== "UNKNOWN"
        ? intent.pickPosition.face
        : "TOP",
    required_repeatability_mm: repeatability,
    max_cycle_force_n: force,
    material_recommendation: materialFor(repeatability, force, temperature),
    environment_temperature_c: temperature,
  };
}

function fixtureTypeFor(intent: TaskIntent, requirement: FixtureRequirement): FixtureType {
  const shape = intent.partGeometry?.shape ?? "UNKNOWN";
  if (shape === "IRREGULAR" || shape === "UNKNOWN") return "CUSTOM";
  if (shape === "CYLINDRICAL") return "V-BLOCK";
  if (requirement.required_pick_face === "SIDE") {
    return shape === "RECTANGULAR" ? "RAIL" : "V-BLOCK";
  }
  if (requirement.required_pick_face === "TOP" && shape === "RECTANGULAR") return "NEST";
  return "CUSTOM";
}

function nestSpec(box: PartBoundingBox, tolerance: number): FixtureSpecDocument {
  const clearance = Math.max(0.25, tolerance);
  const wall = 6;
  const floor = 5;
  return {
    dimensions: {
      overall_length: dimension(box.length_mm + 2 * (clearance + wall), tolerance),
      overall_width: dimension(box.width_mm + 2 * (clearance + wall), tolerance),
      overall_height: dimension(Math.max(12, box.height_mm * 0.45 + floor), tolerance),
      pocket_length: dimension(box.length_mm + 2 * clearance, tolerance),
      pocket_width: dimension(box.width_mm + 2 * clearance, tolerance),
      pocket_depth: dimension(Math.min(box.height_mm * 0.45, box.height_mm - 1), tolerance),
      mounting_hole_diameter: dimension(6.5, 0.1),
    },
    general_tolerance_mm: tolerance,
    surface_finish_requirements: "Part-contact floor and locating walls: Ra 3.2 micrometres or smoother; remove all burrs.",
    mounting_method: "Four M6 clearance holes on the outer flange; bolt to a flat tooling plate and dowel after final alignment.",
  };
}

function vBlockSpec(box: PartBoundingBox, tolerance: number): FixtureSpecDocument {
  const diameter = Math.min(box.width_mm, box.height_mm);
  const length = box.length_mm;
  return {
    dimensions: {
      overall_length: dimension(length + 20, tolerance),
      overall_width: dimension(Math.max(diameter * 1.8, 30), tolerance),
      overall_height: dimension(Math.max(diameter * 0.9, 20), tolerance),
      vee_angle_degrees: dimension(90, 0.5),
      vee_depth: dimension(Math.max(diameter * 0.55, 8), tolerance),
      end_stop_offset: dimension(8, tolerance),
      mounting_hole_diameter: dimension(6.5, 0.1),
    },
    general_tolerance_mm: tolerance,
    surface_finish_requirements: "V contact faces: Ra 3.2 micrometres or smoother; break sharp edges to 0.5 mm maximum.",
    mounting_method: "Two slotted M6 mounting points plus one fixed dowel reference; add a removable end stop.",
  };
}

function writtenSpec(box: PartBoundingBox, tolerance: number): FixtureSpecDocument {
  return {
    dimensions: {
      part_envelope_length: dimension(box.length_mm, tolerance),
      part_envelope_width: dimension(box.width_mm, tolerance),
      part_envelope_height: dimension(box.height_mm, tolerance),
      minimum_edge_clearance: dimension(5, tolerance),
    },
    general_tolerance_mm: tolerance,
    surface_finish_requirements: "Designer to identify stable datum surfaces; all contact faces must be smooth, deburred, and non-marking for the part material.",
    mounting_method: "Designer to provide a positively located base pattern compatible with the target tooling plate.",
  };
}

export class FixtureDesigner {
  design(intent: TaskIntent, gripper?: GripperSpec): FixtureDesignOutput {
    const requirement = deriveFixtureRequirement(intent, gripper);
    const fixtureType = fixtureTypeFor(intent, requirement);
    const tolerance = Math.max(0.1, requirement.required_repeatability_mm);
    const specification =
      fixtureType === "NEST"
        ? nestSpec(requirement.part_bounding_box, tolerance)
        : fixtureType === "V-BLOCK"
          ? vBlockSpec(requirement.part_bounding_box, tolerance)
          : writtenSpec(requirement.part_bounding_box, tolerance);
    const geometryGeneratable = fixtureType === "NEST" || fixtureType === "V-BLOCK";
    const lowConfidence =
      intent.confidence === "LOW" ||
      intent.partGeometry?.shape === "UNKNOWN" ||
      intent.pickPosition?.face === "UNKNOWN";
    return {
      fixture_id: randomUUID(),
      name: `${fixtureType === "V-BLOCK" ? "V-block" : fixtureType.toLowerCase()} fixture`,
      interface_points: [],
      tolerance_mm: tolerance,
      fixture_type: fixtureType,
      material_recommendation: requirement.material_recommendation,
      specification,
      geometry_file: geometryGeneratable ? "pending-generation" : null,
      manufacturing_notes:
        requirement.material_recommendation.endsWith("3DPRINT")
          ? "Print with 30% infill minimum and four perimeter walls. Sand the contact surface smooth before use. Verify the first part against the stated tolerance."
          : "Machine contact surfaces in one setup where possible. Deburr, clean, and inspect all locating dimensions before use.",
      confidence: lowConfidence ? "LOW" : geometryGeneratable ? "HIGH" : "MEDIUM",
      human_review_required: fixtureType === "CUSTOM" || fixtureType === "RAIL" || lowConfidence,
      disclaimer: FIXTURE_VERIFICATION_DISCLAIMER,
      notes: geometryGeneratable
        ? "Parametric geometry is eligible for manifold STL generation."
        : "Written fabrication brief only; geometry requires human design.",
    };
  }
}
