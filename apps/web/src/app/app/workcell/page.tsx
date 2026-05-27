"use client";

import { useEffect, useMemo, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RobotViewport } from "@/components/robot-viewport";
import { FALLBACK_POLICY } from "@/lib/demo-seed";
import { useDemoData } from "@/lib/use-demo-data";
import {
  DEFAULT_WORKCELL_CONFIG,
  GRIPPER_MODELS,
  GRIPPER_TYPES,
  configFromModel,
  getGripperModel,
  isPneumaticGripper,
  readWorkcellConfig,
  saveWorkcellConfig,
  type GripperType,
  type WorkcellConfig,
} from "@/lib/workcell-config";

function clampDelay(value: number) {
  if (!Number.isFinite(value)) return DEFAULT_WORKCELL_CONFIG.actuationDelayMs;
  return Math.min(2000, Math.max(100, Math.round(value)));
}

export default function WorkcellPage() {
  const { skills } = useDemoData();
  const [config, setConfig] = useState<WorkcellConfig>(DEFAULT_WORKCELL_CONFIG);
  const selectedModel = useMemo(() => getGripperModel(config.gripperModelId), [config.gripperModelId]);
  const matchingModels = useMemo(
    () => GRIPPER_MODELS.filter((model) => config.gripperType === "custom" || model.type === config.gripperType || model.id === "custom"),
    [config.gripperType],
  );
  const pneumatic = isPneumaticGripper(config.gripperType);

  useEffect(() => {
    setConfig(readWorkcellConfig());
  }, []);

  useEffect(() => {
    saveWorkcellConfig(config);
  }, [config]);

  const update = <K extends keyof WorkcellConfig>(key: K, value: WorkcellConfig[K]) => {
    setConfig((current) => ({ ...current, [key]: value }));
  };

  const selectModel = (modelId: string) => {
    const model = getGripperModel(modelId);
    setConfig(configFromModel(model));
  };

  const selectType = (type: GripperType) => {
    const model = GRIPPER_MODELS.find((item) => item.type === type) ?? getGripperModel("custom");
    setConfig({ ...configFromModel(model), gripperType: type });
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-5 md:p-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-[rgb(var(--signal-cyan))]">Configuration</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight">Workcell setup</h1>
          <p className="mt-2 max-w-2xl text-sm text-[rgb(var(--bone-2))]">Configure the robot cell once, then use the same gripper and I/O mapping in generated robot code.</p>
        </div>
        <Button className="gap-2"><ShieldCheck className="h-4 w-4" /> Validate {skills.filter((skill) => skill.status === "ready").length} skills</Button>
      </div>

      <RobotViewport robotType="ur5e" gripperType={config.gripperType} policy={FALLBACK_POLICY} playbackState="paused" showCollisionGeometry />

      <section className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-lg border border-[rgb(var(--steel))] bg-[rgb(var(--ink-2))] p-5">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-[rgb(var(--signal-cyan))]">End effector</p>
          <h2 className="mt-2 text-2xl font-semibold">Gripper configuration</h2>

          <div className="mt-5 grid gap-3">
            <label className="grid gap-1 text-sm">
              <span className="text-[rgb(var(--bone-2))]">Gripper type</span>
              <select
                className="rounded-md border border-[rgb(var(--steel))] bg-[rgb(var(--ink-3))] px-3 py-2"
                value={config.gripperType}
                onChange={(event) => selectType(event.target.value as GripperType)}
              >
                {GRIPPER_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
              </select>
            </label>

            <label className="grid gap-1 text-sm">
              <span className="text-[rgb(var(--bone-2))]">Gripper model</span>
              <select
                className="rounded-md border border-[rgb(var(--steel))] bg-[rgb(var(--ink-3))] px-3 py-2"
                value={config.gripperModelId}
                onChange={(event) => selectModel(event.target.value)}
              >
                {matchingModels.map((model) => <option key={model.id} value={model.id}>{model.name}</option>)}
              </select>
            </label>

            <div className="rounded-md border border-[rgb(var(--steel))] bg-[rgb(var(--ink-3))] p-3 text-sm">
              <p className="font-medium">{selectedModel.description}</p>
              <p className="mt-1 text-[rgb(var(--bone-2))]">{selectedModel.controlMethod}</p>
              <p className="mt-2 font-mono text-xs tabular">Max payload: {config.maxPayloadKg.toFixed(1)} kg</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-[rgb(var(--steel))] bg-[rgb(var(--ink-2))] p-5">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-[rgb(var(--signal-cyan))]">I/O mapping</p>
          <h2 className="mt-2 text-2xl font-semibold">{pneumatic ? "Pneumatic valve control" : "Control mapping"}</h2>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <label className="grid gap-1 text-sm">
              <span className="text-[rgb(var(--bone-2))]">Open signal (DO port #)</span>
              <input
                type="number"
                min={0}
                className="rounded-md border border-[rgb(var(--steel))] bg-[rgb(var(--ink-3))] px-3 py-2 font-mono tabular"
                value={config.openPort}
                onChange={(event) => update("openPort", Math.max(0, Number(event.target.value)))}
              />
            </label>

            <label className="grid gap-1 text-sm">
              <span className="text-[rgb(var(--bone-2))]">Close signal (DO port #)</span>
              <input
                type="number"
                min={0}
                disabled={config.springReturn}
                className="rounded-md border border-[rgb(var(--steel))] bg-[rgb(var(--ink-3))] px-3 py-2 font-mono tabular disabled:opacity-50"
                value={config.closePort}
                onChange={(event) => update("closePort", Math.max(0, Number(event.target.value)))}
              />
            </label>

            <label className="grid gap-1 text-sm">
              <span className="text-[rgb(var(--bone-2))]">Actuation delay (ms)</span>
              <input
                type="number"
                min={100}
                max={2000}
                className="rounded-md border border-[rgb(var(--steel))] bg-[rgb(var(--ink-3))] px-3 py-2 font-mono tabular"
                value={config.actuationDelayMs}
                onChange={(event) => update("actuationDelayMs", clampDelay(Number(event.target.value)))}
              />
            </label>

            <label className="grid gap-1 text-sm">
              <span className="text-[rgb(var(--bone-2))]">Verify via DI? optional port</span>
              <input
                type="number"
                min={0}
                placeholder="None"
                className="rounded-md border border-[rgb(var(--steel))] bg-[rgb(var(--ink-3))] px-3 py-2 font-mono tabular"
                value={config.verifyPort ?? ""}
                onChange={(event) => update("verifyPort", event.target.value === "" ? undefined : Math.max(0, Number(event.target.value)))}
              />
            </label>
          </div>

          {pneumatic && (
            <div className="mt-4 flex flex-wrap gap-3">
              <label className="flex items-center gap-2 rounded-md border border-[rgb(var(--steel))] bg-[rgb(var(--ink-3))] px-3 py-2 text-sm">
                <input type="checkbox" checked={config.springReturn} onChange={(event) => update("springReturn", event.target.checked)} />
                <span>Spring-return (single-signal)</span>
              </label>
              <span className="rounded-md bg-[rgb(var(--signal-green)/0.1)] px-3 py-2 font-mono text-xs text-[rgb(var(--signal-green))]">
                Saved · DO{config.openPort}=OPEN {config.springReturn ? "" : `DO${config.closePort}=CLOSE`}
              </span>
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {["Workbench", "Pickup bin", "Placement bin"].map((item) => (
          <div key={item} className="rounded-lg border border-[rgb(var(--steel))] bg-[rgb(var(--ink-2))] p-4">
            <p className="font-semibold">{item}</p>
            <p className="mt-1 text-sm text-[rgb(var(--bone-2))]">Saved in facility workcell configuration.</p>
          </div>
        ))}
      </section>
    </div>
  );
}
