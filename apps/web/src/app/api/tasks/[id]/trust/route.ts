import { NextRequest, NextResponse } from "next/server";
import { getTask, getTaskVersions } from "@/lib/task-store-db";
import {
  decideApproval,
  getTrustRecord,
  updateTrustCheck,
} from "@/lib/trust-store-db";

async function context(id: string) {
  const task = await getTask(id);
  if (!task) return null;
  const versions = await getTaskVersions(id);
  return { task, currentVersion: versions[0]?.version_number ?? 1 };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const found = await context(id);
  if (!found) return NextResponse.json({ error: "Task not found." }, { status: 404 });
  return NextResponse.json(await getTrustRecord(found.task, found.currentVersion));
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const found = await context(id);
    if (!found) return NextResponse.json({ error: "Task not found." }, { status: 404 });
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!body || typeof body.action !== "string") {
      return NextResponse.json({ error: "A trust-record action is required." }, { status: 400 });
    }

    if (body.action === "update-check") {
      if (
        typeof body.check_id !== "string" ||
        !["passed", "failed", "pending"].includes(String(body.status)) ||
        typeof body.evidence !== "string" ||
        typeof body.actor !== "string"
      ) {
        return NextResponse.json({ error: "Check, status, evidence, and actor are required." }, { status: 400 });
      }
      return NextResponse.json(await updateTrustCheck(found.task, found.currentVersion, {
        check_id: body.check_id,
        status: body.status as "passed" | "failed" | "pending",
        evidence: body.evidence,
        actor: body.actor,
      }));
    }

    if (body.action === "decide") {
      if (
        !["approved", "rejected"].includes(String(body.status)) ||
        typeof body.reviewer_name !== "string" ||
        typeof body.reviewer_role !== "string" ||
        typeof body.qualification !== "string" ||
        typeof body.comments !== "string"
      ) {
        return NextResponse.json({ error: "Complete reviewer details are required." }, { status: 400 });
      }
      return NextResponse.json(await decideApproval(found.task, found.currentVersion, {
        status: body.status as "approved" | "rejected",
        reviewer_name: body.reviewer_name,
        reviewer_role: body.reviewer_role,
        qualification: body.qualification,
        comments: body.comments,
      }));
    }

    return NextResponse.json({ error: "Unknown trust-record action." }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Trust record update failed." },
      { status: 422 },
    );
  }
}
