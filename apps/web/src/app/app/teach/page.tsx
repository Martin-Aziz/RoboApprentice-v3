"use client";

import { useEffect, useMemo, useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneLight } from "react-syntax-highlighter/dist/cjs/styles/prism";
import jsPDF from "jspdf";
import { Bot, CheckCircle2, Code2, Download, Play, Rocket, TrendingUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RobotViewport } from "@/components/robot-viewport";
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
            {!started && <Button data-testid="auto-play-demo" onClick={() => setStarted(true)} className="gap-2"><Play className="h-4 w-4" /> {t("teach.autoplay")}</Button>}
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
          <RobotViewport
            robotType="ur5e"
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
            {deployed ? <p className="rounded-md bg-[rgb(var(--signal-green)/0.12)] p-3 text-sm text-[rgb(var(--signal-green))]">Skill is now live on Assembly Cell 1. <a href="/app/robots" className="underline">Open in fleet view</a></p> : <Button data-testid="deploy-skill" onClick={deploy}>Deploy</Button>}
          </div>
        </Modal>
      )}

      {modal === "export" && <ExportModal policy={policy} onClose={() => setModal(null)} />}
      {modal === "roi" && <Modal title="Calculate ROI" wide onClose={() => setModal(null)}><RoiCalculator /></Modal>}
    </div>
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

const fmt = (value: number, precision = 4) => Number(value.toFixed(precision)).toString();

function sanitizeIdentifier(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "aurevix_skill";
}

