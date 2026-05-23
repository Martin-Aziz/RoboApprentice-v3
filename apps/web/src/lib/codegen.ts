import type { TaskPolicy, TaskStep } from "./types";
import { createHash } from "crypto";

export type CodegenTarget = "urscript" | "ros2_python" | "pseudocode";

const fmt = (n: number, p = 4) => Number(n.toFixed(p)).toString();

function escapeForString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/**
 * Generate policy hash for provenance/audit.
 */
function policyHash(policy: TaskPolicy): string {
  const content = JSON.stringify(policy.steps);
  return createHash("sha256").update(content).digest("hex").slice(0, 16);
}

function urscriptForStep(step: TaskStep): string[] {
  const { x, y, z, rx = 0, ry = 0, rz = 0 } = step.target;
  const pose = `p[${fmt(x)}, ${fmt(y)}, ${fmt(z)}, ${fmt(rx)}, ${fmt(ry)}, ${fmt(rz)}]`;
  const lines: string[] = [];
  lines.push(`# ${step.order}. ${escapeForString(step.description)} [${step.action}]`);

  const blendRadius = step.action === "grip" || step.action === "release" ? 0.001 : 0.05;

  if (step.action === "home") {
    lines.push(`movej([0, -1.5708, 0, -1.5708, 0, 0], a=1.0, v=${fmt(step.speed)}, r=${blendRadius})`);
  } else if (step.action === "approach" || step.action === "move" || step.action === "rotate") {
    lines.push(`movel(${pose}, a=0.5, v=${fmt(step.speed)}, r=${blendRadius})`);
  } else if (step.action === "grip") {
    lines.push(`movel(${pose}, a=0.3, v=${fmt(Math.min(step.speed, 0.1))}, r=0.001)`);
    lines.push(`set_tool_digital_out(0, True)`);
    lines.push(`sleep(0.4)`);
  } else if (step.action === "release") {
    lines.push(`movel(${pose}, a=0.3, v=${fmt(Math.min(step.speed, 0.1))}, r=0.001)`);
    lines.push(`set_tool_digital_out(0, False)`);
    lines.push(`sleep(0.4)`);
  } else if (step.action === "wait") {
    lines.push(`sleep(${fmt(step.duration)})`);
  } else if (step.action === "inspect") {
    lines.push(`movel(${pose}, a=0.3, v=${fmt(step.speed)}, r=${blendRadius})`);
    if (step.requiresVision) {
      lines.push(`# vision check inserted by AUREVIX`);
      lines.push(`textmsg("inspect ${escapeForString(step.description)}")`);
    }
  }
  return lines;
}

export function toUrscript(policy: TaskPolicy, taskTitle: string): string {
  const policyId = policyHash(policy);
  const timestamp = new Date().toISOString();

  const header = [
    `# AUREVIX // generated UR program`,
    `# Task: ${escapeForString(taskTitle)}`,
    `# Generated: ${timestamp}`,
    `# Policy ID: ${policyId}`,
    `# Steps: ${policy.steps.length}  Cycle: ~${policy.estimatedCycleSeconds}s`,
    `# Tool frame: ${policy.toolFrame}`,
    `# Blending enabled for smooth execution (r=0.05 nominal, r=0.001 at contact)`,
    `#`,
    `def aurevix_skill():`,
  ];

  const body = policy.steps
    .flatMap(urscriptForStep)
    .map((line) => `    ${line}`);

  return [
    ...header,
    ...body,
    `    textmsg("forge mind skill complete")`,
    `end`,
    `aurevix_skill()`,
  ].join("\n");
}

