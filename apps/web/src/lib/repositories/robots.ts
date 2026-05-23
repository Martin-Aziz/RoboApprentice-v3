import { getDb } from "@/lib/db";
import type { Robot, RobotStatus } from "@/lib/types";

/** Returns all robots in name order. */
export async function getAllRobots() {
  const rows = await (await getDb()).getAll("robots");
  return rows.sort((a, b) => a.name.localeCompare(b.name));
}

/** Returns robots assigned to a facility. */
export async function getRobotsByFacility(facilityId: string) {
  return (await getDb()).getAllFromIndex("robots", "by-facility", facilityId);
}

/** Finds a robot by id. */
export async function getRobotById(id: string) {
  return (await getDb()).get("robots", id);
}

/** Creates a robot configuration. */
export async function createRobot(robot: Robot) {
  await (await getDb()).add("robots", robot);
  return robot;
}

/** Applies a partial robot update while preserving current metrics. */
export async function updateRobot(id: string, patch: Partial<Robot>) {
  const db = await getDb();
  const current = await db.get("robots", id);
  if (!current) throw new Error(`Robot not found: ${id}`);
  const next = { ...current, ...patch };
  await db.put("robots", next);
  return next;
}

/** Updates only the operating status for live fleet transitions. */
export async function updateRobotStatus(id: string, status: RobotStatus) {
  return updateRobot(id, { status, last_seen_at: new Date().toISOString() });
}
