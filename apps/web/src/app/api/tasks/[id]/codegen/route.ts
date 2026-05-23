import { NextRequest, NextResponse } from "next/server";
import { getTask } from "@/lib/task-store";
import { toUrscript, toRos2Python, toPseudocode } from "@/lib/codegen";

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

  const target = req.nextUrl.searchParams.get("target") ?? "all";
  const download = req.nextUrl.searchParams.get("download") === "1";
  const policy = task.policy;
  const title = task.title;

  if (target === "urscript") {
    const code = toUrscript(policy, title);
    return new NextResponse(code, {
      status: 200,
      headers: download
        ? {
            "Content-Type": "text/plain; charset=utf-8",
            "Content-Disposition": `attachment; filename="aurevix-skill.urscript"`,
          }
        : { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  if (target === "ros2_python") {
    const code = toRos2Python(policy, title);
    return new NextResponse(code, {
      status: 200,
      headers: download
        ? {
            "Content-Type": "text/x-python; charset=utf-8",
            "Content-Disposition": `attachment; filename="aurevix_skill.py"`,
          }
        : { "Content-Type": "text/x-python; charset=utf-8" },
    });
  }

  if (target === "pseudocode") {
    return new NextResponse(toPseudocode(policy, title), {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  return NextResponse.json({
    urscript: toUrscript(policy, title),
    ros2_python: toRos2Python(policy, title),
    pseudocode: toPseudocode(policy, title),
    estimated_cycle_seconds: policy.estimatedCycleSeconds,
    step_count: policy.steps.length,
  });
}
