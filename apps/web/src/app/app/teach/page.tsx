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
import { RoiCalculator } from "@/components/roi-calculator";
import { DEMO_VIDEO_URL, FALLBACK_POLICY, FALLBACK_STEPS } from "@/lib/demo-seed";
import { useDemoData } from "@/lib/use-demo-data";
import { useLocale } from "@/lib/i18n";
import type { Skill, TaskPolicy, TaskStep } from "@/lib/types";
import { readSafeDemoMode } from "@/lib/demo-mode";
import { DEFAULT_WORKCELL_CONFIG, isPneumaticGripper, readWorkcellConfig, type WorkcellConfig } from "@/lib/workcell-config";
import { toRapid, toFanucKarel } from "@/lib/codegen";
import { DEFAULT_TOOL_CHANGER_CONFIG, getToolStation, readToolChangerConfig, type ToolChangerConfig, type ToolStation } from "@/lib/tool-changer";

type Modal = "deploy" | "export" | "roi" | null;
type DemoRobot = "ur5e" | "abb_gofa" | "techman_tm12" | "kuka_kr6" | "fanuc_lr_mate" | "yaskawa_gp12";
export type SequenceStepType = "MOTION" | "WAIT_FOR_SIGNAL" | "GRIPPER_ACTUATE" | "TOOL_CHANGE" | "INSPECTION" | "USER_CONFIRM";
type SequenceStatus = "pending" | "analysing" | "complete" | "error";
export type ConditionType = "signal_high" | "inspection_pass" | "retry_or_abort";

export interface SequenceGate {
  type: ConditionType;
  signalPort: number;
  passStepId?: string;
  failStepId?: string;
  elseAction: "wait" | "retry" | "abort";
}

