"use client";

import { useEffect, useMemo, useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneLight } from "react-syntax-highlighter/dist/cjs/styles/prism";
import jsPDF from "jspdf";
import { ArrowDown, ArrowUp, Check, CheckCircle2, Code2, Download, Plus, Play, Rocket, Trash2, TrendingUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RobotViewport } from "@/components/robot-viewport";
import { DeployReadiness } from "@/components/deploy-readiness";
import { RoiCalculator } from "@/components/roi-calculator";
import { DEMO_VIDEO_URL, FALLBACK_POLICY, FALLBACK_STEPS } from "@/lib/demo-seed";
import { useDemoData } from "@/lib/use-demo-data";
import { useLocale } from "@/lib/i18n";
import type { Skill, TaskPolicy, TaskStep } from "@/lib/types";
import { readSafeDemoMode } from "@/lib/demo-mode";
import { DEFAULT_WORKCELL_CONFIG, isPneumaticGripper, readWorkcellConfig, type WorkcellConfig } from "@/lib/workcell-config";
import { toRapid, toFanucKarel } from "@/lib/codegen";
import { DEFAULT_TOOL_CHANGER_CONFIG, readToolChangerConfig, type ToolChangerConfig, type ToolStation } from "@/lib/tool-changer";
import { generateRos, generateUr, type ConditionType, type SequenceGate, type SequenceStep, type SequenceStepType } from "@/lib/teach-codegen";

type Modal = "deploy" | "export" | "roi" | null;
type DemoRobot = "ur5e" | "abb_gofa" | "techman_tm12" | "kuka_kr6" | "fanuc_lr_mate" | "yaskawa_gp12";
const ROBOT_OPTIONS: Array<{ value: DemoRobot; label: string; codeLabel: string }> = [
  { value: "ur5e", label: "Universal Robots UR5e", codeLabel: "Universal Robots UR5e" },
  { value: "abb_gofa", label: "ABB GoFa CRB 15000", codeLabel: "ABB GoFa CRB 15000" },
  { value: "kuka_kr6", label: "KUKA KR 6 R900", codeLabel: "KUKA KR 6 R900" },
  { value: "techman_tm12", label: "Techman TM12", codeLabel: "Techman TM12" },
  { value: "fanuc_lr_mate", label: "FANUC LR Mate 200iD", codeLabel: "FANUC LR Mate 200iD" },
  { value: "yaskawa_gp12", label: "Yaskawa Motoman GP12", codeLabel: "Yaskawa Motoman GP12" },
];

const STEP_TYPES: SequenceStepType[] = ["MOTION", "WAIT_FOR_SIGNAL", "GRIPPER_ACTUATE", "TOOL_CHANGE", "INSPECTION", "USER_CONFIRM"];
const DEFAULT_SEQUENCE: SequenceStep[] = [
  { id: "seq-pick", label: "Pick component", type: "MOTION", status: "pending", gateAfter: { type: "signal_high", signalPort: 2, elseAction: "wait" } },
  { id: "seq-orient", label: "Rotate component", type: "MOTION", status: "pending" },
  { id: "seq-place", label: "Place beside fixture", type: "MOTION", status: "pending", gateAfter: { type: "inspection_pass", signalPort: 3, failStepId: "seq-orient", elseAction: "retry" } },
  { id: "seq-toolchange", label: "Switch to vacuum cup", type: "TOOL_CHANGE", status: "pending", toolStationId: "station-vacuum" },
  { id: "seq-machine", label: "Trigger machine", type: "WAIT_FOR_SIGNAL", status: "pending", gateAfter: { type: "retry_or_abort", signalPort: 5, elseAction: "abort" } },
];

const SEQUENCE_STORAGE_KEY = "aurevix_teach_sequence";

