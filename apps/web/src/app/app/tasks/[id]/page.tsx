"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RiskAssessmentDraftAction } from "@/components/risk-assessment-draft";
import { GripperRecommendations } from "@/components/gripper-recommendations";
import { AutomationPassportExport } from "@/components/automation-passport-export";
import { FixtureDesignerPanel } from "@/components/fixture-designer";
import type { Task } from "@/lib/types";

export default function TaskDetailPage() {
  const params = useParams<{ id: string }>();
  const { data: task, isLoading, error } = useQuery({
    queryKey: ["task", params.id],
    queryFn: async () => {
      const response = await fetch(`/api/tasks/${params.id}`);
      if (!response.ok) throw new Error("Task could not be loaded.");
      return response.json() as Promise<Task>;
    },
  });

  if (isLoading) {
    return <div className="flex min-h-80 items-center justify-center gap-2"><Loader2 className="h-5 w-5 animate-spin" /> Loading task…</div>;
  }
  if (error || !task) {
    return <div className="p-8 text-[rgb(var(--signal-red))]">{error instanceof Error ? error.message : "Task not found."}</div>;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-5 md:p-8">
      <Button asChild variant="ghost">
        <Link href="/app/tasks"><ArrowLeft className="h-4 w-4" /> Task Library</Link>
      </Button>

      <section className="hud rounded-md p-6">
        <span className="hud-corner-tr" />
        <span className="hud-corner-bl" />
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-[rgb(var(--signal-cyan))]">Deployed task record</p>
        <div className="mt-3 flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="font-display text-4xl">{task.title}</h1>
            <p className="mt-2 max-w-2xl text-[rgb(var(--bone-2))]">{task.description ?? task.transcript ?? "No task summary has been recorded."}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <AutomationPassportExport task={task} />
            <RiskAssessmentDraftAction task={task} />
          </div>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <Stat label="Status" value={task.status} />
          <Stat label="Motion steps" value={String(task.steps.length)} />
          <Stat label="Robot model" value={task.targetRobotModels?.[0] ?? "Review required"} />
        </div>
        {task.originPassportId && (
          <p className="mt-4 rounded-md border border-[rgb(var(--signal-cyan)/0.3)] bg-[rgb(var(--signal-cyan)/0.06)] p-3 font-mono text-xs">
            Provenance: imported from passport {task.originPassportId} · parent task {task.parentTaskId}
          </p>
        )}
      </section>

      <section className="rounded-md border border-[rgb(var(--steel))] bg-[rgb(var(--ink-2))] p-5">
        <h2 className="font-display text-2xl">Motion summary</h2>
        <p className="mt-1 text-sm text-[rgb(var(--bone-2))]">Technical waypoints remain hidden from the risk-document workflow; reviewers see task-level hazard evidence and plain-language prompts.</p>
        <div className="mt-4 space-y-2">
          {task.steps.map((step) => (
            <div key={step.id} className="flex items-center justify-between gap-4 rounded-md border border-[rgb(var(--steel))] p-3 text-sm">
              <span>{step.order}. {step.description}</span>
              <span className="shrink-0 font-mono text-xs tabular text-[rgb(var(--bone-2))]">{Math.round(step.speed * 1000)} mm/s</span>
            </div>
          ))}
        </div>
      </section>

      <GripperRecommendations task={task} />
      <FixtureDesignerPanel task={task} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md bg-[rgb(var(--ink-3))] p-4"><p className="font-mono text-lg tabular">{value}</p><p className="text-xs text-[rgb(var(--bone-2))]">{label}</p></div>;
}
