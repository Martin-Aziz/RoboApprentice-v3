import { NextRequest, NextResponse } from "next/server";
import { getTask, getTaskVersions } from "@/lib/task-store-db";
import { getTrustRecord } from "@/lib/trust-store-db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const task = await getTask(id);
  if (!task) return NextResponse.json({ error: "Task not found." }, { status: 404 });
  const versions = await getTaskVersions(id);
  const record = await getTrustRecord(task, versions[0]?.version_number ?? 1);
  const packageBody = {
    format: "aurevix-deployment-evidence",
    format_version: "1.0",
    generated_at: new Date().toISOString(),
    disclaimer: "This evidence package documents the Aurevix workflow and human decisions. It is not a safety certification.",
    task: {
      id: task.id,
      title: task.title,
      description: task.description ?? task.transcript ?? null,
      robot_model: task.robotModel ?? task.targetRobotModels?.[0] ?? null,
      status: task.status,
      task_version: record.current_task_version,
      policy_hash: record.policy_hash,
      motion_steps: task.steps,
    },
    trust_record: record,
    version_history: versions,
  };

  return new NextResponse(JSON.stringify(packageBody, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="aurevix-deployment-evidence-${id}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
