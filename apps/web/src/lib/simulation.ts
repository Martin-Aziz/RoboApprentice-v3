import type { PolicyReviewSummary, SceneObject, TaskPolicy } from "./types";
import { resolveSceneForPolicy, findCarryPairs } from "./scene-model";
import { createHash } from "crypto";
import { summarizePolicyReview } from "./policy-review";

export interface SimulationManifest {
  format_version: "1.1";
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
  scene: {
    source: string;
    confidence: number;
    objects: Array<{
      id: string;
      label: string;
      role: string;
      category: string;
      confidence: number;
      visual_fidelity?: string;
      size?: { x: number; y: number; z: number };
      pose?: { x: number; y: number; z: number; yaw?: number };
      review_required_reason?: string;
    }>;
    warnings: string[];
  };
  review: {
    headline: string;
    recommended_action: string;
    ready_steps: number;
    review_steps: number;
    blocked_steps: number;
    average_confidence: number;
    validation_scope: string;
  };
}

function policyHash(policy: TaskPolicy): string {
  const content = JSON.stringify(policy.steps);
  return createHash("sha256").update(content).digest("hex").slice(0, 16);
}

export function buildManifest(policy: TaskPolicy, taskTitle: string): SimulationManifest {
  const scene = resolveSceneForPolicy(policy);
  const review = policy.reviewSummary ?? summarizePolicyReview(policy);
  return {
    format_version: "1.1",
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
    scene: {
      source: scene.source,
      confidence: scene.confidence,
      objects: scene.objects.map((o) => ({
        id: o.id,
        label: o.label,
        role: o.role,
        category: o.category,
        confidence: o.confidence,
        visual_fidelity: o.visualFidelity,
        size: o.sizeHint,
        pose: o.poseHint,
        review_required_reason: o.reviewRequiredReason,
      })),
      warnings: scene.warnings,
    },
    review: {
      headline: review.headline,
      recommended_action: review.recommendedAction,
      ready_steps: review.readySteps,
      review_steps: review.reviewSteps,
      blocked_steps: review.blockedSteps,
      average_confidence: review.averageConfidence,
      validation_scope:
        "Visual review plus heuristic kinematic screening only. This manifest is not a collision-planned or physics-validated commissioning result.",
    },
  };
}

const fmt = (n: number) => Number(n.toFixed(4)).toString();

/** Open-top container categories: rendered without a top face. */
const OPEN_TOP = new Set<SceneObject["category"]>(["tote", "bin", "tray"]);

function pySceneObjectLines(objects: SceneObject[]): string {
  return objects
    .filter((o) => o.poseHint)
    .map((o) => {
      const size = o.sizeHint ?? { x: 0.12, y: 0.12, z: 0.1 };
      const pose = o.poseHint!;
      const shape = o.category === "cylinder" ? "cylinder" : OPEN_TOP.has(o.category) ? "open_box" : "box";
      return `    {"id": ${JSON.stringify(o.id)}, "label": ${JSON.stringify(o.label)}, "role": "${o.role}", "category": "${o.category}", "shape": "${shape}", "size": (${fmt(size.x)}, ${fmt(size.y)}, ${fmt(size.z)}), "pose": (${fmt(pose.x)}, ${fmt(pose.y)}, ${fmt(pose.z)}), "yaw": ${fmt(pose.yaw ?? 0)}, "fidelity": "${o.visualFidelity ?? "proxy"}", "confidence": ${fmt(o.confidence)}},`;
    })
    .join("\n");
}

/**
 * Exports a self-contained matplotlib review artifact. Beyond the waypoint
 * animation this renders the interpreted scene objects (with class-specific
 * wireframes and open-top containers), colors the path by motion phase,
 * carries a payload marker between grip and release, annotates contact
 * events, and prints explicit caution text for proxy-fidelity geometry.
 */
