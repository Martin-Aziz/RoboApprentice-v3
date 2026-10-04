"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useSessionStore } from "@/lib/store";
import { useDemoData, resetDemoData } from "@/lib/use-demo-data";
import { readSafeDemoMode, saveSafeDemoMode } from "@/lib/demo-mode";
import { Button } from "@/components/ui/button";

export default function SettingsPage() {
  const { session_id, preferences, setPreferences } = useSessionStore();
  const { facility, robots, skills } = useDemoData();
  const [theme, setTheme] = useState("light");
  const [safeDemoMode, setSafeDemoMode] = useState(true);
  const [salesMode, setSalesMode] = useState(false);

  useEffect(() => {
    setTheme(document.documentElement.dataset.theme ?? "light");
    setSafeDemoMode(readSafeDemoMode());
    setSalesMode(localStorage.getItem("aurevix.salesMode") === "true");
  }, []);

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = next;
    setPreferences({ theme: next as "light" | "dark" });
    setTheme(next);
  };

  const toggleSalesMode = () => {
    const next = !salesMode;
    localStorage.setItem("aurevix.salesMode", String(next));
    setSalesMode(next);
    window.dispatchEvent(new Event("aurevix-sales-mode"));
  };

  const toggleSafeDemoMode = () => {
    const next = !safeDemoMode;
    saveSafeDemoMode(next);
    setSafeDemoMode(next);
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
          <Info label="Workspace" value="Local demo workspace" />
          <Info label="Workspace reference" value={session_id?.slice(0, 8) ?? "initializing"} />
          <Info label="Robot program units" value="Metric (mm, kg, °C)" />
        </div>
      </section>
      <section className="rounded-lg border border-[rgb(var(--steel))] bg-[rgb(var(--ink-2))] p-5">
        <h2 className="font-semibold">Preferences</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button variant="outline" onClick={toggleTheme}>{theme === "light" ? <Moon className="mr-2 h-4 w-4" /> : <Sun className="mr-2 h-4 w-4" />} {theme === "light" ? "Dark mode" : "Light mode"}</Button>
          <Button variant="outline" onClick={resetDemoData}>Reset workspace</Button>
        </div>
        <div className="mt-5 flex flex-col gap-4 border-t border-[rgb(var(--steel))] pt-5 md:flex-row md:items-center md:justify-between">
          <div><h3 className="font-medium">Sales mode</h3><p className="mt-1 max-w-2xl text-sm text-[rgb(var(--bone-2))]">Shows ROI and value-based billing surfaces. Figures are illustrative and based on configurable assumptions, not measured outcomes.</p></div>
          <label className="flex items-center gap-3 rounded-md border border-[rgb(var(--steel))] bg-[rgb(var(--ink-3))] px-4 py-3 text-sm"><input aria-label="Sales mode" type="checkbox" checked={salesMode} onChange={toggleSalesMode} /><span className="font-mono uppercase tracking-[0.14em]">{salesMode ? "On" : "Off"}</span></label>
        </div>
      </section>
      <section className="rounded-lg border border-[rgb(var(--steel))] bg-[rgb(var(--ink-2))] p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-[rgb(var(--signal-cyan))]">Demo data &amp; recovery</p>
            <h2 className="mt-2 font-semibold">Safe Demo Mode</h2>
            <p className="mt-1 max-w-2xl text-sm text-[rgb(var(--bone-2))]">
              When enabled, the teaching workflow uses deterministic cached results while preserving streaming progress, robot replay, and exports.
            </p>
          </div>
          <label className="flex items-center gap-3 rounded-md border border-[rgb(var(--steel))] bg-[rgb(var(--ink-3))] px-4 py-3 text-sm">
            <input type="checkbox" checked={safeDemoMode} onChange={toggleSafeDemoMode} />
            <span className="font-mono uppercase tracking-[0.14em]">{safeDemoMode ? "On" : "Off"}</span>
          </label>
        </div>
      </section>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><p className="text-sm text-[rgb(var(--bone-2))]">{label}</p><p className="mt-1 font-mono tabular">{value}</p></div>;
}
