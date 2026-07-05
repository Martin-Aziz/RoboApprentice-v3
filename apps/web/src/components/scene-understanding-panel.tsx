"use client";

import { useMemo } from "react";
import { AlertTriangle, Eye, ScanSearch } from "lucide-react";
import { isEvidenceGrounded, resolveSceneForPolicy, sceneObjectDisplayName } from "@/lib/scene-model";
import type { SceneObject, TaskPolicy } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Compact "Scene understanding" panel for the teach page: how many workcell
 * objects were interpreted, where the scene came from (video evidence vs.
 * text-derived), which objects are proxy geometry or low-confidence, and what
 * a human must review before deployment. Honesty layer for the 3D preview —
 * it never claims robot-grade geometry from monocular video.
 */
export function SceneUnderstandingPanel({ policy, className }: { policy?: TaskPolicy; className?: string }) {
  const scene = useMemo(() => resolveSceneForPolicy(policy), [policy]);

  const proxyObjects = scene.objects.filter((o) => (o.visualFidelity ?? "proxy") === "proxy");
  const lowConfidence = scene.objects.filter((o) => o.confidence < 0.45);
  const reviewRequired = scene.objects.filter((o) => o.reviewRequiredReason);
  const grounded = scene.objects.filter(isEvidenceGrounded);

  if (scene.objects.length === 0) return null;

  return (
    <section
      data-testid="scene-understanding"
      className={cn("rounded-md border border-[rgb(var(--steel))] bg-[rgb(var(--ink-3))] p-3", className)}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[rgb(var(--signal-cyan))]">
          Scene understanding
        </p>
        <span
          className={cn(
            "rounded-md border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em]",
            scene.source === "video"
              ? "border-[rgb(var(--signal-green)/0.4)] bg-[rgb(var(--signal-green)/0.1)] text-[rgb(var(--signal-green))]"
              : "border-[rgb(var(--signal-amber)/0.4)] bg-[rgb(var(--signal-amber)/0.1)] text-[rgb(var(--signal-amber))]",
          )}
        >
          {scene.source === "video" ? "video evidence" : "derived from steps"}
        </span>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Objects" value={String(scene.objects.length)} />
        <Stat label="Evidence-grounded" value={`${grounded.length}/${scene.objects.length}`} />
        <Stat label="Scene confidence" value={`${Math.round(scene.confidence * 100)}%`} />
        <Stat label="Needs review" value={String(reviewRequired.length)} tone={reviewRequired.length ? "warn" : undefined} />
      </div>

      <ul className="mt-3 space-y-1">
        {scene.objects.map((object, index) => (
          <li
            key={object.id}
            className="flex items-center gap-2 text-xs"
            title={objectTooltip(object)}
          >
            <FidelityDot object={object} />
            <span className="truncate font-medium">{sceneObjectDisplayName(object, index)}</span>
            <span className="font-mono text-[10px] uppercase text-[rgb(var(--bone-2))]">{object.role}</span>
            <span className="ml-auto font-mono text-[10px] tabular text-[rgb(var(--bone-2))]">
              {(object.visualFidelity ?? "proxy").replace("_", " ")} · {Math.round(object.confidence * 100)}%
            </span>
          </li>
        ))}
      </ul>

      {proxyObjects.length > 0 && (
        <p className="mt-3 flex items-start gap-2 text-xs text-[rgb(var(--bone-2))]">
          <ScanSearch className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {proxyObjects.length === scene.objects.length
            ? "All rendered objects are proxy geometry — approximate stand-ins, not measured shapes."
            : `${proxyObjects.length} object(s) render as proxy geometry (approximate stand-ins, not measured shapes).`}
        </p>
      )}
      {lowConfidence.length > 0 && (
        <p className="mt-1 flex items-start gap-2 text-xs text-[rgb(var(--signal-amber))]">
          <Eye className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Low-confidence: {lowConfidence.map((o) => o.label).join(", ")}
        </p>
      )}
      {reviewRequired.length > 0 && (
        <p className="mt-1 flex items-start gap-2 text-xs text-[rgb(var(--signal-amber))]">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Review before deployment: {reviewRequired.map((o) => o.label).join(", ")}
        </p>
      )}
      {scene.warnings.slice(0, 3).map((warning) => (
        <p key={warning} className="mt-1 text-xs text-[rgb(var(--bone-2))]">
          • {warning}
        </p>
      ))}
    </section>
  );
}

function objectTooltip(object: SceneObject): string {
  const parts = [
    `${object.label} (${object.category})`,
    `fidelity: ${object.visualFidelity ?? "proxy"}`,
    `geometry: ${object.geometrySource ?? "unknown"}`,
    `confidence: ${Math.round(object.confidence * 100)}%`,
  ];
  if (object.trackId) parts.push(`track: ${object.trackId}`);
  if (object.detectionLabel) parts.push(`detected as: ${object.detectionLabel}`);
  if (object.reviewRequiredReason) parts.push(`review: ${object.reviewRequiredReason}`);
  return parts.join("\n");
}

function FidelityDot({ object }: { object: SceneObject }) {
  const needsReview = Boolean(object.reviewRequiredReason) || object.confidence < 0.45;
  const grounded = isEvidenceGrounded(object);
  const confirmed = grounded && object.confidence >= 0.6 && object.visualFidelity !== "proxy";
  return (
    <span
      aria-hidden
      className={cn(
        "h-2 w-2 shrink-0 rounded-full",
        needsReview
          ? "bg-[rgb(var(--signal-amber))]"
          : confirmed
            ? "bg-[rgb(var(--signal-green))]"
            : "bg-[rgb(var(--steel))]",
      )}
    />
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "warn" }) {
  return (
    <div className="rounded-md border border-[rgb(var(--steel))] bg-[rgb(var(--ink-2))] px-2 py-1.5">
      <p className="text-[10px] uppercase tracking-[0.1em] text-[rgb(var(--bone-2))]">{label}</p>
      <p className={cn("font-mono text-sm tabular", tone === "warn" && "text-[rgb(var(--signal-amber))]")}>{value}</p>
    </div>
  );
}
