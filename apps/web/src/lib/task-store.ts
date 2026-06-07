import type { Task, TaskFeedback, TaskPolicy, TaskStatus, TaskStep } from "./types";
import { randomUUID } from "crypto";

declare global {
  // eslint-disable-next-line no-var
  var __roboApprenticeTasks: Map<string, Task> | undefined;
}

const tasks = globalThis.__roboApprenticeTasks ?? new Map<string, Task>();

globalThis.__roboApprenticeTasks = tasks;

export function listTasks(): Task[] {
  return Array.from(tasks.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export function getTask(id: string): Task | undefined {
  return tasks.get(id);
}

export function createTask(title: string, videoUrl: string, transcript?: string): Task {
  const now = new Date().toISOString();
  const task: Task = {
    id: randomUUID(),
    facility_id: "fac-production-001",
    title,
    videoUrl,
    transcript,
    status: "pending",
    steps: [],
    feedback: [],
    createdAt: now,
    updatedAt: now,
  };
  tasks.set(task.id, task);
  return task;
}

export function updateTask(
  id: string,
  patch: {
    steps?: TaskStep[];
    policy?: TaskPolicy;
    status?: TaskStatus;
    transcript?: string;
    errorMessage?: string;
  },
): Task | undefined {
  const task = tasks.get(id);
  if (!task) return undefined;
  const updated: Task = {
    ...task,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  tasks.set(id, updated);
  return updated;
}

export function appendFeedback(id: string, feedback: TaskFeedback): Task | undefined {
  const task = tasks.get(id);
  if (!task) return undefined;
  const updated: Task = {
    ...task,
    feedback: [...(task.feedback ?? []), feedback],
    updatedAt: new Date().toISOString(),
  };
  tasks.set(id, updated);
  return updated;
}
