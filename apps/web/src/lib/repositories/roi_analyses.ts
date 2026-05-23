import { getDb } from "@/lib/db";
import type { ROIAnalysis } from "@/lib/types";

/** Finds a saved ROI analysis by id. */
export async function getROIAnalysisById(id: string) {
  return (await getDb()).get("roi_analyses", id);
}

/** Persists a shareable ROI analysis. */
export async function createROIAnalysis(analysis: ROIAnalysis) {
  await (await getDb()).put("roi_analyses", analysis);
  return analysis;
}

/** Returns recent ROI analyses for the sidebar/history surface. */
export async function listRecentROIAnalyses(limit = 12) {
  const rows = await (await getDb()).getAll("roi_analyses");
  return rows.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)).slice(0, limit);
}
