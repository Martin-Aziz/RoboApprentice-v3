import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

const MAX_VIDEO_BYTES = 250 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-m4v",
]);

const EXT_BY_TYPE: Record<string, string> = {
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
  "video/x-m4v": "m4v",
};

function extensionFor(file: File): string {
  const fromType = EXT_BY_TYPE[file.type];
  if (fromType) return fromType;
  const match = file.name.toLowerCase().match(/\.([a-z0-9]{2,5})$/);
  return match?.[1] ?? "mp4";
}

export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  const file = form?.get("video");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "video file is required" }, { status: 400 });
  }

  if (file.size <= 0) {
    return NextResponse.json({ error: "video file is empty" }, { status: 400 });
  }

  if (file.size > MAX_VIDEO_BYTES) {
    return NextResponse.json({ error: "video file must be 250MB or smaller" }, { status: 413 });
  }

  if (file.type && !ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: "video must be MP4, MOV, M4V, or WebM" }, { status: 415 });
  }

  const uploadDir = join(process.cwd(), "public", "uploads", "demos");
  await mkdir(uploadDir, { recursive: true });

  const ext = extensionFor(file);
  const filename = `${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID()}.${ext}`;
  const absolutePath = join(uploadDir, filename);
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(absolutePath, bytes);

  return NextResponse.json({
    videoUrl: `/uploads/demos/${filename}`,
    filename,
    originalName: file.name,
    size: file.size,
    contentType: file.type || "application/octet-stream",
  }, { status: 201 });
}