function rosForStep(step: TaskStep): string[] {
  const { x, y, z, rx = 0, ry = 0, rz = 0 } = step.target;
  const lines: string[] = [];
  lines.push(`        # ${step.order}. ${escapeForString(step.description)} [${step.action}]`);

  if (step.action === "home") {
    lines.push(`        self.go_home()`);
  } else if (step.action === "approach" || step.action === "move" || step.action === "rotate" || step.action === "inspect") {
    lines.push(
      `        self.move_to_pose(${fmt(x)}, ${fmt(y)}, ${fmt(z)}, ${fmt(rx)}, ${fmt(ry)}, ${fmt(rz)}, speed=${fmt(step.speed)})`,
    );
    if (step.action === "inspect" && step.requiresVision) {
      lines.push(`        self.run_vision_check("${escapeForString(step.description)}")`);
    }
  } else if (step.action === "grip") {
    lines.push(
      `        self.move_to_pose(${fmt(x)}, ${fmt(y)}, ${fmt(z)}, ${fmt(rx)}, ${fmt(ry)}, ${fmt(rz)}, speed=${fmt(Math.min(step.speed, 0.1))})`,
    );
    lines.push(`        self.set_gripper(closed=True)`);
  } else if (step.action === "release") {
    lines.push(
      `        self.move_to_pose(${fmt(x)}, ${fmt(y)}, ${fmt(z)}, ${fmt(rx)}, ${fmt(ry)}, ${fmt(rz)}, speed=${fmt(Math.min(step.speed, 0.1))})`,
    );
    lines.push(`        self.set_gripper(closed=False)`);
  } else if (step.action === "wait") {
    lines.push(`        self.sleep(${fmt(step.duration)})`);
  }
  return lines;
}

export function toRos2Python(policy: TaskPolicy, taskTitle: string): string {
  const policyId = policyHash(policy);
  const timestamp = new Date().toISOString();

  const header = [
    `# AUREVIX // generated ROS 2 Python skill`,
    `# Task: ${escapeForString(taskTitle)}`,
    `# Generated: ${timestamp}`,
    `# Policy ID: ${policyId}`,
    `# This module assumes a MoveIt 2 manipulator group + parallel gripper.`,
    `#`,
    `import rclpy`,
    `from rclpy.node import Node`,
    `from geometry_msgs.msg import Pose`,
    `from trajectory_msgs.msg import JointTrajectory, JointTrajectoryPoint`,
    `import time`,
    ``,
    ``,
    `class AurevixSkill(Node):`,
    `    def __init__(self):`,
    `        super().__init__("aurevix_skill")`,
    `        # User wires this to MoveItPy / pymoveit2 in production.`,
    `        self.get_logger().info(f"AUREVIX skill node started [policy=${policyId}]")`,
    `        self.policy_id = "${policyId}"`,
    ``,
    `    def go_home(self):`,
    `        self.get_logger().info("home")`,
    ``,
    `    def move_to_pose(self, x, y, z, rx, ry, rz, speed=0.2):`,
    `        pose = Pose()`,
    `        pose.position.x = x`,
    `        pose.position.y = y`,
    `        pose.position.z = z`,
    `        self.get_logger().info(f"move {x:.3f},{y:.3f},{z:.3f} v={speed}")`,
    ``,
    `    def set_gripper(self, closed: bool):`,
    `        self.get_logger().info(f"gripper={'closed' if closed else 'open'}")`,
    ``,
    `    def run_vision_check(self, label: str):`,
    `        self.get_logger().info(f"vision check: {label}")`,
    ``,
    `    def sleep(self, seconds: float):`,
    `        time.sleep(seconds)`,
    ``,
    `    def execute(self):`,
  ];

  const body = policy.steps.flatMap(rosForStep);

  const footer = [
    `        self.get_logger().info(f"forge mind skill complete [policy=${policyId}]")`,
    ``,
    ``,
    `def main(args=None):`,
    `    rclpy.init(args=args)`,
    `    node = AurevixSkill()`,
    `    node.execute()`,
    `    node.destroy_node()`,
    `    rclpy.shutdown()`,
    ``,
    ``,
    `if __name__ == "__main__":`,
    `    main()`,
  ];

  return [...header, ...body, ...footer].join("\n");
}

export function toPseudocode(policy: TaskPolicy, taskTitle: string): string {
  const policyId = policyHash(policy);
  const lines: string[] = [];
  lines.push(`# AUREVIX // pseudocode for "${taskTitle}"`);
  lines.push(`# Policy ID: ${policyId}`);
  lines.push(`# Estimated cycle: ${policy.estimatedCycleSeconds}s, tool: ${policy.toolFrame}`);
  lines.push(`#`);

  policy.steps.forEach((s) => {
    lines.push(
      `${String(s.order).padStart(2, "0")}. ${s.action.toUpperCase()} → (${fmt(s.target.x)}, ${fmt(s.target.y)}, ${fmt(s.target.z)})  gripper=${s.gripper}  v=${fmt(s.speed)}m/s  t=${s.duration}s — ${s.description}`,
    );
  });

  return lines.join("\n");
}
