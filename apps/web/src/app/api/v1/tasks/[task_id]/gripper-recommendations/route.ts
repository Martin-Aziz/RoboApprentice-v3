import { NextRequest, NextResponse } from "next/server";
import { getTask } from "@/lib/task-store-db";
import {
  AFFILIATE_DISCLOSURE,
  GripperRecommender,
} from "@/lib/gripper-recommender";
import type {
  GripperRecommendationResponse,
  PartMaterial,
  PartSurface,
  PickType,
  TaskCategory,
  TaskIntent,
} from "@/lib/types";

const MATERIALS = new Set<PartMaterial>(["metal", "plastic", "glass", "cardboard", "unknown"]);
const SURFACES = new Set<PartSurface>(["smooth", "rough", "porous", "unknown"]);
const PICK_TYPES = new Set<PickType>(["top-pick", "side-pick", "unknown"]);

function enumParam<T extends string>(value: string | null, allowed: Set<T>, fallback: T): T {
  return value && allowed.has(value as T) ? (value as T) : fallback;
}

function inferCategory(text: string): TaskCategory {
  if (/\b(machine|cnc|spindle|lathe)\b/.test(text)) return "machine-tend";
  if (/\b(pallet|depallet|box stack)\b/.test(text)) return "palletising";
  if (/\b(assemble|assembly|insert|fasten)\b/.test(text)) return "assembly";
  return "pick-place";
}

function inferMaterial(text: string): PartMaterial {
  if (/\b(metal|steel|aluminium|aluminum|iron)\b/.test(text)) return "metal";
  if (/\b(plastic|polymer)\b/.test(text)) return "plastic";
  if (/\b(glass)\b/.test(text)) return "glass";
  if (/\b(cardboard|carton|box)\b/.test(text)) return "cardboard";
  return "unknown";
}

function inferSurface(text: string): PartSurface {
  if (/\b(porous|corrugated|cardboard|foam)\b/.test(text)) return "porous";
  if (/\b(rough|textured|cast)\b/.test(text)) return "rough";
  if (/\b(smooth|glass|polished|sheet)\b/.test(text)) return "smooth";
  return "unknown";
}

function inferPickType(text: string): PickType {
  if (/\b(side pick|from the side|horizontal grip)\b/.test(text)) return "side-pick";
  if (/\b(top pick|from above|lift|pallet)\b/.test(text)) return "top-pick";
  return "unknown";
}

function optionalPositive(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ task_id: string }> },
) {
  const { task_id: taskId } = await params;
  const task = await getTask(taskId);
  if (!task) {
    return NextResponse.json(
      {
        recommendations: [],
        explanation: "Task not found.",
        disclosure: AFFILIATE_DISCLOSURE,
      } satisfies GripperRecommendationResponse,
      { status: 404 },
    );
  }

  const search = request.nextUrl.searchParams;
  const sourceText = `${task.title} ${task.description ?? ""} ${task.transcript ?? ""}`.toLowerCase();
  const robotModel = search.get("robot_model") ?? task.targetRobotModels?.[0];
  const payloadKg =
    optionalPositive(search.get("payload_kg")) ??
    optionalPositive(sourceText.match(/(\d+(?:\.\d+)?)\s*kg\b/)?.[1] ?? null);
  const material = enumParam(
    search.get("material"),
    MATERIALS,
    inferMaterial(sourceText),
  );
  const surface = enumParam(
    search.get("surface"),
    SURFACES,
    inferSurface(sourceText),
  );
  const pickType = enumParam(
    search.get("pick_type"),
    PICK_TYPES,
    inferPickType(sourceText),
  );

  if (!robotModel) {
    return NextResponse.json({
      recommendations: [],
      explanation: "Select the deployed robot model before choosing an end-effector.",
      disclosure: AFFILIATE_DISCLOSURE,
    } satisfies GripperRecommendationResponse);
  }

  const intent: TaskIntent = {
    waypoints: task.steps.map((step) => step.target),
    approximateSpeeds: task.steps.map((step) => step.speed),
    confidence: "MEDIUM",
    taskCategory: inferCategory(sourceText),
    payloadKg,
    partMaterial: material,
    partSurface: surface,
    pickType,
    cycleTimeSeconds:
      optionalPositive(search.get("cycle_time_seconds")) ??
      task.policy?.estimatedCycleSeconds,
    robotModel,
  };
  const recommendations = new GripperRecommender().recommend(intent);

  return NextResponse.json({
    recommendations,
    explanation:
      recommendations.length > 0
        ? `Technical matches use a 30% payload safety margin for ${robotModel}.`
        : "No catalogue gripper meets the minimum payload, robot compatibility, material, surface, and pick criteria. Aurevix will not force an unsuitable recommendation.",
    disclosure: AFFILIATE_DISCLOSURE,
  } satisfies GripperRecommendationResponse);
}
