"use client";
import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ValueStatement } from "@/lib/types";

export function ValueStatementView() {
  const [period,setPeriod]=useState("2026-06"); const [statement,setStatement]=useState<ValueStatement|null>(null); const [loading,setLoading]=useState(false); const [error,setError]=useState("");
  async function load(){setLoading(true);setError("");const r=await fetch(`/api/v1/billing/value-statement/${period}`,{headers:{"x-aurevix-customer-id":"customer-demo"}});const b=await r.json();if(r.ok)setStatement(b);else setError(b.error);setLoading(false);}
  return <section className="space-y-5">
    <div className="flex flex-wrap items-end gap-3"><label className="grid gap-1 text-sm"><span>Billing month</span><input type="month" value={period} onChange={e=>setPeriod(e.target.value)} className="rounded-md border border-[rgb(var(--steel))] bg-[rgb(var(--ink-3))] px-3 py-2"/></label><Button onClick={load} disabled={loading}>{loading?<Loader2 className="animate-spin"/>:"Open value statement"}</Button></div>
    {error&&<p className="rounded-md bg-[rgb(var(--signal-red)/0.1)] p-3 text-sm text-[rgb(var(--signal-red))]">{error}</p>}
    {statement&&<div className="hud rounded-md p-6"><span className="hud-corner-tr"/><span className="hud-corner-bl"/>
      <p className="font-mono text-xs uppercase tracking-[.18em] text-[rgb(var(--signal-cyan))]">Monthly value report</p><h2 className="mt-2 font-display text-4xl">Here&apos;s what Aurevix saved you this month</h2>
      <div className="mt-6 grid gap-3 sm:grid-cols-4"><Metric label="Tasks deployed" value={String(statement.tasks_deployed)}/><Metric label="Cost avoided" value={usd(statement.cost_avoided_usd)}/><Metric label="Aurevix fee" value={usd(statement.final_billable_usd)}/><Metric label="You kept" value={usd(statement.cost_avoided_usd-statement.final_billable_usd)}/></div>
      <p className="mt-5 text-lg">You avoided <b>{usd(statement.cost_avoided_usd)}</b> in integration costs. Aurevix&apos;s share: <b>{usd(statement.final_billable_usd)}</b>. You kept: <b>{usd(statement.cost_avoided_usd-statement.final_billable_usd)}</b>.</p>
      <p className="mt-2 text-sm text-[rgb(var(--bone-2))]">Only tasks reaching 10 verified successful cycles during the period count. Unverifiable outcomes are never billed.</p>
      <div className="mt-5 overflow-hidden rounded-md border border-[rgb(var(--steel))]"><div className="grid grid-cols-[1fr_160px_120px] bg-[rgb(var(--ink-3))] p-3 text-xs font-semibold"><span>Task</span><span>Deployment</span><span>Cycles</span></div>{statement.task_breakdown.map(x=><div key={x.task_id} className="grid grid-cols-[1fr_160px_120px] border-t border-[rgb(var(--steel))] p-3 text-sm"><span>{x.task_name}</span><span>{x.deployment_date}</span><span className="font-mono">{x.cycle_count_at_billing}</span></div>)}</div>
      {statement.excluded_for_manual_review.length>0&&<div className="mt-4 rounded-md bg-[rgb(var(--signal-amber)/0.1)] p-4 text-sm"><b>Excluded for manual review:</b> {statement.excluded_for_manual_review.map(x=>x.task_name).join(", ")}</div>}
      <Button asChild variant="outline" className="mt-5 gap-2"><a href={statement.pdf_url} download><Download/>Download as PDF</a></Button>
    </div>}
  </section>;
}
const usd=(v:number)=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(v);
function Metric({label,value}:{label:string;value:string}){return <div className="rounded-md bg-[rgb(var(--ink-3))] p-4"><p className="font-mono text-2xl tabular">{value}</p><p className="text-xs text-[rgb(var(--bone-2))]">{label}</p></div>}
