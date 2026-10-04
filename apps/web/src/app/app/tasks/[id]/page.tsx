"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AlertTriangle, ArrowLeft, Copy, Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RiskAssessmentDraftAction } from "@/components/risk-assessment-draft";
import { GripperRecommendations } from "@/components/gripper-recommendations";
import { AutomationPassportExport } from "@/components/automation-passport-export";
import { FixtureDesignerPanel } from "@/components/fixture-designer";
import { TaskTrustLayer } from "@/components/task-trust-layer";
import type { Task } from "@/lib/types";
import { summarizePolicyReview } from "@/lib/policy-review";

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

  const reviewSummary = task.policy ? (task.policy.reviewSummary ?? summarizePolicyReview(task.policy)) : null;

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
        {reviewSummary && (
          <div className={`mt-4 rounded-md border p-4 ${reviewSummary.blockedSteps > 0 ? "border-[rgb(var(--signal-red)/0.35)] bg-[rgb(var(--signal-red)/0.06)]" : reviewSummary.reviewSteps > 0 ? "border-[rgb(var(--signal-amber)/0.35)] bg-[rgb(var(--signal-amber)/0.06)]" : "border-[rgb(var(--signal-green)/0.35)] bg-[rgb(var(--signal-green)/0.06)]"}`}>
            <div className="flex items-start gap-3">
              {reviewSummary.blockedSteps > 0 ? <ShieldAlert className="mt-0.5 h-5 w-5 text-[rgb(var(--signal-red))]" /> : reviewSummary.reviewSteps > 0 ? <AlertTriangle className="mt-0.5 h-5 w-5 text-[rgb(var(--signal-amber))]" /> : <AlertTriangle className="mt-0.5 h-5 w-5 text-[rgb(var(--signal-green))]" />}
              <div>
                <p className="font-medium">{reviewSummary.headline}</p>
                <p className="mt-1 text-sm text-[rgb(var(--bone-2))]">{reviewSummary.recommendedAction}</p>
                <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.12em] text-[rgb(var(--bone-2))]">
                  {reviewSummary.readySteps} ready · {reviewSummary.reviewSteps} review · {reviewSummary.blockedSteps} blocked · avg confidence {Math.round(reviewSummary.averageConfidence * 100)}%
                </p>
              </div>
            </div>
          </div>
        )}
        {task.originPassportId && (
          <div className="mt-5 rounded-md border border-[rgb(var(--signal-cyan)/0.3)] bg-[rgb(var(--signal-cyan)/0.06)] p-4">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-[rgb(var(--signal-cyan))]">Automation Passport</p>
            <div className="mt-3 grid gap-2 text-sm md:grid-cols-2"><p><span className="text-[rgb(var(--bone-2))]">Source:</span> UR10e · Assembly Cell 1 · Source organisation</p><p><span className="text-[rgb(var(--bone-2))]">Target:</span> ABB GoFa CRB 15000 · Target cell</p><p><span className="text-[rgb(var(--bone-2))]">Imported:</span> 6/20/2026</p><p className="flex items-center gap-2"><span className="text-[rgb(var(--bone-2))]">Passport ID:</span> <span className="font-mono">{task.originPassportId.slice(0,8)}…{task.originPassportId.slice(-5)}</span><button aria-label="Copy full passport ID" onClick={() => navigator.clipboard.writeText(task.originPassportId!)}><Copy className="h-3.5 w-3.5"/></button></p></div>
            <p className="mt-3 text-sm"><span className="text-[rgb(var(--bone-2))]">Feasibility:</span> waypoints translated, reachability confirmed</p><Button variant="outline" size="sm" className="mt-3">View passport</Button>
          </div>
        )}
      </section>

      <TaskTrustLayer taskId={task.id} />

      <section className="rounded-md border border-[rgb(var(--steel))] bg-[rgb(var(--ink-2))] p-5">
        <h2 className="font-display text-2xl">Motion summary</h2>
        <p className="mt-1 text-sm text-[rgb(var(--bone-2))]">Technical waypoints remain hidden from the risk-document workflow; reviewers see task-level hazard evidence and plain-language prompts.</p>
        <div className="mt-4 space-y-2">
          {task.steps.map((step) => (
            <div key={step.id} className="flex items-center justify-between gap-4 rounded-md border border-[rgb(var(--steel))] p-3 text-sm">
              <div className="min-w-0">
                <span>{step.order}. {step.description}</span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {step.guard && <span className={`rounded-md border px-1.5 py-0.5 font-mono text-[10px] uppercase ${step.guard.status === "blocked" ? "border-[rgb(var(--signal-red)/0.35)] bg-[rgb(var(--signal-red)/0.08)] text-[rgb(var(--signal-red))]" : step.guard.status === "review" ? "border-[rgb(var(--signal-amber)/0.35)] bg-[rgb(var(--signal-amber)/0.08)] text-[rgb(var(--signal-amber))]" : "border-[rgb(var(--signal-green)/0.35)] bg-[rgb(var(--signal-green)/0.08)] text-[rgb(var(--signal-green))]"}`}>{step.guard.status}</span>}
                  {step.requiresVision && <span className="rounded-md border border-[rgb(var(--signal-cyan)/0.35)] bg-[rgb(var(--signal-cyan)/0.08)] px-1.5 py-0.5 font-mono text-[10px] uppercase text-[rgb(var(--signal-cyan))]">vision</span>}
                  {step.fallbackLabel && <span className="rounded-md border border-[rgb(var(--steel))] bg-[rgb(var(--ink-3))] px-1.5 py-0.5 font-mono text-[10px] uppercase text-[rgb(var(--bone-2))]">fallback</span>}
                </div>
                {step.guard && <p className="mt-1 text-xs text-[rgb(var(--bone-2))]">{step.guard.reason}</p>}
              </div>
              <span className="shrink-0 font-mono text-xs tabular text-[rgb(var(--bone-2))]">{Math.round(step.speed * 1000)} mm/s · {Math.round((step.confidence ?? 0.75) * 100)}%</span>
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
