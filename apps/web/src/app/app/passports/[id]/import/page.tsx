"use client";

import { useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PassportImportResult, RobotModel } from "@/lib/types";

const ROBOTS: RobotModel[] = ["UR5e", "UR10e", "UR16e", "ABB GoFa CRB 15000", "FANUC CRX-10iA"];

export default function PassportImportPage() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const [robot, setRobot] = useState<RobotModel>("ABB GoFa CRB 15000");
  const [origin, setOrigin] = useState({ x: "0", y: "0", z: "0" });
  const [dimensions, setDimensions] = useState({ x: "1.6", y: "1.6", z: "1.5" });
  const [result, setResult] = useState<PassportImportResult | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function importPassport() {
    setWorking(true);
    setError(null);
    try {
      const response = await fetch(`/api/v1/passport/${params.id}/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_robot_model: robot,
          target_workcell_config: {
            dimensions: Object.fromEntries(Object.entries(dimensions).map(([key, value]) => [key, Number(value)])),
            origin: Object.fromEntries(Object.entries(origin).map(([key, value]) => [key, Number(value)])),
            toolFrame: "tcp_default",
          },
          target_facility_id: "fac-production-001",
          target_organisation_id: "org-aurevix-demo",
          share_token: search.get("token"),
        }),
      });
      const body = await response.json() as PassportImportResult & { error?: string };
      if (!response.ok && response.status !== 409) throw new Error(body.error ?? "Import failed.");
      setResult(body);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Import failed.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-5 md:p-8">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-[rgb(var(--signal-cyan))]">Automation Passport import</p>
        <h1 className="mt-2 font-display text-4xl">Re-plan for this workcell</h1>
        <p className="mt-2 text-[rgb(var(--bone-2))]">The original intent stays unchanged. Aurevix creates a new controller program and checks every translated waypoint.</p>
      </div>

      <section className="hud rounded-md p-5">
        <span className="hud-corner-tr" /><span className="hud-corner-bl" />
        <div className="grid gap-5 md:grid-cols-2">
          <label className="grid gap-1.5 text-sm"><span className="font-medium">Target robot</span><select value={robot} onChange={(event) => setRobot(event.target.value as RobotModel)} className="rounded-md border border-[rgb(var(--steel))] bg-[rgb(var(--ink-3))] px-3 py-2">{ROBOTS.map((item) => <option key={item}>{item}</option>)}</select></label>
          <div><p className="text-sm font-medium">Workcell dimensions (metres)</p><div className="mt-1.5 grid grid-cols-3 gap-2">{(["x", "y", "z"] as const).map((axis) => <input key={axis} aria-label={`Workcell ${axis}`} type="number" step="0.05" value={dimensions[axis]} onChange={(event) => setDimensions((current) => ({ ...current, [axis]: event.target.value }))} className="rounded-md border border-[rgb(var(--steel))] bg-[rgb(var(--ink-3))] px-3 py-2" />)}</div></div>
          <div className="md:col-span-2"><p className="text-sm font-medium">Task origin relative to target robot base (metres)</p><div className="mt-1.5 grid grid-cols-3 gap-2">{(["x", "y", "z"] as const).map((axis) => <input key={axis} aria-label={`Origin ${axis}`} type="number" step="0.01" value={origin[axis]} onChange={(event) => setOrigin((current) => ({ ...current, [axis]: event.target.value }))} className="rounded-md border border-[rgb(var(--steel))] bg-[rgb(var(--ink-3))] px-3 py-2" />)}</div></div>
        </div>
        <Button onClick={importPassport} disabled={working} className="mt-5 gap-2">{working ? "Re-planning…" : "Validate and create target task"}<ArrowRight className="h-4 w-4" /></Button>
        {error && <p className="mt-4 rounded-md bg-[rgb(var(--signal-red)/0.1)] p-3 text-sm text-[rgb(var(--signal-red))]">{error}</p>}
      </section>

      {result && <ImportDiff result={result} />}
    </div>
  );
}

function ImportDiff({ result }: { result: PassportImportResult }) {
  return (
    <section className={`rounded-md border p-5 ${result.deployment_blocked ? "border-[rgb(var(--signal-red)/0.4)] bg-[rgb(var(--signal-red)/0.06)]" : "border-[rgb(var(--signal-green)/0.4)] bg-[rgb(var(--signal-green)/0.06)]"}`}>
      <div className="flex gap-3">
        {result.deployment_blocked ? <AlertTriangle className="h-6 w-6 text-[rgb(var(--signal-red))]" /> : <CheckCircle2 className="h-6 w-6 text-[rgb(var(--signal-green))]" />}
        <div><h2 className="font-display text-2xl">{result.deployment_blocked ? "Deployment blocked" : "Re-planning complete"}</h2><p className="mt-1">{result.message}</p></div>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <DiffStat label="Original robot" value={result.source_robot_model} />
        <DiffStat label="Target robot" value={result.target_robot_model} />
        <DiffStat label="Waypoints adjusted" value={String(result.adjusted_waypoint_count)} />
      </div>
      {result.unreachable_waypoints.length > 0 && <div className="mt-5 space-y-2">{result.unreachable_waypoints.map((item) => <div key={item.waypoint_index} className="rounded-md border border-[rgb(var(--signal-red)/0.3)] bg-[rgb(var(--ink-2))] p-3 text-sm"><strong>Waypoint {item.waypoint_index + 1}: {item.description}</strong><p className="mt-1 text-[rgb(var(--bone-2))]">{item.reason}</p></div>)}</div>}
      {!result.deployment_blocked && result.new_task_id && <Button asChild className="mt-5"><Link href={`/app/tasks/${result.new_task_id}`}>Open imported task and review simulation</Link></Button>}
    </section>
  );
}

function DiffStat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md bg-[rgb(var(--ink-2))] p-3"><p className="font-mono text-sm">{value}</p><p className="mt-1 text-xs text-[rgb(var(--bone-2))]">{label}</p></div>;
}
