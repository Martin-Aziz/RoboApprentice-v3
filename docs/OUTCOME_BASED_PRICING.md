# Outcome-Based Pricing

Outcome-based pricing is an optional alternative to the flat subscription. It begins only when the customer selects it and is never applied retroactively.

## How the monthly calculation works

A task counts only when it reaches at least 10 verified successful cycles during the billing month. Failed deployments and tasks without submitted outcome evidence do not count.

For qualifying tasks:

1. Multiply qualifying tasks by the customer-confirmed integrator baseline.
2. Multiply that avoided cost by the agreed Aurevix outcome share.
3. Apply the disclosed monthly minimum.
4. Apply the disclosed monthly maximum.

Default example:

- Confirmed baseline: $8,000 per task change
- Aurevix share: 15%
- Monthly minimum: $199
- Monthly maximum: $2,000

Two qualifying tasks represent $16,000 of avoided integration cost. The uncapped 15% fee is $2,400, so the customer pays the disclosed $2,000 cap and keeps $14,000.

## Baseline confirmation

The customer must explicitly confirm the baseline in the plan-selection UI. They may replace the $8,000 default with a verified figure from their own invoices. The plan cannot activate without confirmation.

## Missing outcome data

If Aurevix cannot verify 10 successful cycles, the task is excluded and listed for manual review. Estimated outcomes are never billed.

## Closed statements and disputes

Closing a period creates an immutable `ValueStatement`. Reopening or overwriting it is not allowed. If a customer disputes a task, baseline, or outcome, investigate the evidence and issue a separate `CreditNote` referencing the original statement. The original report remains intact for auditability.

## Changing commercial settings

Global share, floor, and cap are managed at `/app/admin/pricing`. Enterprise overrides are stored per customer. Changes affect future statements and plan changes; they do not mutate closed statements.

API authorization uses customer and role identity headers in the local MVP. Hosted deployments must populate these from verified authentication middleware:

- `x-aurevix-customer-id`
- `x-aurevix-role: admin`
