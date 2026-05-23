import { create } from "zustand";
import type { User, Facility } from "@/lib/types";
import { api } from "@/lib/api";
import type { AuthResponse } from "@/lib/types";
import { DEMO_FACILITIES, DEMO_USER } from "@/lib/demo-seed";

interface AuthState {
  user: User | null;
  facility: Facility | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  init: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loadFacilities: () => Promise<void>;
  setUser: (user: User | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: DEMO_USER,
  facility: DEMO_FACILITIES[0],
  isAuthenticated: true,
  isLoading: false,

  setUser: (user) => set({ user: user ?? DEMO_USER, isAuthenticated: true, isLoading: false }),

  init: async () => {
    set({ user: DEMO_USER, facility: DEMO_FACILITIES[0], isAuthenticated: true, isLoading: false });
  },

  login: async (email, password) => {
    const data = await api.post<AuthResponse>("/api/v1/auth/login", { email, password });
    localStorage.setItem("forge_access_token", data.access_token);
    set({ user: data.user, isAuthenticated: true, isLoading: false });
  },

  register: async (name, email, password) => {
    const data = await api.post<AuthResponse>("/api/v1/auth/register", { name, email, password });
    localStorage.setItem("forge_access_token", data.access_token);
    set({ user: data.user, isAuthenticated: true, isLoading: false });
  },

  logout: async () => {
    localStorage.clear();
    set({ user: DEMO_USER, facility: DEMO_FACILITIES[0], isAuthenticated: true, isLoading: false });
    window.location.reload();
  },

  loadFacilities: async () => {
    set({ facility: DEMO_FACILITIES[0] });
  },
}));
