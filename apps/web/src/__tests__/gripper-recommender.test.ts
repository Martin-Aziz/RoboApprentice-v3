import { describe, expect, it } from "vitest";
import { GripperRecommender } from "@/lib/gripper-recommender";
import type { GripperSpec, TaskIntent } from "@/lib/types";

const catalogue: GripperSpec[] = [
  {
    id: "vacuum-perfect",
    manufacturer: "Schmalz",
    model_name: "Perfect Vacuum",
    gripper_type: "VACUUM_SINGLE",
    max_payload_kg: 5,
    compatible_robot_models: ["UR10e"],
    suitable_materials: ["plastic"],
    suitable_surfaces: ["smooth"],
    suitable_pick_types: ["top-pick"],
    min_cycle_time_seconds: 0.3,
    max_grip_force_n: 0,
    product_url: "https://example.com/product",
    enquiry_url: "https://example.com/contact",
    image_url: "https://example.com/image.jpg",
    affiliate_tag: null,
    source: "https://example.com/datasheet.pdf",
    estimated_fields: [],
  },
  {
    id: "jaw-marginal",
    manufacturer: "Robotiq",
    model_name: "Marginal Jaw",
    gripper_type: "PARALLEL_JAW",
    max_payload_kg: 2.7,
    compatible_robot_models: ["UR10e"],
    suitable_materials: ["plastic"],
    suitable_surfaces: ["smooth"],
    suitable_pick_types: ["top-pick"],
    min_cycle_time_seconds: 0.9,
    max_grip_force_n: 100,
    product_url: "https://example.com/product-2",
    enquiry_url: "https://example.com/contact-2",
    image_url: "https://example.com/image-2.jpg",
    affiliate_tag: null,
    source: "estimated",
    estimated_fields: ["max_payload_kg"],
  },
];

function intent(patch: Partial<TaskIntent> = {}): TaskIntent {
  return {
    waypoints: [],
    confidence: "HIGH",
    robotModel: "UR10e",
    payloadKg: 2,
    partMaterial: "plastic",
    partSurface: "smooth",
    pickType: "top-pick",
    cycleTimeSeconds: 2,
    ...patch,
  };
}

describe("GripperRecommender", () => {
  it("ranks the perfect technical match first", () => {
    const recommendations = new GripperRecommender(catalogue).recommend(intent());
    expect(recommendations[0].gripper.id).toBe("vacuum-perfect");
    expect(recommendations[0].confidence).toBe("HIGH");
  });

  it("returns a marginal but qualifying payload match", () => {
    const recommendations = new GripperRecommender(catalogue).recommend(
      intent({ cycleTimeSeconds: 1 }),
    );
    expect(recommendations.some((item) => item.gripper.id === "jaw-marginal")).toBe(true);
    expect(recommendations.find((item) => item.gripper.id === "jaw-marginal")!.match_score).toBeLessThan(
      recommendations[0].match_score,
    );
  });

  it("returns no match when payload margin or robot compatibility fails", () => {
    expect(
      new GripperRecommender(catalogue).recommend(intent({ payloadKg: 10 })),
    ).toEqual([]);
    expect(
      new GripperRecommender(catalogue).recommend(intent({ robotModel: "UR5e" })),
    ).toEqual([]);
  });

  it("returns low confidence when part data is missing", () => {
    const recommendations = new GripperRecommender(catalogue).recommend(
      intent({
        partMaterial: "unknown",
        partSurface: "unknown",
        pickType: "unknown",
        cycleTimeSeconds: undefined,
      }),
    );
    expect(recommendations[0].confidence).toBe("LOW");
    expect(recommendations[0].confidence_reason).toContain("Missing");
  });
});
