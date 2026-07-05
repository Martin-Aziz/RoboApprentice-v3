import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { spawn } from "child_process";
import Anthropic from "@anthropic-ai/sdk";
import { getTask, updateTask } from "@/lib/task-store-db";
import { processPolicyPipeline } from "@/lib/policy-pipeline";
import { extractVideoFrames, type FrameSample } from "@/lib/video-frames";
import { buildLocalPerceptionEvidence, summarisePerceptionEvidence } from "@/lib/perception-evidence";
import {
  deriveSceneFromSteps,
  extractFirstJsonArray,
  extractSceneJson,
  validateWorkcellScene,
} from "@/lib/scene-model";
import type { GripperState, RobotAction, TaskPolicy, TaskStep, Waypoint, WorkcellScene } from "@/lib/types";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? "";
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";
const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "gemma4:latest";
// Use the local Claude Code CLI as a provider (its own subscription auth, no
// API key). Disabled with CLAUDE_CODE_CLI=0. Uses a model alias the CLI accepts.
const CLAUDE_CODE_CLI_ENABLED = process.env.CLAUDE_CODE_CLI !== "0";
const CLAUDE_CODE_MODEL = process.env.CLAUDE_CODE_MODEL ?? "sonnet";
const CLAUDE_CODE_TIMEOUT_MS = Number(process.env.CLAUDE_CODE_TIMEOUT_MS ?? 240_000);
// How many evidence frames to sample. Defaults to ~1 frame/second coverage for a
// typical demo (capped in video-frames at 64). Raise for longer or denser clips.
const VISION_MAX_FRAMES = Math.max(8, Math.min(Number(process.env.VISION_MAX_FRAMES ?? 40), 64));

interface RawStep {
  order: number;
  description: string;
  action: string;
  target: { x: number; y: number; z: number; rx?: number; ry?: number; rz?: number };
  gripper: string;
  speed?: number;
  duration?: number;
  requires_vision?: boolean;
  notes?: string;
}

const ALLOWED_ACTIONS: RobotAction[] = [
  "move",
  "approach",
  "grip",
  "release",
  "rotate",
  "wait",
  "inspect",
  "home",
];

const ALLOWED_GRIPPER: GripperState[] = ["open", "closed", "unchanged"];

function buildDeterministicSteps(title: string, transcript?: string): TaskStep[] {
  const source = `${title} ${transcript ?? ""}`.toLowerCase();
  const needsVision = /\b(bin|unsorted|random|camera|vision|unknown)\b/.test(source);
  const rotateForFixture = /\b(rotate|orient|orientation|align)\b/.test(source);
  const pickLabel = /\bpart\b/.test(source) ? "part" : /\bbracket\b/.test(source) ? "bracket" : "workpiece";

  const rawSteps: RawStep[] = [
    {
      order: 1,
      description: "Move to calibrated home pose with gripper open",
      action: "home",
      target: { x: 0.28, y: 0, z: 0.52, ry: Math.PI / 2 },
      gripper: "open",
      speed: 0.3,
      duration: 2,
      requires_vision: false,
      notes: "Deterministic fallback used because the local language model was unavailable.",
    },
    {
      order: 2,
      description: `Approach 6cm above pickup ${pickLabel} at position A`,
      action: "approach",
      target: { x: 0.38, y: -0.16, z: 0.18, ry: Math.PI / 2 },
      gripper: "unchanged",
      speed: 0.1,
      duration: 2,
      requires_vision: needsVision,
    },
    {
      order: 3,
      description: `Descend onto ${pickLabel} at position A and close gripper`,
      action: "grip",
      target: { x: 0.38, y: -0.16, z: 0.1, ry: Math.PI / 2 },
      gripper: "closed",
      speed: 0.06,
      duration: 2,
      requires_vision: needsVision,
      notes: "Verify stable grip before lifting.",
    },
    {
      order: 4,
      description: `Lift ${pickLabel} clear of pickup area`,
      action: "move",
      target: { x: 0.34, y: -0.12, z: 0.28, ry: Math.PI / 2 },
      gripper: "unchanged",
      speed: 0.18,
      duration: 2,
      requires_vision: false,
    },
    {
      order: 5,
      description: rotateForFixture
        ? "Carry to fixture B while rotating tool for alignment"
        : "Carry to fixture B above placement position",
      action: rotateForFixture ? "rotate" : "move",
      target: { x: 0.14, y: 0.22, z: 0.28, ry: Math.PI / 2, rz: rotateForFixture ? 0.31 : 0 },
      gripper: "unchanged",
      speed: 0.2,
      duration: 2,
      requires_vision: false,
    },
    {
      order: 6,
      description: `Approach 6cm above placement fixture B with ${pickLabel}`,
      action: "approach",
      target: { x: 0.12, y: 0.24, z: 0.16, ry: Math.PI / 2, rz: rotateForFixture ? 0.31 : 0 },
      gripper: "unchanged",
      speed: 0.1,
      duration: 2,
      requires_vision: false,
    },
    {
      order: 7,
      description: `Place ${pickLabel} into fixture B and open gripper`,
      action: "release",
      target: { x: 0.12, y: 0.24, z: 0.09, ry: Math.PI / 2, rz: rotateForFixture ? 0.31 : 0 },
      gripper: "open",
      speed: 0.06,
      duration: 2,
      requires_vision: false,
      notes: "Use low contact speed at fixture.",
    },
    {
      order: 8,
      description: "Return to calibrated home pose",
      action: "home",
      target: { x: 0.28, y: 0, z: 0.52, ry: Math.PI / 2 },
      gripper: "open",
      speed: 0.3,
      duration: 2,
      requires_vision: false,
    },
  ];

  return rawSteps.map((step, index) => normalizeStep(step, index + 1));
}

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value) || !Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function normalizeWaypoint(w: RawStep["target"]): Waypoint {
  return {
    x: clamp(w?.x ?? 0, -1.2, 1.2),
    y: clamp(w?.y ?? 0, -1.2, 1.2),
    z: clamp(w?.z ?? 0, 0, 1.5),
    rx: w?.rx === undefined ? undefined : clamp(w.rx, -Math.PI, Math.PI),
    ry: w?.ry === undefined ? undefined : clamp(w.ry, -Math.PI, Math.PI),
    rz: w?.rz === undefined ? undefined : clamp(w.rz, -Math.PI, Math.PI),
  };
}