function policyFingerprint(policy: TaskPolicy) {
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

function generateUr(policy: TaskPolicy) {
  const programName = sanitizeIdentifier("Pick Bracket A");
  const policyId = policyFingerprint(policy);
  const lines = [
    `# AUREVIX generated URScript`,
    `# Program: ${programName}`,
    `# Policy ID: ${policyId}`,
    `# Robot: Universal Robots UR5e`,
    `# Tool frame: ${policy.toolFrame}`,
    `# Coordinate convention: target XYZ is meters in the robot base frame; Z is height above table surface in the teaching UI.`,
    `# Review payload, TCP, and gripper IO mapping before production deployment.`,
    ``,
    `global AUREVIX_APPROACH_ACCEL = 0.6`,
    `global AUREVIX_CONTACT_ACCEL = 0.25`,
    `global AUREVIX_BLEND_SAFE = 0.025`,
    `global AUREVIX_BLEND_CONTACT = 0.001`,
    ``,
    `def aurevix_set_gripper(closed):`,
    `  # Digital output 0 is the demo parallel-gripper close command.`,
    `  set_tool_digital_out(0, closed)`,
    `  sleep(0.35)`,
    `end`,
    ``,
    `def aurevix_guarded_movel(target_pose, speed, accel, blend):`,
    `  # Single motion wrapper so operators can add force/zone checks in one place.`,
    `  movel(target_pose, a=accel, v=speed, r=blend)`,
    `end`,
    ``,
    `def ${programName}():`,
    `  textmsg("AUREVIX start policy ${policyId}")`,
    `  set_tcp(p[0, 0, 0.0952, 0, 0, 0])`,
    `  aurevix_set_gripper(False)`,
  ];

  policy.steps.forEach((step) => {
    const speed = fmt(step.speed);
    const pose = poseLiteral(step);
    lines.push(``);
    lines.push(`  # Step ${step.order}: ${step.description}`);
    lines.push(`  # action=${step.action} gripper=${step.gripper} nominal_speed=${speed}m/s duration=${step.duration}s`);

    if (step.action === "home") {
      lines.push(`  movej([0, -1.5708, 1.5708, -1.5708, -1.5708, 0], a=1.0, v=0.35, r=0)`);
    } else if (step.action === "grip") {
      lines.push(`  aurevix_guarded_movel(${pose}, ${fmt(Math.min(step.speed, 0.1))}, AUREVIX_CONTACT_ACCEL, AUREVIX_BLEND_CONTACT)`);
      lines.push(`  aurevix_set_gripper(${step.gripper === "closed" ? "True" : "False"})`);
    } else if (step.action === "release") {
      lines.push(`  aurevix_guarded_movel(${pose}, ${fmt(Math.min(step.speed, 0.12))}, AUREVIX_CONTACT_ACCEL, AUREVIX_BLEND_CONTACT)`);
      lines.push(`  aurevix_set_gripper(False)`);
    } else if (step.action === "wait") {
      lines.push(`  sleep(${fmt(step.duration)})`);
    } else {
      lines.push(`  aurevix_guarded_movel(${pose}, ${speed}, AUREVIX_APPROACH_ACCEL, AUREVIX_BLEND_SAFE)`);
    }

    if (step.requiresVision) {
      lines.push(`  # Vision/contact verification required before continuing.`);
      lines.push(`  textmsg("verify: step ${step.order}")`);
    }
  });

  lines.push(``);
  lines.push(`  aurevix_set_gripper(False)`);
  lines.push(`  textmsg("AUREVIX complete policy ${policyId}")`);
  lines.push(`end`);
  lines.push(``);
  lines.push(`${programName}()`);
  return lines.join("\n");
}

function generateRos(policy: TaskPolicy) {
  const policyId = policyFingerprint(policy);
  const stepRows = policy.steps
    .map((step) => {
      const { x, y, z, rx = 0, ry = Math.PI / 2, rz = 0 } = step.target;
      return `        SkillStep(${step.order}, "${step.action}", "${step.gripper}", (${fmt(x)}, ${fmt(y)}, ${fmt(z)}, ${fmt(rx)}, ${fmt(ry)}, ${fmt(rz)}), ${fmt(step.speed)}, ${step.duration}, "${step.description.replace(/"/g, '\\"')}"),`;
    })
    .join("\n");

  return [
    `# AUREVIX generated ROS 2 Python skill`,
    `# Policy ID: ${policyId}`,
    `# Robot: Universal Robots UR5e`,
    `# Intended integration: ROS 2 + MoveIt 2 + a parallel gripper driver.`,
    `# This file is production-structured but hardware adapters must be wired by the cell integrator.`,
    ``,
    `from dataclasses import dataclass`,
    `from typing import Literal, Tuple`,
    ``,
    `import rclpy`,
    `from rclpy.node import Node`,
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
    `        self.steps = [`,
    stepRows,
    `        ]`,
    ``,
    `    def move_home(self) -> None:`,
    `        self.get_logger().info("Moving to validated home joint configuration")`,
    `        # TODO: send MoveIt 2 joint target for UR5e home posture.`,
    ``,
    `    def move_linear(self, pose: PoseTuple, speed: float, contact: bool = False) -> None:`,
    `        x, y, z, rx, ry, rz = pose`,
    `        zone = "contact" if contact else "free-space"`,
    `        self.get_logger().info(f"{zone} move to x={x:.3f} y={y:.3f} z={z:.3f} speed={speed:.3f}")`,
    `        # TODO: build geometry_msgs/PoseStamped and execute via MoveIt 2.`,
    ``,
    `    def set_gripper(self, state: Gripper) -> None:`,
    `        if state == "unchanged":`,
    `            return`,
    `        self.get_logger().info(f"Setting gripper {state}")`,
    `        # TODO: publish to the gripper command action/topic.`,
    ``,
    `    def verify_contact_or_vision(self, step: SkillStep) -> None:`,
    `        self.get_logger().info(f"Verification checkpoint after step {step.order}: {step.description}")`,
    `        # TODO: read force/torque or vision result and raise on failure.`,
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
    `        self.get_logger().info(f"Starting AUREVIX policy {self.policy_id}")`,
    `        for step in self.steps:`,
    `            self.execute_step(step)`,
    `        self.set_gripper("open")`,
    `        self.get_logger().info(f"Completed AUREVIX policy {self.policy_id}")`,
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
