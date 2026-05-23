"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDemoData } from "@/lib/use-demo-data";

export default function ExportPage() {
  const { skills } = useDemoData();
  const ready = skills.filter((skill) => skill.status === "ready");
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-5 md:p-8">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.22em] text-[rgb(var(--signal-cyan))]">Configuration</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">Code export</h1>
      </div>
      <section className="rounded-lg border border-[rgb(var(--steel))] bg-[rgb(var(--ink-2))] p-5">
        <div className="grid gap-4 md:grid-cols-3">
          {["URScript bundle", "ROS 2 package", "PDF report bundle"].map((target) => (
            <button key={target} className="rounded-md border border-[rgb(var(--steel))] p-4 text-left transition hover:border-[rgb(var(--signal-cyan))]">
              <p className="font-semibold">{target}</p>
              <p className="mt-1 text-sm text-[rgb(var(--bone-2))]">{ready.length} ready skills selected</p>
            </button>
          ))}
        </div>
        <Button className="mt-5 gap-2"><Download className="h-4 w-4" /> Generate bundle</Button>
      </section>
      <section className="rounded-lg border border-[rgb(var(--steel))] bg-[rgb(var(--ink-2))]">
        {ready.map((skill) => <div key={skill.id} className="flex items-center justify-between border-b border-[rgb(var(--steel))] px-4 py-3 last:border-b-0"><span>{skill.name}</span><span className="font-mono text-sm">{Math.round(skill.confidence * 100)}%</span></div>)}
      </section>
    </div>
  );
}
