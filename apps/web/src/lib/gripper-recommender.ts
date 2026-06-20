import catalogueData from "@/data/gripper-catalogue.json";
import type {
  GripperRecommendation,
  GripperSpec,
  PartMaterial,
  PartSurface,
  PickType,
  TaskIntent,
} from "./types";

export const AFFILIATE_DISCLOSURE =
  "Aurevix may earn a referral fee from some of these links. Recommendations are based solely on technical fit for your task.";

export const PAYLOAD_SAFETY_FACTOR = 1.3;

/**
 * Neutral initial values. Admin tooling may change these when objective field
 * reliability evidence exists; affiliate status must never affect this map.
 */
export const MANUFACTURER_RELIABILITY_SCORES: Record<string, number> = {
  Schmalz: 0.9,
  OnRobot: 0.9,
  Robotiq: 0.9,
  "Zimmer Group": 0.9,
};

export const GRIPPER_CATALOGUE = catalogueData as GripperSpec[];

function known<T extends string>(value: T | undefined): value is Exclude<T, "unknown"> {
  return Boolean(value && value !== "unknown");
}

function gripperLabel(type: GripperSpec["gripper_type"]): string {
  return {
    PARALLEL_JAW: "two-finger electric gripper",
    THREE_FINGER: "self-centering three-finger gripper",
    VACUUM_SINGLE: "single-cup vacuum gripper",
    VACUUM_MULTI: "multi-cup vacuum gripper",
    MAGNETIC: "magnetic gripper",
    SOFT_FINGER: "soft-finger gripper",
  }[type];
}

function confidenceFor(intent: TaskIntent): {
  confidence: GripperRecommendation["confidence"];
  reason: string;
} {
  const missing: string[] = [];
  if (!known(intent.partMaterial)) missing.push("part material");
  if (!known(intent.partSurface)) missing.push("surface texture");
  if (!known(intent.pickType)) missing.push("pick direction");
  if (intent.payloadKg === undefined) missing.push("part weight");
  if (!intent.cycleTimeSeconds) missing.push("target cycle time");

  if (missing.length === 0) {
    return { confidence: "HIGH", reason: "Part, pick, payload, and cycle data were all available." };
  }
  if (missing.length <= 2) {
    return {
      confidence: "MEDIUM",
      reason: `The ${missing.join(" and ")} ${missing.length === 1 ? "was" : "were"} not available.`,
    };
  }
  return {
    confidence: "LOW",
    reason: `Missing ${missing.join(", ")}. Add these details to improve the match.`,
  };
}

function scoreCandidate(gripper: GripperSpec, intent: TaskIntent): number {
  const requiredPayload = Math.max(0, intent.payloadKg ?? 0) * PAYLOAD_SAFETY_FACTOR;
  const payloadScore =
    requiredPayload === 0
      ? 0.55
      : Math.min(1, Math.max(0, (gripper.max_payload_kg - requiredPayload) / Math.max(requiredPayload, 1)));
  const cycleScore =
    intent.cycleTimeSeconds && intent.cycleTimeSeconds > 0
      ? Math.min(1, intent.cycleTimeSeconds / Math.max(gripper.min_cycle_time_seconds, 0.01))
      : 0.6;

  const knownFitFields = [
    known(intent.partMaterial),
    known(intent.partSurface),
    known(intent.pickType),
  ];
  const materialScore =
    knownFitFields.filter(Boolean).length === 0
      ? 0.55
      : knownFitFields.every(Boolean)
        ? 1
        : 0.75;

  const forceScore =
    intent.requiredGripForceNewtons && gripper.max_grip_force_n > 0
      ? Math.min(1, gripper.max_grip_force_n / intent.requiredGripForceNewtons.max)
      : 0.7;
  const reliability = MANUFACTURER_RELIABILITY_SCORES[gripper.manufacturer] ?? 0.8;

  return Number(
    (
      payloadScore * 0.3 +
      cycleScore * 0.25 +
      materialScore * 0.25 +
      forceScore * 0.1 +
      reliability * 0.1
    ).toFixed(3),
  );
}

function reasonFor(gripper: GripperSpec, intent: TaskIntent): string {
  const pieces = [
    `This ${gripperLabel(gripper.gripper_type)} has enough rated payload capacity with Aurevix's 30% handling margin`,
  ];
  if (known(intent.partSurface) && known(intent.partMaterial)) {
    pieces.push(`and suits your ${intent.partSurface}-surface ${intent.partMaterial} part`);
  } else if (known(intent.partMaterial)) {
    pieces.push(`and suits your ${intent.partMaterial} part`);
  }
  if (intent.robotModel) pieces.push(`It is listed for integration with your ${intent.robotModel}`);
  if (intent.cycleTimeSeconds) pieces.push(`and its published or estimated actuation time fits your ${intent.cycleTimeSeconds}-second cycle target`);
  return `${pieces[0]}${pieces[1] ? ` ${pieces[1]}` : ""}. ${pieces.slice(2).join(" ")}.`
    .replace("..", ".")
    .trim();
}

export class GripperRecommender {
  constructor(private readonly catalogue: GripperSpec[] = GRIPPER_CATALOGUE) {}

  recommend(intent: TaskIntent): GripperRecommendation[] {
    if (!intent.robotModel) return [];
    const requiredPayload = Math.max(0, intent.payloadKg ?? 0) * PAYLOAD_SAFETY_FACTOR;

    const candidates = this.catalogue.filter((gripper) => {
      if (!gripper.compatible_robot_models.includes(intent.robotModel as string)) return false;
      if (gripper.max_payload_kg < requiredPayload) return false;
      if (
        known(intent.partMaterial) &&
        !gripper.suitable_materials.includes(intent.partMaterial as PartMaterial)
      ) return false;
      if (
        known(intent.partSurface) &&
        !gripper.suitable_surfaces.includes(intent.partSurface as PartSurface)
      ) return false;
      if (
        known(intent.pickType) &&
        !gripper.suitable_pick_types.includes(intent.pickType as PickType)
      ) return false;
      if (
        intent.requiredGripForceNewtons &&
        gripper.max_grip_force_n > 0 &&
        gripper.max_grip_force_n < intent.requiredGripForceNewtons.max
      ) return false;
      return true;
    });

    const confidence = confidenceFor(intent);
    return candidates
      .map((gripper) => ({
        gripper,
        match_score: scoreCandidate(gripper, intent),
        plain_english_reason: reasonFor(gripper, intent),
        confidence: confidence.confidence,
        confidence_reason: confidence.reason,
      }))
      .sort(
        (a, b) =>
          b.match_score - a.match_score ||
          a.gripper.manufacturer.localeCompare(b.gripper.manufacturer) ||
          a.gripper.model_name.localeCompare(b.gripper.model_name),
      )
      .slice(0, 3);
  }
}
