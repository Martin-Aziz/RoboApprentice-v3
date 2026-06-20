"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { GraduationCap, Loader2, PackageOpen } from "lucide-react";
import { formatDate } from "@/lib/format";
import { useLocale } from "@/lib/i18n";
import type { CloudTaskLibrary } from "@/lib/types";
import { useState } from "react";

interface SharedPassportSummary {
  passport_id: string;
  source_robot_model: string;
  source_task_id: string;
  created_at: string;
}

async function fetchTasks(): Promise<CloudTaskLibrary[]> {
  const res = await fetch("/api/tasks");
  if (!res.ok) throw new Error("Failed to fetch tasks");
  return res.json();
}

export default function TaskLibraryPage() {
  const [tab, setTab] = useState<"tasks" | "shared">("tasks");
  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["tasks"],
    queryFn: fetchTasks,
  });
  const { locale } = useLocale();
  const { data: shared = [], isLoading: sharedLoading } = useQuery({
    queryKey: ["shared-passports"],
    queryFn: async () => {
      const response = await fetch("/api/v1/passports/shared?organisation_id=org-aurevix-demo");
      if (!response.ok) throw new Error("Failed to fetch shared passports");
      return response.json() as Promise<SharedPassportSummary[]>;
    },
  });

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

      <div className="flex gap-2 border-b border-[rgb(var(--steel))]">
        <button onClick={() => setTab("tasks")} className={`border-b-2 px-4 py-2 text-sm ${tab === "tasks" ? "border-[rgb(var(--signal-cyan))] text-[rgb(var(--signal-cyan))]" : "border-transparent text-[rgb(var(--bone-2))]"}`}>My tasks</button>
        <button onClick={() => setTab("shared")} className={`border-b-2 px-4 py-2 text-sm ${tab === "shared" ? "border-[rgb(var(--signal-cyan))] text-[rgb(var(--signal-cyan))]" : "border-transparent text-[rgb(var(--bone-2))]"}`}>Shared with us</button>
      </div>

      {tab === "tasks" && isLoading && (
        <div className="flex items-center justify-center gap-2 rounded-lg border border-[rgb(var(--steel))] bg-[rgb(var(--ink-3))] p-8">
          <Loader2 className="h-5 w-5 animate-spin text-[rgb(var(--signal-cyan))]" />
          <span className="text-sm text-[rgb(var(--bone-2))]">Loading tasks...</span>
        </div>
      )}

      {tab === "tasks" && !isLoading && tasks.length === 0 && (
        <div className="rounded-lg border border-[rgb(var(--steel))] bg-[rgb(var(--ink-2))] p-8 text-center">
          <p className="text-[rgb(var(--bone-2))]">
            No tasks yet. <Link href="/app/teach" className="font-semibold text-[rgb(var(--signal-cyan))] hover:underline">Teach your first task</Link> to get started.
          </p>
        </div>
      )}

      {tab === "tasks" && !isLoading && tasks.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          {tasks.map((task) => (
            <TaskCard key={task.task_id} task={task} locale={locale} />
          ))}
        </div>
      )}

      {tab === "shared" && (
        sharedLoading ? <div className="p-8 text-center text-sm">Loading shared passports…</div> :
        shared.length ? <div className="grid gap-4 lg:grid-cols-2">{shared.map((passport) => <Link key={passport.passport_id} href={`/app/passports/${passport.passport_id}/import`} className="rounded-md border border-[rgb(var(--steel))] bg-[rgb(var(--ink-2))] p-5 hover:border-[rgb(var(--signal-cyan))]"><PackageOpen className="h-5 w-5 text-[rgb(var(--signal-cyan))]" /><h2 className="mt-3 font-semibold">Automation Passport</h2><p className="mt-1 text-sm text-[rgb(var(--bone-2))]">Originally run on {passport.source_robot_model}</p><p className="mt-4 font-mono text-xs">{passport.passport_id}</p></Link>)}</div> :
        <div className="rounded-md border border-[rgb(var(--steel))] bg-[rgb(var(--ink-2))] p-8 text-center text-[rgb(var(--bone-2))]">No passports have been shared with this organisation.</div>
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
