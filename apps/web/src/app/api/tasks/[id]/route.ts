import { NextRequest, NextResponse } from "next/server";
import { getTask, updateTask } from "@/lib/task-store";
import type { TaskPolicy, TaskStatus, TaskStep } from "@/lib/types";

export function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return params.then(({ id }) => {
    const task = getTask(id);
    if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(task);
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const patch: {
    steps?: TaskStep[];
    policy?: TaskPolicy;
    status?: TaskStatus;
    transcript?: string;
    errorMessage?: string;
  } = {};
  if (Array.isArray(body.steps)) patch.steps = body.steps;
  if (body.policy && typeof body.policy === "object") patch.policy = body.policy as TaskPolicy;
  if (typeof body.status === "string") patch.status = body.status as TaskStatus;
  if (typeof body.transcript === "string") patch.transcript = body.transcript;
  if (typeof body.errorMessage === "string") patch.errorMessage = body.errorMessage;

  const updated = updateTask(id, patch);
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(updated);
}
