import { NextRequest, NextResponse } from "next/server";
import { requireCustomer } from "@/lib/billing-auth";
import { closeStatement, getOutcomes, getPricingPlan, getStatement } from "@/lib/billing-store";
import { ValueMeasurementService } from "@/lib/value-measurement";

function range(period: string) {
  if (!/^\d{4}-\d{2}$/.test(period)) throw new Error("Period must use YYYY-MM.");
  const [year, month] = period.split("-").map(Number);
  return { start: `${period}-01`, end: new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10) };
}
export async function GET(request: NextRequest, { params }: { params: Promise<{ period: string }> }) {
  try {
    const customerId = requireCustomer(request); const { period } = await params;
    const existing = await getStatement(customerId, period);
    if (existing) return NextResponse.json({ ...existing, pdf_url: `/api/v1/billing/value-statement/${period}/pdf` });
    const plan = await getPricingPlan(customerId);
    if (!plan) return NextResponse.json({ error: "No pricing plan is configured." }, { status: 404 });
    if (plan.effective_from.slice(0, 7) > period) return NextResponse.json({ error: "Outcome pricing is not retroactive." }, { status: 422 });
    const statement = new ValueMeasurementService().measure(plan, range(period), await getOutcomes(customerId));
    return NextResponse.json({ ...(await closeStatement(period, statement)), pdf_url: `/api/v1/billing/value-statement/${period}/pdf` });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Statement failed." }, { status: 422 }); }
}
