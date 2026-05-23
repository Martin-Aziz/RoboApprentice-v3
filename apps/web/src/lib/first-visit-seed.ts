import { DEMO_EXECUTIONS, DEMO_ROBOTS, DEMO_SKILLS, FALLBACK_POLICY } from "@/lib/demo-seed";
import { getDb } from "@/lib/db";
import type { Facility, PersistedPolicy, Robot, Skill } from "@/lib/types";

export const DEFAULT_FACILITY_ID = "fac-production-001";

function remapFacility<T extends { facility_id: string }>(value: T): T {
  return { ...value, facility_id: DEFAULT_FACILITY_ID };
}

/** Seeds a new browser workspace with realistic operating data without adding any visible seed/demo distinction. */
export async function seedWorkspaceIfNeeded(sessionId: string) {
  const db = await getDb();
  if ((await db.count("facilities")) > 0) return;

  const facility: Facility = {
    id: DEFAULT_FACILITY_ID,
    name: "Production Facility",
    owner_id: sessionId,
    created_at: "2025-09-14T08:00:00Z",
    region: "Global",
  };

  const robots: Robot[] = DEMO_ROBOTS.map((robot) => remapFacility(robot));
  const skills: Skill[] = DEMO_SKILLS.map((skill) => ({
    ...remapFacility(skill),
    created_by: sessionId,
  }));

  const policyRows: PersistedPolicy[] = skills.map((skill, index) => ({
    policy_id: `pol-${skill.id}-v1`,
    skill_id: skill.id,
    version: 1,
    task_policy: FALLBACK_POLICY,
    generated_code: {
      urscript: `# Aurevix generated URScript\n# ${skill.name}\n`,
      ros2_python: `# Aurevix generated ROS 2 Python\n# ${skill.name}\n`,
      pseudocode: `Run skill: ${skill.name}`,
    },
    simulation_manifest: { robot: robots[index % robots.length]?.model ?? "UR5e", waypoint_count: FALLBACK_POLICY.steps.length },
    created_at: skill.created_at,
  }));

  const tx = db.transaction(["facilities", "robots", "skills", "executions", "policies"], "readwrite");
  await tx.objectStore("facilities").put(facility);
  await Promise.all([
    ...robots.map((robot) => tx.objectStore("robots").put(robot)),
    ...skills.map((skill) => tx.objectStore("skills").put(skill)),
    ...DEMO_EXECUTIONS.map((execution) => tx.objectStore("executions").put(execution)),
    ...policyRows.map((policy) => tx.objectStore("policies").put(policy)),
    tx.done,
  ]);
}
