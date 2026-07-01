/**
 * Server-side video frame extraction for the vision analysis pipeline.
 *
 * The interpretation route sends still frames sampled from a demonstration
 * video to a multimodal model so the motion policy is derived from what the
 * robot actually does on screen, rather than inferred from the title alone.
 *
 * This runs in the Node.js runtime only (it shells out to `ffmpeg`/`ffprobe`
 * and reads the filesystem). It degrades gracefully: if the video cannot be
 * located on disk (e.g. a browser `blob:` URL the server never received) or
 * ffmpeg is unavailable, it returns no frames plus a human-readable note and
 * the caller falls back to text-only interpretation.
 */

import { execFile } from "child_process";
import { mkdtemp, readFile, rm } from "fs/promises";
import { existsSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { promisify } from "util";
import { analyzeMotion, motionAt, summariseMotion, type MotionProfile } from "./video-motion";

const execFileAsync = promisify(execFile);

export interface ExtractedFrames {
  /** Base64-encoded JPEG frames, sampled in chronological order. */
  frames: string[];
  /** Timestamped samples with the reason each frame was selected. */
  samples: FrameSample[];
  mediaType: "image/jpeg";
  /** The resolved on-disk path that was read, or null if none was usable. */
  sourcePath: string | null;
  /** Duration of the source video when ffprobe can read it. */
  durationSeconds: number | null;
  /** Scene-change timestamps detected by ffmpeg, used for multi-stage videos. */
  sceneChanges: number[];
  /** Plain-language motion timeline derived from inter-frame optical difference. */
  motionSummary: string;
  /** Human-readable explanation, surfaced to the operator when frames are absent. */
  note: string;
}

export type SampleReason =
  | "start"
  | "end"
  | "scene-boundary"
  | "segment-midpoint"
  | "uniform"
  | "action"
  | "action-pre"
  | "action-post";

export interface FrameSample {
  /** Base64-encoded JPEG frame. */
  data: string;
  /** Timestamp in the source video. */
  timestampSeconds: number;
  /** Why the adaptive sampler kept this frame. */
  reason: SampleReason;
  /** Human-readable label for model prompts and debug output. */
  label: string;
  /**
   * Optional zoomed crop centred on the moving region (gripper/contact) at this
   * timestamp, as a base64 JPEG. Lets the model read gripper open/closed state
   * and the handled object, which is unreadable in the wide frame.
   */
  roi?: { data: string; label: string };
}

export interface PlannedSample {
  timestampSeconds: number;
  reason: SampleReason;
  priority: number;
}

/**
 * Resolve a stored `videoUrl` to a readable file on disk. Public-relative URLs
 * (the bundled demo, e.g. "/demos/multitask.mp4") map into `public/`. Browser
 * `blob:`/`data:` URLs are not readable here. Absolute filesystem paths are
 * used as-is.
 */
function resolveVideoPath(videoUrl: string): { path: string | null; note: string } {
  if (!videoUrl) return { path: null, note: "No video source was recorded for this task." };
  if (videoUrl.startsWith("blob:") || videoUrl.startsWith("data:")) {
    return {
      path: null,
      note: "Uploaded videos stay in the browser as a blob URL, so the server cannot read their frames yet. Frame analysis currently runs on server-hosted videos (such as the bundled demo).",
    };
  }

  let relativePath = videoUrl;
  if (videoUrl.startsWith("http://") || videoUrl.startsWith("https://")) {
    try {
      relativePath = new URL(videoUrl).pathname;
    } catch {
      return { path: null, note: `Could not parse video URL: ${videoUrl}` };
    }
  }

  const candidates: string[] = [];
  if (relativePath.startsWith("/")) {
    candidates.push(join(process.cwd(), "public", relativePath));
  } else {
    candidates.push(relativePath, join(process.cwd(), "public", relativePath));
  }

  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) {
    return { path: null, note: `Video file not found on the server for: ${videoUrl}` };
  }
  return { path: found, note: "" };
}

async function probeDurationSeconds(path: string): Promise<number | null> {
  try {
    const { stdout } = await execFileAsync("ffprobe", [
      "-v", "error",
      "-show_entries", "format=duration",
      "-of", "default=noprint_wrappers=1:nokey=1",
      path,
    ]);
    const duration = Number.parseFloat(stdout.trim());
    return Number.isFinite(duration) && duration > 0 ? duration : null;
  } catch {
    return null;
  }
}

