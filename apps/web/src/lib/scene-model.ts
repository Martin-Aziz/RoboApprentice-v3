/**
 * Scene-understanding contract for the teach pipeline.
 *
 * The interpretation route asks the vision model for a structured
 * `WorkcellScene` — the physical objects it saw (workpieces, totes, fixtures,
 * inspection surfaces, stations) with size/color/material hints — alongside the
 * motion policy. This module owns everything around that contract that must be
 * pure and testable without a model or a browser:
 *
 *  - extracting the steps array and the scene object from raw model output
 *  - validating/clamping the scene (sizes, poses, object cap, confidence)
 *  - deriving a fallback scene from step text when no scene was returned,
 *    so the simulator always has something plausible to render
 *
 * The Three.js renderer consumes the validated scene; it never parses model
 * output or step text itself beyond calling the classifiers exported here.
 */

import type {
  SceneGeometrySource,
  SceneMaterialHint,
  SceneObject,
  SceneObjectCategory,
  SceneObjectRole,
  SceneVisualFidelity,
  TaskStep,
  WorkcellScene,
} from "./types";

export const MAX_SCENE_OBJECTS = 12;
export const MAX_SCENE_WARNINGS = 6;

const ROLES: SceneObjectRole[] = [
  "source",
  "workpiece",
  "destination",
  "fixture",
  "container",
  "inspection_surface",
  "tool",
  "unknown",
];

const CATEGORIES: SceneObjectCategory[] = [
  "box",
  "bin",
  "tote",
  "tray",
  "cylinder",
  "bracket",
  "machined_part",
  "fixture",
  "station",
  "surface",
  "unknown",
];

const MATERIALS: SceneMaterialHint[] = ["metal", "plastic", "rubber", "wood", "cardboard", "unknown"];

const GEOMETRY_SOURCES: SceneGeometrySource[] = ["model", "depth", "primitive", "derived"];
const VISUAL_FIDELITIES: SceneVisualFidelity[] = ["proxy", "depth_estimated", "cad_matched"];

/** Below this pose confidence an object is flagged for human review. */
export const LOW_POSE_CONFIDENCE = 0.5;

/** Roles that mark an object as a drop-off surface/receptacle for a carried part. */
export const DESTINATION_ROLES: ReadonlySet<SceneObjectRole> = new Set([
  "destination",
  "fixture",
  "container",
  "inspection_surface",
]);

/** Roles that mark an object as the thing the robot picks up and carries. */
export const WORKPIECE_ROLES: ReadonlySet<SceneObjectRole> = new Set(["workpiece", "source"]);

// ---------------------------------------------------------------------------
// Raw model-output shapes (accepts snake_case and camelCase field spellings)
// ---------------------------------------------------------------------------

export interface RawSceneObject {
  id?: unknown;
  role?: unknown;
  category?: unknown;
  label?: unknown;
  color_hint?: unknown;
  colorHint?: unknown;
  material_hint?: unknown;
  materialHint?: unknown;
  size_hint?: unknown;
  sizeHint?: unknown;
  pose_hint?: unknown;
  poseHint?: unknown;
  related_step_orders?: unknown;
  relatedStepOrders?: unknown;
  confidence?: unknown;
  detection_label?: unknown;
  detectionLabel?: unknown;
  detection_score?: unknown;
  detectionScore?: unknown;
  mask_id?: unknown;
  maskId?: unknown;
  track_id?: unknown;
  trackId?: unknown;
  depth_hint?: unknown;
  depthHint?: unknown;
  pose_confidence?: unknown;
  poseConfidence?: unknown;
  geometry_source?: unknown;
  geometrySource?: unknown;
  visual_fidelity?: unknown;
  visualFidelity?: unknown;
  review_required_reason?: unknown;
  reviewRequiredReason?: unknown;
}

export interface RawWorkcellScene {
  objects?: unknown;
  confidence?: unknown;
  warnings?: unknown;
}

// ---------------------------------------------------------------------------
// Balanced JSON extraction (model output may append a scene object after the
// steps array, so naive first-"["/last-"]" slicing is no longer safe)
// ---------------------------------------------------------------------------

/**
 * Scans forward from `start` (which must point at "[" or "{") and returns the
 * substring covering the balanced JSON value, or null when unbalanced. String
 * contents (including escaped quotes and brackets inside strings) are skipped.
 */
