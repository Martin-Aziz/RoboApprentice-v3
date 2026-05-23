import { NextRequest, NextResponse } from "next/server";
import { getTask } from "@/lib/task-store";
import { buildManifest, buildPythonSimulator } from "@/lib/simulation";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const task = getTask(id);
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!task.policy || task.policy.steps.length === 0) {
    return NextResponse.json(
      { error: "Task has no policy yet. Run /interpret first." },
      { status: 409 },
    );
  }

  const format = req.nextUrl.searchParams.get("format") ?? "json";
  const download = req.nextUrl.searchParams.get("download") === "1";

  if (format === "python") {
    const py = buildPythonSimulator(task.policy, task.title);
    return new NextResponse(py, {
      status: 200,
      headers: download
        ? {
            "Content-Type": "text/x-python; charset=utf-8",
            "Content-Disposition": `attachment; filename="simulate.py"`,
          }
        : { "Content-Type": "text/x-python; charset=utf-8" },
    });
  }

  const manifest = buildManifest(task.policy, task.title);
  if (download) {
    return new NextResponse(JSON.stringify(manifest, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="aurevix-simulation.json"`,
      },
    });
  }
  return NextResponse.json(manifest);
}
