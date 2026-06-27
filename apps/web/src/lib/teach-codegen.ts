import type { TaskPolicy, TaskStep } from "./types";
import { isPneumaticGripper, type WorkcellConfig } from "./workcell-config";
import { getToolStation, type ToolChangerConfig, type ToolStation } from "./tool-changer";

export type SequenceStepType = "MOTION" | "WAIT_FOR_SIGNAL" | "GRIPPER_ACTUATE" | "TOOL_CHANGE" | "INSPECTION" | "USER_CONFIRM";
export type SequenceStatus = "pending" | "analysing" | "complete" | "error";
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

const DEFAULT_CODEGEN_SEQUENCE: SequenceStep[] = [
  { id: "seq-pick", label: "Pick component", type: "MOTION", status: "pending", gateAfter: { type: "signal_high", signalPort: 2, elseAction: "wait" } },
  { id: "seq-orient", label: "Rotate component", type: "MOTION", status: "pending" },
  { id: "seq-place", label: "Place beside fixture", type: "MOTION", status: "pending", gateAfter: { type: "inspection_pass", signalPort: 3, failStepId: "seq-orient", elseAction: "retry" } },
  { id: "seq-toolchange", label: "Switch to vacuum cup", type: "TOOL_CHANGE", status: "pending", toolStationId: "station-vacuum" },
  { id: "seq-machine", label: "Trigger machine", type: "WAIT_FOR_SIGNAL", status: "pending", gateAfter: { type: "retry_or_abort", signalPort: 5, elseAction: "abort" } },
];

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

  const chunks = sequence.length ? sequence : DEFAULT_CODEGEN_SEQUENCE;
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

  const chunks = sequence.length ? sequence : DEFAULT_CODEGEN_SEQUENCE;
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
