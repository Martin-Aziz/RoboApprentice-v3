import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import Anthropic from "@anthropic-ai/sdk";
import { getTask, updateTask } from "@/lib/task-store-db";
import { processPolicyPipeline } from "@/lib/policy-pipeline";
import type { GripperState, RobotAction, TaskPolicy, TaskStep, Waypoint } from "@/lib/types";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? "";
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";
const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "gemma4:latest";

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

## THINKING PROCESS
Before generating output, reason through these questions mentally:
1. What is the primary pick-and-place or manipulation goal?
2. What are the key spatial waypoints (home → approach → grasp → carry → approach → place → home)?
3. Which steps require vision/sensing vs. blind positioning?
4. Where are the critical contact points that need slow, careful motion?
5. What safety clearances and approach vectors are needed to avoid collisions?

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
- Generate 5 to 14 atomic steps total
- ALWAYS start with step 1 as "home" action (joints at rest, gripper open, z ≥ 0.5)
- ALWAYS end with the final step as "home" action (return to rest)
- Structure: home → [approach → grip → lift] → [carry] → [approach → release → retract] → home

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
✓ Output is valid JSON array only — no surrounding text`;

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
        const userPrompt = [
          `## Task to plan`,
          `Title: "${task.title}"`,
          `Video source: ${task.videoUrl}`,
          task.transcript
            ? `\n## Operator description\n"${task.transcript}"\n\nUse this narration as the primary source of truth for the task steps, contact points, and spatial positions.`
            : `\n## Note\nNo operator narration provided. Infer a plausible pick-and-place policy from the task title alone. Use conservative speeds and add vision checks where part position is uncertain.`,
          `\n## Output`,
          `Generate the JSON array of motion steps now. Follow all rules in the system prompt exactly.`,
        ]
          .filter(Boolean)
          .join("\n");

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
              messages: [{ role: "user", content: userPrompt }],
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

        // ── 2. Try Ollama — local fallback ──────────────────────────────────
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
