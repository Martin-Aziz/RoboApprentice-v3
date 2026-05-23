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
}

export type AurevixDatabase = IDBPDatabase<AurevixDB>;

/** Opens the local Aurevix workspace database and creates all object stores on first use. */
export async function getDb(): Promise<AurevixDatabase> {
  return openDB<AurevixDB>("aurevix", 1, {
    upgrade(db) {
      db.createObjectStore("session", { keyPath: "session_id" });
      const facilities = db.createObjectStore("facilities", { keyPath: "id" });
      facilities.createIndex("by-name", "name");
      const robots = db.createObjectStore("robots", { keyPath: "id" });
      robots.createIndex("by-facility", "facility_id");
      robots.createIndex("by-status", "status");
      const skills = db.createObjectStore("skills", { keyPath: "id" });
      skills.createIndex("by-facility", "facility_id");
      skills.createIndex("by-status", "status");
      const executions = db.createObjectStore("executions", { keyPath: "id" });
      executions.createIndex("by-skill", "skill_id");
      executions.createIndex("by-robot", "robot_id");
      executions.createIndex("by-time", "started_at");
      const demos = db.createObjectStore("demonstrations", { keyPath: "id" });
      demos.createIndex("by-skill", "skill_id");
      const policies = db.createObjectStore("policies", { keyPath: "policy_id" });
      policies.createIndex("by-skill", "skill_id");
      const analyses = db.createObjectStore("roi_analyses", { keyPath: "analysis_id" });
      analyses.createIndex("by-time", "created_at");
    },
  });
}

/** Deletes and recreates the local workspace. Used only after an explicit reset action. */
export async function resetWorkspaceDb() {
  const db = await getDb();
  db.close();
  await indexedDB.deleteDatabase("aurevix");
}
