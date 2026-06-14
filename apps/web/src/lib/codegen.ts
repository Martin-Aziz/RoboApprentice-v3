import type { TaskPolicy, TaskStep } from "./types";
import { createHash } from "crypto";

export type CodegenTarget = "urscript" | "ros2_python" | "pseudocode" | "rapid" | "fanuc_karel";

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

/**
 * Rotation about Z (rz) expressed as a RAPID quaternion [q1, q2, q3, q4] = [w, x, y, z].
 * rx/ry are not encoded; integrators should confirm tool orientation before deployment.
 */
function quaternionFromRz(rz: number): [number, number, number, number] {
  const half = rz / 2;
  return [Math.cos(half), 0, 0, Math.sin(half)];
}

export function toRapid(policy: TaskPolicy, taskTitle: string): string {
  const policyId = policyHash(policy);
  const timestamp = new Date().toISOString();

  const declarations: string[] = [
    `    CONST robtarget pHome:=[[0,0,600,0],[1,0,0,0],[0,0,0,0],[9E9,9E9,9E9,9E9,9E9,9E9]];`,
    `    PERS bool doGripperClose:=FALSE;`,
  ];
  const body: string[] = [];

  policy.steps.forEach((step, index) => {
    const { x, y, z, rz = 0 } = step.target;
    const [q1, q2, q3, q4] = quaternionFromRz(rz);
    const targetName = `pTarget${index + 1}`;
    declarations.push(
      `    CONST robtarget ${targetName}:=[[${fmt(x * 1000, 2)},${fmt(y * 1000, 2)},${fmt(z * 1000, 2)}],[${fmt(q1)},${fmt(q2)},${fmt(q3)},${fmt(q4)}],[0,0,0,0],[9E9,9E9,9E9,9E9,9E9,9E9]];`,
    );

    body.push(`        ! ${step.order}. ${escapeForString(step.description)} [${step.action}]`);
    const speedMmS = Math.max(1, Math.round(step.speed * 1000));

    if (step.action === "home") {
      body.push(`        MoveJ pHome, v500, fine, tool0;`);
    } else if (step.action === "grip") {
      body.push(`        MoveL ${targetName}, v${Math.min(speedMmS, 100)}, fine, tool0;`);
      body.push(`        Set doGripperClose;`);
      body.push(`        WaitTime 0.4;`);
    } else if (step.action === "release") {
      body.push(`        MoveL ${targetName}, v${Math.min(speedMmS, 100)}, fine, tool0;`);
      body.push(`        Reset doGripperClose;`);
      body.push(`        WaitTime 0.4;`);
    } else if (step.action === "wait") {
      body.push(`        WaitTime ${fmt(step.duration)};`);
    } else {
      body.push(`        MoveL ${targetName}, v${speedMmS}, z10, tool0;`);
      if (step.action === "inspect" && step.requiresVision) {
        body.push(`        ! vision check inserted by AUREVIX`);
        body.push(`        TPWrite "inspect ${escapeForString(step.description)}";`);
      }
    }
  });

  return [
    `MODULE AurevixSkill`,
    `    ! AUREVIX // generated ABB RAPID program`,
    `    ! Task: ${escapeForString(taskTitle)}`,
    `    ! Generated: ${timestamp}`,
    `    ! Policy ID: ${policyId}`,
    `    ! Steps: ${policy.steps.length}  Cycle: ~${policy.estimatedCycleSeconds}s`,
    `    ! Tool frame: ${policy.toolFrame}`,
    `    ! Coordinates converted from meters (Aurevix) to millimeters (RAPID).`,
    `    !`,
    ...declarations,
    ``,
    `    PROC main()`,
    ...body,
    `        TPWrite "AUREVIX skill complete";`,
    `    ENDPROC`,
    `ENDMODULE`,
  ].join("\n");
}

export function toFanucKarel(policy: TaskPolicy, taskTitle: string): string {
  const policyId = policyHash(policy);
  const timestamp = new Date().toISOString();
  const programName = "aurevix_skill";
  const toDeg = (rad: number) => (rad * 180) / Math.PI;

  const declarations: string[] = [];
  const body: string[] = [];

  policy.steps.forEach((step, index) => {
    const name = `p${index + 1}`;
    declarations.push(`  ${name}: POSITION`);
    const { x, y, z, rx = 0, ry = 0, rz = 0 } = step.target;

    body.push(`  -- ${step.order}. ${escapeForString(step.description)} [${step.action}]`);
    body.push(
      `  ${name} := POS(${fmt(x * 1000, 1)}, ${fmt(y * 1000, 1)}, ${fmt(z * 1000, 1)}, ${fmt(toDeg(rx), 1)}, ${fmt(toDeg(ry), 1)}, ${fmt(toDeg(rz), 1)}, '')`,
    );

    if (step.action === "home") {
      body.push(`  MOVE TO home`);
    } else if (step.action === "grip") {
      body.push(`  MOVE TO ${name} WITH $TERM_TYPE = FINE`);
      body.push(`  DOUT[1] = ON`);
      body.push(`  DELAY 400`);
    } else if (step.action === "release") {
      body.push(`  MOVE TO ${name} WITH $TERM_TYPE = FINE`);
      body.push(`  DOUT[1] = OFF`);
      body.push(`  DELAY 400`);
    } else if (step.action === "wait") {
      body.push(`  DELAY ${Math.round(step.duration * 1000)}`);
    } else {
      body.push(`  MOVE TO ${name}`);
      if (step.action === "inspect" && step.requiresVision) {
        body.push(`  -- vision check inserted by AUREVIX`);
        body.push(`  WRITE('inspect ${escapeForString(step.description)}', CR)`);
      }
    }
  });

  return [
    `PROGRAM ${programName}`,
    `  -- AUREVIX // generated FANUC Karel program`,
    `  -- Task: ${escapeForString(taskTitle)}`,
    `  -- Generated: ${timestamp}`,
    `  -- Policy ID: ${policyId}`,
    `  -- Steps: ${policy.steps.length}  Cycle: ~${policy.estimatedCycleSeconds}s`,
    `  -- Tool frame: ${policy.toolFrame}`,
    `  -- Coordinates converted from meters (Aurevix) to millimeters (Karel); rotations in degrees.`,
    `VAR`,
    `  home: POSITION`,
    ...declarations,
    `BEGIN`,
    `  home := POS(0, 0, 600, 0, 0, 0, '')`,
    `  MOVE TO home`,
    ...body,
    `  WRITE('AUREVIX skill complete', CR)`,
    `END ${programName}`,
  ].join("\n");
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