export function buildPythonSimulator(policy: TaskPolicy, taskTitle: string): string {
  const policyId = policyHash(policy);
  const timestamp = new Date().toISOString();
  const scene = resolveSceneForPolicy(policy);
  const review = policy.reviewSummary ?? summarizePolicyReview(policy);
  const carryPairs = findCarryPairs(policy.steps);

  const waypointLines = policy.steps
    .map(
      (s) =>
        `    {"order": ${s.order}, "action": "${s.action}", "gripper": "${s.gripper}", "speed": ${fmt(s.speed)}, "duration": ${s.duration}, "pose": (${fmt(s.target.x)}, ${fmt(s.target.y)}, ${fmt(s.target.z)}), "yaw": ${fmt(s.target.rz ?? 0)}, "label": ${JSON.stringify(s.description)}},`,
    )
    .join("\n");
  const carryLines = carryPairs.map((p) => `    (${p.pickIndex}, ${p.placeIndex}),`).join("\n");
  const proxyCount = scene.objects.filter((o) => (o.visualFidelity ?? "proxy") !== "cad_matched").length;
  const safeTitle = taskTitle.replace(/["\\]/g, "");

  return `"""AUREVIX simulator — task: ${safeTitle}

Generated: ${timestamp}
Policy ID: ${policyId}
Scene source: ${scene.source} (confidence ${scene.confidence.toFixed(2)})
Policy review: ${review.headline}

Run with:
    pip install matplotlib numpy
    python simulate.py

Animates the planned waypoints in 3D with the interpreted workcell objects so
a factory operator can review the trajectory before deploying to hardware.

CAUTION: the path shown is straight waypoint interpolation, NOT a
collision-planned trajectory. Scene objects are approximate proxies unless
labelled otherwise.
"""

try:
    import numpy as np
    import matplotlib.pyplot as plt
    from mpl_toolkits.mplot3d import Axes3D  # noqa: F401
    from mpl_toolkits.mplot3d.art3d import Poly3DCollection
    from matplotlib.animation import FuncAnimation
except ImportError:
    raise SystemExit("Please run: pip install matplotlib numpy")


POLICY_ID = "${policyId}"
TASK_TITLE = "${safeTitle}"
SCENE_SOURCE = "${scene.source}"
PROXY_OBJECT_COUNT = ${proxyCount}
REVIEW_HEADLINE = "${review.headline.replace(/["\\]/g, "")}"
REVIEW_RECOMMENDED_ACTION = "${review.recommendedAction.replace(/["\\]/g, "")}"
REVIEW_BLOCKED_STEPS = ${review.blockedSteps}
REVIEW_STEPS = ${review.reviewSteps}

WAYPOINTS = [
${waypointLines}
]

# (pick_step_index, place_step_index) pairs — payload is carried in between.
CARRY_PAIRS = [
${carryLines}
]

SCENE_OBJECTS = [
${pySceneObjectLines(scene.objects)}
]

PHASE_COLORS = {
    "transit": "#5b8dd9",
    "approach": "#00b8d9",
    "contact": "#e5484d",
    "carry": "#e8a33d",
    "home": "#8f7ee7",
}

ROLE_COLORS = {
    "workpiece": "#e8a33d",
    "source": "#e8a33d",
    "destination": "#4cc38a",
    "container": "#4cc38a",
    "fixture": "#9aa4b2",
    "inspection_surface": "#00b8d9",
    "tool": "#9aa4b2",
    "unknown": "#6c7683",
}


def segment_phase(index, gripper_closed):
    """Motion phase of the segment ending at the given waypoint index."""
    action = WAYPOINTS[index]["action"] if 0 <= index < len(WAYPOINTS) else "home"
    if action in ("grip", "release"):
        return "contact"
    if action == "approach":
        return "approach"
    if action == "home":
        return "home"
    return "carry" if gripper_closed else "transit"


def rotz(yaw):
    c, s = np.cos(yaw), np.sin(yaw)
    return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]])


def draw_box(ax, obj, open_top=False):
    sx, sy, sz = obj["size"]
    px, py, pz = obj["pose"]
    R = rotz(obj["yaw"])
    corners = np.array([
        [dx * sx / 2, dy * sy / 2, dz * sz]
        for dx, dy, dz in [(-1, -1, 0), (1, -1, 0), (1, 1, 0), (-1, 1, 0),
                           (-1, -1, 1), (1, -1, 1), (1, 1, 1), (-1, 1, 1)]
    ]) @ R.T + np.array([px, py, pz])
    faces = [
        [0, 1, 2, 3],              # bottom
        [0, 1, 5, 4], [1, 2, 6, 5],  # sides
        [2, 3, 7, 6], [3, 0, 4, 7],
    ]
    if not open_top:
        faces.append([4, 5, 6, 7])  # top
    color = ROLE_COLORS.get(obj["role"], "#6c7683")
    poly = Poly3DCollection([corners[f] for f in faces], alpha=0.18,
                            facecolor=color, edgecolor=color, linewidths=0.8)
    ax.add_collection3d(poly)
    fid = "" if obj["fidelity"] == "cad_matched" else " (proxy)"
    ax.text(px, py, pz + sz + 0.02, obj["label"] + fid, fontsize=7, color=color)


def draw_cylinder(ax, obj):
    sx, sy, sz = obj["size"]
    px, py, pz = obj["pose"]
    radius = max(sx, sy) / 2
    theta = np.linspace(0, 2 * np.pi, 24)
    color = ROLE_COLORS.get(obj["role"], "#6c7683")
    for zc in (pz, pz + sz):
        ax.plot(px + radius * np.cos(theta), py + radius * np.sin(theta),
                zc, color=color, alpha=0.55, linewidth=0.9)
    for angle in np.linspace(0, 2 * np.pi, 8, endpoint=False):
        ax.plot([px + radius * np.cos(angle)] * 2,
                [py + radius * np.sin(angle)] * 2,
                [pz, pz + sz], color=color, alpha=0.3, linewidth=0.7)
    ax.text(px, py, pz + sz + 0.02, obj["label"] + " (proxy)", fontsize=7, color=color)


def draw_scene(ax):
    for obj in SCENE_OBJECTS:
        if obj["shape"] == "cylinder":
            draw_cylinder(ax, obj)
        else:
            draw_box(ax, obj, open_top=(obj["shape"] == "open_box"))


def interp(p0, p1, t):
    return tuple(p0[i] + (p1[i] - p0[i]) * t for i in range(3))


def trajectory(samples_per_step=24):
    home = (0.0, 0.0, 0.6)
    poses = [home] + [w["pose"] for w in WAYPOINTS] + [home]
    points, phases, gripper_open, carrying = [], [], [], []
    g_state = 1.0
    closed = False
    for i in range(len(poses) - 1):
        target_index = i  # segment ends at WAYPOINTS[i] (0-based)
        for k in range(samples_per_step):
            t = k / samples_per_step
            points.append(interp(poses[i], poses[i + 1], t))
            phases.append(segment_phase(target_index, closed))
            if target_index < len(WAYPOINTS):
                g = WAYPOINTS[target_index]["gripper"]
                if g == "closed":
                    g_state = max(0.0, g_state - 1.0 / samples_per_step)
                elif g == "open":
                    g_state = min(1.0, g_state + 1.0 / samples_per_step)
            gripper_open.append(g_state)
            carrying.append(closed)
        if target_index < len(WAYPOINTS):
            g = WAYPOINTS[target_index]["gripper"]
            if g == "closed":
                closed = True
            elif g == "open":
                closed = False
    points.append(poses[-1])
    phases.append("home")
    gripper_open.append(g_state)
    carrying.append(False)
    return points, phases, gripper_open, carrying


def main():
    points, phases, gripper_open, carrying = trajectory()
    xs = [p[0] for p in points]
    ys = [p[1] for p in points]
    zs = [p[2] for p in points]

    fig = plt.figure(figsize=(12, 8))
    ax = fig.add_subplot(111, projection="3d")
    ax.set_xlabel("X (m)")
    ax.set_ylabel("Y (m)")
    ax.set_zlabel("Z (m)")
    ax.set_title(f"AUREVIX simulation: {TASK_TITLE} [policy={POLICY_ID}]")
    ax.text2D(0.02, 0.98, REVIEW_HEADLINE, transform=ax.transAxes, fontsize=9,
              color="#d97706" if REVIEW_BLOCKED_STEPS or REVIEW_STEPS else "#059669", va="top")
    ax.text2D(0.02, 0.94, REVIEW_RECOMMENDED_ACTION, transform=ax.transAxes, fontsize=8,
              color="#475569", va="top")
    ax.set_xlim(-0.8, 0.8)
    ax.set_ylim(-0.8, 0.8)
    ax.set_zlim(0.0, 1.0)

    draw_scene(ax)

    # Phase-colored static path (segment by segment).
    for i in range(len(points) - 1):
        ax.plot(xs[i:i + 2], ys[i:i + 2], zs[i:i + 2],
                color=PHASE_COLORS[phases[i + 1]], alpha=0.35, linewidth=1)

    # Waypoints + contact-event annotations.
    for w in WAYPOINTS:
        contact = w["action"] in ("grip", "release")
        ax.scatter(*w["pose"], s=52 if contact else 30,
                   color="#e5484d" if contact else "#ffa040",
                   marker="^" if contact else "o")
        if contact:
            ax.text(w["pose"][0], w["pose"][1], w["pose"][2] - 0.05,
                    f"{w['action']} (step {w['order']})", fontsize=7, color="#e5484d")

    line, = ax.plot([], [], [], color="#00c8ff", linewidth=2)
    point, = ax.plot([], [], [], "o", color="#ffa040", markersize=8)
    payload, = ax.plot([], [], [], "s", color="#e8a33d", markersize=6)
    text = ax.text2D(0.02, 0.95, "", transform=ax.transAxes)
    caution = ("CAUTION: straight waypoint interpolation, not a collision-planned path. "
               f"{PROXY_OBJECT_COUNT} scene object(s) are approximate proxies "
               f"(scene source: {SCENE_SOURCE}).")
    ax.text2D(0.02, 0.02, caution, transform=ax.transAxes, fontsize=7, color="#e5484d")

    def update(frame):
        line.set_data(xs[: frame + 1], ys[: frame + 1])
        line.set_3d_properties(zs[: frame + 1])
        point.set_data([xs[frame]], [ys[frame]])
        point.set_3d_properties([zs[frame]])
        if carrying[frame]:
            payload.set_data([xs[frame]], [ys[frame]])
            payload.set_3d_properties([zs[frame] - 0.04])
        else:
            payload.set_data([], [])
            payload.set_3d_properties([])
        text.set_text(f"phase={phases[frame]}  gripper_open={gripper_open[frame]:.2f}"
                      f"  payload={'held' if carrying[frame] else 'none'}")
        return line, point, payload, text

    anim = FuncAnimation(fig, update, frames=len(points), interval=40, blit=False, repeat=True)
    print(f"Loaded {len(WAYPOINTS)} waypoints, {len(SCENE_OBJECTS)} scene object(s).")
    print(f"Estimated cycle: {sum(w['duration'] for w in WAYPOINTS):.1f}s")
    print(f"Policy: {POLICY_ID}")
    print(caution)
    plt.tight_layout()
    plt.show()


if __name__ == "__main__":
    main()
`;
}
