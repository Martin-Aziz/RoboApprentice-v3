import { NextRequest, NextResponse } from "next/server";
import { listTasks, createTask } from "@/lib/task-store-db";

export async function GET(req: NextRequest) {
  const facilityId = req.nextUrl.searchParams.get("facility_id") ?? undefined;
  const tasks = await listTasks(facilityId);
  return NextResponse.json(tasks);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body.videoUrl !== "string" || !body.videoUrl.trim()) {
    return NextResponse.json({ error: "videoUrl is required" }, { status: 400 });
  }
  const title = typeof body.title === "string" ? body.title.trim() : "Untitled Task";
  const transcript = typeof body.transcript === "string" ? body.transcript : undefined;
  const facilityId = typeof body.facility_id === "string" ? body.facility_id : undefined;
  const task = await createTask(title, body.videoUrl.trim(), transcript, facilityId);
  return NextResponse.json(task, { status: 201 });
}