export function extractBalancedJson(text: string, start: number): string | null {
  const open = text[start];
  if (open !== "[" && open !== "{") return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\" && inString) {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === "[" || ch === "{") depth += 1;
    else if (ch === "]" || ch === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

/** First balanced top-level JSON array in the text (the motion-step list). */
export function extractFirstJsonArray(text: string): string | null {
  const start = text.indexOf("[");
  if (start < 0) return null;
  return extractBalancedJson(text, start);
}

/**
 * Finds the trailing `{"scene": {...}}` (or bare `"scene": {...}` key inside a
 * wrapper) object the model emits after the steps array and parses it. Returns
 * null when no parseable scene is present.
 */
export function extractSceneJson(text: string): RawWorkcellScene | null {
  const keyPattern = /"scene"\s*:/g;
  let match: RegExpExecArray | null;
  let lastKeyIndex = -1;
  while ((match = keyPattern.exec(text)) !== null) lastKeyIndex = match.index + match[0].length;
  if (lastKeyIndex < 0) return null;

  const valueStart = text.indexOf("{", lastKeyIndex);
  if (valueStart < 0) return null;
  const body = extractBalancedJson(text, valueStart);
  if (!body) return null;
  try {
    return JSON.parse(body) as RawWorkcellScene;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Validation / normalization
// ---------------------------------------------------------------------------

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, num));
}

function asString(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.slice(0, maxLength) : "";
}

function normalizeSize(raw: unknown): SceneObject["sizeHint"] {
  if (!raw || typeof raw !== "object") return undefined;
  const size = raw as { x?: unknown; y?: unknown; z?: unknown };
  const x = clampNumber(size.x, 0.01, 0.6, NaN);
  const y = clampNumber(size.y, 0.01, 0.6, NaN);
  const z = clampNumber(size.z, 0.005, 0.6, NaN);
  if ([x, y, z].some((v) => Number.isNaN(v))) return undefined;
  return { x, y, z };
}

function normalizePose(raw: unknown): SceneObject["poseHint"] {
  if (!raw || typeof raw !== "object") return undefined;
  const pose = raw as { x?: unknown; y?: unknown; z?: unknown; yaw?: unknown };
  const x = clampNumber(pose.x, -1.2, 1.2, NaN);
  const y = clampNumber(pose.y, -1.2, 1.2, NaN);
  if (Number.isNaN(x) || Number.isNaN(y)) return undefined;
  const z = clampNumber(pose.z, 0, 1.5, 0);
  const yaw = pose.yaw === undefined ? undefined : clampNumber(pose.yaw, -Math.PI, Math.PI, 0);
  return { x, y, z, yaw };
}

function normalizeRelatedSteps(raw: RawSceneObject, steps: TaskStep[]): string[] {
  const orders = (raw.related_step_orders ?? raw.relatedStepOrders) as unknown;
  if (!Array.isArray(orders)) return [];
  const ids: string[] = [];
  for (const order of orders) {
    const num = typeof order === "number" ? order : Number(order);
    if (!Number.isFinite(num)) continue;
    const step = steps.find((s) => s.order === num);
    if (step && !ids.includes(step.id)) ids.push(step.id);
  }
  return ids;
}

/**
 * Normalizes one raw model-emitted scene object: whitelists role/category/
 * material, clamps sizes and poses to physically plausible workcell ranges,
 * and maps the model's step orders to server-generated step IDs. Returns null
 * when the entry is too malformed to render safely.
 */
export function normalizeSceneObject(
  raw: RawSceneObject,
  index: number,
  steps: TaskStep[],
): SceneObject | null {
  if (!raw || typeof raw !== "object") return null;
  const role = ROLES.includes(raw.role as SceneObjectRole) ? (raw.role as SceneObjectRole) : "unknown";
  const category = CATEGORIES.includes(raw.category as SceneObjectCategory)
    ? (raw.category as SceneObjectCategory)
    : "unknown";
  const label = asString(raw.label, 60).trim() || `${category === "unknown" ? "object" : category.replace("_", " ")} ${index + 1}`;
  const colorHint = asString(raw.color_hint ?? raw.colorHint, 40).trim() || undefined;
  const materialRaw = (raw.material_hint ?? raw.materialHint) as SceneMaterialHint;
  const materialHint = MATERIALS.includes(materialRaw) ? materialRaw : undefined;
  const idRaw = asString(raw.id, 48).trim();

  const optionalUnit = (value: unknown): number | undefined => {
    if (value === undefined || value === null) return undefined;
    const num = clampNumber(value, 0, 1, NaN);
    return Number.isNaN(num) ? undefined : num;
  };
  const optionalString = (value: unknown, maxLength: number): string | undefined => {
    const str = asString(value, maxLength).trim();
    return str || undefined;
  };
  const geometryRaw = (raw.geometry_source ?? raw.geometrySource) as SceneGeometrySource;
  const fidelityRaw = (raw.visual_fidelity ?? raw.visualFidelity) as SceneVisualFidelity;

  const object: SceneObject = {
    id: idRaw || `scene-obj-${index + 1}`,
    role,
    category,
    label,
    colorHint,
    materialHint,
    sizeHint: normalizeSize(raw.size_hint ?? raw.sizeHint),
    poseHint: normalizePose(raw.pose_hint ?? raw.poseHint),
    relatedStepIds: normalizeRelatedSteps(raw, steps),
    confidence: clampNumber(raw.confidence, 0, 1, 0.3),
    detectionLabel: optionalString(raw.detection_label ?? raw.detectionLabel, 80),
    detectionScore: optionalUnit(raw.detection_score ?? raw.detectionScore),
    maskId: optionalString(raw.mask_id ?? raw.maskId, 48),
    trackId: optionalString(raw.track_id ?? raw.trackId, 48),
    depthHint: optionalUnit(raw.depth_hint ?? raw.depthHint),
    poseConfidence: optionalUnit(raw.pose_confidence ?? raw.poseConfidence),
    geometrySource: GEOMETRY_SOURCES.includes(geometryRaw) ? geometryRaw : undefined,
    visualFidelity: VISUAL_FIDELITIES.includes(fidelityRaw) ? fidelityRaw : undefined,
    reviewRequiredReason: optionalString(raw.review_required_reason ?? raw.reviewRequiredReason, 200),
  };

  // Honesty guard: geometry that isn't grounded in detection/track/depth
  // evidence can only be a primitive proxy, whatever the model claimed.
  const grounded = Boolean(object.detectionLabel || object.trackId || object.maskId || object.depthHint !== undefined);
  if (!grounded) {
    if (object.visualFidelity === "cad_matched" || object.visualFidelity === "depth_estimated") {
      object.visualFidelity = "proxy";
    }
    if (object.geometrySource === "model" || object.geometrySource === "depth") {
      object.geometrySource = "primitive";
    }
  }
  if (!object.visualFidelity) object.visualFidelity = "proxy";
  if (!object.geometrySource) object.geometrySource = grounded ? "primitive" : "derived";

  // Low pose confidence means the placement is a guess — flag for review.
  const effectivePoseConfidence = object.poseConfidence ?? object.confidence;
  if (!object.reviewRequiredReason && effectivePoseConfidence < LOW_POSE_CONFIDENCE) {
    object.reviewRequiredReason = "Pose/size is low-confidence; verify position against the source video before deployment.";
  }

  return object;
}

/**
 * Validates a raw scene from the model into a renderable `WorkcellScene`.
 * Caps the object count, rejects impossible values, deduplicates IDs, and
 * appends warnings for anything that was dropped or looks low-confidence.
 */
export function validateWorkcellScene(raw: RawWorkcellScene | null, steps: TaskStep[]): WorkcellScene | null {
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.objects)) return null;

  const warnings: string[] = [];
  if (Array.isArray(raw.warnings)) {
    for (const warning of raw.warnings.slice(0, MAX_SCENE_WARNINGS)) {
      if (typeof warning === "string" && warning.trim()) warnings.push(warning.slice(0, 200));
    }
  }

  const seenIds = new Set<string>();
  const objects: SceneObject[] = [];
  for (const [index, entry] of (raw.objects as RawSceneObject[]).entries()) {
    if (objects.length >= MAX_SCENE_OBJECTS) {
      warnings.push(`Scene model truncated to ${MAX_SCENE_OBJECTS} objects.`);
      break;
    }
    const normalized = normalizeSceneObject(entry, index, steps);
    if (!normalized) continue;
    if (seenIds.has(normalized.id)) normalized.id = `${normalized.id}-${index + 1}`;
    seenIds.add(normalized.id);
    objects.push(normalized);
  }

  if (objects.length === 0) return null;

  const confidence = clampNumber(
    raw.confidence,
    0,
    1,
    objects.reduce((sum, o) => sum + o.confidence, 0) / objects.length,
  );
  if (confidence < 0.35) {
    warnings.push("Low scene confidence — rendered objects are approximate proxies; review against the source video.");
  }

  const reviewCount = objects.filter((o) => o.reviewRequiredReason).length;
  if (reviewCount > 0) {
    warnings.push(`${reviewCount} object(s) have low-confidence pose/geometry and need human review before deployment.`);
  }

  return {
    objects,
    confidence,
    warnings: warnings.slice(0, MAX_SCENE_WARNINGS),
    source: "video",
  };
}

// ---------------------------------------------------------------------------
// Carry pairs (shared by the renderer and the fallback scene derivation)
// ---------------------------------------------------------------------------

/** One pick-and-place operation: gripper closes at `pickIndex`, opens at `placeIndex`. */
export interface CarryPair {
  pickIndex: number;
  placeIndex: number;
}

/**
 * Scans the steps for grip(close) → release(open) pairs. Each pair represents
 * one part picked up somewhere and carried somewhere else — the policy's own
 * gripper-discipline rules guarantee these never nest or overlap.
 */
export function findCarryPairs(steps: TaskStep[] | undefined): CarryPair[] {
  const pairs: CarryPair[] = [];
  let openPick: number | null = null;
  (steps ?? []).forEach((step, index) => {
    if (step.gripper === "closed" && openPick === null) {
      openPick = index;
    } else if (step.gripper === "open" && openPick !== null) {
      pairs.push({ pickIndex: openPick, placeIndex: index });
      openPick = null;
    }
  });
  return pairs;
}

// ---------------------------------------------------------------------------
// Text classifiers + fallback scene derivation
// ---------------------------------------------------------------------------

const COLOR_WORDS = [
  "black", "white", "gray", "grey", "silver", "red", "orange", "amber", "yellow",
  "green", "teal", "cyan", "blue", "navy", "purple", "violet", "brown", "tan", "beige",
];

/** First color word mentioned in free text, usable as a colorHint. */
export function extractColorWord(text: string): string | undefined {
  const lower = text.toLowerCase();
  return COLOR_WORDS.find((word) => new RegExp(`\\b${word}\\b`).test(lower));
}

export interface DestinationClassification {
  role: SceneObjectRole;
  category: SceneObjectCategory;
  label: string;
}

/**
 * Classifies a drop-off/placement step's text into a destination object.
 * Order matters: explicit containers beat inspection beats fixtures beats
 * generic stations, so "place into tote at inspection cell" reads as a tote.
 */
export function classifyDestination(text: string): DestinationClassification {
  const lower = text.toLowerCase();
  if (/\btote\b/.test(lower)) return { role: "container", category: "tote", label: "tote" };
  if (/\bbin\b/.test(lower)) return { role: "container", category: "bin", label: "bin" };
  if (/\btray\b/.test(lower)) return { role: "container", category: "tray", label: "tray" };
  if (/\b(carton|package|parcel)\b/.test(lower)) return { role: "container", category: "box", label: "carton" };
  if (/\b(inspect|inspection|scan|scanner|camera|vision|measure|gauge|qc|quality)\b/.test(lower)) {
    return { role: "inspection_surface", category: "surface", label: "inspection surface" };
  }
  if (/\b(fixture|jig|cradle|clamp|vise|vice|rail)\b/.test(lower)) {
    return { role: "fixture", category: "fixture", label: "fixture" };
  }
  if (/\b(station|nest|dock|final|assembly|conveyor|belt|pallet|stack)\b/.test(lower)) {
    return { role: "destination", category: "station", label: "placement station" };
  }
  if (/\b(pad|mat|surface|table|bench)\b/.test(lower)) {
    return { role: "destination", category: "surface", label: "placement surface" };
  }
  return { role: "fixture", category: "fixture", label: "fixture" };
}

export interface WorkpieceClassification {
  category: SceneObjectCategory;
  label: string;
}

/** Classifies a pick step's text into the kind of part being handled. */
export function classifyWorkpiece(text: string): WorkpieceClassification {
  const lower = text.toLowerCase();
  if (/\bbracket\b/.test(lower)) return { category: "bracket", label: "bracket" };
  if (/\b(cylinder|shaft|tube|pipe|roller|can|bottle|vial)\b/.test(lower)) return { category: "cylinder", label: "cylindrical part" };
  if (/\b(box|carton|package|parcel|case)\b/.test(lower)) return { category: "box", label: "box" };
  if (/\b(plate|panel|sheet|board|pcb)\b/.test(lower)) return { category: "tray", label: "flat panel" };
  if (/\b(part|component|workpiece|casting|housing|block)\b/.test(lower)) return { category: "machined_part", label: "machined part" };
  return { category: "machined_part", label: "workpiece" };
}

function stepText(step: TaskStep | undefined): string {
  return `${step?.description ?? ""} ${step?.notes ?? ""}`;
}

/**
 * Derives a plausible scene purely from the policy's step text and geometry.
 * Used when the model returned no scene (or an unusable one) so the simulator
 * still renders differentiated, role-appropriate proxies instead of nothing.
 */
export function deriveSceneFromSteps(steps: TaskStep[]): WorkcellScene {
  const objects: SceneObject[] = [];
  const pairs = findCarryPairs(steps);

  pairs.forEach((pair, index) => {
    if (objects.length >= MAX_SCENE_OBJECTS - 1) return;
    const pick = steps[pair.pickIndex];
    const place = steps[pair.placeIndex];
    const pickText = stepText(pick);
    const placeText = stepText(place);

    const workpiece = classifyWorkpiece(pickText);
    objects.push({
      id: `derived-workpiece-${index + 1}`,
      role: "workpiece",
      category: workpiece.category,
      label: workpiece.label,
      colorHint: extractColorWord(pickText),
      relatedStepIds: [pick.id],
      poseHint: { x: pick.target.x, y: pick.target.y, z: 0 },
      confidence: 0.45,
      geometrySource: "derived",
      visualFidelity: "proxy",
      reviewRequiredReason: "Inferred from step text, not video evidence.",
    });

    const destination = classifyDestination(placeText);
    objects.push({
      id: `derived-destination-${index + 1}`,
      role: destination.role,
      category: destination.category,
      label: destination.label,
      colorHint: extractColorWord(placeText),
      relatedStepIds: [place.id],
      poseHint: { x: place.target.x, y: place.target.y, z: 0 },
      confidence: 0.4,
      geometrySource: "derived",
      visualFidelity: "proxy",
      reviewRequiredReason: "Inferred from step text, not video evidence.",
    });
  });

  // Standalone inspection dwells (not release points) get their own surface,
  // deduplicated by XY so a hover + descend pair yields one pad.
  for (const step of steps) {
    if (step.action !== "inspect" || objects.length >= MAX_SCENE_OBJECTS) continue;
    const nearExisting = objects.some(
      (o) =>
        o.poseHint &&
        Math.hypot(o.poseHint.x - step.target.x, o.poseHint.y - step.target.y) < 0.09,
    );
    if (nearExisting) continue;
    objects.push({
      id: `derived-inspection-${objects.length + 1}`,
      role: "inspection_surface",
      category: "surface",
      label: "inspection surface",
      relatedStepIds: [step.id],
      poseHint: { x: step.target.x, y: step.target.y, z: 0 },
      confidence: 0.4,
      geometrySource: "derived",
      visualFidelity: "proxy",
      reviewRequiredReason: "Inferred from step text, not video evidence.",
    });
  }

  return {
    objects,
    confidence: objects.length ? 0.4 : 0,
    warnings: objects.length
      ? ["Scene inferred from step descriptions; object appearance is an approximate proxy."]
      : ["No scene objects could be inferred from the policy steps."],
    source: "derived",
  };
}

/** The scene attached to a policy, or a step-text-derived fallback. */
export function resolveSceneForPolicy(policy: { steps: TaskStep[]; scene?: WorkcellScene } | undefined): WorkcellScene {
  if (policy?.scene && policy.scene.objects.length > 0) return policy.scene;
  return deriveSceneFromSteps(policy?.steps ?? []);
}

/**
 * Best scene object for a given step and role set: prefer an explicit
 * relatedStepIds link, then pose proximity to the step target, then the first
 * object of an acceptable role that hasn't been claimed yet.
 */
export function sceneObjectForStep(
  scene: WorkcellScene,
  step: TaskStep | undefined,
  roles: ReadonlySet<SceneObjectRole>,
  claimed?: Set<string>,
): SceneObject | undefined {
  if (!step) return undefined;
  const candidates = scene.objects.filter((o) => roles.has(o.role) && !claimed?.has(o.id));

  const linked = candidates.find((o) => o.relatedStepIds.includes(step.id));
  if (linked) return linked;

  let nearest: SceneObject | undefined;
  let nearestDistance = 0.14; // meters — beyond this a pose match is a guess
  for (const candidate of candidates) {
    if (!candidate.poseHint) continue;
    const distance = Math.hypot(candidate.poseHint.x - step.target.x, candidate.poseHint.y - step.target.y);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = candidate;
    }
  }
  return nearest ?? candidates[0];
}
