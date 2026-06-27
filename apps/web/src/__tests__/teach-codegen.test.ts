import { describe, expect, it } from "vitest";
import type { TaskPolicy, TaskStep } from "@/lib/types";
import { DEFAULT_WORKCELL_CONFIG } from "@/lib/workcell-config";
import { DEFAULT_TOOL_CHANGER_CONFIG, DEFAULT_TOOL_STATIONS, type ToolChangerConfig } from "@/lib/tool-changer";
import {
  AUREVIX_MAX_RETRIES,
  emitGateRos,
  emitGateUr,
  emitToolChangeRos,
  emitToolChangeUr,
  gateFailLabel,
  generateRos,
  generateUr,
  policyFingerprint,
  sanitizeIdentifier,
  stateMethodName,
  type SequenceStep,
} from "@/lib/teach-codegen";

function step(partial: Partial<TaskStep> & Pick<TaskStep, "action" | "target">): TaskStep {
  return {
    id: partial.id ?? crypto.randomUUID(),
    order: partial.order ?? 1,
    description: partial.description ?? `${partial.action} step`,
    gripper: partial.gripper ?? "unchanged",
    speed: partial.speed ?? 0.2,
    duration: partial.duration ?? 2,
    requiresVision: partial.requiresVision ?? false,
    ...partial,
  };
}

const POLICY: TaskPolicy = {
  toolFrame: "tcp_default",
  estimatedCycleSeconds: 12,
  steps: [
    step({ order: 1, action: "home", target: { x: 0, y: 0, z: 0.4, rz: 0 } }),
    step({ order: 2, action: "move", target: { x: 0.3, y: 0.1, z: 0.2, rz: 0 } }),
    step({ order: 3, action: "grip", target: { x: 0.3, y: 0.1, z: 0.05, rz: 0 }, gripper: "closed", speed: 0.08 }),
    step({ order: 4, action: "home", target: { x: 0, y: 0, z: 0.4, rz: 0 } }),
  ],
};

const noGate: SequenceStep = { id: "seq-orient", label: "Orient part", type: "MOTION", status: "pending" };
const gateSignal: SequenceStep = { id: "seq-pick", label: "Pick part", type: "MOTION", status: "pending", gateAfter: { type: "signal_high", signalPort: 2, elseAction: "wait" } };
const gateAbort: SequenceStep = { id: "seq-place", label: "Place part", type: "MOTION", status: "pending", gateAfter: { type: "inspection_pass", signalPort: 3, elseAction: "abort" } };
const gateRetry: SequenceStep = { id: "seq-place", label: "Place part", type: "MOTION", status: "pending", gateAfter: { type: "inspection_pass", signalPort: 3, elseAction: "retry" } };
const gateWait: SequenceStep = { id: "seq-machine", label: "Trigger machine", type: "WAIT_FOR_SIGNAL", status: "pending", gateAfter: { type: "retry_or_abort", signalPort: 5, elseAction: "wait" } };
const gateRetryOrAbort: SequenceStep = { id: "seq-machine", label: "Trigger machine", type: "WAIT_FOR_SIGNAL", status: "pending", gateAfter: { type: "retry_or_abort", signalPort: 5, elseAction: "abort" } };

describe("sanitizeIdentifier", () => {
  it("lowercases and underscores labels", () => {
    expect(sanitizeIdentifier("Pick Bracket")).toBe("pick_bracket");
    expect(sanitizeIdentifier("Step 1: Grip!")).toBe("step_1_grip");
  });

  it("falls back to aurevix_skill when nothing alphanumeric remains", () => {
    expect(sanitizeIdentifier("  ---  ")).toBe("aurevix_skill");
  });
});

describe("policyFingerprint", () => {
  it("is deterministic for identical step content and an 8-char hex string", () => {
    const a = policyFingerprint(POLICY);
    const b = policyFingerprint({ ...POLICY, steps: [...POLICY.steps] });
    expect(a).toMatch(/^[0-9a-f]{8}$/);
    expect(a).toBe(b);
  });

  it("changes when step content changes", () => {
    const changed: TaskPolicy = { ...POLICY, steps: [...POLICY.steps.slice(0, -1)] };
    expect(policyFingerprint(changed)).not.toBe(policyFingerprint(POLICY));
  });
});

describe("gateFailLabel", () => {
  it("labels inspection gates distinctly from other conditions", () => {
    expect(gateFailLabel("inspection_pass")).toBe("Inspection failed");
    expect(gateFailLabel("signal_high")).toBe("Condition failed");
    expect(gateFailLabel("retry_or_abort")).toBe("Condition failed");
  });
});

describe("emitGateUr", () => {
  it("emits nothing when the step has no gate", () => {
    expect(emitGateUr(noGate, "fn")).toEqual([]);
  });

  it("blocks on a digital input for signal_high gates", () => {
    const lines = emitGateUr(gateSignal, "pick_part").join("\n");
    expect(lines).toContain("while get_digital_in(2) == False:");
    expect(lines).toContain("sleep(0.1)");
  });

  it("halts with a popup for abort gates", () => {
    const lines = emitGateUr(gateAbort, "place_part").join("\n");
    expect(lines).toContain('popup("Inspection failed after Place part", error=True)');
    expect(lines).toContain("halt");
  });

  it("re-invokes the step and caps attempts at AUREVIX_MAX_RETRIES for retry gates", () => {
    const lines = emitGateUr(gateRetry, "place_part").join("\n");
    expect(lines).toContain("place_part()");
    expect(lines).toContain("> AUREVIX_MAX_RETRIES");
    expect(lines).toContain("max retries exceeded");
  });

  it("polls until pass for the default wait elseAction", () => {
    const lines = emitGateUr(gateWait, "trigger_machine").join("\n");
    expect(lines).toContain("while not (get_digital_in(5) == True):");
    expect(lines).toContain("sleep(0.5)");
  });
});

