import { describe, expect, it } from "vitest";
import { ValueMeasurementService } from "@/lib/value-measurement";
import type { DeploymentOutcome, PricingPlan } from "@/lib/types";

const plan: PricingPlan = {
  plan_id: "plan-1", customer_id: "customer-1", plan_type: "OUTCOME_BASED",
  effective_from: "2026-06-01", integrator_cost_baseline_usd: 8000,
  baseline_confirmed_at: "2026-06-01T00:00:00Z", outcome_share_pct: 0.15,
  min_monthly_fee_usd: 199, max_monthly_cap_usd: 2000,
  billing_cycle: "MONTHLY", measurement_window_days: 30,
};
const period = { start: "2026-06-01", end: "2026-06-30" };
const outcome = (patch: Partial<DeploymentOutcome> = {}): DeploymentOutcome => ({
  task_id: "task-1", customer_id: "customer-1", task_name: "Pack tray",
  deployment_date: "2026-06-10", successful_cycles: 10, outcome_data_complete: true, ...patch,
});

describe("ValueMeasurementService", () => {
  it("calculates normal billing", () => {
    const statement = new ValueMeasurementService().measure({ ...plan, integrator_cost_baseline_usd: 5000, outcome_share_pct: 0.1, max_monthly_cap_usd: 5000 }, period, [outcome()]);
    expect(statement.cost_avoided_usd).toBe(5000);
    expect(statement.final_billable_usd).toBe(500);
  });
  it("applies the monthly floor", () => {
    const statement = new ValueMeasurementService().measure(plan, period, []);
    expect(statement.floor_applied).toBe(true);
    expect(statement.final_billable_usd).toBe(199);
  });
  it("applies the monthly cap", () => {
    const outcomes = [1, 2, 3].map((n) => outcome({ task_id: `task-${n}` }));
    const statement = new ValueMeasurementService().measure(plan, period, outcomes);
    expect(statement.cap_applied).toBe(true);
    expect(statement.final_billable_usd).toBe(2000);
  });
  it("excludes unverifiable outcome data", () => {
    const statement = new ValueMeasurementService().measure(plan, period, [outcome({ successful_cycles: null, outcome_data_complete: false })]);
    expect(statement.tasks_deployed).toBe(0);
    expect(statement.excluded_for_manual_review).toHaveLength(1);
  });
});
