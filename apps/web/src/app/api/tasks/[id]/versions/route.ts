import { NextRequest, NextResponse } from "next/server";
import { getTaskVersions, rollbackToVersion } from "@/lib/task-store-db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const versions = await getTaskVersions(id);
  return NextResponse.json(versions);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body || typeof body.version_number !== "number") {
    return NextResponse.json(
      { error: "version_number (number) is required" },
      { status: 400 },
    );
  }

  const rolled = await rollbackToVersion(id, body.version_number);
  if (!rolled) {
    return NextResponse.json({ error: "Version not found" }, { status: 404 });
  }

  return NextResponse.json(rolled, { status: 201 });
}
