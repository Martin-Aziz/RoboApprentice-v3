"use client";

import { useEffect, useState } from "react";
import { Download, FileCheck2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DeployReadiness } from "@/components/deploy-readiness";

const checks = ["Motion policy validated", "Deployment target recorded", "Simulation reviewed", "Risk assessment completed", "Workcell safeguards verified", "Supervised trial passed"];
const records = [
  { id:"pick", name:"Pick Bracket A", version:3, robot:"UR5e", cell:"Assembly Cell 1", score:94, complete:4, reviewer:"Dr. Elena Fischer", hash:"sha256:8d14f2c0ab72", queue:"awaiting" },
  { id:"connector", name:"Place Connector (drift detected)", version:2, robot:"TM12", cell:"Quality Inspection Cell", score:68, complete:2, reviewer:"Unassigned", hash:"sha256:11a02ce798bd", queue:"blocked" },
  { id:"cnc", name:"Load Blanks into CNC Fixture", version:4, robot:"KR 6 R900", cell:"CNC Tending Cell 3", score:91, complete:6, reviewer:"M. Schneider", hash:"sha256:73fe9ab213c1", queue:"approved" },
  { id:"stale", name:"Pack Components in Tray", version:5, robot:"LR Mate 200iD", cell:"Machine Tend Cell 2", score:86, complete:5, reviewer:"S. Weber", hash:"sha256:policy-new-52a1", queue:"stale" },
] as const;
type Tab = "awaiting"|"blocked"|"approved"|"stale";

export default function ReviewPage() {
  const [tab, setTab] = useState<Tab>("awaiting");
  useEffect(() => { const requested = new URLSearchParams(window.location.search).get("tab") as Tab | null; if (requested) setTab(requested); }, []);
  const [open, setOpen] = useState<(typeof records)[number] | null>(null);
  if (open) return <ReviewDetail record={open} onBack={() => setOpen(null)} />;
  const labels: Array<[Tab,string]> = [["awaiting","Awaiting review"],["blocked","Blocked"],["approved","Approved"],["stale","Stale approvals"]];
  return <div className="mx-auto max-w-7xl space-y-6 p-5 md:p-8">
    <header><p className="font-mono text-xs uppercase tracking-[0.22em] text-[rgb(var(--signal-cyan))]">Deployment evidence</p><h1 className="mt-3 text-4xl font-semibold tracking-tight">Review &amp; Approvals</h1><p className="mt-2 max-w-4xl text-sm text-[rgb(var(--bone-2))]">Tasks awaiting evidence completion or qualified sign-off. Aurevix does not certify safety; a qualified person must review the installed workcell.</p></header>
    <div role="tablist" className="flex flex-wrap gap-2 border-b border-[rgb(var(--steel))]">{labels.map(([key,label]) => <button role="tab" aria-selected={tab===key} key={key} onClick={() => setTab(key)} className={`border-b-2 px-4 py-3 text-sm ${tab===key?"border-[rgb(var(--signal-cyan))] text-[rgb(var(--signal-cyan))]":"border-transparent text-[rgb(var(--bone-2))]"}`}>{label}</button>)}</div>
    {records.filter(r=>r.queue===tab).map(record => <article key={record.id} className="hud relative rounded-lg p-5"><span className="hud-corner-tr"/><span className="hud-corner-bl"/><div className="grid gap-5 lg:grid-cols-[1.5fr_1fr_1fr_auto] lg:items-center"><div><h2 className="font-semibold">{record.name} <span className="font-mono text-xs text-[rgb(var(--bone-2))]">· v{record.version}</span></h2><p className="mt-1 text-sm text-[rgb(var(--bone-2))]">{record.robot} · {record.cell}</p>{record.queue==="stale"&&<p className="mt-2 text-xs font-semibold text-[rgb(var(--signal-amber))]">STALE — policy changed after approval</p>}</div><div><DeployReadiness confidence={record.score/100}/><p className="mt-2 text-xs text-[rgb(var(--bone-2))]" title={checks.slice(record.complete).join(", ")}>{record.complete} / 6 checks complete</p></div><div><p className="font-mono text-xs">{record.hash.slice(0,18)}…</p><p className="mt-1 text-xs text-[rgb(var(--bone-2))]">{record.reviewer}</p></div><Button onClick={()=>setOpen(record)}>Open review</Button></div></article>)}
  </div>;
}

