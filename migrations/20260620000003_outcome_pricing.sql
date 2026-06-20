CREATE TABLE IF NOT EXISTS pricing_plans (
    id UUID PRIMARY KEY,
    customer_id UUID NOT NULL,
    plan_type TEXT NOT NULL CHECK (plan_type IN ('FLAT_SUBSCRIPTION', 'OUTCOME_BASED')),
    effective_from TIMESTAMPTZ NOT NULL,
    integrator_cost_baseline_usd NUMERIC(12,2) NOT NULL DEFAULT 8000,
    baseline_confirmed_at TIMESTAMPTZ,
    baseline_evidence_note TEXT,
    outcome_share_pct NUMERIC(6,5) NOT NULL DEFAULT 0.15,
    min_monthly_fee_usd NUMERIC(12,2) NOT NULL DEFAULT 199,
    max_monthly_cap_usd NUMERIC(12,2) NOT NULL DEFAULT 2000,
    billing_cycle TEXT NOT NULL DEFAULT 'MONTHLY',
    measurement_window_days INTEGER NOT NULL DEFAULT 30
);
CREATE TABLE IF NOT EXISTS value_statements (
    id UUID PRIMARY KEY,
    customer_id UUID NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    calculation JSONB NOT NULL,
    closed_at TIMESTAMPTZ NOT NULL,
    UNIQUE(customer_id, period_start, period_end)
);
CREATE TABLE IF NOT EXISTS value_statement_credit_notes (
    id UUID PRIMARY KEY,
    statement_id UUID NOT NULL REFERENCES value_statements(id),
    customer_id UUID NOT NULL,
    amount_usd NUMERIC(12,2) NOT NULL,
    reason TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    created_by UUID NOT NULL
);
