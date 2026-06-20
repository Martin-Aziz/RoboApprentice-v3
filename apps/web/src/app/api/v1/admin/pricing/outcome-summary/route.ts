import { NextRequest, NextResponse } from "next/server";
import { authError, requireAdmin } from "@/lib/billing-auth";
import { getPricingAdminData, updateCustomerOverride, updateGlobalConfig } from "@/lib/billing-store";
import { ValueMeasurementService } from "@/lib/value-measurement";

export async function GET(request: NextRequest) {
  try {
    requireAdmin(request); const data = await getPricingAdminData();
    const now = new Date(); const period = { start: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0,10), end: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth()+1,0)).toISOString().slice(0,10) };
    const customers = Object.values(data.plans).filter((p) => p.plan_type === "OUTCOME_BASED").map((plan) => {
      const statement = new ValueMeasurementService().measure(plan, period, data.outcomes);
      return { customer_id: plan.customer_id, cost_avoided_usd: statement.cost_avoided_usd, projected_fee_usd: statement.final_billable_usd, tasks_deployed: statement.tasks_deployed };
    });
    return NextResponse.json({ global_config: data.globalConfig, customer_overrides: data.customerOverrides, customers });
  } catch (e) { return NextResponse.json({ error: "Admin access required." }, { status: authError(e) ? 403 : 500 }); }
}
export async function POST(request: NextRequest) {
  try {
    requireAdmin(request); const body = await request.json() as Record<string, unknown>;
    const config = { outcome_share_pct: Number(body.outcome_share_pct), min_monthly_fee_usd: Number(body.min_monthly_fee_usd), max_monthly_cap_usd: Number(body.max_monthly_cap_usd), updated_at: new Date().toISOString() };
    if (typeof body.customer_id === "string") return NextResponse.json(await updateCustomerOverride(body.customer_id, config));
    return NextResponse.json(await updateGlobalConfig(config));
  } catch (e) { return NextResponse.json({ error: "Admin access required." }, { status: authError(e) ? 403 : 400 }); }
}
