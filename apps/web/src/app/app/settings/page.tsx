"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { LanguageSelector } from "@/components/language-selector";
import { useSessionStore } from "@/lib/store";
import { useDemoData, resetDemoData } from "@/lib/use-demo-data";
import { Button } from "@/components/ui/button";

export default function SettingsPage() {
  const { session_id, preferences, setPreferences } = useSessionStore();
  const { facility, robots, skills } = useDemoData();
  const [theme, setTheme] = useState("light");

  useEffect(() => {
    setTheme(document.documentElement.dataset.theme ?? "light");
  }, []);

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = next;
    setPreferences({ theme: next as "light" | "dark" });
    setTheme(next);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-5 md:p-8">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.22em] text-[rgb(var(--signal-cyan))]">Workspace settings</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">Settings</h1>
      </div>
      <section className="rounded-lg border border-[rgb(var(--steel))] bg-[rgb(var(--ink-2))] p-5">
        <h2 className="font-semibold">Facility</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <Info label="Facility" value={facility.name} />
          <Info label="Region" value={facility.region ?? "EU"} />
          <Info label="Robots / skills" value={`${robots.length} / ${skills.length}`} />
        </div>
      </section>
      <section className="rounded-lg border border-[rgb(var(--steel))] bg-[rgb(var(--ink-2))] p-5">
        <h2 className="font-semibold">Session</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <Info label="Identity" value="Anonymous browser session" />
          <Info label="Session ID" value={session_id?.slice(0, 12) ?? "initializing"} />
          <Info label="Units" value={preferences.units} />
        </div>
      </section>
      <section className="rounded-lg border border-[rgb(var(--steel))] bg-[rgb(var(--ink-2))] p-5">
        <h2 className="font-semibold">Preferences</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          <LanguageSelector />
          <Button variant="outline" onClick={toggleTheme}>{theme === "light" ? <Moon className="mr-2 h-4 w-4" /> : <Sun className="mr-2 h-4 w-4" />} {theme === "light" ? "Dark mode" : "Light mode"}</Button>
          <Button variant="outline" onClick={resetDemoData}>Reset workspace</Button>
        </div>
      </section>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><p className="text-sm text-[rgb(var(--bone-2))]">{label}</p><p className="mt-1 font-mono tabular">{value}</p></div>;
}