function ReviewDetail({record,onBack}:{record:(typeof records)[number];onBack:()=>void}) {
  const [rationale, setRationale] = useState("");
  const [decision, setDecision] = useState<"approved" | "rejected" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const canApprove = record.complete === checks.length && record.queue !== "stale";

  const recordDecision = (nextDecision: "approved" | "rejected") => {
    const trimmed = rationale.trim();
    if (trimmed.length < 12) {
      setMessage("Add a specific rationale of at least 12 characters before recording a decision.");
      return;
    }
    if (nextDecision === "approved" && !canApprove) {
      setMessage(record.queue === "stale" ? "This approval is stale because the policy changed. Complete a fresh review against the current hash." : `Approval is blocked until all ${checks.length} evidence checks are complete.`);
      return;
    }
    setDecision(nextDecision);
    setMessage(`${nextDecision === "approved" ? "Approval" : "Rejection"} recorded for this review session with the supplied rationale.`);
  };

  const downloadRecord = (kind: "evidence" | "passport") => {
    if (kind === "passport" && decision !== "approved" && record.queue !== "approved") {
      setMessage("Approve the current task version before exporting its Automation Passport.");
      return;
    }
    const payload = { schemaVersion: 1, kind, exportedAt: new Date().toISOString(), task: record, decision, rationale: rationale.trim() || null, checks: checks.map((name, index) => ({ name, complete: index < record.complete })) };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${record.id}-${kind}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setMessage(`${kind === "evidence" ? "Evidence package" : "Automation Passport"} exported.`);
  };

  return <div className="mx-auto max-w-5xl space-y-6 p-5 md:p-8"><button onClick={onBack} className="text-sm text-[rgb(var(--signal-cyan))]">← Review queue</button><header><p className="font-mono text-xs uppercase tracking-[0.22em] text-[rgb(var(--signal-cyan))]">Qualified review · v{record.version}</p><h1 className="mt-3 text-4xl font-semibold">{record.name}</h1><p className="mt-2 text-sm text-[rgb(var(--bone-2))]">Aurevix does not certify safety. Approval records qualified review of the installed workcell.</p></header>
    <section className="hud relative rounded-lg p-5"><span className="hud-corner-tr"/><span className="hud-corner-bl"/><h2 className="font-semibold">Evidence checklist</h2><div className="mt-4 space-y-3">{checks.map((check,i)=><div key={check} className="grid gap-2 rounded-md border border-[rgb(var(--steel))] p-3 md:grid-cols-[1fr_200px_180px]"><div className="flex gap-2"><FileCheck2 className={`h-4 w-4 ${i<record.complete?"text-[rgb(var(--signal-green))]":"text-[rgb(var(--signal-amber))]"}`}/><span className="text-sm">{check}</span></div><span className="text-xs text-[rgb(var(--bone-2))]">{i<record.complete?record.reviewer:"Reviewer required"}</span><span className="font-mono text-xs text-[rgb(var(--bone-2))]">{i<record.complete?"2026-07-08 14:32":"Pending"}</span></div>)}</div></section>
    <section className="rounded-lg border border-[rgb(var(--steel))] bg-[rgb(var(--ink-2))] p-5"><h2 className="font-semibold">Bound record</h2><p className="mt-3 font-mono text-sm">Policy hash: {record.hash}</p><p className="mt-1 text-sm text-[rgb(var(--bone-2))]">Task version v{record.version} · {record.robot} · {record.cell}</p></section>
    <section className="rounded-lg border border-[rgb(var(--steel))] bg-[rgb(var(--ink-2))] p-5"><h2 className="font-semibold">Decision and rationale</h2><label htmlFor="review-rationale" className="mt-3 block text-sm text-[rgb(var(--bone-2))]">Document the evidence considered, operating limits, and reason for the decision.</label><textarea id="review-rationale" required value={rationale} onChange={(event) => { setRationale(event.target.value); setMessage(null); }} placeholder="Required rationale for approval or rejection" className="mt-2 min-h-24 w-full rounded-md border border-[rgb(var(--steel))] bg-[rgb(var(--ink))] p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--signal-cyan))]"/><div className="mt-3 flex gap-2"><Button onClick={() => recordDecision("approved")} disabled={!canApprove}><ShieldCheck className="mr-2 h-4 w-4"/>Approve</Button><Button variant="outline" onClick={() => recordDecision("rejected")}>Reject</Button></div>{message && <p role="status" className="mt-3 text-sm text-[rgb(var(--bone-2))]">{message}</p>}{decision && <p className={`mt-2 text-sm font-semibold ${decision === "approved" ? "text-[rgb(var(--signal-green))]" : "text-[rgb(var(--signal-red))]"}`}>Current session decision: {decision}</p>}</section>
    <section className="rounded-lg border border-[rgb(var(--steel))] bg-[rgb(var(--ink-2))] p-5"><h2 className="font-semibold">Audit event log</h2><p className="mt-3 text-sm text-[rgb(var(--bone-2))]">2026-07-08 14:32 · Evidence checklist updated · {record.reviewer}</p><p className="mt-2 text-sm text-[rgb(var(--bone-2))]">2026-07-07 09:10 · Policy hash bound to task version v{record.version}</p></section>
    <div className="flex flex-wrap gap-3"><Button variant="outline" onClick={() => downloadRecord("evidence")}><Download className="mr-2 h-4 w-4"/>Export evidence package</Button><Button onClick={() => downloadRecord("passport")} disabled={decision!=="approved" && record.queue!=="approved"} title={decision!=="approved" && record.queue!=="approved"?"A task must be approved before its passport can be exported.":undefined}><Download className="mr-2 h-4 w-4"/>Export Automation Passport</Button></div>
  </div>;
}
