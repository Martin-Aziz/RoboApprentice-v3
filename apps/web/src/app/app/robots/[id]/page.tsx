"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, Settings } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDemoData } from "@/lib/use-demo-data";
import { formatDate, formatDuration } from "@/lib/format";
import { useLocale } from "@/lib/i18n";
import { RobotViewport, robotTypeForModel } from "@/components/robot-viewport";
import { FALLBACK_POLICY } from "@/lib/demo-seed";
import { isExportable } from "@/lib/trust-layer";

export default function RobotDetailPage() {
  const params = useParams<{ id: string }>();
  const { robots, skills, executions } = useDemoData();
  const { locale } = useLocale();
  const robot = robots.find((item) => item.id === params.id);
  if (!robot) {
    return (
      <div className="mx-auto max-w-4xl p-8">
        <Link href="/app/robots" className="inline-flex items-center gap-2 text-sm text-[rgb(var(--signal-cyan))]">
          <ArrowLeft className="h-4 w-4" /> Back to robots
        </Link>
        <div className="mt-6 rounded-lg border border-[rgb(var(--signal-amber)/0.4)] bg-[rgb(var(--signal-amber)/0.08)] p-6">
          <h1 className="font-display text-3xl">Robot details are loading</h1>
          <p className="mt-2 text-[rgb(var(--bone-2))]">
            This robot was not found in the current browser workspace. Return to the fleet and select an available robot.
          </p>
        </div>
      </div>
    );
  }

  const robotExecutions = executions.filter((item) => item.robot_id === robot.id);
  const deployed = skills.filter((skill) => skill.id === robot.current_skill_id || isExportable(Math.round(skill.confidence * 100))).slice(0, 4);

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-5 md:p-8">
      <Link href="/app/robots" className="inline-flex items-center gap-2 text-sm text-[rgb(var(--signal-cyan))]"><ArrowLeft className="h-4 w-4" /> Back to robots</Link>
      <div className="rounded-lg border border-[rgb(var(--steel))] bg-[rgb(var(--ink-2))] p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-4xl font-semibold tracking-tight">{robot.name}</h1>
            <p className="mt-2 text-[rgb(var(--bone-2))]">{robot.brand} {robot.model} • {robot.ip_address}</p>
          </div>
          <span className="rounded-full bg-[rgb(var(--signal-green)/0.12)] px-3 py-1 font-mono text-xs uppercase text-[rgb(var(--signal-green))]">{robot.status}</span>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="visualization">Visualization</TabsTrigger>
          <TabsTrigger value="skills">Skills</TabsTrigger>
          <TabsTrigger value="executions">Executions</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="mt-4 grid gap-4 md:grid-cols-3">
          <Metric label="Uptime 24h" value={`${robot.metrics?.uptime_24h.toFixed(1)}%`} />
          <Metric label="Cycles today" value={`${robot.metrics?.cycles_today}`} />
          <Metric label="Mean cycle" value={formatDuration(robot.metrics?.mean_cycle_ms ?? 0, locale)} />
        </TabsContent>
        <TabsContent value="visualization" className="mt-4">
          <RobotViewport robotType={robotTypeForModel(robot.brand, robot.model)} policy={FALLBACK_POLICY} playbackState={robot.status === "running" ? "playing" : "paused"} />
        </TabsContent>
        <TabsContent value="skills" className="mt-4 rounded-lg border border-[rgb(var(--steel))] bg-[rgb(var(--ink-2))]">
          {deployed.map((skill) => <Row key={skill.id} left={skill.name} mid={`${Math.round(skill.confidence * 100)}% confidence`} right={skill.status} />)}
        </TabsContent>
        <TabsContent value="executions" className="mt-4 rounded-lg border border-[rgb(var(--steel))] bg-[rgb(var(--ink-2))]">
          {robotExecutions.slice(0, 50).map((execution) => {
            const skill = skills.find((item) => item.id === execution.skill_id);
            return <Row key={execution.id} left={formatDate(execution.started_at, locale)} mid={skill?.name ?? "Skill"} right={formatDuration(execution.cycle_ms ?? 0, locale)} />;
          })}
        </TabsContent>
        <TabsContent value="settings" className="mt-4 rounded-lg border border-[rgb(var(--steel))] bg-[rgb(var(--ink-2))] p-5">
          <div className="flex items-center gap-3"><Settings className="h-4 w-4" /><span>URDF profile: standard six-axis collaborative arm. Network settings are managed from workcell setup.</span></div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-[rgb(var(--steel))] bg-[rgb(var(--ink-2))] p-5"><p className="font-mono text-3xl tabular">{value}</p><p className="mt-1 text-sm text-[rgb(var(--bone-2))]">{label}</p></div>;
}

function Row({ left, mid, right }: { left: string; mid: string; right: string }) {
  return <div className="flex items-center gap-4 border-b border-[rgb(var(--steel))] px-4 py-3 text-sm last:border-b-0"><CheckCircle2 className="h-4 w-4 text-[rgb(var(--signal-green))]" /><span className="flex-1">{left}</span><span className="text-[rgb(var(--bone-2))]">{mid}</span><span className="font-mono tabular">{right}</span></div>;
}
