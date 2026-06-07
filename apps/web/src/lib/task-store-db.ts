/**
 * Cloud Task Library persistence — server-side, file-backed store.
 *
 * Route handlers run in the Node.js runtime, where `indexedDB` does not
 * exist (it's a browser API — see lib/db.ts which is client-only). This
 * store persists to a JSON file on disk so tasks and their version history
 * survive server restarts, satisfying the "system of record" requirement
 * for a local demo. Swap `readStore`/`writeStore` for a real database
 * (Postgres, DynamoDB, etc.) when migrating to a hosted backend — the
 * exported function signatures are the seam to do that without touching
 * any caller.
 *
 * Each task update creates a new version entry (versioning moat).
 */

import { mkdir, readFile, writeFile } from "fs/promises";
import { dirname, join } from "path";
import { randomUUID } from "crypto";
import type {
  Task,
  TaskFeedback,
  TaskPolicy,
  TaskStatus,
  TaskStep,
  CloudTaskLibrary,
  TaskVersion,
} from "@/lib/types";

const DEFAULT_FACILITY_ID = "fac-production-001";
const DATA_DIR = join(process.cwd(), ".aurevix-data");
const TASKS_FILE = join(DATA_DIR, "tasks.json");
const VERSIONS_FILE = join(DATA_DIR, "task-versions.json");

interface StoreShape {
  tasks: Record<string, CloudTaskLibrary>;
  versions: Record<string, TaskVersion[]>; // keyed by task_id
}

declare global {
  // eslint-disable-next-line no-var
  var __aurevixTaskStore: StoreShape | undefined;
  // eslint-disable-next-line no-var
  var __aurevixTaskStoreLoaded: Promise<StoreShape> | undefined;
}

async function readJson<T>(path: string, fallback: T): Promise<T> {
  try {
    const raw = await readFile(path, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function loadStore(): Promise<StoreShape> {
  const [tasks, versions] = await Promise.all([
    readJson<Record<string, CloudTaskLibrary>>(TASKS_FILE, {}),
    readJson<Record<string, TaskVersion[]>>(VERSIONS_FILE, {}),
  ]);
  return { tasks, versions };
}

async function getStore(): Promise<StoreShape> {
  if (globalThis.__aurevixTaskStore) return globalThis.__aurevixTaskStore;
  if (!globalThis.__aurevixTaskStoreLoaded) {
    globalThis.__aurevixTaskStoreLoaded = loadStore().then((store) => {
      globalThis.__aurevixTaskStore = store;
      return store;
    });
  }
  return globalThis.__aurevixTaskStoreLoaded;
}

let writeQueue: Promise<unknown> = Promise.resolve();

function persist(store: StoreShape): void {
  // Serialize writes so concurrent updates can't interleave and corrupt the file.
  writeQueue = writeQueue
    .then(async () => {
      await mkdir(dirname(TASKS_FILE), { recursive: true });
      await Promise.all([
        writeFile(TASKS_FILE, JSON.stringify(store.tasks, null, 2), "utf-8"),
        writeFile(VERSIONS_FILE, JSON.stringify(store.versions, null, 2), "utf-8"),
      ]);
    })
    .catch((err) => {
      console.error("[task-store-db] failed to persist store", err);
    });
}

function taskFromLibrary(lib: CloudTaskLibrary, version: TaskVersion): Task {
  return {
    id: lib.task_id,
    facility_id: lib.facility_id,
    title: version.title,
    description: version.description,
    videoUrl: "",
    status: lib.status,
    steps: version.steps,
    policy: version.policy,
    feedback: [],
    createdAt: lib.created_at,
    updatedAt: lib.updated_at,
    archivedAt: lib.archivedAt,
    targetRobotModels: lib.targetRobotModels,
    gripperConfig: lib.gripperConfig,
  };
}

export async function listTasks(facilityId?: string): Promise<CloudTaskLibrary[]> {
  const store = await getStore();
  const fid = facilityId ?? DEFAULT_FACILITY_ID;
  return Object.values(store.tasks)
    .filter((t) => t.facility_id === fid)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export async function getTask(id: string): Promise<Task | undefined> {
  const store = await getStore();
  const lib = store.tasks[id];
  if (!lib) return undefined;
  const versions = store.versions[id] ?? [];
  const latest = versions[versions.length - 1];
  if (!latest) return undefined;
  return taskFromLibrary(lib, latest);
}

export async function createTask(
  title: string,
  videoUrl: string,
  transcript?: string,
  facilityId?: string,
): Promise<Task> {
  const store = await getStore();
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

  store.tasks[taskId] = lib;
  store.versions[taskId] = [version];
  persist(store);

  return {
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
  const store = await getStore();
  const lib = store.tasks[id];
  if (!lib) return undefined;

  const versions = store.versions[id] ?? [];
  const latest = versions[versions.length - 1];
  const now = new Date().toISOString();
  const nextVersionNumber = lib.total_versions + 1;

  const version: TaskVersion = {
    version_id: randomUUID(),
    task_id: id,
    version_number: nextVersionNumber,
    facility_id: lib.facility_id,
    title: lib.title,
    description: patch.description ?? lib.description,
    steps: patch.steps ?? latest?.steps ?? [],
    policy: patch.policy ?? latest?.policy,
    created_at: now,
    status: "active",
  };

  const updatedLib: CloudTaskLibrary = {
    ...lib,
    description: patch.description ?? lib.description,
    status: patch.status ?? lib.status,
    current_version: nextVersionNumber,
    total_versions: nextVersionNumber,
    updated_at: now,
  };

  store.tasks[id] = updatedLib;
  store.versions[id] = [...versions, version];
  persist(store);

  return taskFromLibrary(updatedLib, version);
}

export async function appendFeedback(
  id: string,
  feedback: TaskFeedback,
): Promise<Task | undefined> {
  const store = await getStore();
  const lib = store.tasks[id];
  if (!lib) return undefined;

  const versions = store.versions[id] ?? [];
  const latest = versions[versions.length - 1];
  if (!latest) return undefined;

  const now = new Date().toISOString();
  const updatedLib: CloudTaskLibrary = { ...lib, updated_at: now };
  store.tasks[id] = updatedLib;
  persist(store);

  return { ...taskFromLibrary(updatedLib, latest), feedback: [feedback] };
}

export async function getTaskVersions(taskId: string): Promise<TaskVersion[]> {
  const store = await getStore();
  return [...(store.versions[taskId] ?? [])].sort((a, b) => b.version_number - a.version_number);
}

export async function rollbackToVersion(taskId: string, versionNumber: number): Promise<Task | undefined> {
  const store = await getStore();
  const lib = store.tasks[taskId];
  if (!lib) return undefined;

  const versions = store.versions[taskId] ?? [];
  const target = versions.find((v) => v.version_number === versionNumber);
  if (!target) return undefined;

  const now = new Date().toISOString();
  const nextVersionNumber = lib.total_versions + 1;

  const newVersion: TaskVersion = {
    version_id: randomUUID(),
    task_id: taskId,
    version_number: nextVersionNumber,
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
    title: target.title,
    description: target.description,
    current_version: nextVersionNumber,
    total_versions: nextVersionNumber,
    updated_at: now,
  };

  store.tasks[taskId] = updatedLib;
  store.versions[taskId] = [...versions, newVersion];
  persist(store);

  return taskFromLibrary(updatedLib, newVersion);
}
