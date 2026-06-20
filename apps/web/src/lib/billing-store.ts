import { randomUUID } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import { dirname, join } from "path";
import type {
  CreditNote, DeploymentOutcome, OutcomePricingConfig, PricingPlan, ValueStatement,
} from "./types";
import {
  DEFAULT_INTEGRATOR_BASELINE_USD, DEFAULT_MAX_MONTHLY_CAP_USD,
  DEFAULT_MIN_MONTHLY_FEE_USD, DEFAULT_OUTCOME_SHARE_PCT,
} from "./value-measurement";

const PATH = join(process.cwd(), ".aurevix-data", "billing.json");
interface Store {
  plans: Record<string, PricingPlan>;
  outcomes: DeploymentOutcome[];
  statements: Record<string, ValueStatement>;
  credits: CreditNote[];
  globalConfig: OutcomePricingConfig;
  customerOverrides: Record<string, Partial<OutcomePricingConfig>>;
}
declare global { var __aurevixBillingStore: Store | undefined; }

function defaults(): Store {
  const now = new Date().toISOString();
  return {
    plans: {}, statements: {}, credits: [],
    globalConfig: { outcome_share_pct: DEFAULT_OUTCOME_SHARE_PCT, min_monthly_fee_usd: DEFAULT_MIN_MONTHLY_FEE_USD, max_monthly_cap_usd: DEFAULT_MAX_MONTHLY_CAP_USD, updated_at: now },
    customerOverrides: {},
    outcomes: [
      { task_id: "skl-pick-bracket-a", customer_id: "customer-demo", task_name: "Pick Bracket A", deployment_date: "2026-06-06", successful_cycles: 1247, outcome_data_complete: true },
      { task_id: "skl-pack-tray", customer_id: "customer-demo", task_name: "Pack Components in Tray", deployment_date: "2026-06-14", successful_cycles: 36, outcome_data_complete: true },
      { task_id: "skl-feedback-missing", customer_id: "customer-demo", task_name: "New machine-tending trial", deployment_date: "2026-06-18", successful_cycles: null, outcome_data_complete: false },
    ],
  };
}
async function store() {
  if (globalThis.__aurevixBillingStore) return globalThis.__aurevixBillingStore;
  try { globalThis.__aurevixBillingStore = JSON.parse(await readFile(PATH, "utf-8")) as Store; }
  catch { globalThis.__aurevixBillingStore = defaults(); }
  return globalThis.__aurevixBillingStore;
}
async function persist(value: Store) { await mkdir(dirname(PATH), { recursive: true }); await writeFile(PATH, JSON.stringify(value, null, 2), "utf-8"); }

export async function getPricingPlan(customerId: string) { return (await store()).plans[customerId]; }
export async function savePricingPlan(plan: PricingPlan) { const s = await store(); s.plans[plan.customer_id] = plan; await persist(s); return plan; }
export async function createDefaultFlatPlan(customerId: string): Promise<PricingPlan> {
  const s = await store(); const cfg = { ...s.globalConfig, ...(s.customerOverrides[customerId] ?? {}) };
  return { plan_id: randomUUID(), customer_id: customerId, plan_type: "FLAT_SUBSCRIPTION", effective_from: new Date().toISOString(), integrator_cost_baseline_usd: DEFAULT_INTEGRATOR_BASELINE_USD, baseline_confirmed_at: null, outcome_share_pct: cfg.outcome_share_pct!, min_monthly_fee_usd: cfg.min_monthly_fee_usd!, max_monthly_cap_usd: cfg.max_monthly_cap_usd!, billing_cycle: "MONTHLY", measurement_window_days: 30 };
}
export async function getOutcomes(customerId: string) { return (await store()).outcomes.filter((x) => x.customer_id === customerId); }
export async function getStatement(customerId: string, periodKey: string) { return (await store()).statements[`${customerId}:${periodKey}`]; }
export async function closeStatement(periodKey: string, statement: ValueStatement) {
  const s = await store(); const key = `${statement.customer_id}:${periodKey}`;
  if (s.statements[key]) return s.statements[key];
  s.statements[key] = statement; await persist(s); return statement;
}
export async function getPricingAdminData() { return store(); }
export async function updateGlobalConfig(config: OutcomePricingConfig) { const s = await store(); s.globalConfig = config; await persist(s); return config; }
export async function updateCustomerOverride(customerId: string, override: Partial<OutcomePricingConfig>) { const s = await store(); s.customerOverrides[customerId] = override; await persist(s); return override; }
