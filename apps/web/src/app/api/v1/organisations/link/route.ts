import { NextRequest, NextResponse } from "next/server";
import { createOrganisationLink } from "@/lib/passport-store";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (
    !body ||
    typeof body.organisation_a_id !== "string" ||
    typeof body.organisation_b_id !== "string"
  ) {
    return NextResponse.json(
      { error: "organisation_a_id and organisation_b_id are required." },
      { status: 400 },
    );
  }
  try {
    const link = await createOrganisationLink(
      body.organisation_a_id,
      body.organisation_b_id,
      typeof body.created_by === "string" ? body.created_by : "local-admin",
    );
    return NextResponse.json(link, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Organisation link failed." },
      { status: 422 },
    );
  }
}
