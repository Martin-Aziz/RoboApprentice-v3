import { NextRequest, NextResponse } from "next/server";
import { listTasks, createTask } from "@/lib/task-store";

export function GET() {
  return NextResponse.json(listTasks());
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body.videoUrl !== "string" || !body.videoUrl.trim()) {
    return NextResponse.json({ error: "videoUrl is required" }, { status: 400 });
  }
  const title = typeof body.title === "string" ? body.title.trim() : "Untitled Task";
  const transcript = typeof body.transcript === "string" ? body.transcript : undefined;
  const task = createTask(title, body.videoUrl.trim(), transcript);
  return NextResponse.json(task, { status: 201 });
}
