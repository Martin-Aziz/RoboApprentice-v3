import { NextRequest, NextResponse } from "next/server";
import {
  PassportImportService,
  SUPPORTED_PASSPORT_ROBOTS,
} from "@/lib/automation-passport";
import type { PassportWorkcellConfig, RobotModel } from "@/lib/types";

function parseWorkcell(value: unknown): PassportWorkcellConfig {
  if (!value || typeof value !== "object") {
    throw new Error("target_workcell_config is required.");
  }
  const raw = value as Record<string, unknown>;
  const dimensions = raw.dimensions as Record<string, unknown> | undefined;
  const origin = raw.origin as Record<string, unknown> | undefined;
  if (!dimensions || !origin) {
    throw new Error("target_workcell_config requires dimensions and origin.");
  }
  const parsed: PassportWorkcellConfig = {
    dimensions: {
      x: Number(dimensions.x),
      y: Number(dimensions.y),
      z: Number(dimensions.z),
    },
    origin: {
      x: Number(origin.x),
      y: Number(origin.y),
      z: Number(origin.z),
    },
    toolFrame: typeof raw.toolFrame === "string" ? raw.toolFrame : undefined,
  };
  if (
    Object.values(parsed.dimensions).some((item) => !Number.isFinite(item) || item <= 0) ||
    [parsed.origin.x, parsed.origin.y, parsed.origin.z].some((item) => !Number.isFinite(item))
  ) {
    throw new Error("Target workcell dimensions and origin must contain valid metre values.");
  }
  return parsed;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ passport_id: string }> },
) {
  try {
    const { passport_id: passportId } = await params;
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    if (
      typeof body.target_robot_model !== "string" ||
      !SUPPORTED_PASSPORT_ROBOTS.includes(body.target_robot_model as RobotModel)
    ) {
      return NextResponse.json(
        { error: "Select a supported target robot model." },
        { status: 400 },
      );
    }
    const result = await new PassportImportService().import({
      passportId,
      targetRobotModel: body.target_robot_model as RobotModel,
      targetWorkcellConfig: parseWorkcell(body.target_workcell_config),
      targetFacilityId:
        typeof body.target_facility_id === "string"
          ? body.target_facility_id
          : "fac-production-001",
      targetOrganisationId:
        typeof body.target_organisation_id === "string"
          ? body.target_organisation_id
          : "org-aurevix-demo",
      shareToken: typeof body.share_token === "string" ? body.share_token : null,
    });
    return NextResponse.json(result, {
      status: result.deployment_blocked ? 409 : 201,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Passport import failed.";
    const status = message.includes("not found") ? 404 : message.includes("not available") || message.includes("invalid") ? 403 : 422;
    return NextResponse.json({ error: message }, { status });
  }
}