function normalizeStep(raw: RawStep, fallbackOrder: number): TaskStep {
  const action = (ALLOWED_ACTIONS as string[]).includes(raw.action)
    ? (raw.action as RobotAction)
    : "move";
  const gripper = (ALLOWED_GRIPPER as string[]).includes(raw.gripper)
    ? (raw.gripper as GripperState)
    : "unchanged";
  return {
    id: randomUUID(),
    order: typeof raw.order === "number" ? raw.order : fallbackOrder,
    description: String(raw.description ?? "").slice(0, 240),
    action,
    target: normalizeWaypoint(raw.target),
    gripper,
    speed: clamp(raw.speed ?? 0.2, 0.05, 0.5),
    duration: Math.round(clamp(raw.duration ?? 3, 1, 30)),
    requiresVision: Boolean(raw.requires_vision),
    notes: raw.notes ? String(raw.notes).slice(0, 240) : undefined,
  };
}

function buildPolicy(steps: TaskStep[]): TaskPolicy {
  const xs = steps.map((s) => s.target.x);
  const ys = steps.map((s) => s.target.y);
  const zs = steps.map((s) => s.target.z);
  const cycle = steps.reduce((acc, s) => acc + s.duration, 0);
  return {
    steps,
    toolFrame: "tcp_default",
    workspaceBounds: steps.length
      ? {
          xMin: Math.min(...xs),
          xMax: Math.max(...xs),
          yMin: Math.min(...ys),
          yMax: Math.max(...ys),
          zMin: Math.min(...zs),
          zMax: Math.max(...zs),
        }
      : undefined,
    estimatedCycleSeconds: cycle,
  };
}

class StreamingJSONParser {
  private buffer = "";
  private depth = 0;
  private inString = false;
  private escaped = false;
  private currentObj = "";

