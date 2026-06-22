import { randomUUID } from "crypto";
import { spawn } from "child_process";
import { mkdir, readFile, rm, writeFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { NextRequest, NextResponse } from "next/server";
import { getTask, getTaskVersions } from "@/lib/task-store-db";
import { markRiskDraftGenerated } from "@/lib/trust-store-db";
import {
  RiskAssessmentGenerator,
  RISK_ASSESSMENT_DISCLAIMER,
} from "@/lib/risk-assessment-generator";
import { saveRiskAssessmentDraft } from "@/lib/risk-assessment-store";
import type { TaskCategory, TaskProgram, WorkcellDimensions } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const ALLOWED_CATEGORIES: TaskCategory[] = [
  "pick-place",
  "machine-tend",
  "assembly",
  "palletising",
];

function optionalPositive(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error("Numeric configuration values cannot be negative.");
  return parsed;
}

function parseDimensions(value: unknown): WorkcellDimensions | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "object") throw new Error("workcellDimensions must be an object.");
  const raw = value as Record<string, unknown>;
  const result = { x: Number(raw.x), y: Number(raw.y), z: Number(raw.z) };
  if (Object.values(result).some((item) => !Number.isFinite(item) || item <= 0)) {
    throw new Error("Workcell dimensions must be positive numbers in metres.");
  }
  return result;
}

function runDocxBuilder(inputPath: string, outputPath: string): Promise<void> {
  const scriptPath = join(process.cwd(), "scripts", "build-risk-assessment-docx.py");
  const python = process.env.AUREVIX_PYTHON ?? "python3";
  return new Promise((resolve, reject) => {
    const child = spawn(python, [scriptPath, inputPath, outputPath], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`DOCX generation failed: ${stderr.trim() || `exit ${code}`}`));
    });
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ task_id: string }> },
) {
  let workDir: string | null = null;
  try {
    const { task_id: taskId } = await params;
    const task = await getTask(taskId);
    if (!task) return NextResponse.json({ error: "Task not found." }, { status: 404 });
    if (!task.steps.length) {
      return NextResponse.json(
        {
          error: "This task has no deployed motion data. Interpret and deploy the task before generating a draft.",
          disclaimer: RISK_ASSESSMENT_DISCLAIMER,
        },
        { status: 422 },
      );
    }

    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const category = body.taskCategory ?? "pick-place";
    if (typeof category !== "string" || !ALLOWED_CATEGORIES.includes(category as TaskCategory)) {
      return NextResponse.json(
        { error: "taskCategory must be pick-place, machine-tend, assembly, or palletising." },
        { status: 400 },
      );
    }

    const robotModel =
      typeof body.robotModel === "string" && body.robotModel.trim()
        ? body.robotModel.trim()
        : task.targetRobotModels?.[0];
    if (!robotModel) {
      return NextResponse.json(
        {
          error: "Robot model is missing. Select the deployed robot model before generating the draft.",
          disclaimer: RISK_ASSESSMENT_DISCLAIMER,
        },
        { status: 422 },
      );
    }

    const program: TaskProgram = {
      taskId,
      taskName: task.title,
      taskSummary: task.description ?? task.transcript,
      robotModel,
      taskCategory: category as TaskCategory,
      waypoints: task.steps.map((step) => ({
        ...step.target,
        tcpSpeedMetersPerSecond: step.speed,
      })),
      gripperType:
        typeof body.gripperType === "string"
          ? body.gripperType
          : task.gripperConfig ?? "not recorded",
      gripperForceNewtons: optionalPositive(body.gripperForceNewtons),
      workcellDimensions: parseDimensions(body.workcellDimensions),
      operatorProximityMillimeters: optionalPositive(body.operatorProximityMillimeters),
      siteName: typeof body.siteName === "string" ? body.siteName.trim() : undefined,
    };

    const draft = new RiskAssessmentGenerator().generate(program);
    await saveRiskAssessmentDraft(draft);
    const versions = await getTaskVersions(taskId);
    await markRiskDraftGenerated(task, versions[0]?.version_number ?? 1);

    workDir = join(tmpdir(), `aurevix-risk-${randomUUID()}`);
    await mkdir(workDir, { recursive: true });
    const inputPath = join(workDir, "draft.json");
    const outputPath = join(workDir, "risk-assessment-draft.docx");
    await writeFile(inputPath, JSON.stringify(draft), "utf-8");
    await runDocxBuilder(inputPath, outputPath);
    const file = await readFile(outputPath);
    const reviewSections = draft.sections
      .filter((section) => section.requires_human_review)
      .map((section) => `${section.section_number} ${section.title}`);

    return new NextResponse(file, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="aurevix-risk-assessment-${taskId}.docx"`,
        "X-Aurevix-Disclaimer": encodeURIComponent(RISK_ASSESSMENT_DISCLAIMER),
        "X-Aurevix-Review-Sections": encodeURIComponent(JSON.stringify(reviewSections)),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Risk assessment draft generation failed.";
    console.error("[risk-assessment] generation failed", error);
    const isValidation = message.includes("must be") || message.includes("cannot be negative");
    return NextResponse.json(
      {
        error: isValidation ? message : "The editable draft could not be generated. Check the task data and try again.",
        disclaimer: RISK_ASSESSMENT_DISCLAIMER,
      },
      { status: isValidation ? 400 : 500 },
    );
  } finally {
    if (workDir) await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}
