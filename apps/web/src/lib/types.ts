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

export type PricingPlanType = "FLAT_SUBSCRIPTION" | "OUTCOME_BASED";
export type BillingCycle = "MONTHLY";

export interface PricingPlan {
  plan_id: string;
  customer_id: string;
  plan_type: PricingPlanType;
  effective_from: string;
  integrator_cost_baseline_usd: number;
  baseline_confirmed_at: string | null;
  baseline_evidence_note?: string;
  outcome_share_pct: number;
  min_monthly_fee_usd: number;
  max_monthly_cap_usd: number;
  billing_cycle: BillingCycle;
  measurement_window_days: number;
}

export interface DeploymentOutcome {
  task_id: string;
  customer_id: string;
  task_name: string;
  deployment_date: string;
  successful_cycles: number | null;
  outcome_data_complete: boolean;
}

export interface DateRange {
  start: string;
  end: string;
}

export interface ValueStatementTask {
  task_id: string;
  task_name: string;
  deployment_date: string;
  cycle_count_at_billing: number;
}

export interface ManualReviewTask {
  task_id: string;
  task_name: string;
  reason: string;
}

export interface ValueStatement {
  statement_id: string;
  customer_id: string;
  billing_period: DateRange;
  tasks_deployed: number;
  integrator_cost_baseline_usd: number;
  cost_avoided_usd: number;
  outcome_fee_usd: number;
  floor_applied: boolean;
  cap_applied: boolean;
  final_billable_usd: number;
  task_breakdown: ValueStatementTask[];
  excluded_for_manual_review: ManualReviewTask[];
  closed_at: string;
  immutable: true;
  pdf_url?: string;
}

export interface CreditNote {
  credit_note_id: string;
  statement_id: string;
  customer_id: string;
  amount_usd: number;
  reason: string;
  created_at: string;
  created_by: string;
}

