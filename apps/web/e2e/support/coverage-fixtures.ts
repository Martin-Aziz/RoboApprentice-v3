import path from "node:path";
import { expect, test as base } from "@playwright/test";
import { CoverageRegistry, type CoverageStatus } from "./coverage-registry";

type CoverageFixtures = {
  coverage: CoverageRegistry;
  evidenceId: string;
};

type InternalFixtures = {
  _coverageHooks: void;
};

function sanitizeFileName(value: string): string {
  return value.replace(/[^a-zA-Z0-9-_]+/g, "-").slice(0, 120);
}

export const test = base.extend<CoverageFixtures & InternalFixtures>({
  coverage: async ({}, use, testInfo) => {
    const runPrefix = process.env.COVERAGE_RUN_ID ?? new Date().toISOString().replace(/[.:]/g, "-");
    const runId = `${runPrefix}-${sanitizeFileName(testInfo.title)}-${testInfo.retry}`;
    const registry = new CoverageRegistry(runId);
    await use(registry);
  },

  evidenceId: async ({}, use, testInfo) => {
    const evidenceId = `${testInfo.project.name}-${sanitizeFileName(testInfo.title)}-r${testInfo.retry}`;
    await use(evidenceId);
  },

  _coverageHooks: [
    async ({ page, coverage, evidenceId }, use, testInfo) => {
      const startedAt = Date.now();

      page.on("console", (message) => {
        if (message.type() === "warning") {
          coverage.addConsoleWarning(message.text());
        }

        if (message.type() === "error") {
          coverage.addConsoleError(message.text());
        }
      });

      page.on("response", (response) => {
        const request = response.request();
        coverage.addNetworkCall({
          method: request.method(),
          url: request.url(),
          status: response.status(),
          resourceType: request.resourceType(),
        });
      });

      page.on("requestfailed", (request) => {
        coverage.addNetworkCall({
          method: request.method(),
          url: request.url(),
          resourceType: request.resourceType(),
          failureText: request.failure()?.errorText,
        });
      });

      await use();

      const rawStatus = (testInfo.status ?? "blocked").toUpperCase();
      const statusMap: Record<string, CoverageStatus> = {
        PASSED: "PASS",
        FAILED: "FAIL",
        TIMEDOUT: "BLOCKED",
        SKIPPED: "ALREADY_TESTED",
        INTERRUPTED: "BLOCKED",
      };

      const status = statusMap[rawStatus] ?? "BLOCKED";
      const outputFile = path.join(testInfo.outputDir, "coverage-registry.json");

      coverage.addTestResult({
        testId: `${testInfo.testId}`,
        title: testInfo.title,
        status,
        durationMs: Date.now() - startedAt,
        evidenceId,
      });

      coverage.flush(outputFile);
    },
    { auto: true },
  ],
});

export { expect };
