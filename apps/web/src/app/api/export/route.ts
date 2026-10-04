import { NextResponse } from "next/server";
import { isExportable } from "@/lib/trust-layer";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { target?: unknown; skills?: unknown } | null;
  if (!body || !Array.isArray(body.skills) || body.skills.length === 0) {
    return NextResponse.json({ error: "Select at least one approved skill before generating a bundle." }, { status: 400 });
  }
  const target = body.target ?? "report";
  const allowedTargets = new Set(["urscript", "ros2", "report"]);
  if (typeof target !== "string" || !allowedTargets.has(target)) {
    return NextResponse.json({ error: "Choose URScript, ROS 2, or PDF report as the export target." }, { status: 400 });
  }
  const skills = body.skills.filter((skill): skill is { id: string; name?: string; readinessScore: number } => {
    if (!skill || typeof skill !== "object") return false;
    const candidate = skill as Record<string, unknown>;
    return typeof candidate.id === "string" && (candidate.name === undefined || typeof candidate.name === "string") && typeof candidate.readinessScore === "number" && Number.isFinite(candidate.readinessScore);
  });
  if (skills.length !== body.skills.length) {
    return NextResponse.json({ error: "One or more selected skills contains invalid export data." }, { status: 400 });
  }
  const blocked = skills.find((skill) => !isExportable(skill.readinessScore));
  if (blocked) return NextResponse.json({ code: "DEPLOY_READINESS_BLOCKED", reason: `Skill ${blocked.id} has ${blocked.readinessScore}% deploy readiness. Skills below 80% cannot be exported.`, skillId: blocked.id, readinessScore: blocked.readinessScore }, { status: 409 });
  return NextResponse.json({
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    target,
    skills: skills.map((skill) => ({ ...skill, name: skill.name ?? skill.id })),
    exported: skills.length,
    verificationNotice: "Controller output must be reviewed and validated in the installed workcell before deployment.",
  });
}
