"use client";

import { useState } from "react";
import { AlertTriangle, Box, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type {
  FixtureDesignOutput,
  PartShape,
  RequiredPickFace,
  Task,
} from "@/lib/types";

export function FixtureDesignerPanel({ task }: { task: Task }) {
  const [shape, setShape] = useState<PartShape>("RECTANGULAR");
  const [face, setFace] = useState<RequiredPickFace>("TOP");
  const [length, setLength] = useState("100");
  const [width, setWidth] = useState("60");
  const [height, setHeight] = useState("25");
  const [tolerance, setTolerance] = useState("0.5");
  const [force, setForce] = useState("40");
  const [temperature, setTemperature] = useState("25");
  const [design, setDesign] = useState<FixtureDesignOutput | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setWorking(true);
    setError(null);
    try {
      const response = await fetch(`/api/v1/tasks/${task.id}/fixture-design`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          part_geometry: {
            shape,
            bounding_box: {
              length_mm: Number(length),
              width_mm: Number(width),
              height_mm: Number(height),
            },
          },
          required_pick_face: face,
          required_repeatability_mm: Number(tolerance),
          max_cycle_force_n: Number(force),
          environment_temperature_c: Number(temperature),
        }),
      });
      const body = await response.json() as FixtureDesignOutput & { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Fixture design failed.");
      setDesign(body);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Fixture design failed.");
    } finally {
      setWorking(false);
    }
  }

  const customTooltip =
    "Your part geometry requires a custom design - see the specification for dimensions to brief a designer.";

  return (
    <section className="rounded-md border border-[rgb(var(--steel))] bg-[rgb(var(--ink-2))] p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-[rgb(var(--signal-cyan))]">Fabrication assistant</p>
          <h2 className="mt-2 font-display text-2xl">Fixture &amp; Jig</h2>
          <p className="mt-1 max-w-2xl text-sm text-[rgb(var(--bone-2))]">Generate a tolerance-controlled fixture brief and, for simple nests or V-blocks, a printable STL.</p>
        </div>
        <Button onClick={generate} disabled={working} className="gap-2">
          {working ? <Loader2 className="h-4 w-4 animate-spin" /> : <Box className="h-4 w-4" />}
          {working ? "Designing…" : "Generate fixture design"}
        </Button>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Part shape"><select value={shape} onChange={(event) => setShape(event.target.value as PartShape)} className={inputClass}><option value="RECTANGULAR">Rectangular</option><option value="CYLINDRICAL">Cylindrical</option><option value="IRREGULAR">Irregular</option><option value="UNKNOWN">Not sure</option></select></Field>
        <Field label="Robot picks from"><select value={face} onChange={(event) => setFace(event.target.value as RequiredPickFace)} className={inputClass}><option value="TOP">Top</option><option value="SIDE">Side</option><option value="BOTTOM">Bottom</option></select></Field>
        <Field label="Length (mm)"><input type="number" min="1" value={length} onChange={(event) => setLength(event.target.value)} className={inputClass} /></Field>
        <Field label="Width (mm)"><input type="number" min="1" value={width} onChange={(event) => setWidth(event.target.value)} className={inputClass} /></Field>
        <Field label="Height (mm)"><input type="number" min="1" value={height} onChange={(event) => setHeight(event.target.value)} className={inputClass} /></Field>
        <Field label="Repeatability (± mm)"><input type="number" min="0.05" step="0.05" value={tolerance} onChange={(event) => setTolerance(event.target.value)} className={inputClass} /></Field>
        <Field label="Maximum cycle force (N)"><input type="number" min="0" value={force} onChange={(event) => setForce(event.target.value)} className={inputClass} /></Field>
        <Field label="Environment (°C)"><input type="number" value={temperature} onChange={(event) => setTemperature(event.target.value)} className={inputClass} /></Field>
      </div>

      <p className="mt-4 rounded-md border border-[rgb(var(--signal-amber)/0.35)] bg-[rgb(var(--signal-amber)/0.08)] p-3 text-sm">
        This fixture design is a starting point. Have a qualified person verify dimensions before production use.
      </p>
      {error && <p className="mt-3 rounded-md bg-[rgb(var(--signal-red)/0.1)] p-3 text-sm text-[rgb(var(--signal-red))]">{error}</p>}

      {design && (
        <div className="mt-5">
          {design.human_review_required && (
            <div className="mb-4 flex gap-3 rounded-md border border-[rgb(var(--signal-amber)/0.4)] bg-[rgb(var(--signal-amber)/0.1)] p-4">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[rgb(var(--signal-amber))]" />
              <p className="text-sm"><strong>This fixture design is a starting point.</strong> Have a qualified person verify dimensions before production use.</p>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-3">
            <Metric label="Fixture type" value={design.fixture_type ?? "Review required"} />
            <Metric label="Material" value={(design.material_recommendation ?? "").replaceAll("_", " ")} />
            <Metric label="Confidence" value={design.confidence ?? "LOW"} />
          </div>
          <div className="mt-4 overflow-hidden rounded-md border border-[rgb(var(--steel))]">
            {Object.entries(design.specification?.dimensions ?? {}).map(([name, value]) => (
              <div key={name} className="grid grid-cols-[1fr_auto] gap-4 border-b border-[rgb(var(--steel))] px-4 py-2.5 text-sm last:border-b-0">
                <span>{name.replaceAll("_", " ")}</span>
                <span className="font-mono tabular">{value.nominal_mm} ± {value.tolerance_mm} {name.includes("degrees") ? "deg" : "mm"}</span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm text-[rgb(var(--bone-2))]">{design.manufacturing_notes}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button asChild variant="outline" className="gap-2"><a href={design.specification_pdf_url} download><Download className="h-4 w-4" />Download Specification (PDF)</a></Button>
            {design.geometry_download_url ? (
              <Button asChild className="gap-2"><a href={design.geometry_download_url} download><Download className="h-4 w-4" />Download 3D File (STL)</a></Button>
            ) : (
              <Button disabled title={customTooltip} className="gap-2"><Download className="h-4 w-4" />Download 3D File (STL)</Button>
            )}
          </div>
          {!design.geometry_download_url && <p className="mt-2 text-xs text-[rgb(var(--bone-2))]">{customTooltip}</p>}
        </div>
      )}
    </section>
  );
}

const inputClass = "w-full rounded-md border border-[rgb(var(--steel))] bg-[rgb(var(--ink-3))] px-3 py-2";
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="grid gap-1.5 text-sm"><span className="font-medium">{label}</span>{children}</label>; }
function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-md bg-[rgb(var(--ink-3))] p-4"><p className="font-mono text-sm">{value}</p><p className="mt-1 text-xs text-[rgb(var(--bone-2))]">{label}</p></div>; }
