import { getDb } from "@/lib/db";
import type { PersistedPolicy } from "@/lib/types";

/** Finds a policy version by id. */
export async function getPolicyById(policyId: string) {
  return (await getDb()).get("policies", policyId);
}

/** Returns the latest policy version for a skill. */
export async function getLatestPolicyForSkill(skillId: string) {
  const rows = await (await getDb()).getAllFromIndex("policies", "by-skill", skillId);
  return rows.sort((a, b) => b.version - a.version)[0];
}

/** Persists a generated robot policy and code bundle. */
export async function createPolicy(policy: PersistedPolicy) {
  await (await getDb()).put("policies", policy);
  return policy;
}
