import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/export/route";

describe("export readiness gate", () => {
  it("rejects a 68% skill at the route level", async () => {
    const response = await POST(new Request("http://localhost/api/export", { method: "POST", body: JSON.stringify({ skills: [{ id: "skl-degraded-example", readinessScore: 68 }] }) }));
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ code: "DEPLOY_READINESS_BLOCKED", readinessScore: 68 });
  });

  it("rejects an empty selection with an actionable error", async () => {
    const response = await POST(new Request("http://localhost/api/export", { method: "POST", body: JSON.stringify({ target: "urscript", skills: [] }) }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: expect.stringContaining("Select at least one") });
  });

  it("rejects an unknown export target", async () => {
    const response = await POST(new Request("http://localhost/api/export", { method: "POST", body: JSON.stringify({ target: "unknown", skills: [{ id: "ready", name: "Ready Skill", readinessScore: 92 }] }) }));
    expect(response.status).toBe(400);
  });

  it("returns a versioned manifest for approved skills", async () => {
    const response = await POST(new Request("http://localhost/api/export", { method: "POST", body: JSON.stringify({ target: "ros2", skills: [{ id: "ready", name: "Ready Skill", readinessScore: 92 }] }) }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ schemaVersion: 1, target: "ros2", exported: 1 });
  });
});
