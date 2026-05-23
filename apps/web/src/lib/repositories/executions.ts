import { getDb } from "@/lib/db";
import type { SkillExecution } from "@/lib/types";

function newestFirst(rows: SkillExecution[]) {
  return rows.sort((a, b) => Date.parse(b.started_at) - Date.parse(a.started_at));
}

/** Lists executions for one skill. */
export async function listExecutionsForSkill(skillId: string) {
  return newestFirst(await (await getDb()).getAllFromIndex("executions", "by-skill", skillId));
}

/** Lists executions for one robot. */
export async function listExecutionsForRobot(robotId: string) {
  return newestFirst(await (await getDb()).getAllFromIndex("executions", "by-robot", robotId));
}

/** Returns recent executions across the workspace. */
export async function listRecentExecutions(limit = 80) {
  return newestFirst(await (await getDb()).getAll("executions")).slice(0, limit);
}

/** Persists one execution event. */
export async function createExecution(execution: SkillExecution) {
  await (await getDb()).put("executions", execution);
  return execution;
}
