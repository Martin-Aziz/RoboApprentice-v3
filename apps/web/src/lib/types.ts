export type LocaleCode = "en-US" | "en-GB" | "de-DE" | "es-ES" | "zh-CN" | "ja-JP";

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: User;
}

export interface Facility {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
  region?: string;
}

export type RobotStatus = "offline" | "idle" | "busy" | "running" | "error" | "e_stopped";

export interface Robot {
  id: string;
  facility_id: string;
  name: string;
  brand: string;
  model: string;
  status: RobotStatus;
  ip_address: string | null;
  last_seen_at: string | null;
  created_at: string;
  metrics?: { uptime_24h: number; cycles_today: number; mean_cycle_ms: number };
  current_skill_id?: string;
}

export type SkillStatus = "draft" | "training" | "ready" | "archived";

export interface Skill {
  id: string;
  facility_id: string;
  name: string;
  description: string | null;
  task_language: string;
  confidence: number;
  status: SkillStatus;
  run_count: number;
  success_count: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  last_executed_at?: string;
  mean_cycle_ms?: number;
  drift_alert?: string;
}

export interface SkillListResponse {
  skills: Skill[];
  total: number;
  page: number;
  per_page: number;
}

export interface Demonstration {
  id: string;
  skill_id: string;
  video_path: string | null;
  voice_transcript: string | null;
  quality_score: number | null;
  created_at: string;
}

export type ExecutionStatus = "started" | "running" | "completed" | "failed" | "stopped";

export interface SkillExecution {
  id: string;
  skill_id: string;
  robot_id: string;
  status: ExecutionStatus;
  started_at: string;
  completed_at: string | null;
  parts_processed: number;
  error_message: string | null;
  cycle_ms?: number;
  quality_score?: number;
}

export type TaskStatus = "pending" | "processing" | "done" | "error";

export type RobotAction =
  | "move"
  | "approach"
  | "grip"
  | "release"
  | "rotate"
  | "wait"
  | "inspect"
  | "home";

export type GripperState = "open" | "closed" | "unchanged";

export interface Waypoint {
  x: number; // meters, robot base frame
  y: number;
  z: number;
  rx?: number; // tool rotation (rad)
  ry?: number;
  rz?: number;
}

export interface TaskStep {
  id: string;
  order: number;
  description: string;
  action: RobotAction;
  target: Waypoint;
  gripper: GripperState;
  speed: number; // m/s, 0.05–0.5
  duration: number; // seconds, integer 1–30
  requiresVision?: boolean;
  notes?: string;
}

export interface TaskPolicy {
  steps: TaskStep[];
  toolFrame: string; // e.g., "tcp_default"
  workspaceBounds?: { xMin: number; xMax: number; yMin: number; yMax: number; zMin: number; zMax: number };
  estimatedCycleSeconds: number;
}

export type FeedbackVerdict = "success" | "partial" | "failed";

export interface TaskFeedback {
  verdict: FeedbackVerdict;
  rating: number; // 1-5
  reportedBy?: string;
  notes?: string;
  failedStepIds?: string[];
  createdAt: string;
}

export interface Task {
  id: string;
  facility_id: string;
  title: string;
  description?: string;
  videoUrl: string;
  transcript?: string;
  status: TaskStatus;
  steps: TaskStep[];
  policy?: TaskPolicy;
  feedback?: TaskFeedback[];
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
  targetRobotModels?: string[];
  gripperConfig?: string;
}

export type TaskVersionStatus = "active" | "archived";

export interface TaskVersion {
  version_id: string;
  task_id: string;
  version_number: number;
  facility_id: string;
  title: string;
  description?: string;
  steps: TaskStep[];
  policy?: TaskPolicy;
  created_by?: string;
  created_at: string;
  status: TaskVersionStatus;
}

export interface CloudTaskLibrary {
  task_id: string;
  facility_id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  current_version: number;
  total_versions: number;
  created_by?: string;
  created_at: string;
  updated_at: string;
  archivedAt?: string;
  targetRobotModels?: string[];
  gripperConfig?: string;
  confidence?: number;
  lastExecutedAt?: string;
}

export interface SessionPreferences {
  locale: LocaleCode;
  theme: "light" | "dark";
  units: "metric" | "imperial";
  default_facility_id: string | null;
}

export interface SessionRecord {
  session_id: string;
  created_at: string;
  preferences: SessionPreferences;
}

export interface ROIInputs {
  robots: number;
  shiftsPerDay: number;
  hoursPerShift: number;
  hourlyLaborCost: number;
  annualMaintenanceCost: number;
  robotCellCost: number;
  currentCycleSeconds: number;
  automatedCycleSeconds: number;
}

export interface ROIOutputs {
  annualSavings: number;
  paybackMonths: number;
  fiveYearNet: number;
  throughputGain: number;
}

export interface PersistedPolicy {
  policy_id: string;
  skill_id: string;
  version: number;
  task_policy: TaskPolicy;
  generated_code: {
    urscript: string;
    ros2_python: string;
    pseudocode: string;
  };
  simulation_manifest: object;
  created_at: string;
}

export interface ROIAnalysis {
  analysis_id: string;
  created_at: string;
  inputs: ROIInputs;
  outputs: ROIOutputs;
  locale: LocaleCode;
}
