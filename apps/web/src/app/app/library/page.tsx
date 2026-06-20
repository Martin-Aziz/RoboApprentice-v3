"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useDemoData } from "@/lib/use-demo-data";
import { DeployReadiness, ReadinessLegend } from "@/components/deploy-readiness";

export default function LibraryPage() {
  const { skills } = useDemoData();
  const ready = skills.filter((skill) => skill.status === "ready").slice(0, 4);
  return (
    <div className="mx-auto max-w-7xl space-y-6 p-5 md:p-8">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.22em] text-[rgb(var(--signal-cyan))]">Proven templates</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">Skill Templates</h1>
        <p className="mt-2 text-[rgb(var(--bone-2))]">Ready skills available for immediate validation and deployment.</p>
      </div>
      <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
        <ReadinessLegend />
        <p className="max-w-md text-xs text-[rgb(var(--bone-2))]">
          Safety workflow references ISO 10218 and ISO/TS 15066. Qualified validation is still required.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {ready.map((skill, index) => (
          <article key={skill.id} className="overflow-hidden rounded-lg border border-[rgb(var(--steel))] bg-[rgb(var(--ink-2))]">
            <div className="aspect-video bg-[rgb(var(--ink-3))] p-4">
              <div className={`h-full rounded-md ${index % 2 ? "bg-[rgb(var(--signal-green)/0.18)]" : "bg-[rgb(var(--signal-cyan)/0.18)]"} border border-[rgb(var(--steel))]`} />
            </div>
            <div className="p-4">
              <p className="font-semibold">{skill.name}</p>
              <p className="mt-2 line-clamp-3 text-sm text-[rgb(var(--bone-2))]">{skill.description}</p>
              <div className="mt-3"><DeployReadiness confidence={skill.confidence} compact /></div>
              <Link href="/app/teach" className="mt-4 inline-flex items-center gap-2 text-sm text-[rgb(var(--signal-cyan))]">Use template <ArrowRight className="h-4 w-4" /></Link>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