describe("emitGateRos", () => {
  it("names the method after the gate index", () => {
    const lines = emitGateRos(gateSignal, 0, "state_1_pick_part");
    expect(lines[0]).toBe("    def gate_1(self) -> None:");
    expect(lines.join("\n")).toContain("self.read_digital_input(2)");
  });

  it("raises RuntimeError for abort gates", () => {
    const lines = emitGateRos(gateAbort, 2, "state_3_place_part").join("\n");
    expect(lines).toContain('raise RuntimeError("Inspection failed after Place part")');
  });

  it("retries via the provided method and caps at self.AUREVIX_MAX_RETRIES", () => {
    const lines = emitGateRos(gateRetry, 2, "state_3_place_part").join("\n");
    expect(lines).toContain("self.state_3_place_part()");
    expect(lines).toContain("self.AUREVIX_MAX_RETRIES");
    expect(lines).toContain("max retries exceeded");
  });
});

describe("emitToolChangeUr", () => {
  const gripper = DEFAULT_TOOL_STATIONS[0];
  const vacuum = DEFAULT_TOOL_STATIONS[1];

  it("skips the move sequence when the target station is already mounted", () => {
    const lines = emitToolChangeUr(gripper, gripper, "Switch tool").join("\n");
    expect(lines).toContain("already mounted");
    expect(lines).not.toContain("set_digital_out");
  });

  it("unlocks the current tool, docks it, then docks and locks the target tool", () => {
    const lines = emitToolChangeUr(gripper, vacuum, "Switch to vacuum cup").join("\n");
    expect(lines).toContain(`set_digital_out(${gripper.unlockPort}, True)`);
    expect(lines).toContain(`set_digital_out(${vacuum.lockPort}, True)`);
    expect(lines).toContain("sleep(0.6)");
    expect(lines).toContain("AUREVIX tool change complete: Vacuum Cup Dock mounted");
  });
});

describe("emitToolChangeRos", () => {
  const gripper = DEFAULT_TOOL_STATIONS[0];
  const vacuum = DEFAULT_TOOL_STATIONS[1];

  it("skips the move sequence when the target station is already mounted", () => {
    const lines = emitToolChangeRos(gripper, gripper, "Switch tool").join("\n");
    expect(lines).toContain("already mounted");
    expect(lines).not.toContain("set_digital_output");
  });

  it("emits move_linear/set_digital_output calls for source and target stations", () => {
    const lines = emitToolChangeRos(gripper, vacuum, "Switch to vacuum cup").join("\n");
    expect(lines).toContain(`self.set_digital_output(${gripper.unlockPort}, True)`);
    expect(lines).toContain(`self.set_digital_output(${vacuum.lockPort}, True)`);
    expect(lines).toContain("time.sleep(0.6)");
    expect(lines).toContain("Tool change complete: Vacuum Cup Dock mounted");
  });
});

describe("stateMethodName", () => {
  it("names tool-change steps distinctly from motion steps", () => {
    const toolChange: SequenceStep = { id: "seq-tool", label: "Switch to vacuum cup", type: "TOOL_CHANGE", status: "pending" };
    expect(stateMethodName(toolChange, 1)).toBe("tool_change_2");
    expect(stateMethodName(gateSignal, 0)).toBe("state_1_pick_part");
  });
});

describe("generateUr / generateRos integration", () => {
  const sequence: SequenceStep[] = [
    gateSignal,
    { id: "seq-toolchange", label: "Switch to vacuum cup", type: "TOOL_CHANGE", status: "pending", toolStationId: "station-vacuum" },
    gateRetry,
    gateRetryOrAbort,
  ];
  const toolChangerConfig: ToolChangerConfig = { ...DEFAULT_TOOL_CHANGER_CONFIG, enabled: true, activeStationId: "station-gripper" };

  it("generateUr documents the active tool, retry budget, and tool-change/gate logic", () => {
    const code = generateUr(POLICY, sequence, DEFAULT_WORKCELL_CONFIG, toolChangerConfig, "Universal Robots UR5e");

    expect(code).toContain("Tool changer enabled. Initial tool: Parallel Gripper Dock (gripper)");
    expect(code).toContain(`global AUREVIX_MAX_RETRIES = ${AUREVIX_MAX_RETRIES}`);
    expect(code).toContain("def switch_to_vacuum_cup():");
    expect(code).toContain("set_digital_out(5, True)");
    expect(code).toContain("while get_digital_in(2) == False:");
    expect(code).toContain("place_part()");
    expect(code).toContain("halt");
  });

  it("generateRos defines tool_change and gate methods and wires them into execute()", () => {
    const code = generateRos(POLICY, sequence, DEFAULT_WORKCELL_CONFIG, toolChangerConfig, "Universal Robots UR5e");

    expect(code).toContain("Tool changer enabled. Initial tool: Parallel Gripper Dock (gripper)");
    expect(code).toContain("self.AUREVIX_MAX_RETRIES = 3");
    expect(code).toContain("def tool_change_2(self) -> None:");
    expect(code).toContain("def gate_1(self) -> None:");
    expect(code).toContain("def gate_3(self) -> None:");
    expect(code).toContain("def gate_4(self) -> None:");
    expect(code).toContain("self.state_1_pick_part()\n        self.gate_1()");
    expect(code).toContain("self.tool_change_2()");
    expect(code).toContain('raise RuntimeError("Condition failed after Trigger machine")');
  });
});
