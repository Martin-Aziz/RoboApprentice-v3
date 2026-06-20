import { NextRequest } from "next/server";
import { createTask } from "./task-store-db";
import type { TaskIntent, TaskPolicy, TaskStep } from "./types";

interface InterpretationEvent {
  type: string;
  message?: string;
  step?: TaskStep;
  policy?: TaskPolicy;
  fallback?: string;
}

/**
 * Adapter around the existing SSE interpretation route. Keeping this adapter
 * small lets the feasibility API reuse the production video pipeline without
 * calling a robot controller or duplicating the model-provider logic.
 */
export async function extractTaskIntentFromVideo(
  videoPath: string,
  title: string,
): Promise<TaskIntent> {
  const task = await createTask(title, videoPath);
  const { POST: interpretTask } = await import(
    "@/app/api/tasks/[id]/interpret/route"
  );
  const response = await interpretTask(
    new NextRequest(`http://localhost/api/tasks/${task.id}/interpret`, {
      method: "POST",
    }),
    { params: Promise.resolve({ id: task.id }) },
  );

  if (!response.ok || !response.body) {
    throw new Error(`Video interpretation failed with status ${response.status}.`);
  }

  const text = await response.text();
  const events = text
    .split("\n\n")
    .map((block) => block.split("\n").find((line) => line.startsWith("data: ")))
    .filter((line): line is string => Boolean(line))
    .map((line) => JSON.parse(line.slice(6)) as InterpretationEvent);

  const error = events.find((event) => event.type === "error");
  if (error) throw new Error(error.message ?? "Video interpretation failed.");

  const done = [...events].reverse().find((event) => event.type === "done");
  const steps = done?.policy?.steps ?? events.flatMap((event) => (event.step ? [event.step] : []));
  if (!steps.length) throw new Error("The video pipeline did not produce a usable task intent.");

  const usedFallback = events.some(
    (event) =>
      event.fallback === "deterministic" ||
      event.message?.includes("deterministic interpreter"),
  );
  const visionSkipped = events.some((event) => event.message?.includes("Vision analysis skipped"));

  return {
    waypoints: steps.map((step) => step.target),
    approximateSpeeds: steps.map((step) => step.speed),
    operationDelaysSeconds: steps
      .filter((step) => step.action === "grip" || step.action === "release" || step.action === "wait")
      .reduce((sum, step) => sum + step.duration, 0),
    confidence: usedFallback || visionSkipped ? "LOW" : steps.length >= 6 ? "HIGH" : "MEDIUM",
  };
}
