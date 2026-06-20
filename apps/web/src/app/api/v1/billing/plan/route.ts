import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireCustomer } from "@/lib/billing-auth";
import { createDefaultFlatPlan, getPricingAdminData, getPricingPlan, savePricingPlan } from "@/lib/billing-store";
import type { PricingPlanType } from "@/lib/types";

export async function GET(request: NextRequest) {
  const customerId = requireCustomer(request);
  return NextResponse.json((await getPricingPlan(customerId)) ?? await createDefaultFlatPlan(customerId));
}
export async function POST(request: NextRequest) {
  const customerId = requireCustomer(request);
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || !["FLAT_SUBSCRIPTION", "OUTCOME_BASED"].includes(String(body.plan_type))) return NextResponse.json({ error: "Valid plan_type is required." }, { status: 400 });
  const type = body.plan_type as PricingPlanType;
  const baseline = Number(body.integrator_cost_baseline_usd ?? 8000);
  if (type === "OUTCOME_BASED" && body.baseline_confirmed !== true) return NextResponse.json({ error: "Explicit confirmation of the integrator cost baseline is required." }, { status: 422 });
  const admin = await getPricingAdminData();
  const cfg = { ...admin.globalConfig, ...(admin.customerOverrides[customerId] ?? {}) };
  const plan = {
    plan_id: randomUUID(), customer_id: customerId, plan_type: type,
    effective_from: new Date().toISOString(), integrator_cost_baseline_usd: baseline,
    baseline_confirmed_at: type === "OUTCOME_BASED" ? new Date().toISOString() : null,
    baseline_evidence_note: typeof body.baseline_evidence_note === "string" ? body.baseline_evidence_note : undefined,
    outcome_share_pct: cfg.outcome_share_pct!, min_monthly_fee_usd: cfg.min_monthly_fee_usd!,
    max_monthly_cap_usd: cfg.max_monthly_cap_usd!, billing_cycle: "MONTHLY" as const, measurement_window_days: 30,
  };
  return NextResponse.json(await savePricingPlan(plan), { status: 201 });
}
