import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type {
  Demonstration,
  Facility,
  PersistedPolicy,
  ROIAnalysis,
  Robot,
  SessionRecord,
  Skill,
  SkillExecution,
  Task,
  TaskVersion,
  CloudTaskLibrary,
} from "@/lib/types";

interface AurevixDB extends DBSchema {
  session: {
    key: string;
    value: SessionRecord;
  };
  facilities: {
    key: string;
    value: Facility;
    indexes: { "by-name": string };
  };
  robots: {
    key: string;
    value: Robot;
    indexes: { "by-facility": string; "by-status": string };
  };
  skills: {
    key: string;
    value: Skill;
    indexes: { "by-facility": string; "by-status": string };
  };
  executions: {
    key: string;
    value: SkillExecution;
    indexes: { "by-skill": string; "by-robot": string; "by-time": string };
  };
  demonstrations: {
    key: string;
    value: Demonstration;
    indexes: { "by-skill": string };
  };
  policies: {
    key: string;
    value: PersistedPolicy;
    indexes: { "by-skill": string };
  };
  roi_analyses: {
    key: string;
    value: ROIAnalysis;
    indexes: { "by-time": string };
  };
  tasks: {
    key: string;
    value: CloudTaskLibrary;
    indexes: { "by-facility": string; "by-status": string; "by-created": string };
  };
  task_versions: {
    key: string;
    value: TaskVersion;
    indexes: { "by-task": string; "by-facility": string; "by-created": string };
  };
}

export type AurevixDatabase = IDBPDatabase<AurevixDB>;

/** Opens the local Aurevix workspace database and creates all object stores on first use. */
export async function getDb(): Promise<AurevixDatabase> {
  return openDB<AurevixDB>("aurevix", 2, {
    upgrade(db) {
      if (!db.objectStoreNames.contains("session")) {
        db.createObjectStore("session", { keyPath: "session_id" });
      }
      if (!db.objectStoreNames.contains("facilities")) {
        const facilities = db.createObjectStore("facilities", { keyPath: "id" });
        facilities.createIndex("by-name", "name");
      }
      if (!db.objectStoreNames.contains("robots")) {
        const robots = db.createObjectStore("robots", { keyPath: "id" });
        robots.createIndex("by-facility", "facility_id");
        robots.createIndex("by-status", "status");
      }
      if (!db.objectStoreNames.contains("skills")) {
        const skills = db.createObjectStore("skills", { keyPath: "id" });
        skills.createIndex("by-facility", "facility_id");
        skills.createIndex("by-status", "status");
      }
      if (!db.objectStoreNames.contains("executions")) {
        const executions = db.createObjectStore("executions", { keyPath: "id" });
        executions.createIndex("by-skill", "skill_id");
        executions.createIndex("by-robot", "robot_id");
        executions.createIndex("by-time", "started_at");
      }
      if (!db.objectStoreNames.contains("demonstrations")) {
        const demos = db.createObjectStore("demonstrations", { keyPath: "id" });
        demos.createIndex("by-skill", "skill_id");
      }
      if (!db.objectStoreNames.contains("policies")) {
        const policies = db.createObjectStore("policies", { keyPath: "policy_id" });
        policies.createIndex("by-skill", "skill_id");
      }
      if (!db.objectStoreNames.contains("roi_analyses")) {
        const analyses = db.createObjectStore("roi_analyses", { keyPath: "analysis_id" });
        analyses.createIndex("by-time", "created_at");
      }
      if (!db.objectStoreNames.contains("tasks")) {
        const tasks = db.createObjectStore("tasks", { keyPath: "task_id" });
        tasks.createIndex("by-facility", "facility_id");
        tasks.createIndex("by-status", "status");
        tasks.createIndex("by-created", "created_at");
      }
      if (!db.objectStoreNames.contains("task_versions")) {
        const versions = db.createObjectStore("task_versions", { keyPath: "version_id" });
        versions.createIndex("by-task", "task_id");
        versions.createIndex("by-facility", "facility_id");
        versions.createIndex("by-created", "created_at");
      }
    },
  });
}

/** Deletes and recreates the local workspace. Used only after an explicit reset action. */
export async function resetWorkspaceDb() {
  const db = await getDb();
  db.close();
  await indexedDB.deleteDatabase("aurevix");
}
