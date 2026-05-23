"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDemoData } from "@/lib/use-demo-data";
import { formatDate, formatDuration } from "@/lib/format";
import { useLocale } from "@/lib/i18n";

export default function ExecutionsPage() {
  const { executions, robots, skills } = useDemoData();
  const { locale } = useLocale();
  const exportCsv = () => {
    const rows = ["time,robot,skill,cycle_ms,status", ...executions.map((execution) => {
      const robot = robots.find((item) => item.id === execution.robot_id);
      const skill = skills.find((item) => item.id === execution.skill_id);
      return [execution.started_at, robot?.name ?? execution.robot_id, skill?.name ?? execution.skill_id, execution.cycle_ms ?? "", execution.status].join(",");
    })];
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "aurevix-executions.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-5 md:p-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-[rgb(var(--signal-cyan))]">Analysis</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight">Execution history</h1>
        </div>
        <Button variant="outline" onClick={exportCsv} className="gap-2"><Download className="h-4 w-4" /> Export CSV</Button>
      </div>
      <div className="overflow-hidden rounded-lg border border-[rgb(var(--steel))] bg-[rgb(var(--ink-2))]">
        <div className="grid grid-cols-[1.2fr_1fr_1fr_0.7fr_0.7fr] border-b border-[rgb(var(--steel))] px-4 py-3 text-xs font-medium uppercase tracking-wide text-[rgb(var(--bone-2))]">
          <span>Time</span><span>Robot</span><span>Skill</span><span>Cycle</span><span>Status</span>
        </div>
        {executions.slice(0, 80).map((execution) => {
          const robot = robots.find((item) => item.id === execution.robot_id);
          const skill = skills.find((item) => item.id === execution.skill_id);
          return (
            <div key={execution.id} className="grid grid-cols-[1.2fr_1fr_1fr_0.7fr_0.7fr] border-b border-[rgb(var(--steel))] px-4 py-3 text-sm last:border-b-0">
              <span>{formatDate(execution.started_at, locale)}</span>
              <span>{robot?.name}</span>
              <span>{skill?.name}</span>
              <span className="font-mono tabular">{formatDuration(execution.cycle_ms ?? 0, locale)}</span>
              <span className="font-mono uppercase">{execution.status}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
