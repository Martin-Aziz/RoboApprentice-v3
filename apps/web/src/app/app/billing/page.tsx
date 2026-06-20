import { PricingPlanSelector } from "@/components/pricing-plan-selector";
import { ValueStatementView } from "@/components/value-statement";
export default function BillingPage(){return <div className="mx-auto max-w-6xl space-y-6 p-5 md:p-8"><div><p className="font-mono text-xs uppercase tracking-[.2em] text-[rgb(var(--signal-cyan))]">Value-based billing</p><h1 className="mt-2 font-display text-4xl">Pricing &amp; value statements</h1></div><PricingPlanSelector/><ValueStatementView/></div>}
