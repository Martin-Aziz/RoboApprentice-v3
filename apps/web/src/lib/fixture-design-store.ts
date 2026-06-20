import { mkdir, readFile, writeFile } from "fs/promises";
import { dirname, join } from "path";
import type { FixtureDesignOutput } from "./types";

const DATA_DIR = join(process.cwd(), ".aurevix-data", "fixture-designs");
const INDEX_PATH = join(DATA_DIR, "index.json");

interface StoredFixtureDesign {
  task_id: string;
  design: FixtureDesignOutput;
  created_at: string;
  stl_path: string | null;
  pdf_path: string;
}

declare global {
  // eslint-disable-next-line no-var
  var __aurevixFixtureDesigns: Record<string, StoredFixtureDesign> | undefined;
}

async function getStore() {
  if (globalThis.__aurevixFixtureDesigns) return globalThis.__aurevixFixtureDesigns;
  try {
    globalThis.__aurevixFixtureDesigns = JSON.parse(
      await readFile(INDEX_PATH, "utf-8"),
    ) as Record<string, StoredFixtureDesign>;
  } catch {
    globalThis.__aurevixFixtureDesigns = {};
  }
  return globalThis.__aurevixFixtureDesigns;
}

export function fixtureArtifactPaths(fixtureId: string) {
  return {
    directory: DATA_DIR,
    input: join(DATA_DIR, `${fixtureId}.json`),
    stl: join(DATA_DIR, `${fixtureId}.stl`),
    report: join(DATA_DIR, `${fixtureId}-manifold.json`),
    pdf: join(DATA_DIR, `${fixtureId}.pdf`),
  };
}

export async function saveFixtureDesign(
  taskId: string,
  design: FixtureDesignOutput,
  stlPath: string | null,
  pdfPath: string,
) {
  const store = await getStore();
  if (store[design.fixture_id]) throw new Error("Fixture design ID already exists.");
  store[design.fixture_id] = {
    task_id: taskId,
    design,
    created_at: new Date().toISOString(),
    stl_path: stlPath,
    pdf_path: pdfPath,
  };
  await mkdir(dirname(INDEX_PATH), { recursive: true });
  await writeFile(INDEX_PATH, JSON.stringify(store, null, 2), "utf-8");
}

export async function getFixtureDesign(fixtureId: string) {
  return (await getStore())[fixtureId];
}

export async function listFixtureDesignsForTask(taskId: string) {
  return Object.values(await getStore())
    .filter((item) => item.task_id === taskId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}
