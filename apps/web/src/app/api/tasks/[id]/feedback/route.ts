import { NextRequest, NextResponse } from "next/server";
import { appendFeedback, getTask } from "@/lib/task-store-db";
import type { FeedbackVerdict, TaskFeedback } from "@/lib/types";

const VERDICTS: FeedbackVerdict[] = ["success", "partial", "failed"];

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const task = await getTask(id);
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(task.feedback ?? []);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const task = await getTask(id);
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const verdict = VERDICTS.includes(body.verdict) ? (body.verdict as FeedbackVerdict) : null;
  if (!verdict) {
    return NextResponse.json(
      { error: "verdict must be one of success | partial | failed" },
      { status: 400 },
    );
  }

  const ratingRaw = Number(body.rating ?? 3);
  const rating = Math.min(5, Math.max(1, Number.isFinite(ratingRaw) ? Math.round(ratingRaw) : 3));

  const feedback: TaskFeedback = {
    verdict,
    rating,
    reportedBy: typeof body.reportedBy === "string" ? body.reportedBy.slice(0, 120) : undefined,
    notes: typeof body.notes === "string" ? body.notes.slice(0, 1000) : undefined,
    failedStepIds: Array.isArray(body.failedStepIds)
      ? body.failedStepIds.filter((s: unknown): s is string => typeof s === "string")
      : undefined,
    createdAt: new Date().toISOString(),
  };

  const updated = await appendFeedback(id, feedback);
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(feedback, { status: 201 });
}
