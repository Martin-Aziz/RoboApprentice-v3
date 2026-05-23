import { getDb } from "@/lib/db";
import type { Facility } from "@/lib/types";

/** Returns every facility in the local workspace, sorted by name for stable UI output. */
export async function getAllFacilities() {
  const rows = await (await getDb()).getAll("facilities");
  return rows.sort((a, b) => a.name.localeCompare(b.name));
}

/** Looks up one facility by its persistent id. */
export async function getFacilityById(id: string) {
  return (await getDb()).get("facilities", id);
}

/** Creates a facility in IndexedDB. */
export async function createFacility(facility: Facility) {
  await (await getDb()).add("facilities", facility);
  return facility;
}

/** Replaces an existing facility record with a partial update. */
export async function updateFacility(id: string, patch: Partial<Facility>) {
  const db = await getDb();
  const current = await db.get("facilities", id);
  if (!current) throw new Error(`Facility not found: ${id}`);
  const next = { ...current, ...patch };
  await db.put("facilities", next);
  return next;
}

/** Deletes a facility record. Related records are intentionally retained for recovery/export workflows. */
export async function deleteFacility(id: string) {
  await (await getDb()).delete("facilities", id);
}
