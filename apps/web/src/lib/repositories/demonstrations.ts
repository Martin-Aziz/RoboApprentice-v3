import { getDb } from "@/lib/db";
import type { Demonstration } from "@/lib/types";

/** Lists demonstrations captured for a skill. */
export async function listDemonstrationsForSkill(skillId: string) {
  return (await getDb()).getAllFromIndex("demonstrations", "by-skill", skillId);
}

/** Finds a demonstration by id. */
export async function getDemonstrationById(id: string) {
  return (await getDb()).get("demonstrations", id);
}

/** Persists a demonstration metadata record. Large videos remain browser blobs or external files. */
export async function createDemonstration(demonstration: Demonstration) {
  await (await getDb()).put("demonstrations", demonstration);
  return demonstration;
}
