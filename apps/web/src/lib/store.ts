import { create } from "zustand";
import { getDb } from "@/lib/db";
import { seedWorkspaceIfNeeded } from "@/lib/first-visit-seed";
import type { LocaleCode, SessionPreferences } from "@/lib/types";

interface SessionState {
  session_id: string | null;
  preferences: SessionPreferences;
  isLoading: boolean;
  initialize: () => Promise<void>;
  setPreferences: (prefs: Partial<SessionPreferences>) => Promise<void>;
}

function detectLocale(): LocaleCode {
  if (typeof navigator === "undefined") return "en-US";
  const browser = navigator.language;
  if (browser.startsWith("de")) return "de-DE";
  if (browser.startsWith("es")) return "es-ES";
  if (browser.startsWith("zh")) return "zh-CN";
  if (browser.startsWith("ja")) return "ja-JP";
  if (browser === "en-GB") return "en-GB";
  return "en-US";
}

function defaultPreferences(): SessionPreferences {
  const locale = detectLocale();
  return {
    locale,
    theme: "light",
    units: locale === "en-US" ? "imperial" : "metric",
    default_facility_id: null,
  };
}

export const useSessionStore = create<SessionState>((set, get) => ({
  session_id: null,
  preferences: defaultPreferences(),
  isLoading: true,

  initialize: async () => {
    const db = await getDb();
    const existing = (await db.getAll("session"))[0];
    const session =
      existing ??
      {
        session_id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
        preferences: defaultPreferences(),
      };

    if (!existing) await db.put("session", session);
    await seedWorkspaceIfNeeded(session.session_id);
    document.documentElement.dataset.theme = session.preferences.theme;
    set({ session_id: session.session_id, preferences: session.preferences, isLoading: false });
  },

  setPreferences: async (prefs) => {
    const db = await getDb();
    const current = (await db.getAll("session"))[0];
    const next = {
      ...(current ?? {
        session_id: get().session_id ?? crypto.randomUUID(),
        created_at: new Date().toISOString(),
        preferences: defaultPreferences(),
      }),
      preferences: { ...(current?.preferences ?? get().preferences), ...prefs },
    };
    await db.put("session", next);
    document.documentElement.dataset.theme = next.preferences.theme;
    set({ session_id: next.session_id, preferences: next.preferences, isLoading: false });
  },
}));
