import { readFile } from "fs/promises";
import { NextResponse } from "next/server";
import { FIXTURE_VERIFICATION_DISCLAIMER } from "@/lib/fixture-designer";
import { getFixtureDesign } from "@/lib/fixture-design-store";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ fixture_id: string }> },
) {
  const { fixture_id: fixtureId } = await params;
  const stored = await getFixtureDesign(fixtureId);
  if (!stored?.stl_path) {
    return NextResponse.json(
      { error: "No validated STL is available for this design.", disclaimer: FIXTURE_VERIFICATION_DISCLAIMER },
      { status: 404 },
    );
  }
  return new NextResponse(await readFile(stored.stl_path), {
    headers: {
      "Content-Type": "model/stl",
      "Content-Disposition": `attachment; filename="aurevix-fixture-${fixtureId}.stl"`,
      "X-Aurevix-Disclaimer": encodeURIComponent(FIXTURE_VERIFICATION_DISCLAIMER),
    },
  });
}
