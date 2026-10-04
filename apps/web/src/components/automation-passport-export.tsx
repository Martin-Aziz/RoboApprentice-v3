"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Globe2, PackageOpen, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PassportSharingScope, Task } from "@/lib/types";

export function AutomationPassportExport({ task }: { task: Task }) {
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<PassportSharingScope>("PRIVATE");
  const [recipientOrg, setRecipientOrg] = useState("");
  const [working, setWorking] = useState(false);
  const [result, setResult] = useState<{ passport_id: string; shareable_link: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [sourceRobotModel, setSourceRobotModel] = useState(
    task.robotModel ?? task.targetRobotModels?.[0] ?? "UR5e",
  );
  const [approved, setApproved] = useState(false);
  useEffect(() => {
    fetch(`/api/tasks/${task.id}/trust`).then((response) => response.ok ? response.json() : null).then((record: { approval?: { status?: string } } | null) => setApproved(record?.approval?.status === "approved")).catch(() => setApproved(false));
  }, [task.id]);

  async function exportPassport() {
    setWorking(true);
    setError(null);
    try {
      const response = await fetch(`/api/v1/tasks/${task.id}/passport/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sharing_scope: scope,
          source_org_id: task.organisationId ?? "org-aurevix-demo",
          recipient_org_id: scope === "ORGANISATION" ? recipientOrg : null,
          created_by: "local-operator",
          source_robot_model: sourceRobotModel,
        }),
      });
      const body = await response.json() as { passport_id?: string; shareable_link?: string | null; error?: string };
      if (!response.ok || !body.passport_id) throw new Error(body.error ?? "Passport export failed.");
      setResult({ passport_id: body.passport_id, shareable_link: body.shareable_link ?? null });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Passport export failed.");
    } finally {
      setWorking(false);
    }
  }

  async function copyLink() {
    if (!result?.shareable_link) return;
    await navigator.clipboard.writeText(result.shareable_link);
    setCopied(true);
  }

  return (
    <>
      <Button variant="outline" disabled={!approved} title={!approved ? "A task must be approved before its passport can be exported." : undefined} onClick={() => setOpen(true)} className="gap-2">
        <PackageOpen className="h-4 w-4" />
        Export Automation Passport
      </Button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgb(var(--bone)/0.55)] p-4">
          <div role="dialog" aria-modal="true" className="w-full max-w-xl rounded-md border border-[rgb(var(--steel))] bg-[rgb(var(--ink-2))] shadow-xl">
            <div className="flex items-center justify-between border-b border-[rgb(var(--steel))] p-5">
              <div><p className="font-mono text-xs uppercase tracking-[0.18em] text-[rgb(var(--signal-cyan))]">Portable robot process</p><h2 className="mt-1 font-display text-2xl">Export Automation Passport</h2></div>
              <Button variant="ghost" size="icon" onClick={() => setOpen(false)}><X className="h-5 w-5" /></Button>
            </div>
            <div className="space-y-5 p-5">
              <p className="text-sm text-[rgb(var(--bone-2))]">
                The passport contains robot-agnostic task intent, quality targets, and approved tooling guidance. It excludes source workcell layout, site data, serial numbers, and controller code.
              </p>
              <div className="space-y-2">
                <ScopeOption selected={scope === "PRIVATE"} onClick={() => setScope("PRIVATE")} title="Private" text="Only this organisation can import it." />
                <ScopeOption selected={scope === "ORGANISATION"} onClick={() => setScope("ORGANISATION")} title="Specific organisation" text="Share with one linked organisation." />
                <ScopeOption selected={scope === "SHARED_LINK"} onClick={() => setScope("SHARED_LINK")} title="Shared link" text="Anyone with the secure link can start an import review." />
              </div>
              <label className="grid gap-1.5 text-sm">
                <span className="font-medium">Source robot model</span>
                <select value={sourceRobotModel} onChange={(event) => setSourceRobotModel(event.target.value)} className="rounded-md border border-[rgb(var(--steel))] bg-[rgb(var(--ink-3))] px-3 py-2">
                  <option>UR5e</option><option>UR10e</option><option>UR16e</option><option>ABB GoFa CRB 15000</option><option>FANUC CRX-10iA</option>
                </select>
              </label>
              {scope === "ORGANISATION" && (
                <label className="grid gap-1.5 text-sm"><span className="font-medium">Recipient organisation ID</span><input value={recipientOrg} onChange={(event) => setRecipientOrg(event.target.value)} placeholder="org-supplier-001" className="rounded-md border border-[rgb(var(--steel))] bg-[rgb(var(--ink-3))] px-3 py-2" /></label>
              )}
              {result && (
                <div className="rounded-md border border-[rgb(var(--signal-green)/0.35)] bg-[rgb(var(--signal-green)/0.08)] p-4 text-sm">
                  <p className="font-semibold text-[rgb(var(--signal-green))]">Passport created</p>
                  <p className="mt-1 font-mono text-xs">{result.passport_id}</p>
                  {result.shareable_link && <Button variant="outline" size="sm" onClick={copyLink} className="mt-3 gap-2">{copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy secure import link"}</Button>}
                </div>
              )}
              {error && <p className="rounded-md bg-[rgb(var(--signal-red)/0.1)] p-3 text-sm text-[rgb(var(--signal-red))]">{error}</p>}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setOpen(false)}>Close</Button>
                <Button onClick={exportPassport} disabled={working || (scope === "ORGANISATION" && !recipientOrg.trim())} className="gap-2"><Globe2 className="h-4 w-4" />{working ? "Creating…" : "Create passport"}</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ScopeOption({ selected, onClick, title, text }: { selected: boolean; onClick: () => void; title: string; text: string }) {
  return <button type="button" onClick={onClick} className={`w-full rounded-md border p-3 text-left ${selected ? "border-[rgb(var(--signal-cyan))] bg-[rgb(var(--signal-cyan)/0.07)]" : "border-[rgb(var(--steel))]"}`}><span className="font-semibold">{title}</span><span className="mt-1 block text-sm text-[rgb(var(--bone-2))]">{text}</span></button>;
}
