import { NextRequest, NextResponse } from "next/server";
import { PassportExportService } from "@/lib/automation-passport";
import type { PassportSharingScope } from "@/lib/types";

const SCOPES = new Set<PassportSharingScope>([
  "PRIVATE",
  "ORGANISATION",
  "SHARED_LINK",
]);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ task_id: string }> },
) {
  try {
    const { task_id: taskId } = await params;
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!body || !SCOPES.has(body.sharing_scope as PassportSharingScope)) {
      return NextResponse.json(
        { error: "sharing_scope must be PRIVATE, ORGANISATION, or SHARED_LINK." },
        { status: 400 },
      );
    }
    const sourceOrgId =
      typeof body.source_org_id === "string" && body.source_org_id.trim()
        ? body.source_org_id.trim()
        : "org-aurevix-demo";
    const passport = await new PassportExportService().create({
      taskId,
      sourceOrgId,
      createdBy:
        typeof body.created_by === "string" ? body.created_by : "local-operator",
      sharingScope: body.sharing_scope as PassportSharingScope,
      recipientOrgId:
        typeof body.recipient_org_id === "string"
          ? body.recipient_org_id.trim()
          : null,
      sourceRobotModel:
        typeof body.source_robot_model === "string"
          ? body.source_robot_model.trim()
          : undefined,
    });
    const shareableLink = passport.share_token
      ? `${request.nextUrl.origin}/app/passports/${passport.passport_id}/import?token=${passport.share_token}`
      : null;
    return NextResponse.json({
      passport_id: passport.passport_id,
      sharing_scope: passport.sharing_scope,
      shareable_link: shareableLink,
      privacy_notice:
        "Source workcell layout, robot serial numbers, site information, and controller program were not included.",
    }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Passport export failed.";
    const status = message === "Task not found." ? 404 : 422;
    return NextResponse.json({ error: message }, { status });
  }
}
