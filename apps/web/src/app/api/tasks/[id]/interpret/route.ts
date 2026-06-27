import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { spawn } from "child_process";
import Anthropic from "@anthropic-ai/sdk";
import { getTask, updateTask } from "@/lib/task-store-db";
import { processPolicyPipeline } from "@/lib/policy-pipeline";
import { extractVideoFrames, type FrameSample } from "@/lib/video-frames";
import type { GripperState, RobotAction, TaskPolicy, TaskStep, Waypoint } from "@/lib/types";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? "";
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";
const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "gemma4:latest";
// Use the local Claude Code CLI as a provider (its own subscription auth, no
// API key). Disabled with CLAUDE_CODE_CLI=0. Uses a model alias the CLI accepts.
const CLAUDE_CODE_CLI_ENABLED = process.env.CLAUDE_CODE_CLI !== "0";
const CLAUDE_CODE_MODEL = process.env.CLAUDE_CODE_MODEL ?? "sonnet";
const CLAUDE_CODE_TIMEOUT_MS = 120_000;

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
Respond with ONLY a valid JSON array. No markdown fences, no commentary, no prose before or after.

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
✓ Output is valid JSON array only — no surrounding text`;

/**
 * Run the interpretation through the locally-installed Claude Code CLI, which
 * authenticates with the user's own Claude Code subscription (no API key). The
 * demonstration frames are passed inline as image blocks via stream-json input,
 * so the model sees the actual video without any Read-tool round-trips. Returns
 * the model's final text (a JSON array of steps, possibly fenced).
 */
function runClaudeCodeCli(opts: {
  systemPrompt: string;
  userText: string;
  samples: FrameSample[];
  mediaType: string;
}): Promise<string> {
  const content: Anthropic.ContentBlockParam[] = [
    { type: "text", text: opts.userText },
    ...opts.samples.flatMap(
      (sample): Anthropic.ContentBlockParam[] => [
        { type: "text", text: sample.label },
        {
          type: "image",
          source: { type: "base64", media_type: opts.mediaType as "image/jpeg", data: sample.data },
        },
      ],
    ),
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
        const extracted = await extractVideoFrames(task.videoUrl, { maxFrames: 24 });
        if (extracted.samples.length > 0) {
          const durationText = extracted.durationSeconds ? ` across ${extracted.durationSeconds.toFixed(1)}s` : "";
          const sceneText = extracted.sceneChanges.length ? `; ${extracted.sceneChanges.length} scene changes detected` : "";
          send({ type: "status", message: `Analyzing ${extracted.samples.length} timestamped frames${durationText}${sceneText}.` });
        } else if (extracted.note) {
          send({ type: "status", message: `Vision analysis skipped — interpreting from text. ${extracted.note}` });
        }

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
            ? `\n## Demonstration frame timeline\n${frameTimeline}\n\nThe timestamped images are attached below in the same order. First identify the stage boundaries, then emit one atomic motion-policy JSON array that preserves the visible stages.`
            : "",
          task.transcript
            ? `\n## Operator description\n"${task.transcript}"\n\nUse this narration alongside the frames to resolve any ambiguity in contact points and spatial positions.`
            : extracted.samples.length > 0
              ? `\n## Note\nNo operator narration provided. Derive the steps from the frames.`
              : `\n## Note\nNo operator narration or readable video frames available. Infer a plausible pick-and-place policy from the task title alone. Use conservative speeds and add vision checks where part position is uncertain.`,
          `\n## Output`,
          `Generate the JSON array of motion steps now. Follow all rules in the system prompt exactly. Use enough steps to preserve all robot-relevant stages, up to the 30-step limit.`,
        ]
          .filter(Boolean)
          .join("\n");

        // Multimodal content for Claude: the prompt text interleaved with the
        // sampled frames as image blocks. Other providers receive text only.
        const claudeContent: Anthropic.MessageParam["content"] = [
          { type: "text", text: userPrompt },
          ...extracted.samples.flatMap(
            (sample): Anthropic.ContentBlockParam[] => [
              { type: "text", text: sample.label },
              {
                type: "image",
                source: { type: "base64", media_type: extracted.mediaType, data: sample.data },
              },
            ],
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
            const start = session.fullText.indexOf("[");
            const end = session.fullText.lastIndexOf("]") + 1;
            if (start >= 0 && end > start) {
              const parsed = JSON.parse(session.fullText.slice(start, end)) as RawStep[];
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

          if (errors.length > 0) {
            send({ type: "warning", message: `Policy validation errors: ${errors.join("; ")}` });
          }

          await updateTask(id, { steps: policy.steps, policy, status: "done" });
          send({ type: "done", steps: policy.steps, policy, warnings });
        };

        const runDeterministicFallback = async (reason: string) => {
          const rawPolicy = buildPolicy(buildDeterministicSteps(task.title, task.transcript));
          const { policy, warnings, errors } = processPolicyPipeline(rawPolicy);
          await updateTask(id, { steps: policy.steps, policy, status: "done" });
          send({
            type: "warning",
            message: `No LLM provider available; deterministic interpreter used. ${reason}`,
          });
          for (const step of policy.steps) send({ type: "step", step });
          send({ type: "done", steps: policy.steps, policy, warnings, errors, fallback: "deterministic" });
        };

        // ── 1. Try Claude (Anthropic) — primary provider ───────────────────
        if (ANTHROPIC_API_KEY) {
          const session = newSession();
          try {
            const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
            const claudeStream = anthropic.messages.stream({
              model: ANTHROPIC_MODEL,
              max_tokens: 4096,
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
            const reason = error instanceof Error ? error.message : "Claude API request failed";
            send({ type: "warning", message: `Claude API unavailable, trying local Ollama. ${reason}` });
          }
        }

        // ── 2. Try the Claude Code CLI — uses local subscription, no API key ─
        if (CLAUDE_CODE_CLI_ENABLED) {
          const session = newSession();
          try {
            send({
              type: "status",
              message: extracted.frames.length
                ? `Sending ${extracted.samples.length} timestamped frames to Claude Code for analysis…`
                : "Interpreting with Claude Code…",
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
            const reason = error instanceof Error ? error.message : "Claude Code CLI request failed";
            send({ type: "warning", message: `Claude Code CLI unavailable, trying local Ollama. ${reason}` });
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
