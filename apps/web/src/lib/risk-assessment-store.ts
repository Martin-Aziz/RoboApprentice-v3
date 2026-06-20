import { mkdir, readFile, writeFile } from "fs/promises";
import { dirname, join } from "path";
import type { RiskAssessmentDraft } from "./types";

const STORE_PATH = join(process.cwd(), ".aurevix-data", "risk-assessment-drafts.json");

declare global {
  // eslint-disable-next-line no-var
  var __aurevixRiskDrafts: Record<string, RiskAssessmentDraft[]> | undefined;
}

async function readStore(): Promise<Record<string, RiskAssessmentDraft[]>> {
  if (globalThis.__aurevixRiskDrafts) return globalThis.__aurevixRiskDrafts;
  try {
    globalThis.__aurevixRiskDrafts = JSON.parse(
      await readFile(STORE_PATH, "utf-8"),
    ) as Record<string, RiskAssessmentDraft[]>;
  } catch {
    globalThis.__aurevixRiskDrafts = {};
  }
  return globalThis.__aurevixRiskDrafts;
}

export async function saveRiskAssessmentDraft(draft: RiskAssessmentDraft) {
  const store = await readStore();
  store[draft.task_id] = [...(store[draft.task_id] ?? []), draft];
  await mkdir(dirname(STORE_PATH), { recursive: true });
  await writeFile(STORE_PATH, JSON.stringify(store, null, 2), "utf-8");
}

export async function listRiskAssessmentDrafts(taskId: string) {
  const store = await readStore();
  return store[taskId] ?? [];
}