export interface SequenceStep {
  id: string;
  label: string;
  type: SequenceStepType;
  status: SequenceStatus;
  gateAfter?: SequenceGate;
  toolStationId?: string;
}

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
  { id: "seq-pick", label: "Pick bracket", type: "MOTION", status: "pending", gateAfter: { type: "signal_high", signalPort: 2, elseAction: "wait" } },
  { id: "seq-orient", label: "Orient bracket", type: "MOTION", status: "pending" },
  { id: "seq-place", label: "Place in fixture", type: "MOTION", status: "pending", gateAfter: { type: "inspection_pass", signalPort: 3, failStepId: "seq-orient", elseAction: "retry" } },
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
  const [sequence, setSequence] = useState<SequenceStep[]>(DEFAULT_SEQUENCE);
  const [activeSequenceIndex, setActiveSequenceIndex] = useState(-1);
  const [workcellConfig, setWorkcellConfig] = useState<WorkcellConfig>(DEFAULT_WORKCELL_CONFIG);
  const [toolChangerConfig, setToolChangerConfig] = useState<ToolChangerConfig>(DEFAULT_TOOL_CHANGER_CONFIG);
  const [safeDemoMode, setSafeDemoMode] = useState(true);
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
    const run = async () => {
      setDone(false);
      setSteps([]);
      setActiveStep(-1);
      setActiveSequenceIndex(0);
      setSequence((current) => current.map((step) => ({ ...step, status: "pending" })));
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
      if (!cancelled) {
        setActiveSequenceIndex(-1);
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
          <TaskSequencePanel
            sequence={sequence}
            toolStations={toolChangerConfig.stations}
            onAdd={addSequenceStep}
            onMove={moveSequenceStep}
            onUpdate={updateSequence}
            onDelete={(id) => setSequence((current) => current.filter((step) => step.id !== id))}
            onAddGate={addGate}
          />
        </section>

        <section className="rounded-lg border border-[rgb(var(--steel))] bg-[rgb(var(--ink-2))] p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-[rgb(var(--signal-cyan))]">3D robot view</p>
              <h2 className="mt-2 text-2xl font-semibold">Replay policy</h2>
            </div>
            <span className="font-mono text-sm tabular">{activeStep + 1}/{FALLBACK_STEPS.length}</span>
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
              <p className="mt-2 font-mono text-sm text-[rgb(var(--bone-2))]">Cycle time: 4.2s • Confidence: 94% • {steps.length} waypoints • {sequence.length} sequence steps • {gripperMode} gripper</p>
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

const fmt = (value: number, precision = 4) => Number(value.toFixed(precision)).toString();

export function sanitizeIdentifier(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "aurevix_skill";
}

export function policyFingerprint(policy: TaskPolicy) {
  const source = JSON.stringify(policy.steps);
  let hash = 0;
  for (let i = 0; i < source.length; i += 1) {
    hash = (hash * 31 + source.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

function poseLiteral(step: TaskStep) {
  const { x, y, z, rx = 0, ry = Math.PI / 2, rz = 0 } = step.target;
  return `p[${fmt(x)}, ${fmt(y)}, ${fmt(z)}, ${fmt(rx)}, ${fmt(ry)}, ${fmt(rz)}]`;
}

function gripperOpenUr(config: WorkcellConfig) {
  const delay = fmt(config.actuationDelayMs / 1000, 2);
  if (isPneumaticGripper(config.gripperType)) {
    const lines = [
      `def aurevix_gripper_open():`,
      `  set_digital_out(${config.openPort}, True)`,
    ];
    if (!config.springReturn) lines.push(`  set_digital_out(${config.closePort}, False)`);
    lines.push(`  sleep(${delay})`);
    lines.push(`end`);
    return lines;
  }
  return [
    `def aurevix_gripper_open():`,
    `  set_tool_digital_out(0, False)`,
    `  sleep(${delay})`,
    `end`,
  ];
}

function gripperCloseUr(config: WorkcellConfig) {
  const delay = fmt(config.actuationDelayMs / 1000, 2);
  if (isPneumaticGripper(config.gripperType)) {
    const lines = [
      `def aurevix_gripper_close():`,
    ];
    if (config.springReturn) {
      lines.push(`  set_digital_out(${config.openPort}, False)`);
    } else {
      lines.push(`  set_digital_out(${config.openPort}, False)`);
      lines.push(`  set_digital_out(${config.closePort}, True)`);
    }
    lines.push(`  sleep(${delay})`);
    lines.push(`end`);
    return lines;
  }
  return [
    `def aurevix_gripper_close():`,
    `  set_tool_digital_out(0, True)`,
    `  sleep(${delay})`,
    `end`,
  ];
}

export const AUREVIX_MAX_RETRIES = 3;

export function gateFailLabel(type: ConditionType) {
  return type === "inspection_pass" ? "Inspection failed" : "Condition failed";
}

/**
 * Emits the post-step gate check. `retryFnName` is the URScript function for this
 * sequence step, re-invoked when elseAction is "retry" (bounded by AUREVIX_MAX_RETRIES).
 */
export function emitGateUr(step: SequenceStep, retryFnName: string) {
  if (!step.gateAfter) return [];
  const gate = step.gateAfter;
  const lines = [`  # Gate after ${step.label}: ${gate.type} on port ${gate.signalPort}, else ${gate.elseAction}`];

  if (gate.type === "signal_high") {
    lines.push(`  while get_digital_in(${gate.signalPort}) == False:`);
    lines.push(`    sleep(0.1)`);
    lines.push(`  end`);
    return lines;
  }

  const passed = `get_digital_in(${gate.signalPort}) == True`;
  const failLabel = gateFailLabel(gate.type);

  if (gate.elseAction === "abort") {
    lines.push(`  if not (${passed}):`);
    lines.push(`    popup("${failLabel} after ${step.label}", error=True)`);
    lines.push(`    halt`);
    lines.push(`  end`);
  } else if (gate.elseAction === "retry") {
    const counter = `aurevix_retries_${sanitizeIdentifier(step.label)}`;
    lines.push(`  ${counter} = 0`);
    lines.push(`  while not (${passed}):`);
    lines.push(`    ${counter} = ${counter} + 1`);
    lines.push(`    if ${counter} > AUREVIX_MAX_RETRIES:`);
    lines.push(`      popup("${failLabel} after ${step.label}: max retries exceeded", error=True)`);
    lines.push(`      halt`);
    lines.push(`    end`);
    lines.push(`    textmsg("AUREVIX retry ${step.label} attempt " + to_str(${counter}))`);
    lines.push(`    ${retryFnName}()`);
    lines.push(`  end`);
  } else {
    lines.push(`  while not (${passed}):`);
    lines.push(`    sleep(0.5)`);
    lines.push(`  end`);
  }
  return lines;
}

/**
 * Builds the URScript move/IO sequence for an automatic tool change: return the
 * current tool to its dock, unlock it, then dock and lock the target tool.
 */
export function emitToolChangeUr(from: ToolStation, to: ToolStation, label: string) {
  const lines: string[] = [`  # Tool change "${label}": return ${from.name} (${from.toolType}) -> pick up ${to.name} (${to.toolType})`];

  if (from.id === to.id) {
    lines.push(`  textmsg("AUREVIX tool change skipped: ${to.name} already mounted")`);
    return lines;
  }

  const retract = 0.05;
  const fromAbove = `p[${fmt(from.dock.x)}, ${fmt(from.dock.y)}, ${fmt(from.dock.z + retract)}, 0, 0, ${fmt(from.dock.rz)}]`;
  const fromAt = `p[${fmt(from.dock.x)}, ${fmt(from.dock.y)}, ${fmt(from.dock.z)}, 0, 0, ${fmt(from.dock.rz)}]`;
  const toAbove = `p[${fmt(to.dock.x)}, ${fmt(to.dock.y)}, ${fmt(to.dock.z + retract)}, 0, 0, ${fmt(to.dock.rz)}]`;
  const toAt = `p[${fmt(to.dock.x)}, ${fmt(to.dock.y)}, ${fmt(to.dock.z)}, 0, 0, ${fmt(to.dock.rz)}]`;
  const unlockDelay = fmt(from.actuationDelayMs / 1000, 2);
  const lockDelay = fmt(to.actuationDelayMs / 1000, 2);

  lines.push(`  aurevix_guarded_movel(${fromAbove}, 0.25, AUREVIX_APPROACH_ACCEL, AUREVIX_BLEND_SAFE)`);
  lines.push(`  aurevix_guarded_movel(${fromAt}, 0.05, AUREVIX_CONTACT_ACCEL, AUREVIX_BLEND_CONTACT)`);
  lines.push(`  set_digital_out(${from.unlockPort}, True)`);
  lines.push(`  sleep(${unlockDelay})`);
  lines.push(`  set_digital_out(${from.unlockPort}, False)`);
  lines.push(`  aurevix_guarded_movel(${fromAbove}, 0.05, AUREVIX_CONTACT_ACCEL, AUREVIX_BLEND_SAFE)`);
  lines.push(`  aurevix_guarded_movel(${toAbove}, 0.25, AUREVIX_APPROACH_ACCEL, AUREVIX_BLEND_SAFE)`);
  lines.push(`  aurevix_guarded_movel(${toAt}, 0.05, AUREVIX_CONTACT_ACCEL, AUREVIX_BLEND_CONTACT)`);
  lines.push(`  set_digital_out(${to.lockPort}, True)`);
  lines.push(`  sleep(${lockDelay})`);
  lines.push(`  aurevix_guarded_movel(${toAbove}, 0.05, AUREVIX_CONTACT_ACCEL, AUREVIX_BLEND_SAFE)`);
  lines.push(`  textmsg("AUREVIX tool change complete: ${to.name} mounted")`);
  return lines;
}

/**
 * ROS 2 equivalent of emitToolChangeUr, expressed as self.move_linear/self.set_digital_output calls.
 */
export function emitToolChangeRos(from: ToolStation, to: ToolStation, label: string) {
  const lines: string[] = [`        self.get_logger().info("Tool change ${label}: return ${from.name} (${from.toolType}) -> pick up ${to.name} (${to.toolType})")`];

  if (from.id === to.id) {
    lines.push(`        self.get_logger().info("Tool change skipped: ${to.name} already mounted")`);
    return lines;
  }

  const retract = 0.05;
  const fromPose = (z: number) => `(${fmt(from.dock.x)}, ${fmt(from.dock.y)}, ${fmt(z)}, 0.0, 0.0, ${fmt(from.dock.rz)})`;
  const toPose = (z: number) => `(${fmt(to.dock.x)}, ${fmt(to.dock.y)}, ${fmt(z)}, 0.0, 0.0, ${fmt(to.dock.rz)})`;
  const unlockDelay = fmt(from.actuationDelayMs / 1000, 2);
  const lockDelay = fmt(to.actuationDelayMs / 1000, 2);

  lines.push(`        self.move_linear(${fromPose(from.dock.z + retract)}, 0.25)`);
  lines.push(`        self.move_linear(${fromPose(from.dock.z)}, 0.05, contact=True)`);
  lines.push(`        self.set_digital_output(${from.unlockPort}, True)`);
  lines.push(`        time.sleep(${unlockDelay})`);
  lines.push(`        self.set_digital_output(${from.unlockPort}, False)`);
  lines.push(`        self.move_linear(${fromPose(from.dock.z + retract)}, 0.05)`);
  lines.push(`        self.move_linear(${toPose(to.dock.z + retract)}, 0.25)`);
  lines.push(`        self.move_linear(${toPose(to.dock.z)}, 0.05, contact=True)`);
  lines.push(`        self.set_digital_output(${to.lockPort}, True)`);
  lines.push(`        time.sleep(${lockDelay})`);
  lines.push(`        self.move_linear(${toPose(to.dock.z + retract)}, 0.05)`);
  lines.push(`        self.get_logger().info("Tool change complete: ${to.name} mounted")`);
  return lines;
}

/**
 * Emits the gate_N() method body for ROS targets, mirroring emitGateUr's branching.
 * `retryMethodName` is re-invoked on the node when elseAction is "retry".
 */
export function emitGateRos(seq: SequenceStep, index: number, retryMethodName: string): string[] {
  const gate = seq.gateAfter!;
  const lines: string[] = [
    `    def gate_${index + 1}(self) -> None:`,
    `        self.get_logger().info("Gate after ${seq.label}: ${gate.type} on port ${gate.signalPort}")`,
  ];

  if (gate.type === "signal_high") {
    lines.push(`        while not self.read_digital_input(${gate.signalPort}):`);
    lines.push(`            time.sleep(0.1)`);
    lines.push(``);
    return lines;
  }

  const failLabel = gateFailLabel(gate.type);

  if (gate.elseAction === "abort") {
    lines.push(`        if not self.read_digital_input(${gate.signalPort}):`);
    lines.push(`            self.get_logger().error("${failLabel} after ${seq.label}")`);
    lines.push(`            raise RuntimeError("${failLabel} after ${seq.label}")`);
    lines.push(``);
  } else if (gate.elseAction === "retry") {
    lines.push(`        attempts = 0`);
    lines.push(`        while not self.read_digital_input(${gate.signalPort}):`);
    lines.push(`            attempts += 1`);
    lines.push(`            if attempts > self.AUREVIX_MAX_RETRIES:`);
    lines.push(`                raise RuntimeError("${failLabel} after ${seq.label}: max retries exceeded")`);
    lines.push(`            self.get_logger().info(f"Retrying ${seq.label} (attempt {attempts}/{self.AUREVIX_MAX_RETRIES})")`);
    lines.push(`            self.${retryMethodName}()`);
    lines.push(``);
  } else {
    lines.push(`        while not self.read_digital_input(${gate.signalPort}):`);
    lines.push(`            time.sleep(0.5)`);
    lines.push(``);
  }
  return lines;
}

export function generateUr(policy: TaskPolicy, sequence: SequenceStep[], workcellConfig: WorkcellConfig, toolChangerConfig: ToolChangerConfig, robotLabel: string) {
  const programName = sanitizeIdentifier("Assemble Bracket Sequence");
  const policyId = policyFingerprint(policy);
  const initialTool = getToolStation(toolChangerConfig, toolChangerConfig.activeStationId);
  const lines = [
    `# AUREVIX generated URScript`,
    `# Program: ${programName}`,
    `# Policy ID: ${policyId}`,
    `# Robot: ${robotLabel}`,
    `# Tool frame: ${policy.toolFrame}`,
    `# Coordinate convention: target XYZ is meters in the robot base frame; Z is height above table surface in the teaching UI.`,
    `# Review payload, TCP, and gripper IO mapping before production deployment.`,
    ...(toolChangerConfig.enabled ? [`# Tool changer enabled. Initial tool: ${initialTool.name} (${initialTool.toolType})`] : []),
    ``,
    `global AUREVIX_APPROACH_ACCEL = 0.6`,
    `global AUREVIX_CONTACT_ACCEL = 0.25`,
    `global AUREVIX_BLEND_SAFE = 0.025`,
    `global AUREVIX_BLEND_CONTACT = 0.001`,
    `global AUREVIX_MAX_RETRIES = ${AUREVIX_MAX_RETRIES}`,
    ``,
    ...gripperOpenUr(workcellConfig),
    ``,
    ...gripperCloseUr(workcellConfig),
    ``,
    `def aurevix_guarded_movel(target_pose, speed, accel, blend):`,
    `  # Single motion wrapper so operators can add force/zone checks in one place.`,
    `  movel(target_pose, a=accel, v=speed, r=blend)`,
    `end`,
    ``,
  ];

  const emitMotionStep = (step: TaskStep) => {
    const speed = fmt(step.speed);
    const pose = poseLiteral(step);
    lines.push(``);
    lines.push(`  # Step ${step.order}: ${step.description}`);
    lines.push(`  # action=${step.action} gripper=${step.gripper} nominal_speed=${speed}m/s duration=${step.duration}s`);

    if (step.action === "home") {
      lines.push(`  movej([0, -1.5708, 1.5708, -1.5708, -1.5708, 0], a=1.0, v=0.35, r=0)`);
    } else if (step.action === "grip") {
      lines.push(`  aurevix_guarded_movel(${pose}, ${fmt(Math.min(step.speed, 0.1))}, AUREVIX_CONTACT_ACCEL, AUREVIX_BLEND_CONTACT)`);
      lines.push(`  aurevix_gripper_close()`);
    } else if (step.action === "release") {
      lines.push(`  aurevix_guarded_movel(${pose}, ${fmt(Math.min(step.speed, 0.12))}, AUREVIX_CONTACT_ACCEL, AUREVIX_BLEND_CONTACT)`);
      lines.push(`  aurevix_gripper_open()`);
    } else if (step.action === "wait") {
      lines.push(`  sleep(${fmt(step.duration)})`);
    } else {
      lines.push(`  aurevix_guarded_movel(${pose}, ${speed}, AUREVIX_APPROACH_ACCEL, AUREVIX_BLEND_SAFE)`);
    }

    if (step.requiresVision) {
      lines.push(`  # Vision/contact verification required before continuing.`);
      lines.push(`  textmsg("verify: step ${step.order}")`);
    }
  };

  const chunks = sequence.length ? sequence : DEFAULT_SEQUENCE;
  const perSequence = Math.max(1, Math.ceil(policy.steps.length / chunks.length));
  let currentToolId = toolChangerConfig.activeStationId;
  chunks.forEach((seq, index) => {
    lines.push(``);
    lines.push(`def ${sanitizeIdentifier(seq.label)}():`);
    lines.push(`  textmsg("AUREVIX sequence step ${index + 1}: ${seq.label}")`);
    if (seq.type === "WAIT_FOR_SIGNAL") {
      lines.push(`  while get_digital_in(${seq.gateAfter?.signalPort ?? 2}) == False:`);
      lines.push(`    sleep(0.1)`);
      lines.push(`  end`);
    } else if (seq.type === "USER_CONFIRM") {
      lines.push(`  popup("Confirm ${seq.label} complete", blocking=True)`);
    } else if (seq.type === "TOOL_CHANGE") {
      const fromStation = getToolStation(toolChangerConfig, currentToolId);
      const toStation = getToolStation(toolChangerConfig, seq.toolStationId);
      lines.push(...emitToolChangeUr(fromStation, toStation, seq.label));
      currentToolId = toStation.id;
    } else {
      policy.steps.slice(index * perSequence, (index + 1) * perSequence).forEach(emitMotionStep);
    }
    lines.push(`end`);
  });

  lines.push(``);
  lines.push(`def main():`);
  lines.push(`  textmsg("AUREVIX start policy ${policyId}")`);
  lines.push(`  set_tcp(p[0, 0, 0.0952, 0, 0, 0])`);
  lines.push(`  aurevix_gripper_open()`);
  chunks.forEach((seq) => {
    lines.push(`  ${sanitizeIdentifier(seq.label)}()`);
    lines.push(...emitGateUr(seq, sanitizeIdentifier(seq.label)));
  });

  lines.push(``);
  lines.push(`  aurevix_gripper_open()`);
  lines.push(`  textmsg("AUREVIX complete policy ${policyId}")`);
  lines.push(`end`);
  lines.push(``);
  lines.push(`main()`);
  return lines.join("\n");
}

export function stateMethodName(seq: SequenceStep, index: number) {
  return seq.type === "TOOL_CHANGE" ? `tool_change_${index + 1}` : `state_${index + 1}_${sanitizeIdentifier(seq.label)}`;
}

export function generateRos(policy: TaskPolicy, sequence: SequenceStep[], workcellConfig: WorkcellConfig, toolChangerConfig: ToolChangerConfig, robotLabel: string) {
  const policyId = policyFingerprint(policy);
  const stepRows = policy.steps
    .map((step) => {
      const { x, y, z, rx = 0, ry = Math.PI / 2, rz = 0 } = step.target;
      return `        SkillStep(${step.order}, "${step.action}", "${step.gripper}", (${fmt(x)}, ${fmt(y)}, ${fmt(z)}, ${fmt(rx)}, ${fmt(ry)}, ${fmt(rz)}), ${fmt(step.speed)}, ${step.duration}, "${step.description.replace(/"/g, '\\"')}"),`;
    })
    .join("\n");

  const chunks = sequence.length ? sequence : DEFAULT_SEQUENCE;
  let currentToolId = toolChangerConfig.activeStationId;
  const toolChanges = chunks.map((seq) => {
    if (seq.type !== "TOOL_CHANGE") return null;
    const fromStation = getToolStation(toolChangerConfig, currentToolId);
    const toStation = getToolStation(toolChangerConfig, seq.toolStationId);
    currentToolId = toStation.id;
    return { fromStation, toStation };
  });
  const initialTool = getToolStation(toolChangerConfig, toolChangerConfig.activeStationId);

  return [
    `# AUREVIX generated ROS 2 Python skill`,
    `# Policy ID: ${policyId}`,
    `# Robot: ${robotLabel}`,
    `# Intended integration: ROS 2 + MoveIt 2 + a parallel gripper driver.`,
    `# This file is production-structured but hardware adapters must be wired by the cell integrator.`,
    ...(toolChangerConfig.enabled ? [`# Tool changer enabled. Initial tool: ${initialTool.name} (${initialTool.toolType})`] : []),
    ``,
    `from dataclasses import dataclass`,
    `from typing import Literal, Tuple`,
    ``,
    `import rclpy`,
    `from rclpy.node import Node`,
    isPneumaticGripper(workcellConfig.gripperType) ? `from industrial_msgs.msg import DigitalOutput` : ``,
    `import time`,
    ``,
    ``,
    `Action = Literal["move", "approach", "grip", "release", "rotate", "wait", "inspect", "home"]`,
    `Gripper = Literal["open", "closed", "unchanged"]`,
    `PoseTuple = Tuple[float, float, float, float, float, float]`,
    ``,
    ``,
    `@dataclass(frozen=True)`,
    `class SkillStep:`,
    `    order: int`,
    `    action: Action`,
    `    gripper: Gripper`,
    `    pose: PoseTuple`,
    `    speed: float`,
    `    duration: float`,
    `    description: str`,
    ``,
    ``,
    `class PickBracketASkill(Node):`,
    `    def __init__(self):`,
    `        super().__init__("aurevix_pick_bracket_a")`,
    `        self.policy_id = "${policyId}"`,
    `        self.gripper_open_pin = ${workcellConfig.openPort}`,
    `        self.gripper_close_pin = ${workcellConfig.closePort}`,
    `        self.actuation_delay = ${workcellConfig.actuationDelayMs / 1000}`,
    `        self.AUREVIX_MAX_RETRIES = ${AUREVIX_MAX_RETRIES}`,
    `        self.steps = [`,
    stepRows,
    `        ]`,
    ``,
    `    def move_home(self) -> None:`,
    `        self.get_logger().info("Moving to validated home joint configuration")`,
    ``,
    `    def move_linear(self, pose: PoseTuple, speed: float, contact: bool = False) -> None:`,
    `        x, y, z, rx, ry, rz = pose`,
    `        zone = "contact" if contact else "free-space"`,
    `        self.get_logger().info(f"{zone} move to x={x:.3f} y={y:.3f} z={z:.3f} speed={speed:.3f}")`,
    ``,
    `    def set_gripper(self, state: Gripper) -> None:`,
    `        if state == "unchanged":`,
    `            return`,
    isPneumaticGripper(workcellConfig.gripperType)
      ? `        self.set_pneumatic_gripper(state == "closed")`
      : `        self.get_logger().info(f"Setting electric gripper {state}")`,
    ``,
    `    def set_pneumatic_gripper(self, closed: bool) -> None:`,
    `        msg = DigitalOutput()`,
    `        msg.pin = self.gripper_close_pin if closed else self.gripper_open_pin`,
    `        msg.state = True`,
    `        self.get_logger().info(f"DigitalOutput pin={msg.pin} state={msg.state}")`,
    `        time.sleep(self.actuation_delay)`,
    ``,
    `    def verify_contact_or_vision(self, step: SkillStep) -> None:`,
    `        self.get_logger().info(f"Verification checkpoint after step {step.order}: {step.description}")`,
    ``,
    `    def read_digital_input(self, port: int) -> bool:`,
    `        # Integrator wires this to the cell PLC/vision I/O driver; True is a safe simulation default.`,
    `        self.get_logger().info(f"Reading digital input {port}")`,
    `        return True`,
    ``,
    `    def set_digital_output(self, port: int, state: bool) -> None:`,
    `        self.get_logger().info(f"DigitalOutput port={port} state={state}")`,
    ``,
    `    def execute_step(self, step: SkillStep) -> None:`,
    `        self.get_logger().info(f"Step {step.order}: {step.description}")`,
    `        if step.action == "home":`,
    `            self.move_home()`,
    `            self.set_gripper(step.gripper)`,
    `        elif step.action in ("grip", "release"):`,
    `            self.move_linear(step.pose, min(step.speed, 0.10), contact=True)`,
    `            self.set_gripper(step.gripper)`,
    `            self.verify_contact_or_vision(step)`,
    `        elif step.action == "wait":`,
    `            self.get_clock().sleep_for(rclpy.duration.Duration(seconds=step.duration))`,
    `        else:`,
    `            self.move_linear(step.pose, step.speed)`,
    `            self.set_gripper(step.gripper)`,
    ``,
    `    def execute(self) -> None:`,
    `        self.get_logger().info(f"Starting AUREVIX sequence policy {self.policy_id}")`,
    ...chunks.flatMap((seq, index) => [
      `        self.${stateMethodName(seq, index)}()`,
      ...(seq.gateAfter ? [`        self.gate_${index + 1}()`] : []),
    ]),
    `        self.set_gripper("open")`,
    `        self.get_logger().info(f"Completed AUREVIX policy {self.policy_id}")`,
    ``,
    ...chunks.flatMap((seq, index) => {
      if (seq.type === "TOOL_CHANGE") {
        const { fromStation, toStation } = toolChanges[index]!;
        return [
          `    def tool_change_${index + 1}(self) -> None:`,
          ...emitToolChangeRos(fromStation, toStation, seq.label),
          ``,
          ...(seq.gateAfter ? emitGateRos(seq, index, stateMethodName(seq, index)) : []),
        ];
      }
      return [
        `    def state_${index + 1}_${sanitizeIdentifier(seq.label)}(self) -> None:`,
        `        self.get_logger().info("State ${index + 1}: ${seq.label}")`,
        `        for step in self.steps[${index}::${chunks.length}]:`,
        `            self.execute_step(step)`,
        ``,
        ...(seq.gateAfter ? emitGateRos(seq, index, stateMethodName(seq, index)) : []),
      ];
    }),
    ``,
    ``,
    `def main(args=None):`,
    `    rclpy.init(args=args)`,
    `    node = PickBracketASkill()`,
    `    try:`,
    `        node.execute()`,
    `    finally:`,
    `        node.destroy_node()`,
    `        rclpy.shutdown()`,
    ``,
    ``,
    `if __name__ == "__main__":`,
    `    main()`,
  ].join("\n");
}