function clampTimestamp(value: number, duration: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(value, 0.15), Math.max(0.15, duration - 0.15));
}

function pushDeduped(
  samples: PlannedSample[],
  sample: PlannedSample,
  minDistanceSeconds: number,
) {
  const exists = samples.some(
    (item) => Math.abs(item.timestampSeconds - sample.timestampSeconds) < minDistanceSeconds,
  );
  if (!exists) samples.push(sample);
}

export function parseSceneTimestamps(stderr: string, durationSeconds: number | null): number[] {
  const found = new Set<number>();
  const pattern = /pts_time:([0-9.]+)/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(stderr)) !== null) {
    const timestamp = Number.parseFloat(match[1]);
    if (!Number.isFinite(timestamp)) continue;
    if (timestamp < 0.5) continue;
    if (durationSeconds && timestamp > durationSeconds - 0.5) continue;
    found.add(Number(timestamp.toFixed(2)));
  }

  return [...found].sort((a, b) => a - b);
}

async function detectSceneChanges(
  path: string,
  durationSeconds: number | null,
  threshold: number,
): Promise<number[]> {
  try {
    const { stderr } = await execFileAsync(
      "ffmpeg",
      [
        "-hide_banner",
        "-i", path,
        "-vf", `select='gt(scene,${threshold})',showinfo`,
        "-an",
        "-f", "null",
        "-",
      ],
      { maxBuffer: 4 * 1024 * 1024 },
    );
    return parseSceneTimestamps(stderr, durationSeconds);
  } catch (error) {
    const stderr = typeof error === "object" && error && "stderr" in error
      ? String((error as { stderr?: unknown }).stderr ?? "")
      : "";
    return parseSceneTimestamps(stderr, durationSeconds);
  }
}

