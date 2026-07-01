import { describe, expect, it } from "vitest";
import {
  MAX_SCENE_OBJECTS,
  classifyDestination,
  classifyWorkpiece,
  deriveSceneFromSteps,
  extractColorWord,
  extractFirstJsonArray,
  extractSceneJson,
  findCarryPairs,
  normalizeSceneObject,
  resolveSceneForPolicy,
  sceneObjectForStep,
  validateWorkcellScene,
  DESTINATION_ROLES,
  WORKPIECE_ROLES,
} from "@/lib/scene-model";
import type { TaskStep, WorkcellScene } from "@/lib/types";

function makeStep(partial: Partial<TaskStep> & { id: string; order: number }): TaskStep {
  return {
    description: "Move",
    action: "move",
    target: { x: 0.3, y: 0, z: 0.2 },
    gripper: "unchanged",
    speed: 0.2,
    duration: 2,
    ...partial,
  };
}

const PICK_PLACE_STEPS: TaskStep[] = [
  makeStep({ id: "s1", order: 1, description: "Move to home", action: "home", gripper: "open" }),
  makeStep({ id: "s2", order: 2, description: "Grip gray bracket at bin", action: "grip", gripper: "closed", target: { x: 0.4, y: -0.2, z: 0.1 } }),
  makeStep({ id: "s3", order: 3, description: "Carry to blue tote", action: "move" }),
  makeStep({ id: "s4", order: 4, description: "Release bracket into blue tote", action: "release", gripper: "open", target: { x: 0.1, y: 0.25, z: 0.12 } }),
  makeStep({ id: "s5", order: 5, description: "Inspect part surface with camera", action: "inspect", target: { x: 0.3, y: 0.05, z: 0.2 } }),
  makeStep({ id: "s6", order: 6, description: "Return home", action: "home", gripper: "open" }),
];

describe("balanced JSON extraction", () => {
  it("extracts the steps array without swallowing a trailing scene object", () => {
    const text = `[{"order":1,"description":"a"},{"order":2,"description":"b"}]
{"scene": {"objects": [{"id":"o1","role":"container","category":"tote","label":"tote","related_step_orders":[2]}], "confidence": 0.8, "warnings": []}}`;
    const arrayText = extractFirstJsonArray(text);
    expect(arrayText).not.toBeNull();
    const parsed = JSON.parse(arrayText!) as Array<{ order: number }>;
    expect(parsed).toHaveLength(2);
    expect(parsed[1].order).toBe(2);
  });

  it("parses the trailing scene object", () => {
    const text = `[{"order":1,"description":"a [test]"}]
{"scene": {"objects": [{"id":"o1","role":"container","category":"tote","label":"gray tote"}], "confidence": 0.7, "warnings": ["glare"]}}`;
    const scene = extractSceneJson(text);
    expect(scene).not.toBeNull();
    expect(Array.isArray(scene!.objects)).toBe(true);
    expect(scene!.confidence).toBe(0.7);
  });

  it("returns null when no scene object is present", () => {
    expect(extractSceneJson(`[{"order":1,"description":"a"}]`)).toBeNull();
  });

  it("survives brackets inside strings", () => {
    const text = `[{"order":1,"description":"place into slot ] with care"}]`;
    const parsed = JSON.parse(extractFirstJsonArray(text)!) as unknown[];
    expect(parsed).toHaveLength(1);
  });
});

describe("scene validation", () => {
  it("normalizes a raw object: clamps size, maps step orders to ids", () => {
    const obj = normalizeSceneObject(
      {
        id: "tote-1",
        role: "container",
        category: "tote",
        label: "gray tote",
        color_hint: "gray",
        material_hint: "plastic",
        size_hint: { x: 5, y: 0.3, z: 0.0001 },
        pose_hint: { x: 99, y: 0.2, z: -3 },
        related_step_orders: [4, 99],
        confidence: 2,
      },
      0,
      PICK_PLACE_STEPS,
    );
    expect(obj).not.toBeNull();
    expect(obj!.sizeHint).toEqual({ x: 0.6, y: 0.3, z: 0.005 });
    expect(obj!.poseHint).toEqual({ x: 1.2, y: 0.2, z: 0, yaw: undefined });
    expect(obj!.relatedStepIds).toEqual(["s4"]);
    expect(obj!.confidence).toBe(1);
  });

  it("whitelists role/category and labels unknown objects", () => {
    const obj = normalizeSceneObject({ role: "spaceship", category: "warp_core" }, 2, []);
    expect(obj!.role).toBe("unknown");
    expect(obj!.category).toBe("unknown");
    expect(obj!.label).toContain("object");
  });

  it("caps the object count and records a warning", () => {
    const raw = {
      objects: Array.from({ length: 20 }, (_, i) => ({ id: `o${i}`, role: "fixture", category: "fixture", label: `f${i}` })),
      confidence: 0.9,
    };
    const scene = validateWorkcellScene(raw, []);
    expect(scene!.objects).toHaveLength(MAX_SCENE_OBJECTS);
    expect(scene!.warnings.some((w) => w.includes("truncated"))).toBe(true);
  });

  it("warns on low overall confidence", () => {
    const raw = { objects: [{ id: "o1", role: "fixture", category: "fixture", label: "f" }], confidence: 0.1 };
    const scene = validateWorkcellScene(raw, []);
    expect(scene!.warnings.some((w) => w.toLowerCase().includes("low scene confidence"))).toBe(true);
  });

  it("returns null for empty or malformed scenes", () => {
    expect(validateWorkcellScene(null, [])).toBeNull();
    expect(validateWorkcellScene({ objects: [] }, [])).toBeNull();
    expect(validateWorkcellScene({ objects: "nope" } as never, [])).toBeNull();
  });
});

