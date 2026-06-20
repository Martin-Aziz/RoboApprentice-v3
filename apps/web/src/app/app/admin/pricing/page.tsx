"use client";
import { useEffect,useState } from "react";
import { Button } from "@/components/ui/button";
export default function AdminPricing(){
 const [data,setData]=useState<any>(null),[share,setShare]=useState("0.15"),[floor,setFloor]=useState("199"),[cap,setCap]=useState("2000");
 async function load(){const r=await fetch("/api/v1/admin/pricing/outcome-summary",{headers:{"x-aurevix-role":"admin"}});const b=await r.json();setData(b);if(b.global_config){setShare(String(b.global_config.outcome_share_pct));setFloor(String(b.global_config.min_monthly_fee_usd));setCap(String(b.global_config.max_monthly_cap_usd));}}
 useEffect(()=>{load()},[]);
 async function save(){await fetch("/api/v1/admin/pricing/outcome-summary",{method:"POST",headers:{"Content-Type":"application/json","x-aurevix-role":"admin"},body:JSON.stringify({outcome_share_pct:Number(share),min_monthly_fee_usd:Number(floor),max_monthly_cap_usd:Number(cap)})});load()}
 return <div className="mx-auto max-w-6xl space-y-6 p-5 md:p-8"><div><p className="font-mono text-xs uppercase tracking-[.2em] text-[rgb(var(--signal-cyan))]">Admin</p><h1 className="mt-2 font-display text-4xl">Outcome pricing configuration</h1></div>
 <section className="rounded-md border border-[rgb(var(--steel))] bg-[rgb(var(--ink-2))] p-5"><div className="grid gap-3 sm:grid-cols-3"><Field label="Outcome share (decimal)" v={share} set={setShare}/><Field label="Monthly minimum USD" v={floor} set={setFloor}/><Field label="Monthly maximum USD" v={cap} set={setCap}/></div><Button className="mt-4" onClick={save}>Save global configuration</Button></section>
 <section className="rounded-md border border-[rgb(var(--steel))] bg-[rgb(var(--ink-2))] p-5"><h2 className="font-display text-2xl">Outcome-based customers</h2><div className="mt-4 space-y-2">{data?.customers?.map((x:any)=><div key={x.customer_id} className="grid grid-cols-4 rounded-md bg-[rgb(var(--ink-3))] p-3 text-sm"><span>{x.customer_id}</span><span>{x.tasks_deployed} tasks</span><span>${x.cost_avoided_usd} avoided</span><span>${x.projected_fee_usd} projected</span></div>)||<p>No active outcome customers.</p>}</div></section></div>
}
function Field({label,v,set}:{label:string;v:string;set:(x:string)=>void}){return <label className="grid gap-1 text-sm"><span>{label}</span><input type="number" value={v} onChange={e=>set(e.target.value)} className="rounded-md border border-[rgb(var(--steel))] bg-[rgb(var(--ink-3))] px-3 py-2"/></label>}
