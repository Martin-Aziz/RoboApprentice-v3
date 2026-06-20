"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, Download, FileCheck2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RISK_ASSESSMENT_DISCLAIMER } from "@/lib/risk-assessment-generator";
import { readWorkcellConfig } from "@/lib/workcell-config";
import type { Task, TaskCategory } from "@/lib/types";

const DEFAULT_REVIEW_SECTIONS = [
  "1 Task Description",
  "2 Hazard Identification",
  "3 Risk Estimation",
  "4 Risk Reduction Measures",
  "5 Residual Risk Statement",
  "6 Approval and Sign-Off",
];

export function RiskAssessmentDraftAction({ task }: { task: Task }) {
  const [open, setOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviewSections, setReviewSections] = useState<string[]>([]);
  const [taskCategory, setTaskCategory] = useState<TaskCategory>("pick-place");
  const [robotModel, setRobotModel] = useState(task.targetRobotModels?.[0] ?? "");
  const [siteName, setSiteName] = useState("Production Facility");
  const [gripperForce, setGripperForce] = useState("");
  const [operatorProximity, setOperatorProximity] = useState("");

  async function downloadDraft() {
    setDownloading(true);
    setError(null);
    try {
      const workcell = readWorkcellConfig();
      const response = await fetch(
        `/api/v1/tasks/${task.id}/risk-assessment/draft`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            taskCategory,
            robotModel,
            siteName,
            gripperType: workcell.gripperType,
            gripperForceNewtons: gripperForce || undefined,
            operatorProximityMillimeters: operatorProximity || undefined,
          }),
        },
      );
      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? "The draft could not be generated.");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `aurevix-risk-assessment-${task.id}.docx`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);

      const encoded = response.headers.get("X-Aurevix-Review-Sections");
      setReviewSections(
        encoded
          ? JSON.parse(decodeURIComponent(encoded)) as string[]
          : DEFAULT_REVIEW_SECTIONS,
      );
      setOpen(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The draft could not be generated.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} className="gap-2">
        <FileCheck2 className="h-4 w-4" />
        Generate Risk Assessment Draft
      </Button>

      {reviewSections.length > 0 && (
        <section className="hud mt-5 rounded-md p-5">
          <span className="hud-corner-tr" />
          <span className="hud-corner-bl" />
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 text-[rgb(var(--signal-green))]" />
            <div>
              <h2 className="font-semibold">Draft downloaded — qualified review still required</h2>
              <p className="mt-1 text-sm text-[rgb(var(--bone-2))]">{RISK_ASSESSMENT_DISCLAIMER}</p>
            </div>
          </div>
          <div className="mt-4 grid gap-2 md:grid-cols-2">
            {reviewSections.map((section) => (
              <label key={section} className="flex items-center gap-3 rounded-md border border-[rgb(var(--signal-amber)/0.35)] bg-[rgb(var(--signal-amber)/0.08)] p-3 text-sm">
                <input type="checkbox" className="h-4 w-4 accent-[rgb(var(--signal-cyan))]" />
                <span>{section}</span>
              </label>
            ))}
          </div>
        </section>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgb(var(--bone)/0.55)] p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="risk-modal-title" className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-md border border-[rgb(var(--steel))] bg-[rgb(var(--ink-2))] shadow-xl">
            <div className="flex items-center justify-between border-b border-[rgb(var(--steel))] p-5">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-[rgb(var(--signal-cyan))]">Editable Word draft</p>
                <h2 id="risk-modal-title" className="mt-1 font-display text-2xl">Generate risk assessment draft</h2>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Close">
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="space-y-5 p-5">
              <div className="flex gap-3 rounded-md border border-[rgb(var(--signal-red)/0.35)] bg-[rgb(var(--signal-red)/0.08)] p-4">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[rgb(var(--signal-red))]" />
                <p className="text-sm"><strong>Qualified review is mandatory.</strong> {RISK_ASSESSMENT_DISCLAIMER}</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Robot model">
                  <input value={robotModel} onChange={(event) => setRobotModel(event.target.value)} placeholder="e.g. UR5e" className="w-full rounded-md border border-[rgb(var(--steel))] bg-[rgb(var(--ink-3))] px-3 py-2" />
                </Field>
                <Field label="Task category">
                  <select value={taskCategory} onChange={(event) => setTaskCategory(event.target.value as TaskCategory)} className="w-full rounded-md border border-[rgb(var(--steel))] bg-[rgb(var(--ink-3))] px-3 py-2">
                    <option value="pick-place">Pick and place</option>
                    <option value="machine-tend">Machine tending</option>
                    <option value="assembly">Assembly</option>
                    <option value="palletising">Palletising</option>
                  </select>
                </Field>
                <Field label="Site name">
                  <input value={siteName} onChange={(event) => setSiteName(event.target.value)} className="w-full rounded-md border border-[rgb(var(--steel))] bg-[rgb(var(--ink-3))] px-3 py-2" />
                </Field>
                <Field label="Gripper force in N (if known)">
                  <input type="number" min="0" value={gripperForce} onChange={(event) => setGripperForce(event.target.value)} placeholder="Leave blank for review" className="w-full rounded-md border border-[rgb(var(--steel))] bg-[rgb(var(--ink-3))] px-3 py-2" />
                </Field>
                <Field label="Nearest operator zone in mm (if known)">
                  <input type="number" min="0" value={operatorProximity} onChange={(event) => setOperatorProximity(event.target.value)} placeholder="Leave blank for review" className="w-full rounded-md border border-[rgb(var(--steel))] bg-[rgb(var(--ink-3))] px-3 py-2" />
                </Field>
              </div>

              <label className="flex cursor-pointer items-start gap-3 rounded-md border border-[rgb(var(--signal-amber)/0.35)] bg-[rgb(var(--signal-amber)/0.08)] p-4">
                <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-0.5 h-4 w-4 accent-[rgb(var(--signal-cyan))]" />
                <span className="text-sm">I understand this is an auto-drafted starting point that must be reviewed, completed, and signed by a qualified person before robot operation.</span>
              </label>

              {error && <p className="rounded-md bg-[rgb(var(--signal-red)/0.1)] p-3 text-sm text-[rgb(var(--signal-red))]">{error}</p>}

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button disabled={!confirmed || !robotModel.trim() || downloading} onClick={downloadDraft} className="gap-2">
                  <Download className="h-4 w-4" />
                  {downloading ? "Generating editable draft…" : "Confirm and download .docx"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm">
      <span className="font-medium">{label}</span>
      {children}
    </label>
  );
}