describe("carry pairs", () => {
  it("pairs grip-close with the next release-open", () => {
    expect(findCarryPairs(PICK_PLACE_STEPS)).toEqual([{ pickIndex: 1, placeIndex: 3 }]);
  });

  it("handles multiple sequential cycles", () => {
    const steps = [
      makeStep({ id: "a", order: 1, gripper: "closed" }),
      makeStep({ id: "b", order: 2, gripper: "open" }),
      makeStep({ id: "c", order: 3, gripper: "closed" }),
      makeStep({ id: "d", order: 4, gripper: "open" }),
    ];
    expect(findCarryPairs(steps)).toHaveLength(2);
  });
});

describe("text classifiers", () => {
  it("classifies destinations with container > inspection > fixture precedence", () => {
    expect(classifyDestination("place into gray tote").category).toBe("tote");
    expect(classifyDestination("drop in the parts bin").category).toBe("bin");
    expect(classifyDestination("set on inspection surface for camera check").category).toBe("surface");
    expect(classifyDestination("seat into fixture cradle").category).toBe("fixture");
    expect(classifyDestination("place at final assembly station").category).toBe("station");
    expect(classifyDestination("put it down").category).toBe("fixture");
  });

  it("classifies workpieces from pick text", () => {
    expect(classifyWorkpiece("grip aluminum bracket").category).toBe("bracket");
    expect(classifyWorkpiece("grip steel shaft").category).toBe("cylinder");
    expect(classifyWorkpiece("pick up cardboard box").category).toBe("box");
    expect(classifyWorkpiece("grip the workpiece").category).toBe("machined_part");
  });

  it("extracts color words", () => {
    expect(extractColorWord("Release bracket into blue tote")).toBe("blue");
    expect(extractColorWord("no color here")).toBeUndefined();
  });
});

describe("deriveSceneFromSteps", () => {
  it("derives workpiece, destination, and inspection surface from step text", () => {
    const scene = deriveSceneFromSteps(PICK_PLACE_STEPS);
    const roles = scene.objects.map((o) => o.role);
    expect(roles).toContain("workpiece");
    expect(roles).toContain("container");
    expect(roles).toContain("inspection_surface");
    expect(scene.source).toBe("derived");
    expect(scene.warnings.length).toBeGreaterThan(0);

    const tote = scene.objects.find((o) => o.category === "tote");
    expect(tote?.colorHint).toBe("blue");
    expect(tote?.relatedStepIds).toContain("s4");
    expect(tote?.poseHint?.x).toBeCloseTo(0.1);
  });

  it("returns an empty scene with a warning for stepless policies", () => {
    const scene = deriveSceneFromSteps([]);
    expect(scene.objects).toHaveLength(0);
    expect(scene.confidence).toBe(0);
    expect(scene.warnings.length).toBeGreaterThan(0);
  });
});

describe("resolveSceneForPolicy / sceneObjectForStep", () => {
  const videoScene: WorkcellScene = {
    objects: [
      { id: "wp", role: "workpiece", category: "bracket", label: "bracket", relatedStepIds: ["s2"], confidence: 0.8 },
      { id: "dst", role: "container", category: "tote", label: "tote", relatedStepIds: ["s4"], confidence: 0.8 },
      { id: "far", role: "fixture", category: "fixture", label: "far fixture", relatedStepIds: [], poseHint: { x: -0.5, y: -0.5, z: 0 }, confidence: 0.6 },
    ],
    confidence: 0.8,
    warnings: [],
    source: "video",
  };

  it("prefers the attached video scene, falls back to derivation", () => {
    expect(resolveSceneForPolicy({ steps: PICK_PLACE_STEPS, scene: videoScene }).source).toBe("video");
    expect(resolveSceneForPolicy({ steps: PICK_PLACE_STEPS }).source).toBe("derived");
  });

  it("matches objects by relatedStepIds first", () => {
    expect(sceneObjectForStep(videoScene, PICK_PLACE_STEPS[1], WORKPIECE_ROLES)?.id).toBe("wp");
    expect(sceneObjectForStep(videoScene, PICK_PLACE_STEPS[3], DESTINATION_ROLES)?.id).toBe("dst");
  });

  it("matches by pose proximity when no step link exists", () => {
    const step = makeStep({ id: "sx", order: 9, target: { x: -0.48, y: -0.52, z: 0.1 } });
    const claimed = new Set<string>(["dst"]);
    expect(sceneObjectForStep(videoScene, step, DESTINATION_ROLES, claimed)?.id).toBe("far");
  });

  it("skips claimed objects", () => {
    const claimed = new Set<string>(["wp"]);
    expect(sceneObjectForStep(videoScene, PICK_PLACE_STEPS[1], WORKPIECE_ROLES, claimed)).toBeUndefined();
  });
});
