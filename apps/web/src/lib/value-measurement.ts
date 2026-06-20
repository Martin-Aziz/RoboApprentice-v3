import { randomUUID } from "crypto";
import type {
  DateRange,
  DeploymentOutcome,
  PricingPlan,
  ValueStatement,
} from "./types";

export const QUALIFYING_SUCCESSFUL_CYCLES = 10;
export const DEFAULT_INTEGRATOR_BASELINE_USD = 8000;
export const DEFAULT_OUTCOME_SHARE_PCT = 0.15;
export const DEFAULT_MIN_MONTHLY_FEE_USD = 199;
export const DEFAULT_MAX_MONTHLY_CAP_USD = 2000;

function money(value: number) {
  return Number(value.toFixed(2));
}

export class ValueMeasurementService {
  measure(
    plan: PricingPlan,
    period: DateRange,
    outcomes: DeploymentOutcome[],
    closedAt = new Date().toISOString(),
  ): ValueStatement {
    if (plan.plan_type !== "OUTCOME_BASED") {
      throw new Error("Value statements are only available for outcome-based plans.");
    }
    if (!plan.baseline_confirmed_at) {
      throw new Error("The customer must explicitly confirm the integrator baseline before billing.");
    }
    const inPeriod = outcomes.filter(
      (item) =>
        item.customer_id === plan.customer_id &&
        item.deployment_date >= period.start &&
        item.deployment_date <= period.end,
    );
    const excluded = inPeriod
      .filter((item) => !item.outcome_data_complete || item.successful_cycles === null)
      .map((item) => ({
        task_id: item.task_id,
        task_name: item.task_name,
        reason: "Outcome feedback was incomplete, so this task was excluded from billing and flagged for manual review.",
      }));
    const qualifying = inPeriod.filter(
      (item) =>
        item.outcome_data_complete &&
        item.successful_cycles !== null &&
        item.successful_cycles >= QUALIFYING_SUCCESSFUL_CYCLES,
    );
    const costAvoided = qualifying.length * plan.integrator_cost_baseline_usd;
    const outcomeFee = costAvoided * plan.outcome_share_pct;
    const afterFloor = Math.max(outcomeFee, plan.min_monthly_fee_usd);
    const finalBillable = Math.min(afterFloor, plan.max_monthly_cap_usd);
    return {
      statement_id: randomUUID(),
      customer_id: plan.customer_id,
      billing_period: period,
      tasks_deployed: qualifying.length,
      integrator_cost_baseline_usd: money(plan.integrator_cost_baseline_usd),
      cost_avoided_usd: money(costAvoided),
      outcome_fee_usd: money(outcomeFee),
      floor_applied: outcomeFee < plan.min_monthly_fee_usd,
      cap_applied: afterFloor > plan.max_monthly_cap_usd,
      final_billable_usd: money(finalBillable),
      task_breakdown: qualifying.map((item) => ({
        task_id: item.task_id,
        task_name: item.task_name,
        deployment_date: item.deployment_date,
        cycle_count_at_billing: item.successful_cycles as number,
      })),
      excluded_for_manual_review: excluded,
      closed_at: closedAt,
      immutable: true,
    };
  }
}
