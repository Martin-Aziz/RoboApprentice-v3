import type { Facility, LocaleCode, Robot, Skill, SkillExecution, TaskPolicy, TaskStep } from "@/lib/types";

export type DemoLocale = LocaleCode;

export const DEMO_USER = {
  id: "demo-user-0000-0000-0000-000000000000",
  email: "",
  name: "Local Session",
  role: "admin",
  created_at: new Date().toISOString(),
};

export const DEMO_FACILITIES: Facility[] = [
  {
    id: "fac-production-001",
    name: "Production Facility",
    owner_id: DEMO_USER.id,
    created_at: "2025-09-14T08:00:00Z",
    region: "EU",
  },
];

export const DEMO_ROBOTS: Robot[] = [
  {
    id: "rbt-ur5e-001",
    facility_id: "fac-production-001",
    name: "Assembly Cell 1",
    brand: "Universal Robots",
    model: "UR5e",
    status: "idle",
    ip_address: "10.42.0.21",
    last_seen_at: new Date(Date.now() - 5 * 60_000).toISOString(),
    created_at: "2025-09-15T10:00:00Z",
    current_skill_id: "skl-pick-bracket-a",
    metrics: { uptime_24h: 98.2, cycles_today: 1247, mean_cycle_ms: 3800 },
  },
  {
    id: "rbt-kuka-001",
    facility_id: "fac-production-001",
    name: "Welding Station 3",
    brand: "KUKA",
    model: "KR 6 R900",
    status: "running",
    ip_address: "10.42.0.34",
    last_seen_at: new Date().toISOString(),
    created_at: "2025-10-02T14:30:00Z",
    current_skill_id: "skl-weld-chassis",
    metrics: { uptime_24h: 99.4, cycles_today: 892, mean_cycle_ms: 5200 },
  },
  {
    id: "rbt-techman-001",
    facility_id: "fac-production-001",
    name: "Quality Inspection Cell",
    brand: "Techman",
    model: "TM12",
    status: "idle",
    ip_address: "10.42.0.48",
    last_seen_at: new Date(Date.now() - 12 * 60_000).toISOString(),
    created_at: "2025-11-20T09:15:00Z",
    current_skill_id: "skl-inspect-pcb",
    metrics: { uptime_24h: 97.1, cycles_today: 2105, mean_cycle_ms: 1800 },
  },
  {
    id: "rbt-fanuc-001",
    facility_id: "fac-production-001",
    name: "Machine Tend Cell 2",
    brand: "FANUC",
    model: "LR Mate 200iD",
    status: "running",
    ip_address: "10.42.0.55",
    last_seen_at: new Date(Date.now() - 2 * 60_000).toISOString(),
    created_at: "2025-12-08T07:45:00Z",
    current_skill_id: "skl-pack-tray",
    metrics: { uptime_24h: 96.8, cycles_today: 1583, mean_cycle_ms: 2600 },
  },
  {
    id: "rbt-yaskawa-001",
    facility_id: "fac-production-001",
    name: "Palletizing Cell 4",
    brand: "Yaskawa",
    model: "Motoman GP12",
    status: "offline",
    ip_address: "10.42.0.61",
    last_seen_at: new Date(Date.now() - 45 * 60_000).toISOString(),
    created_at: "2026-01-12T16:20:00Z",
    metrics: { uptime_24h: 91.5, cycles_today: 0, mean_cycle_ms: 4100 },
  },
];

export const DEMO_SKILLS: Skill[] = [
  {
    id: "skl-pick-bracket-a",
    facility_id: "fac-production-001",
    name: "Pick Bracket A",
    description: "Pick metal bracket from conveyor, orient, place in assembly fixture",
    task_language: "en",
    confidence: 0.94,
    status: "ready",
    run_count: 1247,
    success_count: 1219,
    created_by: DEMO_USER.id,
    created_at: "2025-09-20T11:00:00Z",
    updated_at: "2026-05-20T08:30:00Z",
    last_executed_at: new Date(Date.now() - 90_000).toISOString(),
    mean_cycle_ms: 3800,
  },
  {
    id: "skl-weld-chassis",
    facility_id: "fac-production-001",
    name: "Spot Weld Chassis Bracket",
    description: "Three-point spot weld on lower chassis bracket assembly",
    task_language: "en",
    confidence: 0.91,
    status: "ready",
    run_count: 892,
    success_count: 866,
    created_by: DEMO_USER.id,
    created_at: "2025-10-05T13:00:00Z",
    updated_at: "2026-05-22T14:00:00Z",
    last_executed_at: new Date(Date.now() - 25_000).toISOString(),
    mean_cycle_ms: 5200,
  },
  {
    id: "skl-inspect-pcb",
    facility_id: "fac-production-001",
    name: "Inspect PCB Solder Joints",
    description: "Vision-based inspection of 32 solder joints on PCB",
    task_language: "en",
    confidence: 0.88,
    status: "ready",
    run_count: 2105,
    success_count: 2031,
    created_by: DEMO_USER.id,
    created_at: "2025-11-22T10:00:00Z",
    updated_at: "2026-05-23T06:00:00Z",
    last_executed_at: new Date(Date.now() - 5_000).toISOString(),
    mean_cycle_ms: 1800,
  },
  {
    id: "skl-pack-tray",
    facility_id: "fac-production-001",
    name: "Pack Components in Tray",
    description: "Sort and place 12 components in shipping tray, 4x3 grid",
    task_language: "en",
    confidence: 0.76,
    status: "training",
    run_count: 47,
    success_count: 36,
    created_by: DEMO_USER.id,
    created_at: "2026-05-15T09:00:00Z",
    updated_at: "2026-05-23T05:00:00Z",
  },
  {
    id: "skl-degraded-example",
    facility_id: "fac-production-001",
    name: "Place Connector (drift detected)",
    description: "Connector placement on motherboard - confidence dropping over last 14 days",
    task_language: "en",
    confidence: 0.68,
    status: "ready",
    run_count: 423,
    success_count: 358,
    created_by: DEMO_USER.id,
    created_at: "2026-02-10T11:00:00Z",
    updated_at: "2026-05-22T18:00:00Z",
    drift_alert: "Confidence dropped 18% in 14 days - re-demonstrate recommended",
  },
];

