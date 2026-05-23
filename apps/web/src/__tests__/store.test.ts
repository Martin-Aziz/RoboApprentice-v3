/**
 * Unit tests for the Zustand auth store.
 *
 * Each test gets a fresh store instance by re-importing with vi.resetModules().
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the api module before any import of store
vi.mock("@/lib/api", () => ({
  api: {
    post: vi.fn(),
    get: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
  ApiError: class ApiError extends Error {
    constructor(
      public status: number,
      message: string
    ) {
      super(message);
    }
  },
}));

const mockUser = {
  id: "user-1",
  email: "alice@example.com",
  name: "Alice",
  role: "operator",
  created_at: "2025-01-01T00:00:00Z",
};

const mockFacility = {
  id: "fac-1",
  name: "Plant A",
  owner_id: "user-1",
  location: null,
  created_at: "2025-01-01T00:00:00Z",
};

describe("useAuthStore", () => {
  beforeEach(async () => {
    vi.resetModules();
    localStorage.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("initial state: not authenticated", async () => {
    const { useAuthStore } = await import("@/lib/store");
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
    expect(state.facility).toBeNull();
  });

  it("login: sets user + token + isAuthenticated=true", async () => {
    const { api } = await import("@/lib/api");
    (api.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      access_token: "tok-abc",
      user: mockUser,
    });
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce([mockFacility]);

    const { useAuthStore } = await import("@/lib/store");
    await useAuthStore.getState().login("alice@example.com", "pass");

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.user?.email).toBe("alice@example.com");
    expect(localStorage.getItem("forge_access_token")).toBe("tok-abc");
  });

  it("login: loads first facility into store", async () => {
    const { api } = await import("@/lib/api");
    (api.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      access_token: "tok-abc",
      user: mockUser,
    });
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce([mockFacility]);

    const { useAuthStore } = await import("@/lib/store");
    await useAuthStore.getState().login("alice@example.com", "pass");

    expect(useAuthStore.getState().facility?.name).toBe("Plant A");
  });

  it("register: same as login — sets user + token", async () => {
    const { api } = await import("@/lib/api");
    (api.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      access_token: "tok-reg",
      user: mockUser,
    });
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);

    const { useAuthStore } = await import("@/lib/store");
    await useAuthStore.getState().register("Alice", "alice@example.com", "pass");

    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(localStorage.getItem("forge_access_token")).toBe("tok-reg");
  });

  it("logout: clears user, token, and facility", async () => {
    const { api } = await import("@/lib/api");
    // Setup logged-in state first
    (api.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      access_token: "tok-xyz",
      user: mockUser,
    });
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce([mockFacility]);

    const { useAuthStore } = await import("@/lib/store");
    await useAuthStore.getState().login("alice@example.com", "pass");

    // Now log out
    (api.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined);
    await useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
    expect(state.facility).toBeNull();
    expect(localStorage.getItem("forge_access_token")).toBeNull();
  });

  it("logout: clears state even if API call fails", async () => {
    const { api } = await import("@/lib/api");
    // Setup logged-in state
    (api.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      access_token: "tok-abc",
      user: mockUser,
    });
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);
    const { useAuthStore } = await import("@/lib/store");
    await useAuthStore.getState().login("alice@example.com", "pass");

    // Logout API fails
    (api.post as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("network error"));
    await useAuthStore.getState().logout();

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(localStorage.getItem("forge_access_token")).toBeNull();
  });

  it("setUser: directly sets user and isAuthenticated", async () => {
    const { useAuthStore } = await import("@/lib/store");
    useAuthStore.getState().setUser(mockUser);
    expect(useAuthStore.getState().user?.id).toBe("user-1");
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it("setUser(null): clears authentication", async () => {
    const { useAuthStore } = await import("@/lib/store");
    useAuthStore.getState().setUser(mockUser);
    useAuthStore.getState().setUser(null);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().user).toBeNull();
  });
});
