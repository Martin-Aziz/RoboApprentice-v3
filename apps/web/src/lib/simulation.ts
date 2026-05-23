import type { TaskPolicy } from "./types";
import { createHash } from "crypto";

export interface SimulationManifest {
  format_version: "1.0";
  task_title: string;
  policy_id: string;
  generated_at: string;
  tool_frame: string;
  estimated_cycle_seconds: number;
  step_count: number;
  waypoints: Array<{
    order: number;
    description: string;
    action: string;
    gripper: string;
    speed: number;
    duration: number;
    pose: { x: number; y: number; z: number; rx?: number; ry?: number; rz?: number };
  }>;
}

function policyHash(policy: TaskPolicy): string {
  const content = JSON.stringify(policy.steps);
  return createHash("sha256").update(content).digest("hex").slice(0, 16);
}

export function buildManifest(policy: TaskPolicy, taskTitle: string): SimulationManifest {
  return {
    format_version: "1.0",
    task_title: taskTitle,
    policy_id: policyHash(policy),
    generated_at: new Date().toISOString(),
    tool_frame: policy.toolFrame,
    estimated_cycle_seconds: policy.estimatedCycleSeconds,
    step_count: policy.steps.length,
    waypoints: policy.steps.map((s) => ({
      order: s.order,
      description: s.description,
      action: s.action,
      gripper: s.gripper,
      speed: s.speed,
      duration: s.duration,
      pose: s.target,
    })),
  };
}

export function buildPythonSimulator(policy: TaskPolicy, taskTitle: string): string {
  const policyId = policyHash(policy);
  const timestamp = new Date().toISOString();
  const fmt = (n: number) => Number(n.toFixed(4)).toString();
  const waypointLines = policy.steps
    .map(
      (s) =>
        `    {"order": ${s.order}, "action": "${s.action}", "gripper": "${s.gripper}", "speed": ${fmt(s.speed)}, "duration": ${s.duration}, "pose": (${fmt(s.target.x)}, ${fmt(s.target.y)}, ${fmt(s.target.z)}), "label": ${JSON.stringify(s.description)}},`,
    )
    .join("\n");

  return `"""AUREVIX simulator — task: ${taskTitle.replace(/"/g, '\\"')}

Generated: ${timestamp}
Policy ID: ${policyId}

Run with:
    pip install matplotlib numpy
    python simulate.py

Animates the planned waypoints in 3D so a factory operator can preview the
robot's trajectory before deploying to real hardware.
"""

import time
import math

try:
    import numpy as np
    import matplotlib.pyplot as plt
    from mpl_toolkits.mplot3d import Axes3D  # noqa: F401
    from matplotlib.animation import FuncAnimation
except ImportError:
    raise SystemExit("Please run: pip install matplotlib numpy")


POLICY_ID = "${policyId}"
WAYPOINTS = [
${waypointLines}
]


def interp(p0, p1, t):
    return tuple(p0[i] + (p1[i] - p0[i]) * t for i in range(3))


def trajectory(samples_per_step=24):
    home = (0.0, 0.0, 0.6)
    poses = [home] + [w["pose"] for w in WAYPOINTS] + [home]
    actions = ["home"] + [w["action"] for w in WAYPOINTS] + ["home"]
    grippers = ["open"] + [w["gripper"] for w in WAYPOINTS] + ["open"]
    points = []
    meta = []
    g_state = 1.0
    for i in range(len(poses) - 1):
        for k in range(samples_per_step):
            t = k / samples_per_step
            points.append(interp(poses[i], poses[i + 1], t))
            if grippers[i + 1] == "closed":
                g_state = max(0.0, g_state - 1.0 / samples_per_step)
            elif grippers[i + 1] == "open":
                g_state = min(1.0, g_state + 1.0 / samples_per_step)
            meta.append((actions[i + 1], g_state))
    points.append(poses[-1])
    meta.append(("home", g_state))
    return points, meta


def main():
    points, meta = trajectory()
    xs = [p[0] for p in points]
    ys = [p[1] for p in points]
    zs = [p[2] for p in points]

    fig = plt.figure(figsize=(12, 8))
    ax = fig.add_subplot(111, projection="3d")
    ax.set_xlabel("X (m)")
    ax.set_ylabel("Y (m)")
    ax.set_zlabel("Z (m)")
    ax.set_title(f"AUREVIX simulation: {taskTitle.replace(chr(34), '')} [policy=${policyId}]")
    ax.set_xlim(-0.8, 0.8)
    ax.set_ylim(-0.8, 0.8)
    ax.set_zlim(0.0, 1.0)

    # Trajectory path
    ax.plot(xs, ys, zs, color="#00c8ff", alpha=0.4, linewidth=1)

    # Waypoints
    for w in WAYPOINTS:
        ax.scatter(*w["pose"], s=40, color="#ffa040")

    line, = ax.plot([], [], [], color="#00c8ff", linewidth=2)
    point, = ax.plot([], [], [], "o", color="#ffa040", markersize=8)
    text = ax.text2D(0.02, 0.95, "", transform=ax.transAxes)

    def update(frame):
        line.set_data(xs[: frame + 1], ys[: frame + 1])
        line.set_3d_properties(zs[: frame + 1])
        point.set_data([xs[frame]], [ys[frame]])
        point.set_3d_properties([zs[frame]])
        action, gripper = meta[frame]
        text.set_text(f"action={action}  gripper_open={gripper:.2f}")
        return line, point, text

    anim = FuncAnimation(fig, update, frames=len(points), interval=40, blit=False, repeat=True)
    print(f"Loaded {len(WAYPOINTS)} waypoints.")
    print(f"Estimated cycle: {sum(w['duration'] for w in WAYPOINTS):.1f}s")
    print(f"Policy: {POLICY_ID}")
    plt.tight_layout()
    plt.show()


if __name__ == "__main__":
    main()
`;
}
