"use client";

import { useEffect, useMemo, useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneLight } from "react-syntax-highlighter/dist/cjs/styles/prism";
import jsPDF from "jspdf";
import { Bot, CheckCircle2, Code2, Download, Play, Rocket, TrendingUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RobotArm } from "@/components/robot-arm";
import { RoiCalculator } from "@/components/roi-calculator";
import { DEMO_VIDEO_URL, FALLBACK_POLICY, FALLBACK_STEPS } from "@/lib/demo-seed";
import { useDemoData } from "@/lib/use-demo-data";
import { useLocale } from "@/lib/i18n";
import type { Skill, TaskPolicy, TaskStep } from "@/lib/types";

type Modal = "deploy" | "export" | "roi" | null;

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
  const policy = useMemo<TaskPolicy>(() => ({ ...FALLBACK_POLICY, steps }), [steps]);

  useEffect(() => {
    if (!started) return;
    let cancelled = false;
    const run = async () => {
      try {
        await fetch("http://localhost:11434/api/tags", { signal: AbortSignal.timeout(900) });
      } catch {
        console.warn("Aurevix demo: Ollama unavailable, using pre-recorded interpretation fallback.");
      }
      for (let i = 0; i < FALLBACK_STEPS.length; i++) {
        if (cancelled) return;
        await new Promise((resolve) => setTimeout(resolve, 650));
        setSteps((current) => [...current, FALLBACK_STEPS[i]]);
        setActiveStep(i);
      }
      if (!cancelled) setDone(true);
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [started]);

  const deploy = async () => {
    setDeploying(true);
    await new Promise((resolve) => setTimeout(resolve, 3000));
    const skill: Skill = {
      id: "skl-v2-precision-gripper",
      facility_id: "fac-walldorf-001",
      name: "Pick Bracket A",
      description: "Learned from the v2 precision gripper demo",
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
      <div className="flex flex-col gap-3 rounded-lg border border-[rgb(var(--signal-cyan)/0.35)] bg-[rgb(var(--signal-cyan)/0.08)] p-4 md:flex-row md:items-center md:justify-between">
        <p className="text-sm font-medium text-[rgb(var(--bone))]">{t("teach.banner")}</p>
        <Button variant="outline" size="sm" onClick={() => window.location.reload()}>Reset</Button>
      </div>

      <div className="grid gap-5 lg:grid-cols-[0.45fr_0.55fr]">
        <section className="rounded-lg border border-[rgb(var(--steel))] bg-[rgb(var(--ink-2))] p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-[rgb(var(--signal-cyan))]">Video input</p>
              <h1 className="mt-2 text-2xl font-semibold">{t("teach.title")}</h1>
            </div>
            {!started && <Button onClick={() => setStarted(true)} className="gap-2"><Play className="h-4 w-4" /> {t("teach.autoplay")}</Button>}
          </div>
          <video src={DEMO_VIDEO_URL} controls muted loop className="mt-4 aspect-video w-full rounded-md bg-[rgb(var(--ink-3))] object-cover" />
          <Button variant="outline" className="mt-4 w-full">Try your own video</Button>
        </section>

        <section className="rounded-lg border border-[rgb(var(--steel))] bg-[rgb(var(--ink-2))] p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-[rgb(var(--signal-cyan))]">3D robot view</p>
              <h2 className="mt-2 text-2xl font-semibold">Replay policy</h2>
            </div>
            <span className="font-mono text-sm tabular">{activeStep + 1}/{FALLBACK_STEPS.length}</span>
          </div>
          <RobotArm steps={steps} activeStepIndex={activeStep} controlled className="h-[420px] overflow-hidden rounded-md" />
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
        <section className="rounded-lg border border-[rgb(var(--signal-green)/0.5)] bg-[rgb(var(--signal-green)/0.08)] p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-2xl font-semibold"><CheckCircle2 className="h-6 w-6 text-[rgb(var(--signal-green))]" /> {t("teach.result")}</h2>
              <p className="mt-2 font-mono text-sm text-[rgb(var(--bone-2))]">Cycle time: 4.2s • Confidence: 94% • {steps.length} waypoints</p>
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
            {deployed ? <p className="rounded-md bg-[rgb(var(--signal-green)/0.12)] p-3 text-sm text-[rgb(var(--signal-green))]">Skill is now live on Assembly Cell 1. <a href="/app/robots" className="underline">Open in fleet view</a></p> : <Button onClick={deploy}>Deploy</Button>}
          </div>
        </Modal>
      )}

      {modal === "export" && <ExportModal policy={policy} onClose={() => setModal(null)} />}
      {modal === "roi" && <Modal title="Calculate ROI" wide onClose={() => setModal(null)}><RoiCalculator /></Modal>}
    </div>
  );
}

function Modal({ title, children, onClose, wide = false }: { title: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className={`max-h-[90vh] overflow-auto rounded-lg border border-[rgb(var(--steel))] bg-[rgb(var(--ink-2))] p-5 shadow-2xl ${wide ? "w-full max-w-6xl" : "w-full max-w-xl"}`}>
        <div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-semibold">{title}</h2><Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button></div>
        {children}
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md bg-[rgb(var(--ink-3))] p-3"><p className="text-xs text-[rgb(var(--bone-2))]">{label}</p><p className="font-mono tabular">{value}</p></div>;
}

function ExportModal({ policy, onClose }: { policy: TaskPolicy; onClose: () => void }) {
  const ur = generateUr(policy);
  const ros = generateRos(policy);
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
        <TabsList><TabsTrigger value="ur">URScript</TabsTrigger><TabsTrigger value="ros">ROS 2 Python</TabsTrigger><TabsTrigger value="pdf">PDF Summary</TabsTrigger></TabsList>
        <TabsContent value="ur" className="mt-4"><Code code={ur} language="python" /></TabsContent>
        <TabsContent value="ros" className="mt-4"><Code code={ros} language="python" /></TabsContent>
        <TabsContent value="pdf" className="mt-4"><Button onClick={downloadPdf} className="gap-2"><Download className="h-4 w-4" /> Download PDF Summary</Button></TabsContent>
      </Tabs>
    </Modal>
  );
}

function Code({ code, language }: { code: string; language: string }) {
  return (
    <div className="space-y-3">
      <Button variant="outline" onClick={() => navigator.clipboard?.writeText(code)}>Copy to clipboard</Button>
      <SyntaxHighlighter language={language} style={oneLight} customStyle={{ maxHeight: 420, border: "1px solid rgb(var(--steel))", borderRadius: 6 }}>{code}</SyntaxHighlighter>
    </div>
  );
}

function generateUr(policy: TaskPolicy) {
  return [`# AUREVIX generated URScript`, `def pick_bracket_a():`, ...policy.steps.map((step) => `  # ${step.order}. ${step.description}\n  movel(p[${step.target.x}, ${step.target.y}, ${step.target.z}, 0, 0, ${step.target.rz ?? 0}], v=${step.speed}, a=0.5)`), `end`, `pick_bracket_a()`].join("\n");
}

function generateRos(policy: TaskPolicy) {
  return [`# AUREVIX generated ROS 2 Python`, `class PickBracketA:`, `    def execute(self):`, ...policy.steps.map((step) => `        self.move_to(${step.target.x}, ${step.target.y}, ${step.target.z})  # ${step.description}`)].join("\n");
}
