import { randomUUID } from "crypto";
import { mkdir, rm, writeFile } from "fs/promises";
import { extname, join } from "path";
import { tmpdir } from "os";
import { NextRequest, NextResponse } from "next/server";
import { FeasibilityEngine, ROBOT_SPECIFICATIONS } from "@/lib/feasibility-engine";
import { extractTaskIntentFromVideo } from "@/lib/task-intent-pipeline";
import type { RobotModel, WorkcellDimensions } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 180;

const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
const ALLOWED_VIDEO_TYPES = new Set([
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-m4v",
]);

function parsePositiveNumber(value: FormDataEntryValue | null, field: string): number {
  const parsed = typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${field} must be a number greater than zero.`);
  }
  return parsed;
}

function parseWorkcell(value: FormDataEntryValue | null): WorkcellDimensions | undefined {
  if (value === null || value === "") return undefined;
  if (typeof value !== "string") throw new Error("workcell_dimensions must be JSON.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error("workcell_dimensions must be valid JSON.");
  }
  if (!parsed || typeof parsed !== "object") throw new Error("workcell_dimensions must be an object.");
  const dimensions = parsed as Record<string, unknown>;
  const result = { x: Number(dimensions.x), y: Number(dimensions.y), z: Number(dimensions.z) };
  if (Object.values(result).some((dimension) => !Number.isFinite(dimension) || dimension <= 0)) {
    throw new Error("workcell_dimensions x, y, and z must be positive numbers in metres.");
  }
  return result;
}

export async function POST(request: NextRequest) {
  let workDir: string | null = null;
  try {
    const form = await request.formData();
    const video = form.get("video");
    const robotModel = form.get("robot_model");

    if (!(video instanceof File)) {
      return NextResponse.json({ error: "A video file is required." }, { status: 400 });
    }
    if (!ALLOWED_VIDEO_TYPES.has(video.type)) {
      return NextResponse.json(
        { error: "Use an MP4, MOV, M4V, or WebM video." },
        { status: 415 },
      );
    }
    if (video.size === 0 || video.size > MAX_VIDEO_BYTES) {
      return NextResponse.json(
        { error: "Video must be between 1 byte and 100 MB." },
        { status: 413 },
      );
    }
    if (
      typeof robotModel !== "string" ||
      !(robotModel in ROBOT_SPECIFICATIONS)
    ) {
      return NextResponse.json(
        { error: "Select a supported virtual robot model." },
        { status: 400 },
      );
    }

    const payloadKg = parsePositiveNumber(form.get("payload_kg"), "payload_kg");
    const workcellDimensions = parseWorkcell(form.get("workcell_dimensions"));

    workDir = join(tmpdir(), `aurevix-feasibility-${randomUUID()}`);
    await mkdir(workDir, { recursive: true });
    const suffix = extname(video.name).slice(0, 8) || ".mp4";
    const videoPath = join(workDir, `demonstration${suffix}`);
    await writeFile(videoPath, Buffer.from(await video.arrayBuffer()));

    const taskIntent = await extractTaskIntentFromVideo(
      videoPath,
      video.name.replace(/\.[^.]+$/, "") || "Uploaded task demonstration",
    );
    const result = new FeasibilityEngine().simulate({
      task_intent: taskIntent,
      robot_model: robotModel as RobotModel,
      payload_kg: payloadKg,
      workcell_dimensions: workcellDimensions,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Simulation failed.";
    const validationError =
      message.includes("must be") ||
      message.includes("required") ||
      message.includes("positive");
    console.error("[feasibility] simulation failed", error);
    return NextResponse.json(
      {
        error: validationError
          ? message
          : "We could not analyse this video. Try a shorter, clearer recording.",
      },
      { status: validationError ? 400 : 500 },
    );
  } finally {
    if (workDir) await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}
