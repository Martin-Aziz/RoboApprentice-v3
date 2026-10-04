"use client";

import Link from "next/link";
import { Check, Download, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DeployReadiness } from "@/components/deploy-readiness";
import { useDemoData } from "@/lib/use-demo-data";
import { isExportable } from "@/lib/trust-layer";
import { useState } from "react";

export default function ExportPage() {
  const { skills } = useDemoData();
  const [blockedAttempt, setBlockedAttempt] = useState<string | null>(null);
  const [target, setTarget] = useState<"urscript" | "ros2" | "report">("urscript");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const selectable = skills.filter((skill) => isExportable(Math.round(skill.confidence * 100)));

  const toggleSkill = (id: string, allowed: boolean) => {
    if (!allowed) {
      setBlockedAttempt(id);
      return;
    }
    setMessage(null);
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  const generateBundle = async () => {
    if (generating) return;
    const selected = selectable.filter((skill) => selectedIds.includes(skill.id));
    if (selected.length === 0) {
      setMessage("Select at least one skill with 80% or higher deploy readiness.");
      return;
    }
    setGenerating(true);
    setMessage(null);
    try {
      const response = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target, skills: selected.map((skill) => ({ id: skill.id, name: skill.name, readinessScore: Math.round(skill.confidence * 100) })) }),
      });
      const payload = await response.json().catch(() => null) as Record<string, unknown> | null;
      if (!response.ok) throw new Error(typeof payload?.error === "string" ? payload.error : typeof payload?.reason === "string" ? payload.reason : `Export failed with HTTP ${response.status}.`);
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `aurevix-${target}-bundle-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setMessage(`${selected.length} skill${selected.length === 1 ? "" : "s"} exported. Validate the bundle in the installed workcell before deployment.`);
    } catch (error) {
      console.error("[ExportPage.generateBundle] Export failed", { target, selectedIds, error });
      setMessage(error instanceof Error ? error.message : "The export could not be generated. Check the selected skills and try again.");
    } finally {
      setGenerating(false);
    }
  };

  return <div className="mx-auto max-w-6xl space-y-6 p-5 md:p-8">
    <div><p className="font-mono text-xs uppercase tracking-[0.22em] text-[rgb(var(--signal-cyan))]">Configuration</p><h1 className="mt-3 text-4xl font-semibold tracking-tight">Code export</h1><p className="mt-2 text-sm text-[rgb(var(--bone-2))]">Controller code is a supporting output of the reviewed task record.</p></div>
    <section className="rounded-lg border border-[rgb(var(--steel))] bg-[rgb(var(--ink-2))] p-5">
      <div className="grid gap-4 md:grid-cols-3">{([ ["urscript", "URScript bundle"], ["ros2", "ROS 2 package"], ["report", "PDF report manifest"] ] as const).map(([value, label]) => <button type="button" aria-pressed={target === value} key={value} onClick={() => setTarget(value)} className={`rounded-md border p-4 text-left transition duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--signal-cyan))] ${target === value ? "border-[rgb(var(--signal-cyan))] bg-[rgb(var(--signal-cyan)/0.06)]" : "border-[rgb(var(--steel))] hover:border-[rgb(var(--signal-cyan))]"}`}><p className="flex items-center justify-between font-semibold">{label}{target === value && <Check className="h-4 w-4 text-[rgb(var(--signal-cyan))]" />}</p><p className="mt-1 text-sm text-[rgb(var(--bone-2))]">{selectedIds.length} skills selected</p></button>)}</div>
      <Button className="mt-5 gap-2" onClick={generateBundle} disabled={generating || selectedIds.length === 0}><Download className="h-4 w-4" /> {generating ? "Generating bundle…" : "Generate bundle"}</Button>
      {message && <p role="status" className="mt-3 text-sm text-[rgb(var(--bone-2))]">{message}</p>}
    </section>
    <section className="overflow-hidden rounded-lg border border-[rgb(var(--steel))] bg-[rgb(var(--ink-2))]">
      {skills.map((skill) => {
        const score = Math.round(skill.confidence * 100); const allowed = isExportable(score);
        const selected = selectedIds.includes(skill.id);
        return <button key={skill.id} type="button" aria-pressed={allowed ? selected : undefined} onClick={() => toggleSkill(skill.id, allowed)} className={`w-full border-b border-[rgb(var(--steel))] px-4 py-4 text-left transition duration-150 last:border-b-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[rgb(var(--signal-cyan))] ${allowed ? selected ? "bg-[rgb(var(--signal-cyan)/0.08)]" : "hover:bg-[rgb(var(--ink-3))]" : "bg-[rgb(var(--ink-3)/0.65)] opacity-75"}`}>
          <div className="flex items-center justify-between gap-4"><div className="flex items-start gap-3">{allowed && <span aria-hidden="true" className={`mt-0.5 grid h-5 w-5 place-items-center rounded border ${selected ? "border-[rgb(var(--signal-cyan))] bg-[rgb(var(--signal-cyan))] text-white" : "border-[rgb(var(--steel))]"}`}>{selected && <Check className="h-3.5 w-3.5" />}</span>}<div><span className="font-medium">{skill.name}</span>{!allowed && <p className="mt-1 flex items-center gap-1.5 text-xs text-[rgb(var(--signal-red))]"><LockKeyhole className="h-3.5 w-3.5" /> BLOCKED — below 80% deploy readiness</p>}</div></div><DeployReadiness confidence={skill.confidence} /></div>
          {blockedAttempt === skill.id && <div className="mt-3 rounded-md border border-[rgb(var(--signal-red)/0.3)] bg-[rgb(var(--signal-red)/0.06)] p-3 text-sm text-[rgb(var(--bone-2))]">Deploy readiness is {score}%. Skills below 80% cannot be exported. Re-demonstrate this task or complete the missing evidence checks. <Link href="/app/review?tab=blocked" className="font-medium text-[rgb(var(--signal-cyan))] underline">Open task review</Link></div>}
        </button>;
      })}
    </section>
  </div>;
}
