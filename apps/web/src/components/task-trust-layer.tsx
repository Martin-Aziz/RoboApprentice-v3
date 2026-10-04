"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock3,
  Download,
  FileClock,
  Fingerprint,
  Loader2,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type {
  TaskTrustRecord,
  TaskVersion,
  TrustChecklistItem,
} from "@/lib/types";

async function readJson<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? "The trust record could not be updated.");
  return body;
}

export function TaskTrustLayer({ taskId }: { taskId: string }) {
  const queryClient = useQueryClient();
  const [reviewerName, setReviewerName] = useState("");
  const [reviewerRole, setReviewerRole] = useState("");
  const [qualification, setQualification] = useState("");
  const [comments, setComments] = useState("");
  const [editingCheck, setEditingCheck] = useState<TrustChecklistItem | null>(null);

  const trustQuery = useQuery({
    queryKey: ["task-trust", taskId],
    queryFn: async () => readJson<TaskTrustRecord>(await fetch(`/api/tasks/${taskId}/trust`)),
  });
  const versionsQuery = useQuery({
    queryKey: ["task-versions", taskId],
    queryFn: async () => readJson<TaskVersion[]>(await fetch(`/api/tasks/${taskId}/versions`)),
  });
  const mutation = useMutation({
    mutationFn: async (body: Record<string, string>) =>
      readJson<TaskTrustRecord>(await fetch(`/api/tasks/${taskId}/trust`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })),
    onSuccess: (record) => {
      queryClient.setQueryData(["task-trust", taskId], record);
      setEditingCheck(null);
    },
  });

  const record = trustQuery.data;
  if (trustQuery.isLoading || !record) {
    return (
      <section className="hud rounded-md p-6">
        <span className="hud-corner-tr" />
        <span className="hud-corner-bl" />
        <div className="flex items-center gap-2 text-sm text-[rgb(var(--bone-2))]">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading deployment trust record…
        </div>
      </section>
    );
  }

  const allChecksPassed = record.checklist.every((item) => !item.required || item.status === "passed");
  const gateTone =
    record.gate_status === "approved"
      ? "border-[rgb(var(--signal-green)/0.4)] bg-[rgb(var(--signal-green)/0.08)] text-[rgb(var(--signal-green))]"
      : record.gate_status === "blocked"
        ? "border-[rgb(var(--signal-red)/0.4)] bg-[rgb(var(--signal-red)/0.08)] text-[rgb(var(--signal-red))]"
        : "border-[rgb(var(--signal-amber)/0.4)] bg-[rgb(var(--signal-amber)/0.08)] text-[rgb(var(--signal-amber))]";
  const GateIcon = record.gate_status === "approved" ? ShieldCheck : record.gate_status === "blocked" ? XCircle : Clock3;

  function decide(status: "approved" | "rejected") {
    mutation.mutate({
      action: "decide",
      status,
      reviewer_name: reviewerName,
      reviewer_role: reviewerRole,
      qualification,
      comments,
    });
  }

  return (
    <section className="hud rounded-md p-6">
      <span className="hud-corner-tr" />
      <span className="hud-corner-bl" />
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-[rgb(var(--signal-cyan))]">Deployment trust layer</p>
          <h2 className="mt-2 font-display text-3xl">Evidence before operation</h2>
          <p className="mt-2 max-w-3xl text-sm text-[rgb(var(--bone-2))]">
            The gate is attached to the exact task version and policy fingerprint below. Any task change invalidates approval and requires review again. Visual replay, step guardrails, and qualified evidence are tracked separately so the operator can see what is estimated versus what has been formally reviewed.
          </p>
        </div>
        <div className={`min-w-64 rounded-md border p-4 ${gateTone}`}>
          <div className="flex items-center gap-2">
            <GateIcon className="h-5 w-5" />
            <span className="font-mono text-xs uppercase tracking-[0.16em]">{record.gate_status.replace("-", " ")}</span>
          </div>
          <p className="mt-2 font-mono text-3xl tabular">{record.readiness_score}%</p>
          <p className="mt-1 text-xs">{record.gate_reason}</p>
        </div>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-3">
        <Meta icon={FileClock} label="Task version" value={`v${record.current_task_version}`} />
        <Meta icon={Fingerprint} label="Policy fingerprint" value={record.policy_hash} />
        <Meta icon={ShieldCheck} label="Approval" value={record.approval.status} />
      </div>

      <div className="mt-7">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h3 className="font-display text-2xl">Required evidence</h3>
            <p className="mt-1 text-sm text-[rgb(var(--bone-2))]">The percentage is only the weighted completion of the explicit checks shown here.</p>
          </div>
          <a
            href={`/api/tasks/${taskId}/trust/evidence`}
            className="inline-flex h-9 items-center gap-2 rounded-[2px] border border-[rgb(var(--steel))] px-4 text-sm hover:border-[rgb(var(--signal-cyan))] hover:text-[rgb(var(--signal-cyan))]"
          >
            <Download className="h-4 w-4" /> Evidence package
          </a>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {record.checklist.map((item) => (
            <CheckCard key={item.id} item={item} onReview={() => setEditingCheck(item)} />
          ))}
        </div>
      </div>

      <div className="mt-7 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-md border border-[rgb(var(--steel))] bg-[rgb(var(--ink-3))] p-5">
          <h3 className="font-display text-2xl">Qualified-person decision</h3>
          <p className="mt-1 text-sm text-[rgb(var(--bone-2))]">Aurevix documents the decision; it does not certify the installation or replace the responsible safety professional.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label="Reviewer name">
              <input value={reviewerName} onChange={(event) => setReviewerName(event.target.value)} className="trust-input" placeholder="Full name" />
            </Field>
            <Field label="Role">
              <input value={reviewerRole} onChange={(event) => setReviewerRole(event.target.value)} className="trust-input" placeholder="Safety engineer" />
            </Field>
            <Field label="Qualification">
              <input value={qualification} onChange={(event) => setQualification(event.target.value)} className="trust-input" placeholder="Relevant training / authority" />
            </Field>
            <Field label="Decision comments">
              <input value={comments} onChange={(event) => setComments(event.target.value)} className="trust-input" placeholder="Conditions, limits, or rejection reason" />
            </Field>
          </div>
          {record.approval.decided_at && (
            <div className="mt-4 rounded-md border border-[rgb(var(--steel))] bg-[rgb(var(--ink-2))] p-3 text-sm">
              <p className="font-medium">Current decision: {record.approval.status}</p>
              <p className="mt-1 text-[rgb(var(--bone-2))]">
                {record.approval.reviewer_name} · {record.approval.reviewer_role} · version {record.approval.task_version}
              </p>
            </div>
          )}
          {mutation.error && <p className="mt-3 text-sm text-[rgb(var(--signal-red))]">{mutation.error.message}</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              onClick={() => decide("approved")}
              disabled={!allChecksPassed || mutation.isPending}
              className="gap-2"
            >
              <CheckCircle2 className="h-4 w-4" /> Approve current version
            </Button>
            <Button variant="destructive" onClick={() => decide("rejected")} disabled={mutation.isPending} className="gap-2">
              <XCircle className="h-4 w-4" /> Reject
            </Button>
          </div>
        </div>

        <div className="rounded-md border border-[rgb(var(--steel))] bg-[rgb(var(--ink-2))] p-5">
          <h3 className="font-display text-2xl">Record history</h3>
          <div className="mt-4 max-h-80 space-y-4 overflow-auto pr-2">
            {[...record.audit_log].reverse().map((event) => (
              <div key={event.event_id} className="border-l-2 border-[rgb(var(--signal-cyan)/0.35)] pl-4">
                <p className="text-sm font-medium">{event.summary}</p>
                <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-[rgb(var(--bone-2))]">
                  {event.actor} · v{event.task_version} · {new Date(event.created_at).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-5 border-t border-[rgb(var(--steel))] pt-4">
            <p className="font-mono text-xs uppercase tracking-[0.14em] text-[rgb(var(--bone-2))]">Version lineage</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {(versionsQuery.data ?? []).map((version) => (
                <span key={version.version_id} className="rounded-md border border-[rgb(var(--steel))] px-2 py-1 font-mono text-xs">
                  v{version.version_number} · {new Date(version.created_at).toLocaleDateString()}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {editingCheck && (
        <ReviewDialog
          item={editingCheck}
          pending={mutation.isPending}
          error={mutation.error instanceof Error ? mutation.error.message : null}
          onClose={() => setEditingCheck(null)}
          onSave={(status, evidence, actor) => mutation.mutate({
            action: "update-check",
            check_id: editingCheck.id,
            status,
            evidence,
            actor,
          })}
        />
      )}
    </section>
  );
}

function CheckCard({ item, onReview }: { item: TrustChecklistItem; onReview: () => void }) {
  const Icon = item.status === "passed" ? CheckCircle2 : item.status === "failed" ? AlertTriangle : Clock3;
  const tone =
    item.status === "passed"
      ? "text-[rgb(var(--signal-green))]"
      : item.status === "failed"
        ? "text-[rgb(var(--signal-red))]"
        : "text-[rgb(var(--signal-amber))]";
  return (
    <article className="rounded-md border border-[rgb(var(--steel))] bg-[rgb(var(--ink-2))] p-4">
      <div className="flex items-start gap-3">
        <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${tone}`} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h4 className="font-medium">{item.label}</h4>
              <p className="mt-1 text-xs text-[rgb(var(--bone-2))]">{item.description}</p>
            </div>
            <span className="font-mono text-xs tabular text-[rgb(var(--bone-2))]">{item.weight}%</span>
          </div>
          <p className="mt-3 rounded-md bg-[rgb(var(--ink-3))] p-2 text-xs">{item.evidence}</p>
          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[rgb(var(--bone-2))]">{item.source.replace("-", " ")}</span>
            {item.source === "qualified-reviewer" && (
              <Button variant="outline" size="sm" onClick={onReview}>Record review</Button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

function ReviewDialog({
  item,
  pending,
  error,
  onClose,
  onSave,
}: {
  item: TrustChecklistItem;
  pending: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (status: "passed" | "failed" | "pending", evidence: string, actor: string) => void;
}) {
  const [status, setStatus] = useState<"passed" | "failed" | "pending">(item.status);
  const [evidence, setEvidence] = useState(item.status === "pending" ? "" : item.evidence);
  const [actor, setActor] = useState(item.updated_by ?? "");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgb(var(--bone)/0.55)] p-4">
      <div role="dialog" aria-modal="true" className="w-full max-w-xl rounded-md border border-[rgb(var(--steel))] bg-[rgb(var(--ink-2))] p-5 shadow-xl">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-[rgb(var(--signal-cyan))]">Attach reviewer evidence</p>
        <h3 className="mt-2 font-display text-2xl">{item.label}</h3>
        <div className="mt-4 grid gap-4">
          <Field label="Reviewer">
            <input value={actor} onChange={(event) => setActor(event.target.value)} className="trust-input" placeholder="Name of person performing this check" />
          </Field>
          <Field label="Result">
            <select value={status} onChange={(event) => setStatus(event.target.value as typeof status)} className="trust-input">
              <option value="passed">Passed</option>
              <option value="failed">Failed</option>
              <option value="pending">Pending further evidence</option>
            </select>
          </Field>
          <Field label="Evidence and observations">
            <textarea value={evidence} onChange={(event) => setEvidence(event.target.value)} className="trust-input min-h-28" placeholder="What was checked, how it was tested, and what was observed?" />
          </Field>
        </div>
        {error && <p className="mt-3 text-sm text-[rgb(var(--signal-red))]">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={pending || !actor.trim() || !evidence.trim()} onClick={() => onSave(status, evidence, actor)}>
            <Check className="h-4 w-4" /> Save evidence
          </Button>
        </div>
      </div>
    </div>
  );
}

function Meta({ icon: Icon, label, value }: { icon: typeof ShieldCheck; label: string; value: string }) {
  return (
    <div className="rounded-md border border-[rgb(var(--steel))] bg-[rgb(var(--ink-3))] p-4">
      <Icon className="h-4 w-4 text-[rgb(var(--signal-cyan))]" />
      <p className="mt-2 font-mono text-sm tabular">{value}</p>
      <p className="mt-1 text-xs text-[rgb(var(--bone-2))]">{label}</p>
    </div>
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
