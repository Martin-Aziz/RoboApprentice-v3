"use client";

import { useState } from "react";
import { AlertTriangle, ArrowUpRight, Bot, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type {
  GripperRecommendationResponse,
  PartMaterial,
  PartSurface,
  Task,
} from "@/lib/types";

export function GripperRecommendations({ task }: { task: Task }) {
  const [payload, setPayload] = useState("");
  const [material, setMaterial] = useState<PartMaterial>("unknown");
  const [surface, setSurface] = useState<PartSurface>("unknown");
  const [data, setData] = useState<GripperRecommendationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadRecommendations() {
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      if (payload) query.set("payload_kg", payload);
      if (material !== "unknown") query.set("material", material);
      if (surface !== "unknown") query.set("surface", surface);
      const response = await fetch(
        `/api/v1/tasks/${task.id}/gripper-recommendations?${query}`,
      );
      const body = await response.json() as GripperRecommendationResponse & { error?: string };
      if (!response.ok) throw new Error(body.error ?? body.explanation);
      setData(body);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Recommendations could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  const lowConfidence =
    data?.recommendations.some((recommendation) => recommendation.confidence === "LOW") ?? false;

  return (
    <section className="rounded-md border border-[rgb(var(--steel))] bg-[rgb(var(--ink-2))] p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-[rgb(var(--signal-cyan))]">Technical fit only</p>
          <h2 className="mt-2 font-display text-2xl">Recommended End-Effectors</h2>
          <p className="mt-1 max-w-2xl text-sm text-[rgb(var(--bone-2))]">
            Plain-language hardware matches using robot compatibility, payload margin, part properties, and cycle target.
          </p>
        </div>
        <Button onClick={loadRecommendations} disabled={loading} className="gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          {data ? "Refresh matches" : "Find matching grippers"}
        </Button>
      </div>

      <p className="mt-4 rounded-md border border-[rgb(var(--signal-amber)/0.3)] bg-[rgb(var(--signal-amber)/0.07)] p-3 text-xs text-[rgb(var(--bone-2))]">
        Aurevix may earn a referral fee from some of these links. Recommendations are based solely on technical fit for your task.
      </p>

      {error && <p className="mt-4 rounded-md bg-[rgb(var(--signal-red)/0.1)] p-3 text-sm text-[rgb(var(--signal-red))]">{error}</p>}

      {data && (
        <>
          <p className="mt-4 text-sm text-[rgb(var(--bone-2))]">{data.explanation}</p>
          {data.recommendations.length > 0 ? (
            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              {data.recommendations.map((recommendation, index) => (
                <article key={recommendation.gripper.id} className="flex flex-col overflow-hidden rounded-md border border-[rgb(var(--steel))] bg-[rgb(var(--ink-2))]">
                  <a
                    href={recommendation.gripper.image_url}
                    target="_blank"
                    rel="noreferrer sponsored"
                    className="flex aspect-[16/9] items-center justify-center bg-[rgb(var(--ink-3))] text-[rgb(var(--signal-cyan))]"
                    aria-label={`Open manufacturer product imagery for ${recommendation.gripper.model_name}`}
                  >
                    <div className="text-center">
                      <Bot className="mx-auto h-10 w-10" />
                      <span className="mt-2 block font-mono text-xs uppercase tracking-[0.14em]">Manufacturer product photo</span>
                    </div>
                  </a>
                  <div className="flex flex-1 flex-col p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-mono text-xs text-[rgb(var(--bone-2))]">#{index + 1} · {recommendation.gripper.manufacturer}</p>
                        <h3 className="mt-1 text-lg font-semibold">{recommendation.gripper.model_name}</h3>
                      </div>
                      <span className={confidenceClass(recommendation.confidence)}>{recommendation.confidence}</span>
                    </div>
                    <p className="mt-3 text-sm text-[rgb(var(--bone-2))]">{recommendation.plain_english_reason}</p>
                    <p className="mt-3 font-mono text-xs tabular">Match {Math.round(recommendation.match_score * 100)}%</p>
                    <p className="mt-2 text-xs text-[rgb(var(--bone-3))]">{recommendation.confidence_reason}</p>
                    <p className="mt-2 text-xs text-[rgb(var(--bone-3))]">
                      Source: {recommendation.gripper.estimated_fields.length
                        ? `datasheet; estimated fields: ${recommendation.gripper.estimated_fields.join(", ")}`
                        : "manufacturer datasheet"}
                    </p>
                    <div className="mt-auto flex gap-2 pt-5">
                      <Button asChild size="sm">
                        <a href={withAffiliateTag(recommendation.gripper.product_url, recommendation.gripper.affiliate_tag)} target="_blank" rel="noreferrer sponsored">
                          View product <ArrowUpRight className="h-3.5 w-3.5" />
                        </a>
                      </Button>
                      <Button asChild size="sm" variant="outline">
                        <a href={withAffiliateTag(recommendation.gripper.enquiry_url, recommendation.gripper.affiliate_tag)} target="_blank" rel="noreferrer sponsored">Enquire</a>
                      </Button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-md border border-[rgb(var(--signal-amber)/0.35)] bg-[rgb(var(--signal-amber)/0.08)] p-4 text-sm">
              Aurevix found no technically qualifying catalogue entry. Check the robot model and part weight, or ask an integrator for a custom end-effector.
            </div>
          )}
        </>
      )}

      {(!data || lowConfidence) && (
        <div className="mt-5 rounded-md border border-[rgb(var(--signal-cyan)/0.3)] bg-[rgb(var(--signal-cyan)/0.05)] p-4">
          {lowConfidence && (
            <div className="mb-4 flex gap-2 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[rgb(var(--signal-amber))]" />
              <p><strong>We couldn&apos;t determine your part material or surface.</strong> Tell us more to get a better match.</p>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Part weight (kg)">
              <input type="number" min="0.01" step="0.01" value={payload} onChange={(event) => setPayload(event.target.value)} placeholder="e.g. 2.4" className="w-full rounded-md border border-[rgb(var(--steel))] bg-[rgb(var(--ink-2))] px-3 py-2" />
            </Field>
            <Field label="Part material">
              <select value={material} onChange={(event) => setMaterial(event.target.value as PartMaterial)} className="w-full rounded-md border border-[rgb(var(--steel))] bg-[rgb(var(--ink-2))] px-3 py-2">
                <option value="unknown">Not sure</option><option value="metal">Metal</option><option value="plastic">Plastic</option><option value="glass">Glass</option><option value="cardboard">Cardboard</option>
              </select>
            </Field>
            <Field label="Surface texture">
              <select value={surface} onChange={(event) => setSurface(event.target.value as PartSurface)} className="w-full rounded-md border border-[rgb(var(--steel))] bg-[rgb(var(--ink-2))] px-3 py-2">
                <option value="unknown">Not sure</option><option value="smooth">Smooth</option><option value="rough">Rough</option><option value="porous">Porous</option>
              </select>
            </Field>
          </div>
        </div>
      )}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid gap-1.5 text-sm"><span className="font-medium">{label}</span>{children}</label>;
}

function confidenceClass(confidence: "LOW" | "MEDIUM" | "HIGH") {
  if (confidence === "HIGH") return "rounded-full bg-[rgb(var(--signal-green)/0.1)] px-2 py-1 font-mono text-[10px] text-[rgb(var(--signal-green))]";
  if (confidence === "MEDIUM") return "rounded-full bg-[rgb(var(--signal-amber)/0.1)] px-2 py-1 font-mono text-[10px] text-[rgb(var(--signal-amber))]";
  return "rounded-full bg-[rgb(var(--signal-red)/0.1)] px-2 py-1 font-mono text-[10px] text-[rgb(var(--signal-red))]";
}

function withAffiliateTag(url: string, tag: string | null) {
  if (!tag) return url;
  const parsed = new URL(url);
  parsed.searchParams.set("ref", tag);
  return parsed.toString();
}
