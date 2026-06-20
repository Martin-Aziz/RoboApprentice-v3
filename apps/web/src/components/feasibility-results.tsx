import Link from "next/link";
import { AlertTriangle, ArrowRight, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { FeasibilityResult } from "@/lib/types";

const VERDICT_PRESENTATION = {
  FEASIBLE: {
    label: "Feasible",
    icon: CheckCircle2,
    className: "border-[rgb(var(--signal-green)/0.4)] bg-[rgb(var(--signal-green)/0.1)] text-[rgb(var(--signal-green))]",
    summary: "This task is a good fit for the selected virtual robot.",
  },
  MARGINAL: {
    label: "Marginal",
    icon: AlertTriangle,
    className: "border-[rgb(var(--signal-amber)/0.4)] bg-[rgb(var(--signal-amber)/0.1)] text-[rgb(var(--signal-amber))]",
    summary: "This task may work, but the setup has little operating margin.",
  },
  NOT_FEASIBLE: {
    label: "Not feasible",
    icon: XCircle,
    className: "border-[rgb(var(--signal-red)/0.4)] bg-[rgb(var(--signal-red)/0.1)] text-[rgb(var(--signal-red))]",
    summary: "The selected virtual robot is not a safe fit for this task.",
  },
} as const;

export function FeasibilityResults({
  result,
  signupHref = "/signup",
}: {
  result: FeasibilityResult;
  signupHref?: string;
}) {
  const presentation = VERDICT_PRESENTATION[result.verdict];
  const Icon = presentation.icon;

  return (
    <section
      aria-live="polite"
      className="hud overflow-hidden rounded-md"
      data-testid="feasibility-results"
    >
      <span className="hud-corner-tr" />
      <span className="hud-corner-bl" />

      {result.confidence === "LOW" && (
        <div className="flex items-start gap-3 border-b border-[rgb(var(--signal-amber)/0.35)] bg-[rgb(var(--signal-amber)/0.1)] p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[rgb(var(--signal-amber))]" />
          <p>
            <strong>Your video was partially unclear — results are indicative only.</strong>
            {" "}Try another recording with the full task and work area visible.
          </p>
        </div>
      )}

      <div className="p-5 md:p-7">
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div>
            <div
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-xs uppercase tracking-[0.16em] ${presentation.className}`}
            >
              <Icon className="h-4 w-4" />
              {presentation.label}
            </div>
            <h2 className="mt-4 font-display text-3xl text-[rgb(var(--bone))]">
              Pre-purchase feasibility result
            </h2>
            <p className="mt-2 max-w-2xl text-[rgb(var(--bone-2))]">
              {presentation.summary}
            </p>
          </div>
          <p className="font-mono text-xs uppercase tracking-[0.15em] text-[rgb(var(--bone-3))]">
            Conservative estimate · 20% margin
          </p>
        </div>

        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          <Metric
            label="Estimated cycle time"
            value={`${result.estimated_cycle_time_seconds}s`}
          />
          <Metric
            label="Estimated throughput"
            value={`${result.estimated_throughput_per_hour}/hr`}
          />
        </div>

        <p className="mt-5 text-lg">
          Your robot would complete this task about every{" "}
          <strong>{result.estimated_cycle_time_seconds} seconds</strong> — about{" "}
          <strong>{result.estimated_throughput_per_hour} cycles per hour</strong>{" "}
          at 85% uptime.
        </p>

        {result.blocking_reason && (
          <div className="mt-5 rounded-md border border-[rgb(var(--signal-red)/0.35)] bg-[rgb(var(--signal-red)/0.08)] p-4">
            <p className="font-semibold text-[rgb(var(--signal-red))]">What prevents this setup from working</p>
            <p className="mt-1 text-sm text-[rgb(var(--bone-2))]">{result.blocking_reason}</p>
          </div>
        )}

        {result.guidance && (
          <div className="mt-5 rounded-md border border-[rgb(var(--signal-amber)/0.35)] bg-[rgb(var(--signal-amber)/0.08)] p-4">
            <p className="font-semibold">What to change</p>
            <p className="mt-1 text-sm text-[rgb(var(--bone-2))]">{result.guidance}</p>
            {result.recommended_robot && (
              <p className="mt-2 text-sm">
                Based only on reach and payload fit, consider evaluating{" "}
                <strong>{result.recommended_robot}</strong>.
              </p>
            )}
          </div>
        )}

        <div className="mt-7 border-t border-[rgb(var(--steel))] pt-5">
          <Button asChild size="lg">
            <Link href={signupHref}>
              Ready to try it on a real robot? Start your pilot
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[rgb(var(--steel))] bg-[rgb(var(--ink-3))] p-4">
      <p className="font-mono text-xs uppercase tracking-[0.14em] text-[rgb(var(--bone-2))]">{label}</p>
      <p className="mt-2 font-mono text-4xl font-semibold tabular text-[rgb(var(--bone))]">{value}</p>
    </div>
  );
}
