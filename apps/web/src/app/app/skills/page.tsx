"use client";

import { AlertTriangle, CheckCircle2, GraduationCap } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { DeployReadiness, ReadinessLegend } from "@/components/deploy-readiness";
import { useDemoData } from "@/lib/use-demo-data";
import { formatDate, formatDuration, formatNumber } from "@/lib/format";
import { useLocale } from "@/lib/i18n";

export default function SkillsPage() {
  const { skills } = useDemoData();
  const { locale } = useLocale();
  return (
    <div className="mx-auto max-w-7xl space-y-6 p-5 md:p-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-[rgb(var(--signal-cyan))]">Reusable automation</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight">My Skills</h1>
        </div>
        <Button asChild><Link href="/app/teach"><GraduationCap className="mr-2 h-4 w-4" /> Teach from video</Link></Button>
      </div>
      <ReadinessLegend />
      <div className="grid gap-4 lg:grid-cols-2">
        {skills.map((skill) => (
          <Link key={skill.id} href={`/app/skills/${skill.id}`} data-testid="skill-card" className="rounded-lg border border-[rgb(var(--steel))] bg-[rgb(var(--ink-2))] p-5 transition hover:border-[rgb(var(--signal-cyan))]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-semibold">{skill.name}</h2>
                <p className="mt-1 text-sm text-[rgb(var(--bone-2))]">{skill.description}</p>
              </div>
              <DeployReadiness confidence={skill.confidence} compact />
            </div>
            {skill.drift_alert && <p className="mt-4 flex gap-2 rounded-md bg-[rgb(var(--signal-amber)/0.1)] p-3 text-sm text-[rgb(var(--signal-amber))]"><AlertTriangle className="h-4 w-4" /> {skill.drift_alert}</p>}
            <div className="mt-5 grid grid-cols-4 gap-3">
              <div><span className="font-mono text-xs uppercase text-[rgb(var(--bone-2))]">Record active</span><p className="mt-1 text-xs text-[rgb(var(--bone-2))]">Lifecycle</p></div>
              <Small label="Runs" value={formatNumber(skill.run_count, locale)} />
              <Small label="Success" value={skill.run_count ? `${Math.round((skill.success_count / skill.run_count) * 100)}%` : "Not measured"} />
              <Small label="Cycle" value={skill.mean_cycle_ms ? formatDuration(skill.mean_cycle_ms, locale) : "Not measured"} />
            </div>
            <p className="mt-4 text-xs text-[rgb(var(--bone-2))]">Updated {formatDate(skill.updated_at, locale)}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

function Small({ label, value }: { label: string; value: string }) {
  return <div><p className="font-mono text-sm tabular">{value}</p><p className="text-xs text-[rgb(var(--bone-2))]">{label}</p></div>;
}
