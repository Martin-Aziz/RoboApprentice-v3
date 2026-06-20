"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { GraduationCap, Loader2, PackageOpen } from "lucide-react";
import { formatDate } from "@/lib/format";
import { useLocale } from "@/lib/i18n";
import type { CloudTaskLibrary } from "@/lib/types";
import { useState } from "react";
import { Search } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";

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
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
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
  const groupedTasks = Object.values(tasks.reduce<Record<string, { task: CloudTaskLibrary; count: number }>>((groups, task) => {
    const key = `${task.title.toLowerCase()}::${task.status}`;
    const current = groups[key];
    if (!current || new Date(task.created_at) > new Date(current.task.created_at)) groups[key] = { task, count: (current?.count ?? 0) + 1 };
    else current.count += 1;
    return groups;
  }, {})).filter(({ task }) =>
    (status === "all" || task.status === status) &&
    `${task.title} ${task.description ?? ""}`.toLowerCase().includes(query.toLowerCase())
  ).sort((a, b) => Number(Boolean(b.task.targetRobotModels?.length)) - Number(Boolean(a.task.targetRobotModels?.length)));

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-5 md:p-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-[rgb(var(--signal-cyan))]">
            Automation records
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight">Task Records</h1>
        </div>
        <Button asChild>
          <Link href="/app/teach">
            <GraduationCap className="mr-2 h-4 w-4" /> Teach from video
          </Link>
        </Button>
      </div>

      {tab === "tasks" && (
        <div className="grid gap-3 rounded-lg border border-[rgb(var(--steel))] bg-[rgb(var(--ink-2))] p-4 sm:grid-cols-[1fr_auto]">
          <label className="flex items-center gap-2 rounded-md border border-[rgb(var(--steel))] bg-[rgb(var(--ink))] px-3">
            <Search className="h-4 w-4 text-[rgb(var(--bone-2))]" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search task records" className="min-h-11 w-full bg-transparent text-sm outline-none" />
          </label>
          <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter by status" className="min-h-11 rounded-md border border-[rgb(var(--steel))] bg-[rgb(var(--ink))] px-3 text-sm">
            <option value="all">All statuses</option><option value="done">Ready</option><option value="processing">Processing</option><option value="pending">Pending</option><option value="error">Needs attention</option>
          </select>
        </div>
      )}

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
          {groupedTasks.map(({ task, count }) => (
            <TaskCard key={task.task_id} task={task} locale={locale} duplicateCount={count} />
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

function TaskCard({ task, locale, duplicateCount }: { task: CloudTaskLibrary; locale: string; duplicateCount: number }) {
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
        <StatusBadge status={task.status} />
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3">
        <Small label={duplicateCount > 1 ? "Similar records" : "Versions"} value={String(duplicateCount > 1 ? duplicateCount : task.total_versions ?? 1)} />
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