  extractObjects(): { objects: RawStep[]; remaining: string } {
    const objects: RawStep[] = [];

    for (let i = 0; i < this.buffer.length; i++) {
      const ch = this.buffer[i];

      if (this.escaped) {
        this.escaped = false;
        this.currentObj += ch;
        continue;
      }

      if (ch === "\\" && this.inString) {
        this.escaped = true;
        this.currentObj += ch;
        continue;
      }

      if (ch === '"' && !this.escaped) {
        this.inString = !this.inString;
        this.currentObj += ch;
        continue;
      }

      if (this.inString) {
        this.currentObj += ch;
        continue;
      }

      if (ch === "{") {
        if (this.depth === 0) {
          this.currentObj = ch;
        } else {
          this.currentObj += ch;
        }
        this.depth++;
      } else if (ch === "}") {
        this.depth--;
        this.currentObj += ch;

        if (this.depth === 0 && this.currentObj.length > 2) {
          try {
            const obj = JSON.parse(this.currentObj) as RawStep;
            if (obj && typeof obj === "object" && "description" in obj) {
              objects.push(obj);
            }
          } catch {
            // Malformed JSON, skip
          }
          this.currentObj = "";
        }
      } else {
        this.currentObj += ch;
      }
    }

    const remaining = this.currentObj;
    this.buffer = "";
    this.currentObj = "";

    return { objects, remaining };
  }

  feed(chunk: string): { objects: RawStep[]; remaining: string } {
    this.buffer += chunk;
    return this.extractObjects();
  }
}