export function buildAdaptiveSamplePlan(
  durationSeconds: number | null,
  sceneChanges: number[],
  maxFrames: number,
  activityPeaks: number[] = [],
): PlannedSample[] {
  const duration = durationSeconds && durationSeconds > 0 ? durationSeconds : maxFrames / 2;
  const cappedMaxFrames = Math.max(6, Math.min(maxFrames, 64));
  const minDistanceSeconds = duration > 45 ? 0.45 : 0.25;
  const samples: PlannedSample[] = [];

  // Motion activity peaks are the highest-value evidence: the instants a grasp,
  // release, or contact is most likely. Give them top priority so they always
  // survive the frame cap, and bracket each peak with a before/after frame so
  // the model can read the state transition (open→closed, held→released), not
  // just the instant of contact.
  const PEAK_BRACKET_SECONDS = 0.45;
  activityPeaks
    .filter((timestamp) => timestamp > 0.3 && timestamp < duration - 0.3)
    .forEach((timestamp) => {
      pushDeduped(samples, {
        timestampSeconds: clampTimestamp(timestamp, duration),
        reason: "action",
        priority: -1,
      }, minDistanceSeconds);
      pushDeduped(samples, {
        timestampSeconds: clampTimestamp(timestamp - PEAK_BRACKET_SECONDS, duration),
        reason: "action-pre",
        priority: 0,
      }, minDistanceSeconds);
      pushDeduped(samples, {
        timestampSeconds: clampTimestamp(timestamp + PEAK_BRACKET_SECONDS, duration),
        reason: "action-post",
        priority: 0,
      }, minDistanceSeconds);
    });

  pushDeduped(samples, {
    timestampSeconds: clampTimestamp(0.45, duration),
    reason: "start",
    priority: 0,
  }, minDistanceSeconds);
  pushDeduped(samples, {
    timestampSeconds: clampTimestamp(duration - 0.45, duration),
    reason: "end",
    priority: 0,
  }, minDistanceSeconds);

  const usableScenes = sceneChanges
    .filter((timestamp) => timestamp > 0.6 && timestamp < duration - 0.6)
    .sort((a, b) => a - b);

  if (usableScenes.length > 0) {
    const boundaries = [0, ...usableScenes, duration];
    for (let index = 0; index < boundaries.length - 1; index += 1) {
      const start = boundaries[index];
      const end = boundaries[index + 1];
      if (end - start >= 0.8) {
        pushDeduped(samples, {
          timestampSeconds: clampTimestamp(start + (end - start) / 2, duration),
          reason: "segment-midpoint",
          priority: 1,
        }, minDistanceSeconds);
      }
    }

    usableScenes.forEach((timestamp) => {
      pushDeduped(samples, {
        timestampSeconds: clampTimestamp(timestamp + 0.3, duration),
        reason: "scene-boundary",
        priority: 1,
      }, minDistanceSeconds);
    });
  } else {
    const inferredSegments = Math.min(
      Math.max(3, Math.ceil(duration / 5)),
      Math.max(3, Math.floor(cappedMaxFrames / 2)),
    );
    for (let index = 0; index < inferredSegments; index += 1) {
      const start = (duration * index) / inferredSegments;
      const end = (duration * (index + 1)) / inferredSegments;
      pushDeduped(samples, {
        timestampSeconds: clampTimestamp(start + (end - start) / 2, duration),
        reason: "segment-midpoint",
        priority: 1,
      }, minDistanceSeconds);
    }
  }

  // Second-by-second baseline coverage: one uniform frame per integer second so
  // no stage is missed between scene cuts. If the clip is longer than the frame
  // budget, fall back to evenly spaced uniform frames. Action/scene frames keep
  // higher priority, so dense uniform coverage never crowds out the key moments.
  const secondGridFits = Math.floor(duration) <= cappedMaxFrames;
  if (secondGridFits) {
    for (let second = 1; second < duration; second += 1) {
      pushDeduped(samples, {
        timestampSeconds: clampTimestamp(second, duration),
        reason: "uniform",
        priority: 2,
      }, minDistanceSeconds);
    }
  } else {
    for (let index = 1; index <= cappedMaxFrames; index += 1) {
      const timestamp = (duration * index) / (cappedMaxFrames + 1);
      pushDeduped(samples, {
        timestampSeconds: clampTimestamp(timestamp, duration),
        reason: "uniform",
        priority: 2,
      }, minDistanceSeconds);
    }
  }

  if (samples.length > cappedMaxFrames) {
    const selected = [...samples]
      .sort((a, b) => a.priority - b.priority || a.timestampSeconds - b.timestampSeconds)
      .slice(0, cappedMaxFrames);
    return selected.sort((a, b) => a.timestampSeconds - b.timestampSeconds);
  }

  return samples.sort((a, b) => a.timestampSeconds - b.timestampSeconds);
}

/**
 * Extract a zoomed crop centred on the moving region at this timestamp. The
 * centroid comes from the motion field, so the inset frames the gripper/contact
 * tightly enough that the model can read gripper open/closed and the part.
 */
async function extractRoiAt(
  path: string,
  timestampSeconds: number,
  centroid: { x: number; y: number },
  workDir: string,
  index: number,
): Promise<string | null> {
  const cropFraction = 0.42;
  const half = cropFraction / 2;
  const cx = Math.min(Math.max(centroid.x, half), 1 - half);
  const cy = Math.min(Math.max(centroid.y, half), 1 - half);
  const output = join(workDir, `roi-${String(index + 1).padStart(3, "0")}.jpg`);
  const crop = `crop=iw*${cropFraction}:ih*${cropFraction}:iw*${(cx - half).toFixed(4)}:ih*${(cy - half).toFixed(4)},scale=384:-1`;
  try {
    await execFileAsync("ffmpeg", [
      "-y",
      "-ss", timestampSeconds.toFixed(3),
      "-i", path,
      "-frames:v", "1",
      "-vf", crop,
      "-q:v", "3",
      output,
    ]);
    const buf = await readFile(output);
    return buf.toString("base64");
  } catch {
    return null;
  }
}

