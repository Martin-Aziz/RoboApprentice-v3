"use client";

import Link from "next/link";
import { AlertTriangle, Activity, Bot, Clock, Gauge } from "lucide-react";
import { useDemoData } from "@/lib/use-demo-data";
import { formatDuration, formatNumber } from "@/lib/format";
import { useLocale } from "@/lib/i18n";

export default function RobotsPage() {
  const { robots, skills, metrics, highlightedRobotId } = useDemoData();
  const { locale } = useLocale();
  const alerts = skills.filter((skill) => skill.drift_alert);

  return (
    <div className="mx-auto grid max-w-7xl gap-6 p-5 md:p-8 xl:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-[rgb(var(--signal-cyan))]">Fleet</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight">Robots</h1>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Kpi icon={<Bot />} label="Online" value={`${metrics.robotsOnline}/${robots.length}`} />
          <Kpi icon={<Gauge />} label="Cycles today" value={formatNumber(metrics.totalCyclesToday, locale)} />
          <Kpi icon={<Activity />} label="Avg uptime" value={`${metrics.avgUptime.toFixed(1)}%`} />
          <Kpi icon={<AlertTriangle />} label="Drift alerts" value={formatNumber(metrics.driftAlerts, locale)} />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {robots.map((robot, index) => {
            const skill = skills.find((item) => item.id === robot.current_skill_id);
            return (
              <Link
                key={robot.id}
                href={`/app/robots/${robot.id}`}
                className={`rounded-lg border bg-[rgb(var(--ink-2))] p-4 transition hover:border-[rgb(var(--signal-cyan))] ${
                  highlightedRobotId === robot.id ? "border-[rgb(var(--signal-green))] shadow-lg" : "border-[rgb(var(--steel))]"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold">{robot.name}</p>
                    <p className="mt-1 text-sm text-[rgb(var(--bone-2))]">{robot.brand} {robot.model}</p>
                  </div>
                  <Status status={robot.status} />
                </div>
                <p className="mt-5 text-sm text-[rgb(var(--bone-2))]">Current skill</p>
                <p className="mt-1 truncate font-medium">{skill?.name ?? "Standby"}</p>
                <Spark values={Array.from({ length: 18 }, (_, i) => (robot.metrics?.mean_cycle_ms ?? 3000) * (0.82 + Math.sin(i + index) * 0.08 + i / 140))} />
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <Small label="Uptime" value={`${robot.metrics?.uptime_24h.toFixed(1)}%`} />
                  <Small label="Cycle" value={formatDuration(robot.metrics?.mean_cycle_ms ?? 0, locale)} />
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      <aside className="space-y-4">
        <div className="rounded-lg border border-[rgb(var(--steel))] bg-[rgb(var(--ink-2))] p-4">
          <h2 className="font-semibold">Active alerts</h2>
          <div className="mt-4 space-y-3">
            {alerts.map((alert) => (
              <div key={alert.id} className="rounded-md bg-[rgb(var(--signal-amber)/0.1)] p-3 text-sm">
                <p className="font-medium text-[rgb(var(--signal-amber))]">{alert.name}</p>
                <p className="mt-1 text-[rgb(var(--bone-2))]">{alert.drift_alert}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-[rgb(var(--steel))] bg-[rgb(var(--ink-2))] p-4">
          <h2 className="font-semibold">Live signal</h2>
          <p className="mt-2 flex items-center gap-2 text-sm text-[rgb(var(--bone-2))]"><Clock className="h-4 w-4" /> Simulated execution updates every few seconds.</p>
        </div>
      </aside>
    </div>
  );
}

function Kpi({ icon, label, value }: { icon: React.ReactElement; label: string; value: string }) {
  return <div className="rounded-lg border border-[rgb(var(--steel))] bg-[rgb(var(--ink-2))] p-4"><div className="text-[rgb(var(--signal-cyan))] [&>svg]:h-4 [&>svg]:w-4">{icon}</div><p className="mt-4 font-mono text-2xl tabular">{value}</p><p className="text-sm text-[rgb(var(--bone-2))]">{label}</p></div>;
}

function Small({ label, value }: { label: string; value: string }) {
  return <div><p className="font-mono text-sm tabular">{value}</p><p className="text-xs text-[rgb(var(--bone-2))]">{label}</p></div>;
}

function Status({ status }: { status: string }) {
  const running = status === "running";
  return <span className={`rounded-full px-2 py-1 font-mono text-[10px] uppercase ${running ? "bg-[rgb(var(--signal-green)/0.12)] text-[rgb(var(--signal-green))]" : "bg-[rgb(var(--signal-cyan)/0.12)] text-[rgb(var(--signal-cyan))]"}`}>{status}</span>;
}

function Spark({ values }: { values: number[] }) {
  const max = Math.max(...values);
  const min = Math.min(...values);
  const points = values.map((v, i) => `${(i / (values.length - 1)) * 100},${36 - ((v - min) / (max - min || 1)) * 30}`).join(" ");
  return <svg viewBox="0 0 100 40" className="mt-4 h-12 w-full"><polyline fill="none" stroke="rgb(var(--signal-cyan))" strokeWidth="2" points={points} /></svg>;
}