export interface OutcomePricingConfig {
  outcome_share_pct: number;
  min_monthly_fee_usd: number;
  max_monthly_cap_usd: number;
  updated_at: string;
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

export type RobotModel =
  | "UR5e"
  | "UR10e"
  | "UR16e"
  | "ABB GoFa CRB 15000"
  | "FANUC CRX-10iA";

export type IntentConfidence = "LOW" | "MEDIUM" | "HIGH";

export interface TaskIntent {
  waypoints: Waypoint[];
  intentSteps?: Array<{
    id: string;
    order: number;
    description: string;
    action: RobotAction;
    target: Waypoint;
    gripper: GripperState;
    speed: number;
    duration: number;
    requiresVision?: boolean;
    notes?: string;
  }>;
  approximateSpeeds?: number[];
  confidence: IntentConfidence;
  operationDelaysSeconds?: number;
  taskCategory?: TaskCategory;
  payloadKg?: number;
  partMaterial?: PartMaterial;
  partSurface?: PartSurface;
  pickType?: PickType;
  requiredGripForceNewtons?: { min: number; max: number };
  cycleTimeSeconds?: number;
  robotModel?: string;
  partGeometry?: PartGeometry;
  pickPosition?: {
    face: RequiredPickFace | "UNKNOWN";
    offsetMm: { x: number; y: number; z: number };
  };
  requiredPartOrientation?: { rx: number; ry: number; rz: number };
  requiredRepeatabilityMm?: number;
  environmentTemperatureC?: number;
}

export interface WorkcellDimensions {
  x: number;
  y: number;
  z: number;
}

export interface PassportWorkcellConfig {
  dimensions: WorkcellDimensions;
  origin: Waypoint;
  fixtureOffset?: Waypoint;
  toolFrame?: string;
}

export interface PartBoundingBox {
  length_mm: number;
  width_mm: number;
  height_mm: number;
}

export type PartShape = "RECTANGULAR" | "CYLINDRICAL" | "IRREGULAR" | "UNKNOWN";
export interface PartGeometry {
  shape: PartShape;
  boundingBox: PartBoundingBox;
}

export type RequiredPickFace = "TOP" | "SIDE" | "BOTTOM";
export type FixtureMaterial =
  | "PLA_3DPRINT"
  | "ABS_3DPRINT"
  | "ALUMINIUM"
  | "STEEL";
export type FixtureType = "NEST" | "V-BLOCK" | "RAIL" | "CUSTOM";

export interface FixtureRequirement {
  part_bounding_box: PartBoundingBox;
  required_pick_face: RequiredPickFace;
  required_repeatability_mm: number;
  max_cycle_force_n: number;
  material_recommendation: FixtureMaterial;
  environment_temperature_c: number;
}

export interface DimensionWithTolerance {
  nominal_mm: number;
  tolerance_mm: number;
}

export interface FixtureSpecDocument {
  dimensions: Record<string, DimensionWithTolerance>;
  general_tolerance_mm: number;
  surface_finish_requirements: string;
  mounting_method: string;
}

export interface FixtureDesignOutput {
  fixture_id: string;
  name: string;
  interface_points: Waypoint[];
  tolerance_mm?: number;
  notes?: string;
  fixture_type?: FixtureType;
  material_recommendation?: FixtureMaterial;
  specification?: FixtureSpecDocument;
  geometry_file?: string | null;
  geometry_download_url?: string | null;
  specification_pdf_url?: string;
  manufacturing_notes?: string;
  confidence?: IntentConfidence;
  human_review_required?: boolean;
  disclaimer?: string;
}

export interface QualityParameters {
  cycle_time_target_seconds: number;
  acceptable_tolerance_mm: number;
  success_rate_baseline: number;
}

export type PassportSharingScope = "PRIVATE" | "ORGANISATION" | "SHARED_LINK";

export interface PassportExport {
  passport_id: string;
  source_task_id: string;
  source_robot_model: string;
  source_org_id: string;
  task_intent: TaskIntent;
  fixture_spec: FixtureDesignOutput | null;
  gripper_recommendation: GripperRecommendation[] | null;
  quality_parameters: QualityParameters;
  created_at: string;
  created_by: string;
  sharing_scope: PassportSharingScope;
  recipient_org_id: string | null;
  share_token: string | null;
}

export interface UnreachableWaypoint {
  waypoint_index: number;
  description: string;
  reason: string;
  distance_from_base_m: number;
  robot_reach_m: number;
}

export interface PassportImportResult {
  passport_id: string;
  source_task_id: string;
  source_robot_model: string;
  target_robot_model: string;
  new_task_id: string | null;
  adjusted_waypoint_count: number;
  unreachable_waypoints: UnreachableWaypoint[];
  deployment_blocked: boolean;
  controller_program_target: string | null;
  message: string;
}

export interface Organisation {
  org_id: string;
  name: string;
}

export interface OrganisationLink {
  link_id: string;
  organisation_a_id: string;
  organisation_b_id: string;
  created_at: string;
  created_by: string;
}

export interface SimulationRequest {
  task_intent: TaskIntent;
  robot_model: RobotModel;
  payload_kg: number;
  workcell_dimensions?: WorkcellDimensions;
}

export type FeasibilityVerdict = "FEASIBLE" | "MARGINAL" | "NOT_FEASIBLE";

export interface FeasibilityResult {
  verdict: FeasibilityVerdict;
  blocking_reason: string | null;
  estimated_cycle_time_seconds: number;
  estimated_throughput_per_hour: number;
  recommended_robot: RobotModel | null;
  confidence: IntentConfidence;
  guidance: string | null;
}

export type TaskCategory =
  | "pick-place"
  | "machine-tend"
  | "assembly"
  | "palletising";

export type PartMaterial =
  | "metal"
  | "plastic"
  | "glass"
  | "cardboard"
  | "unknown";

export type PartSurface = "smooth" | "rough" | "porous" | "unknown";
export type PickType = "top-pick" | "side-pick" | "unknown";

export type CatalogueGripperType =
  | "PARALLEL_JAW"
  | "THREE_FINGER"
  | "VACUUM_SINGLE"
  | "VACUUM_MULTI"
  | "MAGNETIC"
  | "SOFT_FINGER";

export interface GripperSpec {
  id: string;
  manufacturer: string;
  model_name: string;
  gripper_type: CatalogueGripperType;
  max_payload_kg: number;
  compatible_robot_models: string[];
  suitable_materials: PartMaterial[];
  suitable_surfaces: PartSurface[];
  suitable_pick_types: PickType[];
  min_cycle_time_seconds: number;
  max_grip_force_n: number;
  product_url: string;
  enquiry_url: string;
  image_url: string;
  affiliate_tag: string | null;
  source: string;
  estimated_fields: string[];
}

export interface GripperRecommendation {
  gripper: GripperSpec;
  match_score: number;
  plain_english_reason: string;
  confidence: IntentConfidence;
  confidence_reason: string;
}

export interface GripperRecommendationResponse {
  recommendations: GripperRecommendation[];
  explanation: string;
  disclosure: string;
}

export interface TaskProgram {
  taskId: string;
  taskName: string;
  taskSummary?: string;
  robotModel: string;
  taskCategory: TaskCategory;
  waypoints: Array<Waypoint & { tcpSpeedMetersPerSecond: number }>;
  gripperType: string;
  gripperForceNewtons?: number;
  workcellDimensions?: WorkcellDimensions;
  operatorProximityMillimeters?: number;
  siteName?: string;
}

export interface RiskSection {
  section_number: string;
  title: string;
  auto_populated_content: string;
  requires_human_review: boolean;
  review_prompt: string;
}

export interface RiskAssessmentDraft {
  task_id: string;
  generated_at: string;
  robot_model: string;
  task_category: string;
  sections: RiskSection[];
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

/** What an interpreted workcell object does in the demonstrated task. */
export type SceneObjectRole =
  | "source"
  | "workpiece"
  | "destination"
  | "fixture"
  | "container"
  | "inspection_surface"
  | "tool"
  | "unknown";

/** Geometric proxy class the simulator renders for an interpreted object. */
export type SceneObjectCategory =
  | "box"
  | "bin"
  | "tote"
  | "tray"
  | "cylinder"
  | "bracket"
  | "machined_part"
  | "fixture"
  | "station"
  | "surface"
  | "unknown";

export type SceneMaterialHint = "metal" | "plastic" | "rubber" | "wood" | "cardboard" | "unknown";

/** Where an object's geometry came from, most to least trustworthy. */
export type SceneGeometrySource = "model" | "depth" | "primitive" | "derived";

/** How faithful the rendered proxy is to the real object. */
export type SceneVisualFidelity = "proxy" | "depth_estimated" | "cad_matched";

/**
 * One physical object interpreted from the demonstration video. Sizes are in
 * meters; poses are in the robot base frame (x forward, y left, z up), matching
 * step targets. All hints are best-effort: the renderer degrades to a neutral
 * proxy when a hint is missing.
 */
export interface SceneObject {
  id: string;
  role: SceneObjectRole;
  category: SceneObjectCategory;
  label: string;
  colorHint?: string;
  materialHint?: SceneMaterialHint;
  /** Approximate bounding size in meters, robot frame (z is vertical height). */
  sizeHint?: { x: number; y: number; z: number };
  /** Approximate resting pose in the robot base frame. */
  poseHint?: { x: number; y: number; z: number; yaw?: number };
  /** IDs of the policy steps this object participates in (pick/place/inspect). */
  relatedStepIds: string[];
  confidence: number; // 0–1
  // -- Perception evidence grounding (all optional; absent = ungrounded guess) --
  /** Detector label this object was grounded in (e.g. Grounding DINO phrase). */
  detectionLabel?: string;
  /** Detector confidence for that label, 0–1. */
  detectionScore?: number;
  /** Segmentation mask backing the object's extent (SAM 2). */
  maskId?: string;
  /** Object track backing the object's persistence (CoTracker / motion cluster). */
  trackId?: string;
  /** Relative nearness from monocular depth, 0 (far) – 1 (near). Never metric. */
  depthHint?: number;
  /** Confidence in the estimated pose specifically, 0–1. */
  poseConfidence?: number;
  /** Where the geometry came from. */
  geometrySource?: SceneGeometrySource;
  /** How faithful the rendered shape is to the real object. */
  visualFidelity?: SceneVisualFidelity;
  /** Set when a human should verify this object before deployment. */
  reviewRequiredReason?: string;
}

/** Structured scene understanding derived from the demonstration video. */
export interface WorkcellScene {
  objects: SceneObject[];
  confidence: number; // 0–1 overall scene confidence
  warnings: string[];
  /** How the scene was produced: multimodal video evidence or step-text fallback. */
  source: "video" | "derived";
}

export interface TaskPolicy {
  steps: TaskStep[];
  toolFrame: string; // e.g., "tcp_default"
  workspaceBounds?: { xMin: number; xMax: number; yMin: number; yMax: number; zMin: number; zMax: number };
  estimatedCycleSeconds: number;
  /** Optional structured scene model interpreted alongside the steps. */
  scene?: WorkcellScene;
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
  robotModel?: string;
  controllerProgram?: string;
  controllerProgramTarget?: string;
  taskIntent?: TaskIntent;
  qualityParameters?: QualityParameters;
  originPassportId?: string | null;
  parentTaskId?: string | null;
  organisationId?: string;
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
  robotModel?: string;
  controllerProgram?: string;
  controllerProgramTarget?: string;
  taskIntent?: TaskIntent;
  qualityParameters?: QualityParameters;
  originPassportId?: string | null;
  parentTaskId?: string | null;
}

export type TrustCheckStatus = "passed" | "failed" | "pending";
export type TrustCheckSource = "system" | "qualified-reviewer";
export type DeploymentGateStatus = "blocked" | "review-required" | "approved";
export type ApprovalDecisionStatus = "pending" | "approved" | "rejected";

export interface TrustChecklistItem {
  id: string;
  label: string;
  description: string;
  status: TrustCheckStatus;
  source: TrustCheckSource;
  required: boolean;
  weight: number;
  evidence: string;
  updated_at: string;
  updated_by?: string;
}

export interface TaskApprovalDecision {
  status: ApprovalDecisionStatus;
  reviewer_name?: string;
  reviewer_role?: string;
  qualification?: string;
  comments?: string;
  decided_at?: string;
  task_version?: number;
  policy_hash?: string;
}

export type TrustAuditEventType =
  | "record_created"
  | "task_version_changed"
  | "risk_draft_generated"
  | "check_updated"
  | "approval_granted"
  | "approval_rejected";

export interface TrustAuditEvent {
  event_id: string;
  event_type: TrustAuditEventType;
  actor: string;
  summary: string;
  created_at: string;
  task_version: number;
  policy_hash: string;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface TaskTrustRecord {
  trust_record_id: string;
  task_id: string;
  current_task_version: number;
  policy_hash: string;
  readiness_score: number;
  gate_status: DeploymentGateStatus;
  gate_reason: string;
  checklist: TrustChecklistItem[];
  approval: TaskApprovalDecision;
  audit_log: TrustAuditEvent[];
  created_at: string;
  updated_at: string;
}

export interface CloudTaskLibrary {
  task_id: string;
  facility_id: string;
  title: string;
  description?: string;
  videoUrl?: string;
  transcript?: string;
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
  robotModel?: string;
  controllerProgramTarget?: string;
  originPassportId?: string | null;
  parentTaskId?: string | null;
  organisationId?: string;
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
