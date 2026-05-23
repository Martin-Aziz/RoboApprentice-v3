/**
 * Unit tests for the API client module.
 *
 * All network calls are intercepted via vi.stubGlobal('fetch', ...) so no
 * real HTTP connections are made.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ApiError } from "@/lib/api";

// We need to import `api` after mocking fetch so the module picks up the stub.
// Use a dynamic import inside each test, or reset modules.

function mockFetch(responses: Array<{ status: number; body: unknown }>) {
  let call = 0;
  return vi.fn().mockImplementation(() => {
    const { status, body } = responses[call++] ?? { status: 200, body: {} };
    return Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      statusText: status === 200 ? "OK" : "Error",
      json: () => Promise.resolve(body),
      text: () => Promise.resolve(JSON.stringify(body)),
    } as Response);
  });
}

describe("ApiError", () => {
  it("stores status and message", () => {
    const err = new ApiError(404, "not found");
    expect(err.status).toBe(404);
    expect(err.message).toBe("not found");
    expect(err.name).toBe("ApiError");
  });

  it("is instanceof Error", () => {
    expect(new ApiError(500, "oops")).toBeInstanceOf(Error);
  });
});

describe("api client", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch([{ status: 200, body: { ok: true } }]));
    localStorage.removeItem("forge_access_token");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("GET: adds Authorization header when token is in localStorage", async () => {
    localStorage.setItem("forge_access_token", "test-token");
    const fetchMock = mockFetch([{ status: 200, body: {} }]);
    vi.stubGlobal("fetch", fetchMock);

    const { api } = await import("@/lib/api");
    await api.get("/api/v1/test");

    const calledWith = fetchMock.mock.calls[0];
    const init = calledWith[1] as RequestInit;
    expect((init.headers as Record<string, string>)["Authorization"]).toBe(
      "Bearer test-token"
    );
  });

  it("GET: does NOT add Authorization header without token", async () => {
    const fetchMock = mockFetch([{ status: 200, body: {} }]);
    vi.stubGlobal("fetch", fetchMock);

    const { api } = await import("@/lib/api");
    await api.get("/api/v1/test");

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>)["Authorization"]).toBeUndefined();
  });

  it("POST: sets Content-Type application/json", async () => {
    const fetchMock = mockFetch([{ status: 200, body: {} }]);
    vi.stubGlobal("fetch", fetchMock);

    const { api } = await import("@/lib/api");
    await api.post("/api/v1/test", { name: "test" });

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe(
      "application/json"
    );
  });

  it("throws ApiError on non-ok response", async () => {
    const fetchMock = mockFetch([{ status: 404, body: { error: "not found" } }]);
    vi.stubGlobal("fetch", fetchMock);

    const { api } = await import("@/lib/api");
    await expect(api.get("/api/v1/missing")).rejects.toBeInstanceOf(ApiError);
  });

  it("throws ApiError with correct status", async () => {
    const fetchMock = mockFetch([{ status: 403, body: { error: "forbidden" } }]);
    vi.stubGlobal("fetch", fetchMock);

    const { api } = await import("@/lib/api");
    try {
      await api.get("/api/v1/forbidden");
    } catch (e) {
      expect((e as ApiError).status).toBe(403);
    }
  });

  it("auto-refreshes token on 401 and retries", async () => {
    localStorage.setItem("forge_access_token", "expired-token");
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        json: () => Promise.resolve({}),
        text: () => Promise.resolve(""),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ access_token: "new-token" }),
        text: () => Promise.resolve(""),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: "success" }),
        text: () => Promise.resolve(""),
      });
    vi.stubGlobal("fetch", fetchMock);

    const { api } = await import("@/lib/api");
    const result = await api.get<{ data: string }>("/api/v1/protected");
    expect(result.data).toBe("success");
    expect(localStorage.getItem("forge_access_token")).toBe("new-token");
  });

  it("returns undefined on 204 No Content", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
      json: () => Promise.reject(new Error("no body")),
      text: () => Promise.resolve(""),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { api } = await import("@/lib/api");
    const result = await api.delete("/api/v1/item/1");
    expect(result).toBeUndefined();
  });
});
