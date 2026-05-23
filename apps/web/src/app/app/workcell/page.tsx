"use client";

import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RobotViewport } from "@/components/robot-viewport";
import { FALLBACK_POLICY } from "@/lib/demo-seed";
import { useDemoData } from "@/lib/use-demo-data";

export default function WorkcellPage() {
  const { skills } = useDemoData();
  return (
    <div className="mx-auto max-w-7xl space-y-6 p-5 md:p-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-[rgb(var(--signal-cyan))]">Configuration</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight">Workcell setup</h1>
        </div>
        <Button className="gap-2"><ShieldCheck className="h-4 w-4" /> Validate {skills.filter((skill) => skill.status === "ready").length} skills</Button>
      </div>
      <RobotViewport robotType="ur5e" policy={FALLBACK_POLICY} playbackState="paused" showCollisionGeometry />
      <section className="grid gap-4 md:grid-cols-3">
        {["Workbench", "Pickup bin", "Placement bin"].map((item) => (
          <div key={item} className="rounded-lg border border-[rgb(var(--steel))] bg-[rgb(var(--ink-2))] p-4">
            <p className="font-semibold">{item}</p>
            <p className="mt-1 text-sm text-[rgb(var(--bone-2))]">Saved in facility workcell configuration.</p>
          </div>
        ))}
      </section>
    </div>
  );
}