const SYSTEM_PROMPT = `You are an expert industrial robotics motion planner with deep knowledge of 6-DOF manipulator kinematics, trajectory planning, and manufacturing automation. Your task is to analyze a robot teaching demonstration and produce a precise, executable motion policy.

## EVIDENCE
If still frames sampled from the demonstration video are provided, they are your PRIMARY source of truth. The frames are timestamped and appear in chronological order. Preserve distinct stages that happen at different timestamps. Do not collapse a multi-stage warehouse or workcell video into a single pick/place cycle unless the evidence truly shows only one cycle. Ground every waypoint coordinate and step description in what the frames actually show. Use the title/narration only to fill gaps the frames leave ambiguous.

A computer-vision motion pass may also be supplied:
- A "Motion analysis" timeline derived from inter-frame optical difference. It reports, per segment, whether the dominant motion is a downward descent (approach/contact), an upward lift (retract after grip), a lateral transfer, or localised in-place manipulation, plus the on-screen location of the activity. Hard scene cuts in the timeline mark edits between potentially distinct workcell stages — never merge across a cut without checking the frames.
- "(action)" frames sampled at motion peaks, each optionally followed by a "Zoom on activity region" inset cropped to the moving gripper/contact area. Read these insets to determine gripper open vs. closed and what object is held — this is how you decide pick (gripper closes on a part) versus place (gripper opens to release). When the wide frame is too small to tell, defer to the inset.
- "(action-pre)" and "(action-post)" frames bracket each motion peak roughly half a second before and after. Compare the pre/post pair around a peak to read the state transition: an object present before and gone after means a pick; empty gripper before and object resting after means a place.
- "Object activity zones" in the motion analysis list where on screen work keeps recurring. Distinct zones usually correspond to distinct physical stations (pick area, container, fixture, inspection point) — map steps in different zones to different waypoints instead of reusing one location.

## ANTI-HALLUCINATION RULES
- Do not name equipment, sensors, scanners, second robots, collaborative zones, or inspection systems unless they are clearly visible in the frames or stated in the operator description.
- If a stage is ambiguous, describe it conservatively as "transition to next workcell position" or "hold at intermediate waypoint" instead of inventing a process.
- Use "inspect" only when the video clearly shows a vision/checking pose, camera/scanner, or inspection pause; otherwise use "move" or "wait".
- If the final frames do not clearly show the robot still carrying a payload, end with gripper open at home.
- Never claim the task is complete with a part held in the gripper unless the final frame visibly proves that state.

## THINKING PROCESS
Before generating output, reason through these questions mentally:
1. How many distinct temporal stages are visible? Treat scene changes, long position changes, handoff moments, bin/tote moves, fixture moves, tool-change-looking moves, and final placement as separate stages.
2. For each stage, what object or robot state changes? If the object, source, destination, or tool posture changes, keep that as its own stage.
3. What are the key spatial waypoints for every stage (home → approach → contact/action → lift/retract → transfer → next stage)?
4. Which steps require vision/sensing vs. blind positioning?
5. Where are the critical contact points that need slow, careful motion?
6. What safety clearances and approach vectors are needed to avoid collisions?

## OUTPUT FORMAT
Respond with ONLY a valid JSON array of steps, followed by ONE scene-model JSON object on a new line (described in SCENE MODEL OUTPUT below). No markdown fences, no commentary, no prose before, between, or after.

Each step object must have exactly this shape:
{
  "order": <int starting at 1>,
  "description": "<precise imperative sentence: verb + object + qualifier, e.g. 'Move gripper to pre-pick position 5cm above bracket'>",
  "action": "home" | "move" | "approach" | "grip" | "release" | "rotate" | "wait" | "inspect",
  "target": { "x": <meters>, "y": <meters>, "z": <meters>, "rz": <radians, optional> },
  "gripper": "open" | "closed" | "unchanged",
  "speed": <m/s, range 0.05–0.5>,
  "duration": <integer seconds, range 1–30>,
  "requires_vision": <boolean>,
  "notes": "<safety note, tolerance, or sensor trigger condition — omit if not needed>"
}

## SCENE MODEL OUTPUT
Immediately after the closing "]" of the steps array, output exactly one JSON object describing the physical objects visible in the demonstration:

{"scene": {"objects": [
  {
    "id": "obj-1",
    "role": "source" | "workpiece" | "destination" | "fixture" | "container" | "inspection_surface" | "tool" | "unknown",
    "category": "box" | "bin" | "tote" | "tray" | "cylinder" | "bracket" | "machined_part" | "fixture" | "station" | "surface" | "unknown",
    "label": "<short human label, e.g. 'gray tote', 'aluminum bracket'>",
    "color_hint": "<dominant color word, omit if unclear>",
    "material_hint": "metal" | "plastic" | "rubber" | "wood" | "cardboard" | "unknown",
    "size_hint": { "x": <meters>, "y": <meters>, "z": <meters, vertical height> },
    "pose_hint": { "x": <meters>, "y": <meters>, "z": <meters> },
    "related_step_orders": [<step order numbers this object participates in>],
    "confidence": <0..1>,
    "track_id": "<perception track id this object corresponds to, omit if none>",
    "detection_label": "<detection phrase grounding this object, omit if none>",
    "detection_score": <0..1, omit if no detection>,
    "depth_hint": <0..1 relative nearness, omit if no depth evidence>,
    "pose_confidence": <0..1, how sure you are of pose_hint specifically>,
    "geometry_source": "model" | "depth" | "primitive" | "derived",
    "visual_fidelity": "proxy" | "depth_estimated" | "cad_matched",
    "review_required_reason": "<why a human should verify this object, omit if confident>"
  }
], "confidence": <0..1 overall>, "warnings": ["<anything ambiguous about the scene>"]}}

Scene-model rules:
- Include ONLY objects visibly present in the frames or explicitly stated by the operator. Maximum 10 objects.
- Every carried part should appear as one "workpiece" object whose related_step_orders include its grip step.
- Every drop-off receptacle (tote, tray, fixture, inspection surface, station) should appear with related_step_orders including its release or inspect step.
- pose_hint must be consistent with the step targets the object relates to (same coordinate frame as step "target").
- Approximate sizes honestly in meters; a tote is typically 0.2–0.6m wide, a small machined part 0.03–0.15m.
- When unsure of what an object is, use category "unknown" with a descriptive label and lower confidence — never invent a specific object class.
- If the video shows no identifiable objects, output {"scene": {"objects": [], "confidence": 0, "warnings": ["No distinct objects identified"]}}.

Evidence-grounding rules (mandatory):
- A "Perception evidence" section may list object tracks, detections, depth hints, and motion events. Ground every scene object in that evidence when it exists: set track_id to the matching track, detection_label/detection_score when a detection supports it, and depth_hint when depth evidence exists. Never invent track/detection/mask IDs that are not listed in the evidence.
- Monocular video cannot yield robot-grade geometry. Do NOT claim exact geometry: use visual_fidelity "proxy" and geometry_source "primitive" unless real depth or CAD evidence is listed. When pose or size is uncertain, say so via pose_confidence and review_required_reason instead of pretending precision.
- Objects with no supporting evidence at all must carry a review_required_reason and lower confidence.

## COORDINATE SYSTEM
Robot base frame. Origin at robot base center.
- X: forward toward operator
- Y: left
- Z: up
- Working envelope: x ∈ [-0.6, 0.7], y ∈ [-0.6, 0.6], z ∈ [0.05, 0.9]
- Table surface is typically z ≈ 0.05–0.15m above base

## STRICT RULES

### Step count & structure
- Generate 6 to 30 atomic steps total
- For a single simple pick/place, 6 to 14 steps is enough.
- For multi-stage warehouse/workcell demonstrations, use 12 to 30 steps and preserve every visible stage.
- ALWAYS start with step 1 as "home" action (joints at rest, gripper open, z ≥ 0.5)
- ALWAYS end with the final step as "home" action (return to rest)
- Preferred structure: home → stage 1 actions → stage 2 actions → ... → final retract → home
- A stage may be a grip/release cycle, an inspection, a wait-for-signal, a tool-change posture, a bin/tote transfer, a fixture alignment, or a final placement.
- If a clip shows an operator-only setup/introduction, represent it only if it affects robot action; otherwise start from the first robot-relevant stage.
- Do not invent repeated cycles that are not visible, but do not omit distinct cycles/stages that are visible.

### Approach steps (mandatory before contact)
- Insert an "approach" step 5–8cm ABOVE every grip or release target
- This prevents gripper collision with the workpiece or fixture
- approach speed: 0.08–0.12 m/s (careful descent)

### Gripper discipline
- Gripper starts "open" at home
- Set gripper: "closed" ONLY on "grip" actions
- Set gripper: "open" ONLY on "release" actions
- ALL other steps: "unchanged"
- Never grip twice in a row without a release in between

### Speed profiles (critical for safety)
- Home / free-space transit: 0.25–0.40 m/s
- Approach descent: 0.08–0.12 m/s
- Contact / grip / release: 0.05–0.08 m/s (slowest — prevents damage)
- Inspection / vision: 0.05–0.08 m/s (stable positioning)
- Carry with payload: 0.15–0.25 m/s

### Vision requirements
- Set "requires_vision": true ONLY when part location is variable (bin picking, unsorted parts)
- Set "requires_vision": false for fixed fixtures, known positions, structured environments

### Descriptions (high quality)
- Use precise imperative sentences: "Descend 5cm above left bin bracket at approach speed"
- Include spatial direction when helpful: "Move RIGHT to fixture slot B"
- Include contact cues: "Grip bracket with 40N force until position stable"
- Include stage-specific landmarks when visible: "gray tote", "fixture slot", "bench rail", "second part", "tool-change station"
- Avoid vague verbs: NO "do", "perform", "execute" — use "grip", "move", "descend", "rotate"

### Durations (physics-based)
- Calculate from distance and speed: duration ≈ distance / speed, rounded up to nearest integer
- Minimum 1s for any contact action (grip/release settle time)
- Inspection steps: 2–4s for sensor stabilization

## QUALITY CHECKLIST (verify mentally before output)
✓ Starts and ends with home
✓ Every grip/release has a preceding approach step
✓ No double-grip without intervening release
✓ Slow speeds at all contact points
✓ Coordinates within safe working envelope
✓ Gripper state changes ONLY on grip/release actions
✓ Descriptions are precise and action-oriented
✓ Multi-stage videos preserve each distinct visible stage
✓ Scene object lists every carried part and every drop-off receptacle, linked to step orders
✓ Output is the steps JSON array followed by the single scene JSON object — no surrounding text`;

