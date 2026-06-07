/**
 * Cloud Task Library persistence via IndexedDB.
 * Replaces the in-memory task-store.ts with durable, multi-tenant storage.
 * Each task update creates a version entry (versioning moat).
 *
 * API is async (IndexedDB) vs sync (old Map). All callers must await.
 */

import { getDb } from "@/lib/db";
import type {
  Task,
  TaskFeedback,
  TaskPolicy,
  TaskStatus,
  TaskStep,
  CloudTaskLibrary,
  TaskVersion,
} from "@/lib/types";
import { randomUUID } from "crypto";

const DEFAULT_FACILITY_ID = "fac-production-001";

export async function listTasks(facilityId?: string): Promise<CloudTaskLibrary[]> {
  const db = await getDb();
  const fid = facilityId ?? DEFAULT_FACILITY_ID;
  const tasks = await db.getAllFromIndex("tasks", "by-facility", fid);
  return tasks.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

export async function getTask(id: string): Promise<Task | undefined> {
  const db = await getDb();
  const lib = await db.get("tasks", id);
  if (!lib) return undefined;

  const latestVersion = await db.getAllFromIndex("task_versions", "by-task", id);
  const latest = latestVersion[0];
  if (!latest) return undefined;

  return {
    id: lib.task_id,
    facility_id: lib.facility_id,
    title: lib.title,
    description: lib.description,
    videoUrl: "",
    transcript: latest.steps ? undefined : undefined,
    status: lib.status,
    steps: latest.steps,
    policy: latest.policy,
    feedback: [],
    createdAt: lib.created_at,
    updatedAt: lib.updated_at,
    archivedAt: lib.archivedAt,
    targetRobotModels: lib.targetRobotModels,
    gripperConfig: lib.gripperConfig,
  };
}

export async function createTask(
  title: string,
  videoUrl: string,
  transcript?: string,
  facilityId?: string,
): Promise<Task> {
  const db = await getDb();
  const fid = facilityId ?? DEFAULT_FACILITY_ID;
  const now = new Date().toISOString();
  const taskId = randomUUID();

  const lib: CloudTaskLibrary = {
    task_id: taskId,
    facility_id: fid,
    title,
    status: "pending",
    current_version: 1,
    total_versions: 1,
    created_at: now,
    updated_at: now,
  };

  const version: TaskVersion = {
    version_id: randomUUID(),
    task_id: taskId,
    version_number: 1,
    facility_id: fid,
    title,
    steps: [],
    policy: undefined,
    created_at: now,
    status: "active",
  };

  const task: Task = {
    id: taskId,
    facility_id: fid,
    title,
    videoUrl,
    transcript,
    status: "pending",
    steps: [],
    createdAt: now,
    updatedAt: now,
  };

  await db.put("tasks", lib);
  await db.put("task_versions", version);

  return task;
}

export async function updateTask(
  id: string,
  patch: {
    steps?: TaskStep[];
    policy?: TaskPolicy;
    status?: TaskStatus;
    transcript?: string;
    errorMessage?: string;
    description?: string;
  },
): Promise<Task | undefined> {
  const db = await getDb();
  const lib = await db.get("tasks", id);
  if (!lib) return undefined;

  const now = new Date().toISOString();

  const updatedLib: CloudTaskLibrary = {
    ...lib,
    status: patch.status ?? lib.status,
    updated_at: now,
  };

  const nextVersion = lib.total_versions + 1;
  const version: TaskVersion = {
    version_id: randomUUID(),
    task_id: id,
    version_number: nextVersion,
    facility_id: lib.facility_id,
    title: lib.title,
    description: lib.description,
    steps: patch.steps ?? [],
    policy: patch.policy,
    created_at: now,
    status: "active",
  };

  await db.put("tasks", updatedLib);
  await db.put("task_versions", version);

  return {
    id,
    facility_id: lib.facility_id,
    title: lib.title,
    description: lib.description,
    videoUrl: "",
    status: updatedLib.status,
    steps: patch.steps ?? [],
    policy: patch.policy,
    feedback: [],
    createdAt: lib.created_at,
    updatedAt: now,
  };
}

export async function appendFeedback(
  id: string,
  feedback: TaskFeedback,
): Promise<Task | undefined> {
  const db = await getDb();
  const lib = await db.get("tasks", id);
  if (!lib) return undefined;

  const latestVersions = await db.getAllFromIndex("task_versions", "by-task", id);
  const latest = latestVersions[0];
  if (!latest) return undefined;

  const now = new Date().toISOString();
  const updatedLib: CloudTaskLibrary = {
    ...lib,
    updated_at: now,
  };

  await db.put("tasks", updatedLib);

  return {
    id,
    facility_id: lib.facility_id,
    title: lib.title,
    videoUrl: "",
    status: lib.status,
    steps: latest.steps,
    policy: latest.policy,
    feedback: [feedback],
    createdAt: lib.created_at,
    updatedAt: now,
  };
}

export async function getTaskVersions(taskId: string): Promise<TaskVersion[]> {
  const db = await getDb();
  const versions = await db.getAllFromIndex("task_versions", "by-task", taskId);
  return versions.sort((a, b) => b.version_number - a.version_number);
}

export async function rollbackToVersion(taskId: string, versionNumber: number): Promise<Task | undefined> {
  const db = await getDb();
  const lib = await db.get("tasks", taskId);
  if (!lib) return undefined;

  const versions = await db.getAllFromIndex("task_versions", "by-task", taskId);
  const target = versions.find((v) => v.version_number === versionNumber);
  if (!target) return undefined;

  const now = new Date().toISOString();
  const nextVersion = lib.total_versions + 1;

  const newVersionEntry: TaskVersion = {
    version_id: randomUUID(),
    task_id: taskId,
    version_number: nextVersion,
    facility_id: lib.facility_id,
    title: target.title,
    description: target.description,
    steps: target.steps,
    policy: target.policy,
    created_at: now,
    status: "active",
  };

  const updatedLib: CloudTaskLibrary = {
    ...lib,
    total_versions: nextVersion,
    current_version: nextVersion,
    updated_at: now,
  };

  await db.put("tasks", updatedLib);
  await db.put("task_versions", newVersionEntry);

  return {
    id: taskId,
    facility_id: lib.facility_id,
    title: target.title,
    description: target.description,
    videoUrl: "",
    status: lib.status,
    steps: target.steps,
    policy: target.policy,
    feedback: [],
    createdAt: lib.created_at,
    updatedAt: now,
  };
}
