"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight, Bot, CheckCircle2, Gauge, GraduationCap, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDemoData } from "@/lib/use-demo-data";
import { formatDuration, formatNumber } from "@/lib/format";
import { useLocale } from "@/lib/i18n";

export default function DashboardPage() {
  const { robots, skills, metrics, executions } = useDemoData();
  const { locale, t } = useLocale();
  const drift = skills.find((skill) => skill.drift_alert);

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-5 md:p-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-[rgb(var(--signal-cyan))]">Production Facility</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight">Live automation overview</h1>
          <p className="mt-2 text-[rgb(var(--bone-2))]">{t("regional.secondary")}</p>
        </div>
        <Button asChild className="gap-2">
          <Link href="/app/teach">{t("nav.teach")} <ArrowRight className="h-4 w-4" /></Link>
        </Button>
      </div>

      {drift && (
        <Link href="/app/skills" className="flex items-center gap-3 rounded-lg border border-[rgb(var(--signal-amber)/0.45)] bg-[rgb(var(--signal-amber)/0.08)] p-4 text-sm">
          <AlertTriangle className="h-5 w-5 text-[rgb(var(--signal-amber))]" />
          <span className="font-medium">{drift.name}</span>
          <span className="text-[rgb(var(--bone-2))]">{drift.drift_alert}</span>
        </Link>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <Metric icon={<Bot />} label="Robots online" value={`${metrics.robotsOnline}/${robots.length}`} />
        <Metric icon={<Zap />} label="Skills" value={formatNumber(metrics.skills, locale)} />
        <Metric icon={<AlertTriangle />} label="Drift alerts" value={formatNumber(metrics.driftAlerts, locale)} tone="amber" />
        <Metric icon={<Gauge />} label="Cycles today" value={formatNumber(metrics.totalCyclesToday, locale)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-lg border border-[rgb(var(--steel))] bg-[rgb(var(--ink-2))]">
          <Header title="Robots" href="/app/robots" />
          <div className="grid gap-3 p-4 md:grid-cols-3">
            {robots.map((robot) => (
              <Link key={robot.id} href={`/app/robots/${robot.id}`} data-testid="robot-card" className="rounded-md border border-[rgb(var(--steel))] p-4 transition hover:border-[rgb(var(--signal-cyan))]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{robot.name}</p>
                    <p className="text-sm text-[rgb(var(--bone-2))]">{robot.brand} {robot.model}</p>
                  </div>
                  <Status status={robot.status} />
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <Small label="Cycles" value={formatNumber(robot.metrics?.cycles_today ?? 0, locale)} />
                  <Small label="Cycle" value={formatDuration(robot.metrics?.mean_cycle_ms ?? 0, locale)} />
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-[rgb(var(--steel))] bg-[rgb(var(--ink-2))]">
          <Header title="Recent executions" href="/app/robots" />
          <div className="divide-y divide-[rgb(var(--steel))]">
            {executions.slice(0, 6).map((execution) => {
              const skill = skills.find((item) => item.id === execution.skill_id);
              return (
                <div key={execution.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                  {execution.status === "completed" ? <CheckCircle2 className="h-4 w-4 text-[rgb(var(--signal-green))]" /> : <AlertTriangle className="h-4 w-4 text-[rgb(var(--signal-amber))]" />}
                  <span className="flex-1 truncate">{skill?.name}</span>
                  <span className="font-mono tabular text-[rgb(var(--bone-2))]">{formatDuration(execution.cycle_ms ?? 0, locale)}</span>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <section className="rounded-lg border border-[rgb(var(--steel))] bg-[rgb(var(--ink-2))] p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-semibold">Teach from demonstration</h2>
            <p className="mt-1 text-sm text-[rgb(var(--bone-2))]">Start with the precision-gripper video, then export code and ROI in the same flow.</p>
          </div>
          <Button asChild variant="outline" className="gap-2">
            <Link href="/app/teach"><GraduationCap className="h-4 w-4" /> Run the 30-second workflow</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}

function Header({ title, href }: { title: string; href: string }) {
  return (
    <div className="flex items-center justify-between border-b border-[rgb(var(--steel))] px-4 py-3">
      <h2 className="font-semibold">{title}</h2>
      <Link href={href} className="text-sm text-[rgb(var(--signal-cyan))]">Open</Link>
    </div>
  );
}

function Metric({ icon, label, value, tone = "cyan" }: { icon: React.ReactElement; label: string; value: string; tone?: "cyan" | "amber" }) {
  return (
    <div className="rounded-lg border border-[rgb(var(--steel))] bg-[rgb(var(--ink-2))] p-4">
      <div className={`mb-4 inline-flex rounded-md p-2 ${tone === "amber" ? "bg-[rgb(var(--signal-amber)/0.12)] text-[rgb(var(--signal-amber))]" : "bg-[rgb(var(--signal-cyan)/0.1)] text-[rgb(var(--signal-cyan))]"} [&>svg]:h-4 [&>svg]:w-4`}>{icon}</div>
      <p className="font-mono text-3xl tabular">{value}</p>
      <p className="mt-1 text-sm text-[rgb(var(--bone-2))]">{label}</p>
    </div>
  );
}

function Small({ label, value }: { label: string; value: string }) {
  return <div><p className="font-mono text-sm tabular">{value}</p><p className="text-xs text-[rgb(var(--bone-2))]">{label}</p></div>;
}

function Status({ status }: { status: string }) {
  const classes =
    status === "running"
      ? "bg-[rgb(var(--signal-green)/0.12)] text-[rgb(var(--signal-green))]"
      : status === "idle"
        ? "bg-[rgb(var(--signal-cyan)/0.12)] text-[rgb(var(--signal-cyan))]"
        : "bg-[rgb(var(--signal-amber)/0.12)] text-[rgb(var(--signal-amber))]";
  return <span className={`rounded-full px-2 py-1 font-mono text-[10px] uppercase ${classes}`}>{status}</span>;
}
