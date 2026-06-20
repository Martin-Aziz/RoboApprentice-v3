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
  if (!stored) return NextResponse.json({ error: "Fixture design not found.", disclaimer: FIXTURE_VERIFICATION_DISCLAIMER }, { status: 404 });
  return new NextResponse(await readFile(stored.pdf_path), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="aurevix-fixture-${fixtureId}-specification.pdf"`,
      "X-Aurevix-Disclaimer": encodeURIComponent(FIXTURE_VERIFICATION_DISCLAIMER),
    },
  });
}