/**
 * Run the interpretation through the locally-installed Claude Code CLI, which
 * authenticates with the user's own Claude Code subscription (no API key). The
 * demonstration frames are passed inline as image blocks via stream-json input,
 * so the model sees the actual video without any Read-tool round-trips. Returns
 * the model's final text (a JSON array of steps, possibly fenced).
 */
/**
 * Build the content blocks for one sampled frame: the wide frame, plus the
 * zoomed gripper/contact inset when the motion pass produced one. Shared by the
 * Anthropic API and Claude Code CLI providers so both see identical evidence.
 */
function frameContentBlocks(sample: FrameSample, mediaType: string): Anthropic.ContentBlockParam[] {
  const blocks: Anthropic.ContentBlockParam[] = [
    { type: "text", text: sample.label },
    {
      type: "image",
      source: { type: "base64", media_type: mediaType as "image/jpeg", data: sample.data },
    },
  ];
  if (sample.roi) {
    blocks.push({ type: "text", text: sample.roi.label });
    blocks.push({
      type: "image",
      source: { type: "base64", media_type: mediaType as "image/jpeg", data: sample.roi.data },
    });
  }
  return blocks;
}

function runClaudeCodeCli(opts: {
  systemPrompt: string;
  userText: string;
  samples: FrameSample[];
  mediaType: string;
}): Promise<string> {
  const content: Anthropic.ContentBlockParam[] = [
    { type: "text", text: opts.userText },
    ...opts.samples.flatMap((sample) => frameContentBlocks(sample, opts.mediaType)),
  ];
  const message = { type: "user", message: { role: "user", content } };

  return new Promise<string>((resolve, reject) => {
    const child = spawn(
      "claude",
      [
        "-p",
        "--input-format", "stream-json",
        "--output-format", "stream-json",
        "--verbose",
        "--model", CLAUDE_CODE_MODEL,
        "--append-system-prompt", opts.systemPrompt,
      ],
      { stdio: ["pipe", "pipe", "pipe"] },
    );

    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`Claude Code CLI timed out after ${CLAUDE_CODE_TIMEOUT_MS}ms`));
    }, CLAUDE_CODE_TIMEOUT_MS);

    child.stdout.on("data", (d) => { stdout += d.toString(); });
    child.stderr.on("data", (d) => { stderr += d.toString(); });
    child.on("error", (err) => { clearTimeout(timer); reject(err); });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(`Claude Code CLI exited ${code}: ${stderr.slice(0, 200)}`));
        return;
      }
      let resultText = "";
      for (const line of stdout.trim().split("\n")) {
        try {
          const evt = JSON.parse(line) as { type?: string; result?: string };
          if (evt.type === "result" && typeof evt.result === "string") resultText = evt.result;
        } catch {
          // ignore non-JSON lines
        }
      }
      if (!resultText) {
        reject(new Error("Claude Code CLI produced no result"));
        return;
      }
      resolve(resultText);
    });

    child.stdin.write(JSON.stringify(message) + "\n");
    child.stdin.end();
  });
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const task = await getTask(id);
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await updateTask(id, { status: "processing" });

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));

      try {
        // Pull still frames from the demonstration video so Claude can derive
        // the policy from what actually happens on screen. Degrades to
        // text-only when the video isn't server-readable or ffmpeg is absent.
        const extracted = await extractVideoFrames(task.videoUrl, { maxFrames: VISION_MAX_FRAMES });
        if (extracted.samples.length > 0) {
          const durationText = extracted.durationSeconds ? ` across ${extracted.durationSeconds.toFixed(1)}s` : "";
          const sceneText = extracted.sceneChanges.length ? `; ${extracted.sceneChanges.length} scene changes detected` : "";
          const actionFrames = extracted.samples.filter((s) => s.reason === "action").length;
          const roiCount = extracted.samples.filter((s) => s.roi).length;
          const motionText = actionFrames
            ? `; ${actionFrames} motion-peak keyframe(s), ${roiCount} gripper zoom inset(s)`
            : "";
          send({ type: "status", message: `Analyzing ${extracted.samples.length} timestamped frames${durationText}${sceneText}${motionText}.` });
        } else if (extracted.note) {
          send({ type: "status", message: `Vision analysis skipped — interpreting from text. ${extracted.note}` });
        }

        // Layered perception evidence: today the deterministic local bundle
        // (motion tracks/events + frame plan); later, detector/tracker/depth
        // providers fill the same contract.
        const evidence = buildLocalPerceptionEvidence(task.videoUrl, extracted, extracted.motion);
        const evidenceSummary = summarisePerceptionEvidence(evidence);

        const frameTimeline = extracted.samples.length
          ? extracted.samples
              .map((sample) => `- ${sample.label}`)
              .join("\n")
          : "";

        const userPrompt = [
          `## Task to plan`,
          `Title: "${task.title}"`,
          `Video source: ${task.videoUrl}`,
          extracted.samples.length > 0
            ? `\n## Demonstration frame timeline\n${frameTimeline}\n\nThe timestamped images are attached below in the same order. Frames marked "(action)" sit at detected motion peaks (grasp/release/contact moments) and may be followed by a zoomed inset of the gripper/contact region — use those insets to read gripper open/closed state and the handled object. First identify the stage boundaries, then emit one atomic motion-policy JSON array that preserves the visible stages.`
            : "",
          extracted.motionSummary
            ? `\n## Motion analysis\n${extracted.motionSummary}\n\nUse this motion timeline to order stages, distinguish descents (approach) from lifts (retract), and place grip/release at the activity peaks. The image evidence overrides this summary where they disagree.`
            : "",
          `\n## Perception evidence\n${evidenceSummary}\n\nGround every scene object in this evidence: reference the matching track_id, and use detection/depth fields only when the evidence above actually provides them. Where evidence is missing or weak, mark the object visual_fidelity "proxy" with a review_required_reason — do not present guessed geometry as exact.`,
          task.transcript
            ? `\n## Operator description\n"${task.transcript}"\n\nUse this narration alongside the frames to resolve any ambiguity in contact points and spatial positions.`
            : extracted.samples.length > 0
              ? `\n## Note\nNo operator narration provided. Derive the steps from the frames.`
              : `\n## Note\nNo operator narration or readable video frames available. Infer a plausible pick-and-place policy from the task title alone. Use conservative speeds and add vision checks where part position is uncertain.`,
          `\n## Output`,
          `Generate the JSON array of motion steps now, followed by the single scene-model JSON object. Follow all rules in the system prompt exactly. Use enough steps to preserve all robot-relevant stages, up to the 30-step limit.`,
        ]
          .filter(Boolean)
          .join("\n");

        // Multimodal content for Claude: the prompt text interleaved with the
        // sampled frames as image blocks. Other providers receive text only.
        const claudeContent: Anthropic.MessageParam["content"] = [
          { type: "text", text: userPrompt },
          ...extracted.samples.flatMap((sample) =>
            frameContentBlocks(sample, extracted.mediaType),
          ),
        ];

        // Each provider attempt gets fresh accumulator state so a partial
        // failure from one provider can't bleed step numbering into the next.
        const newSession = () => ({
          collected: [] as TaskStep[],
          parser: new StreamingJSONParser(),
          fullText: "",
        });

        const feedChunk = (session: ReturnType<typeof newSession>, text: string) => {
          session.fullText += text;
          const { objects, remaining } = session.parser.feed(text);
          for (const raw of objects) {
            const step = normalizeStep(raw, session.collected.length + 1);
            if (!session.collected.find((s) => s.order === step.order)) {
              session.collected.push(step);
              session.collected.sort((a, b) => a.order - b.order);
              send({ type: "step", step });
            }
          }
          session.parser.feed(remaining);
        };

        const finalizeAndRespond = async (session: ReturnType<typeof newSession>) => {
          let finalSteps = session.collected;
          try {
            // Balanced-scan extraction: the model output is now a steps array
            // followed by a scene object (which itself contains arrays), so
            // naive first-"["/last-"]" slicing would swallow the scene.
            const arrayText = extractFirstJsonArray(session.fullText);
            if (arrayText) {
              const parsed = JSON.parse(arrayText) as RawStep[];
              const remapped = parsed.map((raw, i) => {
                const existing = session.collected.find((s) => s.order === raw.order);
                const normalized = normalizeStep(raw, i + 1);
                return existing ? { ...normalized, id: existing.id } : normalized;
              });
              if (remapped.length) finalSteps = remapped.sort((a, b) => a.order - b.order);
            }
          } catch {
            // keep collected
          }

          const rawPolicy = buildPolicy(finalSteps);
          const { policy, warnings, errors } = processPolicyPipeline(rawPolicy);

          // Structured scene understanding: prefer the model's scene (validated
          // and clamped); degrade to a scene derived from step text so the
          // simulator always has role-appropriate objects to render.
          const modelScene = validateWorkcellScene(extractSceneJson(session.fullText), policy.steps);
          const scene: WorkcellScene = modelScene ?? deriveSceneFromSteps(policy.steps);
          policy.scene = scene;
          warnings.push(...scene.warnings);
          if (scene.objects.length > 0) {
            send({
              type: "status",
              message: modelScene
                ? `Scene understanding: ${scene.objects.length} workcell object(s) identified from video evidence.`
                : `Scene understanding: ${scene.objects.length} workcell object(s) inferred from the interpreted steps.`,
            });
          }

          if (errors.length > 0) {
            send({ type: "warning", message: `Policy validation errors: ${errors.join("; ")}` });
          }

          await updateTask(id, { steps: policy.steps, policy, status: "done" });
          send({ type: "done", steps: policy.steps, policy, warnings, scene });
        };

        const runDeterministicFallback = async (reason: string) => {
          const rawPolicy = buildPolicy(buildDeterministicSteps(task.title, task.transcript));
          const { policy, warnings, errors } = processPolicyPipeline(rawPolicy);
          const scene = deriveSceneFromSteps(policy.steps);
          policy.scene = scene;
          warnings.push(...scene.warnings);
          await updateTask(id, { steps: policy.steps, policy, status: "done" });
          send({
            type: "warning",
            message: `No LLM provider available; deterministic interpreter used. ${reason}`,
          });
          for (const step of policy.steps) send({ type: "step", step });
          send({ type: "done", steps: policy.steps, policy, warnings, errors, scene, fallback: "deterministic" });
        };

        // ── 1. Try Claude (Anthropic) — primary provider ───────────────────
        if (ANTHROPIC_API_KEY) {
          const session = newSession();
          try {
            const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
            const claudeStream = anthropic.messages.stream({
              model: ANTHROPIC_MODEL,
              max_tokens: 8192,
              system: SYSTEM_PROMPT,
              messages: [{ role: "user", content: claudeContent }],
            });

            for await (const event of claudeStream) {
              if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
                feedChunk(session, event.delta.text);
              }
            }

            await finalizeAndRespond(session);
            return;
          } catch (error) {
            send({ type: "warning", message: "Primary vision analysis was unavailable, switching to the local fallback." });
          }
        }

        // ── 2. Try the Claude Code CLI — uses local subscription, no API key ─
        if (CLAUDE_CODE_CLI_ENABLED) {
          const session = newSession();
          try {
            send({
              type: "status",
              message: extracted.frames.length
                ? `Analyzing ${extracted.samples.length} timestamped video frames and motion cues…`
                : "Interpreting the demonstration workflow…",
            });
            const resultText = await runClaudeCodeCli({
              systemPrompt: SYSTEM_PROMPT,
              userText: userPrompt,
              samples: extracted.samples,
              mediaType: extracted.mediaType,
            });
            feedChunk(session, resultText);
            if (session.collected.length === 0) {
              throw new Error("Claude Code CLI returned no parseable steps");
            }
            await finalizeAndRespond(session);
            return;
          } catch (error) {
            send({ type: "warning", message: "Enhanced video interpretation was unavailable, switching to the local fallback." });
          }
        }

        // ── 3. Try Ollama — local fallback ──────────────────────────────────
        let usedOllamaFallback = false;
        let ollamaFallbackReason = ANTHROPIC_API_KEY
          ? "" // Claude already attempted and failed; reason was sent above
          : "ANTHROPIC_API_KEY is not configured.";
        const ollamaRes = await fetch(`${OLLAMA_URL}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: OLLAMA_MODEL,
            stream: true,
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user", content: userPrompt },
            ],
          }),
        }).catch((error: unknown) => {
          usedOllamaFallback = true;
          ollamaFallbackReason = error instanceof Error ? error.message : "Ollama request failed";
          return null;
        });

        if (!ollamaRes || !ollamaRes.ok || !ollamaRes.body) {
          const errText = ollamaRes ? await ollamaRes.text().catch(() => "unknown error") : "no response";
          usedOllamaFallback = true;
          ollamaFallbackReason = ollamaRes ? `Ollama error ${ollamaRes.status}: ${errText}` : ollamaFallbackReason;
        }

        if (usedOllamaFallback) {
          await runDeterministicFallback(ollamaFallbackReason);
          return;
        }

        if (!ollamaRes?.body) {
          throw new Error("Ollama stream was unavailable after fallback check");
        }
        const ollamaSession = newSession();
        const ollamaBody = ollamaRes.body;
        const reader = ollamaBody.getReader();
        const dec = new TextDecoder();

        // Ollama streams NDJSON: each line is a JSON object
        let lineBuffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          lineBuffer += dec.decode(value, { stream: true });
          const lines = lineBuffer.split("\n");
          lineBuffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            try {
              const msg = JSON.parse(trimmed) as {
                message?: { content?: string };
                done?: boolean;
              };
              const text = msg.message?.content ?? "";
              if (text) feedChunk(ollamaSession, text);
            } catch {
              // skip malformed NDJSON line
            }
          }
        }

        await finalizeAndRespond(ollamaSession);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Interpretation failed";
        await updateTask(id, { status: "error", errorMessage: msg });
        send({ type: "error", message: msg });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
