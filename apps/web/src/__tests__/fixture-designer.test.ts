import { describe, expect, it } from "vitest";
import {
  deriveFixtureRequirement,
  FixtureDesigner,
} from "@/lib/fixture-designer";
import type { PartShape, RequiredPickFace, TaskIntent } from "@/lib/types";

function intent(shape: PartShape, face: RequiredPickFace): TaskIntent {
  return {
    waypoints: [],
    confidence: "HIGH",
    partGeometry: {
      shape,
      boundingBox: { length_mm: 100, width_mm: 60, height_mm: 25 },
    },
    pickPosition: {
      face,
      offsetMm: { x: 0, y: 0, z: 0 },
    },
    requiredRepeatabilityMm: 0.8,
    environmentTemperatureC: 25,
    requiredGripForceNewtons: { min: 10, max: 40 },
  };
}

describe("FixtureDesigner", () => {
  it("selects a NEST for a rectangular top-pick part", () => {
    const design = new FixtureDesigner().design(intent("RECTANGULAR", "TOP"));
    expect(design.fixture_type).toBe("NEST");
    expect(design.geometry_file).toBe("pending-generation");
    expect(design.specification?.dimensions.pocket_length.tolerance_mm).toBeGreaterThan(0);
  });

  it("selects a V-BLOCK for a cylindrical part", () => {
    expect(new FixtureDesigner().design(intent("CYLINDRICAL", "TOP")).fixture_type).toBe("V-BLOCK");
  });

  it("selects a RAIL written specification for rectangular side-pick", () => {
    const design = new FixtureDesigner().design(intent("RECTANGULAR", "SIDE"));
    expect(design.fixture_type).toBe("RAIL");
    expect(design.geometry_file).toBeNull();
    expect(design.human_review_required).toBe(true);
  });

  it("selects CUSTOM and requires review for irregular geometry", () => {
    const design = new FixtureDesigner().design(intent("IRREGULAR", "TOP"));
    expect(design.fixture_type).toBe("CUSTOM");
    expect(design.geometry_file).toBeNull();
    expect(design.human_review_required).toBe(true);
  });

  it("selects aluminium for tight tolerance or high force", () => {
    const tight = intent("RECTANGULAR", "TOP");
    tight.requiredRepeatabilityMm = 0.4;
    expect(deriveFixtureRequirement(tight).material_recommendation).toBe("ALUMINIUM");

    const force = intent("RECTANGULAR", "TOP");
    force.requiredGripForceNewtons = { min: 10, max: 51 };
    expect(deriveFixtureRequirement(force).material_recommendation).toBe("ALUMINIUM");
  });

  it("selects ABS above 60 C and PLA otherwise", () => {
    const hot = intent("RECTANGULAR", "TOP");
    hot.environmentTemperatureC = 61;
    expect(deriveFixtureRequirement(hot).material_recommendation).toBe("ABS_3DPRINT");
    expect(deriveFixtureRequirement(intent("RECTANGULAR", "TOP")).material_recommendation).toBe("PLA_3DPRINT");
  });
});
