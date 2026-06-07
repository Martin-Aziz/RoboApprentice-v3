"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { GraduationCap, Loader2 } from "lucide-react";
import { formatDate } from "@/lib/format";
import { useLocale } from "@/lib/i18n";
import type { CloudTaskLibrary } from "@/lib/types";

async function fetchTasks(): Promise<CloudTaskLibrary[]> {
  const res = await fetch("/api/tasks");
  if (!res.ok) throw new Error("Failed to fetch tasks");
  return res.json();
}

export default function TaskLibraryPage() {
  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["tasks"],
    queryFn: fetchTasks,
  });
  const { locale } = useLocale();

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-5 md:p-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-[rgb(var(--signal-cyan))]">
            Cloud system-of-record
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight">Task Library</h1>
        </div>
        <Button asChild>
          <Link href="/app/teach">
            <GraduationCap className="mr-2 h-4 w-4" /> Teach a new task
          </Link>
        </Button>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center gap-2 rounded-lg border border-[rgb(var(--steel))] bg-[rgb(var(--ink-3))] p-8">
          <Loader2 className="h-5 w-5 animate-spin text-[rgb(var(--signal-cyan))]" />
          <span className="text-sm text-[rgb(var(--bone-2))]">Loading tasks...</span>
        </div>
      )}

      {!isLoading && tasks.length === 0 && (
        <div className="rounded-lg border border-[rgb(var(--steel))] bg-[rgb(var(--ink-2))] p-8 text-center">
          <p className="text-[rgb(var(--bone-2))]">
            No tasks yet. <Link href="/app/teach" className="font-semibold text-[rgb(var(--signal-cyan))] hover:underline">Teach your first task</Link> to get started.
          </p>
        </div>
      )}

      {!isLoading && tasks.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          {tasks.map((task) => (
            <TaskCard key={task.task_id} task={task} locale={locale} />
          ))}
        </div>
      )}
    </div>
  );
}

function TaskCard({ task, locale }: { task: CloudTaskLibrary; locale: string }) {
  const statusColor = {
    pending: "bg-[rgb(var(--signal-amber)/0.12)] text-[rgb(var(--signal-amber))]",
    processing: "bg-[rgb(var(--signal-cyan)/0.12)] text-[rgb(var(--signal-cyan))]",
    done: "bg-[rgb(var(--signal-green)/0.12)] text-[rgb(var(--signal-green))]",
    error: "bg-[rgb(var(--signal-red)/0.12)] text-[rgb(var(--signal-red))]",
  }[task.status];

  return (
    <Link
      href={`/app/tasks/${task.task_id}`}
      data-testid="task-card"
      className="rounded-lg border border-[rgb(var(--steel))] bg-[rgb(var(--ink-2))] p-5 transition hover:border-[rgb(var(--signal-cyan))]"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h2 className="font-semibold">{task.title}</h2>
          {task.description && (
            <p className="mt-1 text-sm text-[rgb(var(--bone-2))]">{task.description}</p>
          )}
        </div>
        <span className={`rounded-full px-2 py-1 font-mono text-xs tabular ${statusColor}`}>
          {task.status}
        </span>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3">
        <Small label="Versions" value={String(task.total_versions ?? 1)} />
        <Small label="Status" value={task.status} />
        <Small label="Created" value={new Date(task.created_at).toLocaleDateString()} />
      </div>

      {task.targetRobotModels && task.targetRobotModels.length > 0 && (
        <p className="mt-3 text-xs text-[rgb(var(--bone-2))]">
          Target robots: {task.targetRobotModels.join(", ")}
        </p>
      )}

      {task.gripperConfig && (
        <p className="mt-2 text-xs text-[rgb(var(--bone-2))]">Gripper: {task.gripperConfig}</p>
      )}
    </Link>
  );
}

function Small({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-mono text-sm tabular">{value}</p>
      <p className="text-xs text-[rgb(var(--bone-2))]">{label}</p>
    </div>
  );
}