function readSequence(): SequenceStep[] {
  if (typeof window === "undefined") return DEFAULT_SEQUENCE;
  try {
    const raw = localStorage.getItem(SEQUENCE_STORAGE_KEY);
    if (!raw) return DEFAULT_SEQUENCE;
    const parsed = JSON.parse(raw) as SequenceStep[];
    return parsed.length ? parsed.map((step) => ({ ...step, status: "pending" as const })) : DEFAULT_SEQUENCE;
  } catch {
    return DEFAULT_SEQUENCE;
  }
}

function saveSequence(sequence: SequenceStep[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(SEQUENCE_STORAGE_KEY, JSON.stringify(sequence.map((step) => ({ ...step, status: "pending" }))));
}

function stepTypeTone(type: SequenceStepType) {
  if (type === "WAIT_FOR_SIGNAL" || type === "USER_CONFIRM") return "border-[rgb(var(--signal-amber)/0.45)] bg-[rgb(var(--signal-amber)/0.1)] text-[rgb(var(--signal-amber))]";
  if (type === "GRIPPER_ACTUATE" || type === "TOOL_CHANGE") return "border-[rgb(var(--signal-green)/0.45)] bg-[rgb(var(--signal-green)/0.1)] text-[rgb(var(--signal-green))]";
  if (type === "INSPECTION") return "border-[rgb(var(--signal-cyan)/0.45)] bg-[rgb(var(--signal-cyan)/0.1)] text-[rgb(var(--signal-cyan))]";
  return "border-[rgb(var(--steel))] bg-[rgb(var(--ink-3))] text-[rgb(var(--bone-2))]";
}

export default function TeachPage() {
  const { t } = useLocale();
  const { addSkill, robots } = useDemoData();
  const [started, setStarted] = useState(false);
  const [steps, setSteps] = useState<TaskStep[]>([]);
  const [activeStep, setActiveStep] = useState(-1);
  const [done, setDone] = useState(false);
  const [modal, setModal] = useState<Modal>(null);
  const [deploying, setDeploying] = useState(false);
  const [deployed, setDeployed] = useState(false);
  const [robotType, setRobotType] = useState<DemoRobot>("ur5e");
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [sequence, setSequence] = useState<SequenceStep[]>(DEFAULT_SEQUENCE);
  const [activeSequenceIndex, setActiveSequenceIndex] = useState(-1);
  const [workcellConfig, setWorkcellConfig] = useState<WorkcellConfig>(DEFAULT_WORKCELL_CONFIG);
  const [toolChangerConfig, setToolChangerConfig] = useState<ToolChangerConfig>(DEFAULT_TOOL_CHANGER_CONFIG);
  const [safeDemoMode, setSafeDemoMode] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const policy = useMemo<TaskPolicy>(() => ({ ...FALLBACK_POLICY, steps }), [steps]);
  const selectedRobot = ROBOT_OPTIONS.find((robot) => robot.value === robotType) ?? ROBOT_OPTIONS[0];
  const totalMotionSteps = Math.max(sequence.length * FALLBACK_STEPS.length, FALLBACK_STEPS.length);
  const completedSequenceSteps = sequence.filter((step) => step.status === "complete").length;
  const gripperMode = isPneumaticGripper(workcellConfig.gripperType) ? "Pneumatic" : "Electric";

  useEffect(() => {
    setSequence(readSequence());
    setWorkcellConfig(readWorkcellConfig());
    setToolChangerConfig(readToolChangerConfig());
    setSafeDemoMode(readSafeDemoMode());
  }, []);

  useEffect(() => {
    saveSequence(sequence);
  }, [sequence]);

  useEffect(() => {
    if (!started) return;
    let cancelled = false;

    // Map streaming progress onto the sequence timeline (cosmetic) so the left
    // panel animates while the real interpretation arrives.
    const markSequenceProgress = (fraction: number) => {
      const count = sequence.length || 1;
      setSequence((current) => current.map((step, index) => {
        if (fraction >= (index + 1) / count) return { ...step, status: "complete" };
        if (fraction >= index / count) return { ...step, status: "analysing" };
        return { ...step, status: "pending" };
      }));
      setActiveSequenceIndex(Math.min(Math.floor(fraction * count), count - 1));
    };

    // Real pipeline: create a task for the bundled demo video, then consume the
    // SSE interpretation stream (Claude vision on extracted frames, server-side).
    const runReal = async () => {
      const createRes = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Bench pick-rotate-place demonstration", videoUrl: DEMO_VIDEO_URL }),
      });
      if (!createRes.ok) throw new Error(`task create failed: ${createRes.status}`);
      const task = (await createRes.json()) as { id: string };

      const res = await fetch(`/api/tasks/${task.id}/interpret`, { method: "POST" });
      if (!res.ok || !res.body) throw new Error(`interpret failed: ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const collected: TaskStep[] = [];
      let sawDone = false;

      type StreamEvent = { type: string; message?: string; step?: TaskStep; steps?: TaskStep[]; policy?: TaskPolicy };
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (cancelled) { await reader.cancel(); return; }
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";
        for (const evt of events) {
          const dataLine = evt.split("\n").find((l) => l.startsWith("data: "));
          if (!dataLine) continue;
          let payload: StreamEvent;
          try { payload = JSON.parse(dataLine.slice(6)) as StreamEvent; } catch { continue; }
          if (payload.type === "status" || payload.type === "warning") {
            setStatusMessage(payload.message ?? null);
          } else if (payload.type === "step" && payload.step) {
            collected.push(payload.step);
            setSteps([...collected]);
            setActiveStep(collected.length - 1);
            markSequenceProgress(Math.min(collected.length / 10, 0.95));
          } else if (payload.type === "done") {
            sawDone = true;
            const finalSteps = payload.policy?.steps ?? payload.steps ?? collected;
            setSteps(finalSteps);
            setActiveStep(finalSteps.length - 1);
          } else if (payload.type === "error") {
            throw new Error(payload.message ?? "interpretation error");
          }
        }
      }
      if (!sawDone && collected.length === 0) throw new Error("no steps produced");
    };

    // Offline safety net: the scripted walkthrough, so the demo always plays
    // even if the API route or network is unavailable.
    const runScripted = async () => {
      const activeSequence = sequence.length ? sequence : DEFAULT_SEQUENCE;
      let globalIndex = 0;
      for (let sequenceIndex = 0; sequenceIndex < activeSequence.length; sequenceIndex += 1) {
        if (cancelled) return;
        setActiveSequenceIndex(sequenceIndex);
        setSequence((current) => current.map((step, index) => index === sequenceIndex ? { ...step, status: "analysing" } : step));
        const stepCount = activeSequence[sequenceIndex].type === "MOTION" ? FALLBACK_STEPS.length : 2;
        for (let i = 0; i < stepCount; i += 1) {
          if (cancelled) return;
          await new Promise((resolve) => setTimeout(resolve, 360));
          if (cancelled) return;
          const template = FALLBACK_STEPS[i % FALLBACK_STEPS.length];
          setSteps((current) => [...current, { ...template, id: `${activeSequence[sequenceIndex].id}-${i}`, order: globalIndex + 1, description: `${activeSequence[sequenceIndex].label}: ${template.description}` }]);
          setActiveStep(globalIndex);
          globalIndex += 1;
        }
        setSequence((current) => current.map((step, index) => index === sequenceIndex ? { ...step, status: "complete" } : step));
      }
    };

    const run = async () => {
      setDone(false);
      setSteps([]);
      setActiveStep(-1);
      setActiveSequenceIndex(0);
      setStatusMessage(null);
      setSequence((current) => current.map((step) => ({ ...step, status: "pending" })));

      try {
        await runReal();
      } catch (err) {
        if (cancelled) return;
        console.warn("[teach] live analysis failed, using built-in walkthrough", err);
        setStatusMessage((prev) => prev ?? "Live analysis unavailable — playing the built-in walkthrough.");
        setSteps([]);
        setActiveStep(-1);
        setSequence((current) => current.map((step) => ({ ...step, status: "pending" })));
        await runScripted();
      }

      if (!cancelled) {
        setActiveSequenceIndex(-1);
        setSequence((current) => current.map((step) => ({ ...step, status: "complete" })));
        setDone(true);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [started, sequence.length]);

  const runWorkflow = () => {
    setStarted(false);
    window.setTimeout(() => setStarted(true), 0);
  };

  const updateSequence = (id: string, patch: Partial<SequenceStep>) => {
    setSequence((current) => current.map((step) => step.id === id ? { ...step, ...patch } : step));
  };

  const moveSequenceStep = (index: number, direction: -1 | 1) => {
    setSequence((current) => {
      const next = [...current];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const addSequenceStep = () => {
    setSequence((current) => [
      ...current,
      { id: `seq-${Date.now()}`, label: `Step ${current.length + 1}`, type: "MOTION", status: "pending" },
    ]);
  };

  const addGate = (id: string) => {
    updateSequence(id, { gateAfter: { type: "signal_high", signalPort: 2, elseAction: "wait" } });
  };

  const deploy = async () => {
    setDeploying(true);
    await new Promise((resolve) => setTimeout(resolve, 3000));
    const skill: Skill = {
      id: "skl-v2-precision-gripper",
      facility_id: "fac-production-001",
      name: "Pick Bracket A",
      description: "Learned from the precision gripper workflow",
      task_language: "en",
      confidence: 0.94,
      status: "ready",
      run_count: 0,
      success_count: 0,
      created_by: "demo-user-0000-0000-0000-000000000000",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      mean_cycle_ms: 4200,
      last_executed_at: new Date().toISOString(),
    };
    addSkill(skill);
    setDeploying(false);
    setDeployed(true);
  };

  return (
    <div className="mx-auto max-w-[1500px] space-y-5 p-4 md:p-6">
      <div className="grid gap-5 lg:grid-cols-[0.45fr_0.55fr]">
        <section className="rounded-lg border border-[rgb(var(--steel))] bg-[rgb(var(--ink-2))] p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-[rgb(var(--signal-cyan))]">Video input</p>
              <h1 className="mt-2 text-2xl font-semibold">{t("teach.title")}</h1>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {safeDemoMode && <span className="rounded-md border border-[rgb(var(--signal-green)/0.35)] bg-[rgb(var(--signal-green)/0.1)] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-[rgb(var(--signal-green))]">Safe demo mode</span>}
              <Button data-testid="auto-play-demo" onClick={runWorkflow} className="gap-2"><Play className="h-4 w-4" /> {t("teach.autoplay")}</Button>
            </div>
          </div>
          <video src={DEMO_VIDEO_URL} controls muted loop className="mt-4 aspect-video w-full rounded-md bg-[rgb(var(--ink-3))] object-cover" />
          <Button
            variant="outline"
            className="mt-4 w-full"
            onClick={() => setUploadMessage("Demo-safe mode uses the bundled 38s MP4 so the live flow remains fully offline and repeatable.")}
          >
            Try your own video
          </Button>
          {uploadMessage && <p className="mt-2 rounded-md bg-[rgb(var(--signal-amber)/0.1)] p-2 text-sm text-[rgb(var(--bone-2))]">{uploadMessage}</p>}
          <div className="mt-4 rounded-md border border-[rgb(var(--steel))] bg-[rgb(var(--ink-3))] p-3">
            <div className="flex items-center justify-between gap-3">
              <div><p className="font-semibold">Aurevix found {sequence.length} task stages</p><p className="text-sm text-[rgb(var(--bone-2))]">The guided workflow hides robot logic until you need to edit it.</p></div>
              <Button variant="outline" size="sm" onClick={() => setShowAdvanced((value) => !value)}>{showAdvanced ? "Hide advanced controls" : "Edit advanced logic"}</Button>
            </div>
          </div>
          {showAdvanced && <TaskSequencePanel
              sequence={sequence}
              toolStations={toolChangerConfig.stations}
              onAdd={addSequenceStep}
              onMove={moveSequenceStep}
              onUpdate={updateSequence}
              onDelete={(id) => setSequence((current) => current.filter((step) => step.id !== id))}
              onAddGate={addGate}
            />}
        </section>

        <section className="rounded-lg border border-[rgb(var(--steel))] bg-[rgb(var(--ink-2))] p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-[rgb(var(--signal-cyan))]">3D robot view</p>
              <h2 className="mt-2 text-2xl font-semibold">Replay policy</h2>
            </div>
            <span className="font-mono text-sm tabular">{activeStep + 1}/{steps.length || FALLBACK_STEPS.length}</span>
          </div>
          <label className="mb-3 grid max-w-sm gap-1 text-sm">
            <span className="text-[rgb(var(--bone-2))]">Robot model</span>
            <select
              aria-label="Robot model"
              className="rounded-md border border-[rgb(var(--steel))] bg-[rgb(var(--ink-3))] px-3 py-2"
              value={robotType}
              onChange={(event) => setRobotType(event.target.value as DemoRobot)}
            >
              {ROBOT_OPTIONS.map((robot) => <option key={robot.value} value={robot.value}>{robot.label}</option>)}
            </select>
          </label>
          <SequenceProgress sequence={sequence} activeIndex={activeSequenceIndex} completedMotionSteps={activeStep + 1} totalMotionSteps={totalMotionSteps} />
          <RobotViewport
            robotType={robotType}
            gripperType={workcellConfig.gripperType}
            policy={steps.length ? policy : FALLBACK_POLICY}
            playbackState={done || started ? "playing" : "paused"}
            className="min-h-[520px]"
          />
        </section>
      </div>

      <section className="rounded-lg border border-[rgb(var(--steel))] bg-[rgb(var(--ink-2))] p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Interpretation</h2>
          <span className="font-mono text-xs text-[rgb(var(--bone-2))]">{started ? done ? "complete" : "streaming" : "waiting"}</span>
        </div>
        {statusMessage && (
          <p data-testid="analysis-status" className="mt-2 rounded-md border border-[rgb(var(--signal-cyan)/0.3)] bg-[rgb(var(--signal-cyan)/0.06)] p-2 font-mono text-xs text-[rgb(var(--bone-2))]">
            {statusMessage}
          </p>
        )}
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {(steps.length ? steps : FALLBACK_STEPS.slice(0, 3)).map((step, index) => (
            <div key={step.id} className={`rounded-md border p-3 text-sm ${index <= activeStep ? "border-[rgb(var(--signal-cyan)/0.45)] bg-[rgb(var(--signal-cyan)/0.06)]" : "border-[rgb(var(--steel))] opacity-45"}`}>
              <span className="font-mono text-xs text-[rgb(var(--bone-2))]">Step {step.order}</span>
              <p className="mt-1">{step.description}</p>
            </div>
          ))}
        </div>
      </section>

      {done && (
        <section data-testid="result-panel" className="rounded-lg border border-[rgb(var(--signal-green)/0.5)] bg-[rgb(var(--signal-green)/0.08)] p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-2xl font-semibold"><CheckCircle2 className="h-6 w-6 text-[rgb(var(--signal-green))]" /> {t("teach.result")}</h2>
              <p className="mt-2 font-mono text-sm text-[rgb(var(--bone-2))]">Estimated cycle time: 4.2s • {steps.length} interpreted motions • {sequence.length} task stages • {gripperMode} gripper</p>
              <div className="mt-3"><DeployReadiness confidence={0.94} /></div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setModal("deploy")} className="gap-2"><Rocket className="h-4 w-4" /> Deploy to robot</Button>
              <Button variant="outline" onClick={() => setModal("export")} className="gap-2"><Code2 className="h-4 w-4" /> {t("action.exportCode")}</Button>
              <Button variant="outline" onClick={() => setModal("roi")} className="gap-2"><TrendingUp className="h-4 w-4" /> {t("action.calculateRoi")}</Button>
            </div>
          </div>
        </section>
      )}

      {modal === "deploy" && (
        <Modal title="Deploy to robot" onClose={() => setModal(null)}>
          <div className="space-y-4">
            <label className="grid gap-1 text-sm"><span>Robot</span><select className="rounded-md border border-[rgb(var(--steel))] bg-[rgb(var(--ink-3))] px-3 py-2"><option>{robots[0]?.name} - {robots[0]?.model}</option></select></label>
            <div className="grid grid-cols-2 gap-3"><Info label="Estimated cycle" value="4.2s" /><Info label="Confidence" value="94%" /></div>
            {deploying && <Progress value={66} />}
            {deployed ? <p className="rounded-md bg-[rgb(var(--signal-green)/0.12)] p-3 text-sm text-[rgb(var(--signal-green))]">Skill is now live on Assembly Cell 1. <a href="/app/robots" className="underline">Open in fleet view</a></p> : <Button data-testid="deploy-skill" onClick={deploy}>Deploy</Button>}
          </div>
        </Modal>
      )}

      {modal === "export" && <ExportModal policy={policy} sequence={sequence} workcellConfig={workcellConfig} toolChangerConfig={toolChangerConfig} robotLabel={selectedRobot.codeLabel} onClose={() => setModal(null)} />}
      {modal === "roi" && <Modal title="Calculate ROI" wide onClose={() => setModal(null)}><RoiCalculator /></Modal>}
    </div>
  );
}

function SequenceProgress({ sequence, activeIndex, completedMotionSteps, totalMotionSteps }: { sequence: SequenceStep[]; activeIndex: number; completedMotionSteps: number; totalMotionSteps: number }) {
  return (
    <div className="mb-3 rounded-md border border-[rgb(var(--steel))] bg-[rgb(var(--ink-3))] p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-[rgb(var(--signal-cyan))]">Sequence progress</p>
        <span className="font-mono text-xs tabular">{Math.max(0, completedMotionSteps)}/{totalMotionSteps}</span>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {sequence.map((step, index) => (
          <div
            key={step.id}
            className={`min-w-[160px] rounded-md border p-2 text-xs transition ${index === activeIndex ? "border-[rgb(var(--signal-cyan))] bg-[rgb(var(--signal-cyan)/0.12)] shadow-[0_0_0_3px_rgb(var(--signal-cyan)/0.12)]" : step.status === "complete" ? "border-[rgb(var(--signal-green)/0.45)] bg-[rgb(var(--signal-green)/0.1)]" : "border-[rgb(var(--steel))] bg-[rgb(var(--ink-2))]"}`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono tabular">{index + 1}</span>
              {step.status === "complete" && <Check className="h-3.5 w-3.5 text-[rgb(var(--signal-green))]" />}
            </div>
            <p className="mt-1 truncate font-medium">{step.label}</p>
            <span className={`mt-2 inline-block rounded border px-1.5 py-0.5 font-mono text-[10px] ${stepTypeTone(step.type)}`}>{step.type}</span>
            <p className="mt-2 font-mono text-[10px] uppercase text-[rgb(var(--bone-2))]">{step.status}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function TaskSequencePanel({
  sequence,
  toolStations,
  onAdd,
  onMove,
  onUpdate,
  onDelete,
  onAddGate,
}: {
  sequence: SequenceStep[];
  toolStations: ToolStation[];
  onAdd: () => void;
  onMove: (index: number, direction: -1 | 1) => void;
  onUpdate: (id: string, patch: Partial<SequenceStep>) => void;
  onDelete: (id: string) => void;
  onAddGate: (id: string) => void;
}) {
  return (
    <section className="mt-4 rounded-lg border border-[rgb(var(--steel))] bg-[rgb(var(--ink-2))] p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-[rgb(var(--signal-cyan))]">Task sequence</p>
          <h2 className="mt-1 text-xl font-semibold">Multi-step workflow</h2>
        </div>
        <Button variant="outline" onClick={onAdd} className="gap-2"><Plus className="h-4 w-4" /> Add step</Button>
      </div>
      <div className="mt-4 space-y-3">
        {sequence.map((step, index) => (
          <div key={step.id}>
            <div className="rounded-md border border-[rgb(var(--steel))] bg-[rgb(var(--ink-3))] p-3">
              <div className="grid gap-2 md:grid-cols-[32px_1fr_170px_auto] md:items-center">
                <span className="font-mono text-sm tabular">{index + 1}</span>
                <input
                  aria-label={`Step ${index + 1} label`}
                  className="min-w-0 rounded-md border border-[rgb(var(--steel))] bg-[rgb(var(--ink-2))] px-3 py-2 text-sm"
                  value={step.label}
                  onChange={(event) => onUpdate(step.id, { label: event.target.value })}
                />
                <select
                  aria-label={`Step ${index + 1} type`}
                  className="rounded-md border border-[rgb(var(--steel))] bg-[rgb(var(--ink-2))] px-3 py-2 font-mono text-xs"
                  value={step.type}
                  onChange={(event) => onUpdate(step.id, { type: event.target.value as SequenceStepType })}
                >
                  {STEP_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => onMove(index, -1)} disabled={index === 0} title="Move up"><ArrowUp className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => onMove(index, 1)} disabled={index === sequence.length - 1} title="Move down"><ArrowDown className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => onDelete(step.id)} title="Delete step"><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
              {step.type === "TOOL_CHANGE" && (
                <label className="mt-2 grid max-w-sm gap-1 text-xs">
                  <span className="text-[rgb(var(--bone-2))]">Dock to tool station</span>
                  <select
                    aria-label={`Step ${index + 1} tool station`}
                    className="rounded-md border border-[rgb(var(--steel))] bg-[rgb(var(--ink-2))] px-3 py-2 font-mono text-xs"
                    value={step.toolStationId ?? toolStations[0]?.id ?? ""}
                    onChange={(event) => onUpdate(step.id, { toolStationId: event.target.value })}
                  >
                    {toolStations.map((station) => <option key={station.id} value={station.id}>{station.name} ({station.toolType})</option>)}
                  </select>
                </label>
              )}
            </div>

            {index < sequence.length - 1 && (
              <div className="ml-8 mt-2 max-w-xl rounded-md border border-dashed border-[rgb(var(--steel))] bg-[rgb(var(--ink-2))] p-3">
                {step.gateAfter ? (
                  <div className="grid gap-2 md:grid-cols-[1fr_90px_120px] md:items-center">
                    <select
                      className="rounded-md border border-[rgb(var(--steel))] bg-[rgb(var(--ink-3))] px-3 py-2 text-xs"
                      value={step.gateAfter.type}
                      onChange={(event) => onUpdate(step.id, { gateAfter: { ...step.gateAfter!, type: event.target.value as ConditionType } })}
                    >
                      <option value="signal_high">IF signal_in(port) == HIGH</option>
                      <option value="inspection_pass">IF inspection_result == PASS</option>
                      <option value="retry_or_abort">ELSE retry / abort</option>
                    </select>
                    <input
                      type="number"
                      min={0}
                      className="rounded-md border border-[rgb(var(--steel))] bg-[rgb(var(--ink-3))] px-3 py-2 font-mono text-xs tabular"
                      value={step.gateAfter.signalPort}
                      onChange={(event) => onUpdate(step.id, { gateAfter: { ...step.gateAfter!, signalPort: Math.max(0, Number(event.target.value)) } })}
                    />
                    <select
                      className="rounded-md border border-[rgb(var(--steel))] bg-[rgb(var(--ink-3))] px-3 py-2 text-xs"
                      value={step.gateAfter.elseAction}
                      onChange={(event) => onUpdate(step.id, { gateAfter: { ...step.gateAfter!, elseAction: event.target.value as SequenceGate["elseAction"] } })}
                    >
                      <option value="wait">ELSE wait</option>
                      <option value="retry">ELSE retry</option>
                      <option value="abort">ELSE abort</option>
                    </select>
                  </div>
                ) : (
                  <Button variant="ghost" size="sm" onClick={() => onAddGate(step.id)}>Add condition gate</Button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function Modal({ title, children, onClose, wide = false }: { title: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={onClose}>
      <div className={`max-h-[90vh] overflow-auto rounded-lg border border-[rgb(var(--steel))] bg-[rgb(var(--ink-2))] p-5 shadow-2xl ${wide ? "w-full max-w-6xl" : "w-full max-w-xl"}`} onMouseDown={(event) => event.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-semibold">{title}</h2><Button aria-label="Close modal" variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button></div>
        {children}
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md bg-[rgb(var(--ink-3))] p-3"><p className="text-xs text-[rgb(var(--bone-2))]">{label}</p><p className="font-mono tabular">{value}</p></div>;
}

function downloadText(filename: string, code: string, type: string) {
  const blob = new Blob([code], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function ExportModal({ policy, sequence, workcellConfig, toolChangerConfig, robotLabel, onClose }: { policy: TaskPolicy; sequence: SequenceStep[]; workcellConfig: WorkcellConfig; toolChangerConfig: ToolChangerConfig; robotLabel: string; onClose: () => void }) {
  const ur = generateUr(policy, sequence, workcellConfig, toolChangerConfig, robotLabel);
  const ros = generateRos(policy, sequence, workcellConfig, toolChangerConfig, robotLabel);
  const rapid = toRapid(policy, "Pick Bracket A");
  const karel = toFanucKarel(policy, "Pick Bracket A");
  const downloadPdf = () => {
    const pdf = new jsPDF();
    pdf.setFontSize(20);
    pdf.text("Aurevix Skill Summary", 18, 20);
    pdf.setFontSize(12);
    pdf.text(`Task: Pick Bracket A`, 18, 34);
    pdf.text(`Confidence: 94%`, 18, 42);
    policy.steps.forEach((step, index) => pdf.text(`${index + 1}. ${step.description}`, 18, 58 + index * 8, { maxWidth: 170 }));
    pdf.save("aurevix-policy-summary.pdf");
  };
  return (
    <Modal title="Export code" wide onClose={onClose}>
      <Tabs defaultValue="ur">
        <TabsList>
          <TabsTrigger value="ur">URScript</TabsTrigger>
          <TabsTrigger value="ros">ROS 2 Python</TabsTrigger>
          <TabsTrigger value="rapid">RAPID (ABB)</TabsTrigger>
          <TabsTrigger value="karel">FANUC Karel</TabsTrigger>
          <TabsTrigger value="pdf">PDF Summary</TabsTrigger>
        </TabsList>
        <TabsContent value="ur" className="mt-4"><Code code={ur} language="python" filename="assemble_bracket_sequence.urscript" type="text/plain;charset=utf-8" /></TabsContent>
        <TabsContent value="ros" className="mt-4"><Code code={ros} language="python" filename="assemble_bracket_sequence_ros2.py" type="text/x-python;charset=utf-8" /></TabsContent>
        <TabsContent value="rapid" className="mt-4"><Code code={rapid} language="pascal" filename="aurevix_skill.mod" type="text/plain;charset=utf-8" /></TabsContent>
        <TabsContent value="karel" className="mt-4"><Code code={karel} language="pascal" filename="aurevix_skill.kl" type="text/plain;charset=utf-8" /></TabsContent>
        <TabsContent value="pdf" className="mt-4"><Button onClick={downloadPdf} className="gap-2"><Download className="h-4 w-4" /> Download PDF Summary</Button></TabsContent>
      </Tabs>
    </Modal>
  );
}

function Code({ code, language, filename, type }: { code: string; language: string; filename: string; type: string }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => navigator.clipboard?.writeText(code)}>Copy to clipboard</Button>
        <Button onClick={() => downloadText(filename, code, type)} className="gap-2"><Download className="h-4 w-4" /> Download {filename}</Button>
      </div>
      <SyntaxHighlighter language={language} style={oneLight} customStyle={{ maxHeight: 420, border: "1px solid rgb(var(--steel))", borderRadius: 6 }}>{code}</SyntaxHighlighter>
    </div>
  );
}
