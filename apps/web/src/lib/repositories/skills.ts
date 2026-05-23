import { getDb } from "@/lib/db";
import type { Skill } from "@/lib/types";

/** Returns all skills with newest changes first. */
export async function getAllSkills() {
  const rows = await (await getDb()).getAll("skills");
  return rows.sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at));
}

/** Returns skills assigned to one facility. */
export async function getSkillsByFacility(facilityId: string) {
  return (await getDb()).getAllFromIndex("skills", "by-facility", facilityId);
}

/** Finds a skill by id. */
export async function getSkillById(id: string) {
  return (await getDb()).get("skills", id);
}

/** Creates or replaces a skill, supporting idempotent teach/deploy flows. */
export async function createSkill(skill: Skill) {
  await (await getDb()).put("skills", skill);
  return skill;
}

/** Applies a partial update and refreshes the modification timestamp. */
export async function updateSkill(id: string, patch: Partial<Skill>) {
  const db = await getDb();
  const current = await db.get("skills", id);
  if (!current) throw new Error(`Skill not found: ${id}`);
  const next = { ...current, ...patch, updated_at: new Date().toISOString() };
  await db.put("skills", next);
  return next;
}

/** Archives a skill without deleting its history. */
export async function archiveSkill(id: string) {
  return updateSkill(id, { status: "archived" });
}

/** Lightweight similarity search used by the command palette and skill reuse hints. */
export async function listSimilar(query: string) {
  const normalized = query.trim().toLowerCase();
  const rows = await getAllSkills();
  if (!normalized) return rows;
  return rows.filter((skill) => `${skill.name} ${skill.description ?? ""}`.toLowerCase().includes(normalized));
}
