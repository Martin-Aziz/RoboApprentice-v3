import { afterEach, describe, expect, it } from "vitest";
import { existsSync } from "fs";
import { unlink } from "fs/promises";
import { join } from "path";
import { POST } from "@/app/api/uploads/demo-video/route";
import type { NextRequest } from "next/server";

const writtenFiles: string[] = [];

function makeRequest(file?: File) {
  const form = new FormData();
  if (file) form.append("video", file);
  return { formData: async () => form } as NextRequest;
}

afterEach(async () => {
  await Promise.all(
    writtenFiles.splice(0).map((path) => unlink(path).catch(() => undefined)),
  );
});

describe("demo video upload API", () => {
  it("stores a server-readable video under public uploads", async () => {
    const bytes = new Uint8Array([0, 1, 2, 3]);
    const file = new File([bytes], "demo.mp4", { type: "video/mp4" });
    Object.defineProperty(file, "arrayBuffer", {
      value: async () => bytes.buffer,
    });
    const res = await POST(makeRequest(file));
    const payload = (await res.json()) as { videoUrl: string; originalName: string; size: number };

    expect(res.status).toBe(201);
    expect(payload.videoUrl).toMatch(/^\/uploads\/demos\/.+\.mp4$/);
    expect(payload.originalName).toBe("demo.mp4");
    expect(payload.size).toBe(4);

    const absolutePath = join(process.cwd(), "public", payload.videoUrl);
    writtenFiles.push(absolutePath);
    expect(existsSync(absolutePath)).toBe(true);
  });

  it("rejects missing and unsupported files", async () => {
    const missing = await POST(makeRequest());
    expect(missing.status).toBe(400);

    const textFile = new File(["hello"], "notes.txt", { type: "text/plain" });
    const unsupported = await POST(makeRequest(textFile));
    expect(unsupported.status).toBe(415);
  });
});
