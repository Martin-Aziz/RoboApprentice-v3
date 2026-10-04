import { AlertTriangle, CheckCircle2, HelpCircle, ShieldCheck } from "lucide-react";
import { readinessState } from "@/lib/trust-layer";

export function readinessFor(confidence: number) {
  const state = readinessState(Math.round(confidence * 100));
  if (state === "supervised-ready") return { label: "REVIEW COMPLETE", tone: "green" as const, action: "Eligible for supervised deployment after qualified sign-off" };
  if (state === "review-required") return { label: "REVIEW REQUIRED", tone: "amber" as const, action: "Simulation review before deployment" };
  return { label: "BLOCKED", tone: "red" as const, action: "Cannot be exported or deployed. Re-demonstration required" };
}

export function DeployReadiness({ confidence, compact = false }: { confidence: number; compact?: boolean }) {
  const readiness = readinessFor(confidence);
  const Icon = readiness.tone === "green" ? CheckCircle2 : readiness.tone === "amber" ? ShieldCheck : AlertTriangle;
  const tone =
    readiness.tone === "green"
      ? "border-[rgb(var(--signal-green)/0.35)] bg-[rgb(var(--signal-green)/0.1)] text-[rgb(var(--signal-green))]"
      : readiness.tone === "amber"
        ? "border-[rgb(var(--signal-amber)/0.35)] bg-[rgb(var(--signal-amber)/0.1)] text-[rgb(var(--signal-amber))]"
        : "border-[rgb(var(--signal-red)/0.35)] bg-[rgb(var(--signal-red)/0.1)] text-[rgb(var(--signal-red))]";

  return (
    <div className={`inline-flex items-center gap-2 rounded-md border px-2.5 py-1.5 ${tone}`} title={`Readiness is based on observed success, task completeness, and validation history. ${readiness.action}.`}>
      <Icon className="h-3.5 w-3.5" />
      <span className="font-mono text-xs tabular">{Math.round(confidence * 100)}%</span>
      {!compact && <span className="text-xs font-medium">{readiness.label}</span>}
      <HelpCircle className="h-3 w-3 opacity-65" aria-label="Readiness definition" />
    </div>
  );
}

export function ReadinessLegend() {
  return (
    <div className="rounded-md border border-[rgb(var(--steel))] bg-[rgb(var(--ink-3))] p-3 text-xs text-[rgb(var(--bone-2))]">
      <strong className="text-[rgb(var(--bone))]">Deploy readiness</strong> combines observed success, task completeness, and validation history. Below 80% is blocked from deployment; 80–89% requires simulation review; 90%+ is eligible for supervised deployment after qualified sign-off.
    </div>
  );
}
