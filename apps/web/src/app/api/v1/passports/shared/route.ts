import { NextRequest, NextResponse } from "next/server";
import { listPassportsForOrganisation } from "@/lib/passport-store";

export async function GET(request: NextRequest) {
  const orgId = request.nextUrl.searchParams.get("organisation_id") ?? "org-aurevix-demo";
  const passports = await listPassportsForOrganisation(orgId);
  return NextResponse.json(
    passports.map((passport) => ({
      passport_id: passport.passport_id,
      source_robot_model: passport.source_robot_model,
      source_task_id: passport.source_task_id,
      created_at: passport.created_at,
      sharing_scope: passport.sharing_scope,
      quality_parameters: passport.quality_parameters,
    })),
  );
}