export function generateExecutionHistory(): SkillExecution[] {
  const robots = DEMO_ROBOTS;
  const readySkills = DEMO_SKILLS.filter((skill) => skill.status === "ready");
  return Array.from({ length: 50 }, (_, index) => {
    const skill = readySkills[index % readySkills.length];
    const robot = robots[index % robots.length];
    const started = Date.now() - (50 - index) * 3.2 * 60 * 60 * 1000;
    const base = skill.mean_cycle_ms ?? 4200;
    const variance = Math.sin(index * 1.7) * 0.16 + Math.cos(index * 0.5) * 0.07;
    const cycle = Math.round(base * (1 + variance));
    const success = ((index * 37) % 100) / 100 < skill.confidence;
    return {
      id: `exe-demo-${index.toString().padStart(3, "0")}`,
      skill_id: skill.id,
      robot_id: robot.id,
      status: success ? ("completed" as const) : ("failed" as const),
      started_at: new Date(started).toISOString(),
      completed_at: new Date(started + cycle).toISOString(),
      parts_processed: success ? 1 : 0,
      error_message: success ? null : "Quality threshold missed during placement verification",
      cycle_ms: cycle,
      quality_score: Math.max(0.62, Math.min(0.99, skill.confidence + Math.sin(index) * 0.05)),
    };
  }).reverse();
}

export const DEMO_EXECUTIONS = generateExecutionHistory();
export const DEMO_VIDEO_URL = "/demos/multitask.mp4";

export const FALLBACK_STEPS: TaskStep[] = [
  { id: "step-1", order: 1, description: "Move to home position above the workbench", action: "home", target: { x: 0.25, y: 0, z: 0.34 }, gripper: "open", speed: 0.25, duration: 2 },
  { id: "step-2", order: 2, description: "Approach the component on the right side of the table", action: "approach", target: { x: 0.38, y: -0.16, z: 0.18 }, gripper: "open", speed: 0.2, duration: 3 },
  { id: "step-3", order: 3, description: "Open gripper around the component", action: "grip", target: { x: 0.38, y: -0.16, z: 0.11 }, gripper: "open", speed: 0.08, duration: 1 },
  { id: "step-4", order: 4, description: "Close gripper on the component and verify grip", action: "grip", target: { x: 0.38, y: -0.16, z: 0.08 }, gripper: "closed", speed: 0.06, duration: 2, requiresVision: true },
  { id: "step-5", order: 5, description: "Lift the component clear of the table", action: "move", target: { x: 0.34, y: -0.12, z: 0.24 }, gripper: "closed", speed: 0.22, duration: 2 },
  { id: "step-6", order: 6, description: "Rotate the component 90 degrees while carrying it toward the fixture block", action: "rotate", target: { x: 0.16, y: 0.19, z: 0.24, rz: 1.5708 }, gripper: "closed", speed: 0.18, duration: 2 },
  { id: "step-7", order: 7, description: "Set the component down beside the fixture block", action: "release", target: { x: 0.12, y: 0.24, z: 0.1, rz: 1.5708 }, gripper: "open", speed: 0.1, duration: 3 },
  { id: "step-8", order: 8, description: "Retract clear of the workpiece", action: "move", target: { x: 0.2, y: 0.12, z: 0.32 }, gripper: "open", speed: 0.24, duration: 2 },
];

export const FALLBACK_POLICY: TaskPolicy = {
  steps: FALLBACK_STEPS,
  toolFrame: "tcp_precision_gripper",
  workspaceBounds: { xMin: -0.6, xMax: 0.6, yMin: -0.5, yMax: 0.5, zMin: 0.02, zMax: 0.55 },
  estimatedCycleSeconds: 4.2,
};
