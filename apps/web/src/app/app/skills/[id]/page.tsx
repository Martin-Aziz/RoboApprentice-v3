"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RobotViewport } from "@/components/robot-viewport";
import { FALLBACK_POLICY } from "@/lib/demo-seed";
import { useDemoData } from "@/lib/use-demo-data";
import { formatDate, formatDuration } from "@/lib/format";
import { useLocale } from "@/lib/i18n";

export default function SkillDetailPage() {
  const params = useParams<{ id: string }>();
  const { skills, executions } = useDemoData();
  const { locale } = useLocale();
  const skill = skills.find((item) => item.id === params.id);
  if (!skill) return null;
  const rows = executions.filter((execution) => execution.skill_id === skill.id);
  return (
    <div className="mx-auto max-w-7xl space-y-6 p-5 md:p-8">
      <Link href="/app/skills" className="inline-flex items-center gap-2 text-sm text-[rgb(var(--signal-cyan))]"><ArrowLeft className="h-4 w-4" /> Back to skills</Link>
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight">{skill.name}</h1>
          <p className="mt-2 text-[rgb(var(--bone-2))]">{skill.description}</p>
        </div>
        <span className="rounded-full bg-[rgb(var(--signal-green)/0.12)] px-3 py-1 font-mono text-xs uppercase text-[rgb(var(--signal-green))]">{skill.status}</span>
      </div>
      <Tabs defaultValue="visualization">
        <TabsList><TabsTrigger value="visualization">Visualization</TabsTrigger><TabsTrigger value="waypoints">Waypoints</TabsTrigger><TabsTrigger value="code">Code</TabsTrigger><TabsTrigger value="executions">Executions</TabsTrigger><TabsTrigger value="versions">Versions</TabsTrigger></TabsList>
        <TabsContent value="visualization" className="mt-4"><RobotViewport robotType="ur5e" policy={FALLBACK_POLICY} /></TabsContent>
        <TabsContent value="waypoints" className="mt-4 rounded-lg border border-[rgb(var(--steel))] bg-[rgb(var(--ink-2))]">{FALLBACK_POLICY.steps.map((step) => <Row key={step.id} left={`Waypoint ${step.order}`} mid={step.description} right={`${step.speed} m/s`} />)}</TabsContent>
        <TabsContent value="code" className="mt-4 rounded-lg border border-[rgb(var(--steel))] bg-[rgb(var(--ink-2))] p-4 font-mono text-sm">URScript, ROS 2 Python, and pseudocode exports are available from Code export.</TabsContent>
        <TabsContent value="executions" className="mt-4 rounded-lg border border-[rgb(var(--steel))] bg-[rgb(var(--ink-2))]">{rows.slice(0, 30).map((row) => <Row key={row.id} left={formatDate(row.started_at, locale)} mid={row.status} right={formatDuration(row.cycle_ms ?? 0, locale)} />)}</TabsContent>
        <TabsContent value="versions" className="mt-4 rounded-lg border border-[rgb(var(--steel))] bg-[rgb(var(--ink-2))]"><Row left="Version 1" mid={`Created ${formatDate(skill.created_at, locale)}`} right="current" /></TabsContent>
      </Tabs>
    </div>
  );
}

function Row({ left, mid, right }: { left: string; mid: string; right: string }) {
  return <div className="flex items-center gap-4 border-b border-[rgb(var(--steel))] px-4 py-3 text-sm last:border-b-0"><span className="w-40 font-medium">{left}</span><span className="flex-1 text-[rgb(var(--bone-2))]">{mid}</span><span className="font-mono tabular">{right}</span></div>;
}