async function extractFrameAt(
  path: string,
  sample: PlannedSample,
  width: number,
  workDir: string,
  index: number,
  profile: MotionProfile | null,
): Promise<FrameSample | null> {
  const output = join(workDir, `f-${String(index + 1).padStart(3, "0")}.jpg`);
  try {
    await execFileAsync("ffmpeg", [
      "-y",
      "-ss", sample.timestampSeconds.toFixed(3),
      "-i", path,
      "-frames:v", "1",
      "-vf", `scale=${width}:-1`,
      "-q:v", "4",
      output,
    ]);
    const buf = await readFile(output);
    const timestamp = Number(sample.timestampSeconds.toFixed(2));

    // Attach a zoomed gripper/contact inset for the moments that matter most —
    // detected action peaks and scene-boundary frames — where reading the
    // gripper state and handled object decides pick vs. place.
    let roi: FrameSample["roi"];
    if (profile && (sample.reason === "action" || sample.reason === "scene-boundary")) {
      const motion = motionAt(profile, sample.timestampSeconds);
      if (motion?.centroid) {
        const data = await extractRoiAt(path, sample.timestampSeconds, motion.centroid, workDir, index);
        if (data) {
          roi = {
            data,
            label: `Zoom on activity region at ${timestamp.toFixed(2)}s (gripper/contact detail)`,
          };
        }
      }
    }

    return {
      data: buf.toString("base64"),
      timestampSeconds: timestamp,
      reason: sample.reason,
      label: `Frame ${index + 1} at ${timestamp.toFixed(2)}s (${sample.reason})`,
      roi,
    };
  } catch {
    return null;
  }
}

/**
 * Extract timestamped JPEG evidence frames. The sampler combines scene-change
 * boundaries, inferred segment midpoints, and uniform coverage so longer
 * multi-stage videos do not collapse into a single pick/place cycle.
 */
export async function extractVideoFrames(
  videoUrl: string,
  opts: { maxFrames?: number; width?: number; sceneThreshold?: number } = {},
): Promise<ExtractedFrames> {
  const maxFrames = Math.max(6, Math.min(opts.maxFrames ?? 32, 64));
  const width = opts.width ?? 512;
  const sceneThreshold = opts.sceneThreshold ?? 0.16;
  const { path, note } = resolveVideoPath(videoUrl);
  if (!path) {
    return {
      frames: [],
      samples: [],
      mediaType: "image/jpeg",
      sourcePath: null,
      durationSeconds: null,
      sceneChanges: [],
      motionSummary: "",
      note,
    };
  }

  const duration = await probeDurationSeconds(path);
  // Computer-vision motion pass: motion-aware keyframes, scene-cut detection,
  // and per-frame regions of interest. Runs alongside the luma scene detector;
  // either source of stage boundaries is merged into the sample plan.
  const motion = await analyzeMotion(path, { durationSeconds: duration }).catch(() => null);
  const sceneFromLuma = await detectSceneChanges(path, duration, sceneThreshold);
  const sceneChanges = motion?.ok
    ? [...new Set([...sceneFromLuma, ...motion.cuts])].sort((a, b) => a - b)
    : sceneFromLuma;
  const activityPeaks = motion?.ok ? motion.activityPeaks : [];
  const motionSummary = motion?.ok ? summariseMotion(motion) : "";
  const plan = buildAdaptiveSamplePlan(duration, sceneChanges, maxFrames, activityPeaks);

  let workDir: string | null = null;
  try {
    workDir = await mkdtemp(join(tmpdir(), "aurevix-frames-"));
    const samples = (
      await Promise.all(
        plan.map((sample, index) =>
          extractFrameAt(path, sample, width, workDir as string, index, motion?.ok ? motion : null),
        ),
      )
    ).filter((sample): sample is FrameSample => Boolean(sample));

    if (samples.length === 0) {
      return {
        frames: [],
        samples: [],
        mediaType: "image/jpeg",
        sourcePath: path,
        durationSeconds: duration,
        sceneChanges,
        motionSummary,
        note: "ffmpeg produced no frames from the video.",
      };
    }
    return {
      frames: samples.map((sample) => sample.data),
      samples,
      mediaType: "image/jpeg",
      sourcePath: path,
      durationSeconds: duration,
      sceneChanges,
      motionSummary,
      note: "",
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "frame extraction failed";
    return {
      frames: [],
      samples: [],
      mediaType: "image/jpeg",
      sourcePath: path,
      durationSeconds: duration,
      sceneChanges,
      motionSummary: "",
      note: `Could not extract frames (is ffmpeg installed?): ${reason}`,
    };
  } finally {
    if (workDir) await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}
