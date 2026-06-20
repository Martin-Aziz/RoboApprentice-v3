import { spawn } from "child_process";
import { mkdir, readFile, rm, writeFile } from "fs/promises";
import { join } from "path";
import { NextRequest, NextResponse } from "next/server";
import {
  FIXTURE_VERIFICATION_DISCLAIMER,
  FixtureDesigner,
} from "@/lib/fixture-designer";
import {
  fixtureArtifactPaths,
  listFixtureDesignsForTask,
  saveFixtureDesign,
} from "@/lib/fixture-design-store";
import { getTask } from "@/lib/task-store-db";
import type {
  GripperSpec,
  PartShape,
  RequiredPickFace,
  TaskIntent,
} from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

function runPython(scriptName: string, args: string[]): Promise<void> {
  const python = process.env.AUREVIX_PDF_PYTHON ?? process.env.AUREVIX_PYTHON ?? "python3";
  const script = join(process.cwd(), "scripts", scriptName);
  return new Promise((resolve, reject) => {
    const child = spawn(python, [script, ...args], { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve() : reject(new Error(stderr.trim() || `${scriptName} failed with exit ${code}`)));
  });
}

function positive(value: unknown, fallback?: number): number {
  if (value === undefined && fallback !== undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error("All part dimensions and tolerances must be positive.");
  return parsed;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ task_id: string }> },
) {
  const { task_id: taskId } = await params;
  const designs = await listFixtureDesignsForTask(taskId);
  return NextResponse.json(designs.map((item) => item.design));
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ task_id: string }> },
) {
  let inputPath: string | null = null;
  try {
    const { task_id: taskId } = await params;
    const task = await getTask(taskId);
    if (!task) return NextResponse.json({ error: "Task not found.", disclaimer: FIXTURE_VERIFICATION_DISCLAIMER }, { status: 404 });
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ error: "Part geometry is required.", disclaimer: FIXTURE_VERIFICATION_DISCLAIMER }, { status: 400 });
    const geometry = body.part_geometry as Record<string, unknown> | undefined;
    const box = geometry?.bounding_box as Record<string, unknown> | undefined;
    if (!geometry || !box) {
      return NextResponse.json({ error: "part_geometry.bounding_box is required.", disclaimer: FIXTURE_VERIFICATION_DISCLAIMER }, { status: 400 });
    }
    const intent: TaskIntent = {
      ...(task.taskIntent ?? { waypoints: task.steps.map((step) => step.target), confidence: "MEDIUM" as const }),
      partGeometry: {
        shape: String(geometry.shape ?? "UNKNOWN").toUpperCase() as PartShape,
        boundingBox: {
          length_mm: positive(box.length_mm),
          width_mm: positive(box.width_mm),
          height_mm: positive(box.height_mm),
        },
      },
      pickPosition: {
        face: String(body.required_pick_face ?? "TOP").toUpperCase() as RequiredPickFace,
        offsetMm: { x: 0, y: 0, z: 0 },
      },
      requiredRepeatabilityMm: positive(body.required_repeatability_mm, 1),
      environmentTemperatureC: Number(body.environment_temperature_c ?? 25),
      requiredGripForceNewtons:
        body.max_cycle_force_n === undefined
          ? undefined
          : { min: 0, max: positive(body.max_cycle_force_n) },
    };
    const design = new FixtureDesigner().design(
      intent,
      body.gripper_spec as GripperSpec | undefined,
    );
    const paths = fixtureArtifactPaths(design.fixture_id);
    await mkdir(paths.directory, { recursive: true });
    inputPath = paths.input;
    await writeFile(paths.input, JSON.stringify(design, null, 2), "utf-8");

    let stlPath: string | null = null;
    if (design.fixture_type === "NEST" || design.fixture_type === "V-BLOCK") {
      try {
        await runPython("generate-fixture-stl.py", [paths.input, paths.stl, paths.report]);
        const report = JSON.parse(await readFile(paths.report, "utf-8")) as { manifold: boolean; file_written: boolean };
        if (report.manifold && report.file_written) stlPath = paths.stl;
      } catch (error) {
        design.geometry_file = null;
        design.geometry_download_url = null;
        design.human_review_required = true;
        design.confidence = "LOW";
        design.notes = `STL manifold validation failed; written specification only. ${error instanceof Error ? error.message : ""}`.trim();
      }
    }

    await writeFile(paths.input, JSON.stringify(design, null, 2), "utf-8");
    await runPython("build-fixture-spec-pdf.py", [paths.input, paths.pdf]);
    design.geometry_file = stlPath ? `${design.fixture_id}.stl` : null;
    design.geometry_download_url = stlPath
      ? `/api/v1/fixture-designs/${design.fixture_id}/stl`
      : null;
    design.specification_pdf_url = `/api/v1/fixture-designs/${design.fixture_id}/specification`;
    await saveFixtureDesign(taskId, design, stlPath, paths.pdf);
    return NextResponse.json(design, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Fixture design generation failed.";
    return NextResponse.json(
      { error: message, disclaimer: FIXTURE_VERIFICATION_DISCLAIMER },
      { status: message.includes("must be") || message.includes("required") ? 400 : 500 },
    );
  } finally {
    if (inputPath) await rm(inputPath, { force: true }).catch(() => {});
  }
}
