/**
 * Browser-side skill persistence via localStorage.
 * Key: "aurevix:skills"  →  PersistedSkill[]
 * Key: "aurevix:policies" →  Record<skillId, TaskPolicy>
 *
 * All functions are synchronous and safe to call from any client component.
 * They are no-ops during SSR (guarded by typeof window check).
 */

import type { Skill, TaskPolicy } from "./types";

const SKILLS_KEY = "aurevix:skills";
const POLICIES_KEY = "aurevix:policies";

// ── helpers ────────────────────────────────────────────────────────────────

function readSkills(): Skill[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SKILLS_KEY);
    return raw ? (JSON.parse(raw) as Skill[]) : [];
  } catch {
    return [];
  }
}

function writeSkills(skills: Skill[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(SKILLS_KEY, JSON.stringify(skills));
}

function readPolicies(): Record<string, TaskPolicy> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(POLICIES_KEY);
    return raw ? (JSON.parse(raw) as Record<string, TaskPolicy>) : {};
  } catch {
    return {};
  }
}

function writePolicies(policies: Record<string, TaskPolicy>): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(POLICIES_KEY, JSON.stringify(policies));
}

// ── public API ─────────────────────────────────────────────────────────────

export function listSkills(): Skill[] {
  return readSkills().sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

export function getSkill(id: string): Skill | undefined {
  return readSkills().find((s) => s.id === id);
}

export function saveSkill(skill: Skill, policy?: TaskPolicy): void {
  const skills = readSkills();
  const idx = skills.findIndex((s) => s.id === skill.id);
  if (idx >= 0) {
    skills[idx] = { ...skills[idx], ...skill, updated_at: new Date().toISOString() };
  } else {
    skills.push(skill);
  }
  writeSkills(skills);

  if (policy) {
    const policies = readPolicies();
    policies[skill.id] = policy;
    writePolicies(policies);
  }
}

export function updateSkillStatus(
  id: string,
  status: Skill["status"],
  confidenceDelta = 0,
): void {
  const skills = readSkills();
  const skill = skills.find((s) => s.id === id);
  if (!skill) return;
  skill.status = status;
  skill.confidence = Math.min(1, Math.max(0, skill.confidence + confidenceDelta));
  skill.updated_at = new Date().toISOString();
  writeSkills(skills);
}

export function incrementSkillRunCount(id: string, success: boolean): void {
  const skills = readSkills();
  const skill = skills.find((s) => s.id === id);
  if (!skill) return;
  skill.run_count += 1;
  if (success) skill.success_count += 1;
  skill.confidence =
    skill.run_count > 0 ? skill.success_count / skill.run_count : 0;
  skill.updated_at = new Date().toISOString();
  writeSkills(skills);
}

export function deleteSkill(id: string): void {
  writeSkills(readSkills().filter((s) => s.id !== id));
  const policies = readPolicies();
  delete policies[id];
  writePolicies(policies);
}

export function getPolicy(skillId: string): TaskPolicy | undefined {
  return readPolicies()[skillId];
}

export function clearAll(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(SKILLS_KEY);
  localStorage.removeItem(POLICIES_KEY);
}
