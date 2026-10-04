"use client";

import { useEffect, useMemo, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RobotViewport } from "@/components/robot-viewport";
import { FALLBACK_POLICY } from "@/lib/demo-seed";
import { useDemoData } from "@/lib/use-demo-data";
import { isExportable } from "@/lib/trust-layer";
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
import {
  DEFAULT_TOOL_CHANGER_CONFIG,
  TOOL_TYPES,
  readToolChangerConfig,
  saveToolChangerConfig,
  type ToolChangerConfig,
  type ToolStation,
  type ToolType,
} from "@/lib/tool-changer";

function clampDelay(value: number) {
  if (!Number.isFinite(value)) return DEFAULT_WORKCELL_CONFIG.actuationDelayMs;
  return Math.min(2000, Math.max(100, Math.round(value)));
}

export default function WorkcellPage() {
  const { skills } = useDemoData();
  const [config, setConfig] = useState<WorkcellConfig>(DEFAULT_WORKCELL_CONFIG);
  const [toolChangerConfig, setToolChangerConfig] = useState<ToolChangerConfig>(DEFAULT_TOOL_CHANGER_CONFIG);
  const selectedModel = useMemo(() => getGripperModel(config.gripperModelId), [config.gripperModelId]);
  const matchingModels = useMemo(
    () => GRIPPER_MODELS.filter((model) => config.gripperType === "custom" || model.type === config.gripperType || model.id === "custom"),
    [config.gripperType],
  );
  const pneumatic = isPneumaticGripper(config.gripperType);

  useEffect(() => {
    setConfig(readWorkcellConfig());
    setToolChangerConfig(readToolChangerConfig());
  }, []);

  useEffect(() => {
    saveWorkcellConfig(config);
  }, [config]);

  useEffect(() => {
    saveToolChangerConfig(toolChangerConfig);
  }, [toolChangerConfig]);

  const updateStation = (id: string, patch: Partial<ToolStation>) => {
    setToolChangerConfig((current) => ({
      ...current,
      stations: current.stations.map((station) => (station.id === id ? { ...station, ...patch } : station)),
    }));
  };

  const updateStationDock = (id: string, key: keyof ToolStation["dock"], value: number) => {
    setToolChangerConfig((current) => ({
      ...current,
      stations: current.stations.map((station) => (station.id === id ? { ...station, dock: { ...station.dock, [key]: value } } : station)),
    }));
  };

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
        <Button className="gap-2"><ShieldCheck className="h-4 w-4" /> Review {skills.filter((skill) => isExportable(Math.round(skill.confidence * 100))).length} eligible skills</Button>
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

      <section className="rounded-lg border border-[rgb(var(--steel))] bg-[rgb(var(--ink-2))] p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-[rgb(var(--signal-cyan))]">Automatic tool changer</p>
            <h2 className="mt-2 text-2xl font-semibold">Tool stations</h2>
            <p className="mt-2 max-w-2xl text-sm text-[rgb(var(--bone-2))]">
              Configure dock waypoints and lock/unlock I/O for each tool. TOOL_CHANGE steps in the teach sequence reference these stations to generate automatic dock/undock code.
            </p>
          </div>
          <label className="flex items-center gap-2 rounded-md border border-[rgb(var(--steel))] bg-[rgb(var(--ink-3))] px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={toolChangerConfig.enabled}
              onChange={(event) => setToolChangerConfig((current) => ({ ...current, enabled: event.target.checked }))}
            />
            <span>Enable tool changer</span>
          </label>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {toolChangerConfig.stations.map((station) => {
            const active = station.id === toolChangerConfig.activeStationId;
            return (
              <div
                key={station.id}
                className={`rounded-md border p-3 text-sm ${active ? "border-[rgb(var(--signal-cyan)/0.5)] bg-[rgb(var(--signal-cyan)/0.06)]" : "border-[rgb(var(--steel))] bg-[rgb(var(--ink-3))]"}`}
              >
                <div className="grid gap-2">
                  <input
                    aria-label={`${station.name} name`}
                    className="rounded-md border border-[rgb(var(--steel))] bg-[rgb(var(--ink-2))] px-2 py-1.5 text-sm font-medium"
                    value={station.name}
                    onChange={(event) => updateStation(station.id, { name: event.target.value })}
                  />
                  <select
                    aria-label={`${station.name} tool type`}
                    className="rounded-md border border-[rgb(var(--steel))] bg-[rgb(var(--ink-2))] px-2 py-1.5 font-mono text-xs"
                    value={station.toolType}
                    onChange={(event) => updateStation(station.id, { toolType: event.target.value as ToolType })}
                  >
                    {TOOL_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                  </select>

                  <div className="grid grid-cols-3 gap-1.5">
                    {(["x", "y", "z"] as const).map((axis) => (
                      <label key={axis} className="grid gap-0.5 text-[11px]">
                        <span className="text-[rgb(var(--bone-2))]">Dock {axis} (m)</span>
                        <input
                          type="number"
                          step="0.01"
                          className="rounded-md border border-[rgb(var(--steel))] bg-[rgb(var(--ink-2))] px-2 py-1 font-mono text-xs tabular"
                          value={station.dock[axis]}
                          onChange={(event) => updateStationDock(station.id, axis, Number(event.target.value))}
                        />
                      </label>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-1.5">
                    <label className="grid gap-0.5 text-[11px]">
                      <span className="text-[rgb(var(--bone-2))]">Lock DO port</span>
                      <input
                        type="number"
                        min={0}
                        className="rounded-md border border-[rgb(var(--steel))] bg-[rgb(var(--ink-2))] px-2 py-1 font-mono text-xs tabular"
                        value={station.lockPort}
                        onChange={(event) => updateStation(station.id, { lockPort: Math.max(0, Number(event.target.value)) })}
                      />
                    </label>
                    <label className="grid gap-0.5 text-[11px]">
                      <span className="text-[rgb(var(--bone-2))]">Unlock DO port</span>
                      <input
                        type="number"
                        min={0}
                        className="rounded-md border border-[rgb(var(--steel))] bg-[rgb(var(--ink-2))] px-2 py-1 font-mono text-xs tabular"
                        value={station.unlockPort}
                        onChange={(event) => updateStation(station.id, { unlockPort: Math.max(0, Number(event.target.value)) })}
                      />
                    </label>
                  </div>

                  <label className="grid gap-0.5 text-[11px]">
                    <span className="text-[rgb(var(--bone-2))]">Actuation delay (ms)</span>
                    <input
                      type="number"
                      min={100}
                      max={2000}
                      className="rounded-md border border-[rgb(var(--steel))] bg-[rgb(var(--ink-2))] px-2 py-1 font-mono text-xs tabular"
                      value={station.actuationDelayMs}
                      onChange={(event) => updateStation(station.id, { actuationDelayMs: Math.min(2000, Math.max(100, Math.round(Number(event.target.value)))) })}
                    />
                  </label>

                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="radio"
                      name="active-tool-station"
                      checked={active}
                      onChange={() => setToolChangerConfig((current) => ({ ...current, activeStationId: station.id }))}
                    />
                    <span>{active ? "Currently mounted" : "Set as currently mounted"}</span>
                  </label>
                </div>
              </div>
            );
          })}
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
