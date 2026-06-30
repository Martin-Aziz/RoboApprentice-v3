/**
 * Motion analysis for the vision pipeline.
 *
 * Raw still frames tell a multimodal model *what* is on screen but not *when*
 * the action happens or *where* in the frame the gripper is doing work. This
 * module derives that structure with a lightweight, dependency-free computer
 * vision pass:
 *
 *  1. ffmpeg decodes the video to a small grayscale stream and emits temporal
 *     difference frames (`tblend=all_mode=difference`). Each output pixel is
 *     the absolute luma change between consecutive frames — a motion field.
 *  2. We read that raw `gray8` buffer in Node and, per frame, compute the total
 *     motion energy plus the centroid and bounding box of the moving pixels.
 *  3. From the energy curve we reject hard scene cuts (whole-frame flashes),
 *     segment the clip between cuts, and find the activity peak inside each
 *     segment — the instants a grasp, release, or contact is most likely.
 *
 * The result feeds two improvements upstream: motion-aware keyframe selection
 * (sample where the action is, not just uniformly) and per-frame regions of
 * interest used to crop zoomed gripper insets. It runs in the Node runtime
 * only and degrades gracefully — any failure yields an empty profile and the
 * caller falls back to scene/uniform sampling.
 */

import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export interface MotionFrame {
  /** Timestamp in the source video, seconds. */
  t: number;
  /** Mean absolute inter-frame luma change, 0–255 (whole-frame motion energy). */
  energy: number;
  /** Normalised centroid (0–1) of moving pixels, or null when the frame is still. */
  centroid: { x: number; y: number } | null;
  /** Normalised bounding box (0–1) of the moving region, or null when still. */
  bbox: { x0: number; y0: number; x1: number; y1: number } | null;
  /** True when this frame is a hard scene cut rather than real subject motion. */
  isCut: boolean;
}

export interface MotionSegment {
  startSeconds: number;
  endSeconds: number;
  /** Timestamp of peak activity inside the segment. */
  peakSeconds: number;
  peakEnergy: number;
  /** Centroid trajectory at the peak, used for ROI cropping. */
  peakCentroid: { x: number; y: number } | null;
  /** Net vertical travel of the motion centroid across the segment (+down, -up). */
  verticalTrend: number;
  /** Net horizontal travel of the motion centroid across the segment (+right). */
  horizontalTrend: number;
  /** Plain-language description of the dominant motion in this segment. */
  summary: string;
}

export interface MotionProfile {
  fps: number;
  width: number;
  height: number;
  frames: MotionFrame[];
  /** Hard scene-cut timestamps detected from whole-frame energy flashes. */
  cuts: number[];
  segments: MotionSegment[];
  /** High-priority timestamps to sample (segment activity peaks). */
  activityPeaks: number[];
  /** Whether the analysis produced usable data. */
  ok: boolean;
}

const MOTION_THRESHOLD = 28; // per-pixel luma delta counted as "moving"

function emptyProfile(fps: number, width: number, height: number): MotionProfile {
  return { fps, width, height, frames: [], cuts: [], segments: [], activityPeaks: [], ok: false };
}

/**
 * Per-frame reduction of the raw difference buffer: energy, motion centroid,
 * and motion bounding box. Exported for unit testing without invoking ffmpeg.
 */
export function reduceMotionField(
  buffer: Uint8Array,
  width: number,
  height: number,
  fps: number,
): MotionFrame[] {
  const frameSize = width * height;
  const frameCount = Math.floor(buffer.length / frameSize);
  const frames: MotionFrame[] = [];

  for (let f = 0; f < frameCount; f += 1) {
    const base = f * frameSize;
    let sum = 0;
    let movingPixels = 0;
    let sx = 0;
    let sy = 0;
    let x0 = width;
    let y0 = height;
    let x1 = -1;
    let y1 = -1;

    for (let i = 0; i < frameSize; i += 1) {
      const v = buffer[base + i];
      sum += v;
      if (v > MOTION_THRESHOLD) {
        const x = i % width;
        const y = (i / width) | 0;
        sx += x;
        sy += y;
        movingPixels += 1;
        if (x < x0) x0 = x;
        if (y < y0) y0 = y;
        if (x > x1) x1 = x;
        if (y > y1) y1 = y;
      }
    }

    const energy = sum / frameSize;
    const hasMotion = movingPixels > frameSize * 0.002; // ignore sensor noise
    frames.push({
      t: Number((f / fps).toFixed(3)),
      energy: Number(energy.toFixed(2)),
      centroid: hasMotion
        ? { x: Number((sx / movingPixels / width).toFixed(3)), y: Number((sy / movingPixels / height).toFixed(3)) }
        : null,
      bbox: hasMotion
        ? {
            x0: Number((x0 / width).toFixed(3)),
            y0: Number((y0 / height).toFixed(3)),
            x1: Number((x1 / width).toFixed(3)),
            y1: Number((y1 / height).toFixed(3)),
          }
        : null,
      isCut: false,
    });
  }

  return frames;
}

/**
 * Flag hard scene cuts: a difference frame whose energy is both far above the
 * clip's typical motion and a sharp spike relative to its neighbours. Editing
 * cuts in a spliced warehouse reel light up nearly every pixel, which would
 * otherwise masquerade as the strongest "activity" in the clip.
 */
export function markSceneCuts(frames: MotionFrame[]): number[] {
  if (frames.length < 3) return [];
  const energies = frames.map((frame) => frame.energy);
  const sorted = [...energies].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const cutFloor = Math.max(18, median * 6);
  const cuts: number[] = [];

  for (let i = 0; i < frames.length; i += 1) {
    const prev = energies[i - 1] ?? 0;
    const next = energies[i + 1] ?? 0;
    const neighbourMax = Math.max(prev, next);
    if (energies[i] >= cutFloor && energies[i] > neighbourMax * 3) {
      frames[i].isCut = true;
      cuts.push(frames[i].t);
    }
  }

  return cuts;
}

function describeSegment(
  peakCentroid: { x: number; y: number } | null,
  verticalTrend: number,
  horizontalTrend: number,
  peakEnergy: number,
): string {
  if (peakEnergy < 2.5) return "little or no robot/operator motion (hold or transition)";
  const parts: string[] = [];
  if (verticalTrend > 0.12) parts.push("downward descent (likely approach/contact)");
  else if (verticalTrend < -0.12) parts.push("upward lift (likely retract after grip)");
  if (horizontalTrend > 0.12) parts.push("rightward transfer");
  else if (horizontalTrend < -0.12) parts.push("leftward transfer");
  if (parts.length === 0) parts.push("localised manipulation in place (grip/release or inspection)");
  const where = peakCentroid
    ? ` Activity centred at frame position (${peakCentroid.x.toFixed(2)}, ${peakCentroid.y.toFixed(2)}).`
    : "";
  return `${parts.join(", then ")}.${where}`;
}

/**
 * Split the clip at scene cuts and, within each segment, locate the activity
 * peak and summarise the dominant motion direction from the centroid path.
 */
export function buildSegments(frames: MotionFrame[], cuts: number[], durationSeconds: number): MotionSegment[] {
  const boundaries = [0, ...cuts, durationSeconds];
  const segments: MotionSegment[] = [];

  for (let b = 0; b < boundaries.length - 1; b += 1) {
    const start = boundaries[b];
    const end = boundaries[b + 1];
    if (end - start < 0.6) continue;

    // Ignore the cut frame itself and a short settle window right after it.
    const inSegment = frames.filter(
      (frame) => frame.t >= start + 0.25 && frame.t < end - 0.05 && !frame.isCut,
    );
    if (inSegment.length === 0) continue;

    let peak = inSegment[0];
    for (const frame of inSegment) if (frame.energy > peak.energy) peak = frame;

    const withCentroid = inSegment.filter((frame) => frame.centroid);
    const first = withCentroid[0]?.centroid ?? null;
    const last = withCentroid[withCentroid.length - 1]?.centroid ?? null;
    const verticalTrend = first && last ? last.y - first.y : 0;
    const horizontalTrend = first && last ? last.x - first.x : 0;

    segments.push({
      startSeconds: Number(start.toFixed(2)),
      endSeconds: Number(end.toFixed(2)),
      peakSeconds: peak.t,
      peakEnergy: peak.energy,
      peakCentroid: peak.centroid,
      verticalTrend: Number(verticalTrend.toFixed(3)),
      horizontalTrend: Number(horizontalTrend.toFixed(3)),
      summary: describeSegment(peak.centroid, verticalTrend, horizontalTrend, peak.energy),
    });
  }

  return segments;
}

/** Nearest analysed motion frame to a timestamp, for ROI lookup at sample time. */
export function motionAt(profile: MotionProfile, timestampSeconds: number): MotionFrame | null {
  if (!profile.frames.length) return null;
  let best: MotionFrame | null = null;
  let bestDist = Infinity;
  for (const frame of profile.frames) {
    if (frame.isCut) continue;
    const dist = Math.abs(frame.t - timestampSeconds);
    if (dist < bestDist) {
      bestDist = dist;
      best = frame;
    }
  }
  return best;
}

/** Compact human/model-readable timeline of detected motion segments. */
export function summariseMotion(profile: MotionProfile): string {
  if (!profile.ok || profile.segments.length === 0) return "";
  const lines = profile.segments.map((segment, index) => {
    return `Segment ${index + 1} [${segment.startSeconds.toFixed(1)}–${segment.endSeconds.toFixed(1)}s, peak ${segment.peakSeconds.toFixed(1)}s]: ${segment.summary}`;
  });
  const cutNote = profile.cuts.length
    ? `\n${profile.cuts.length} hard scene cut(s) detected at ${profile.cuts.map((t) => t.toFixed(1)).join(", ")}s — these are edits, not robot motion; treat each segment as a potentially distinct workcell stage.`
    : "";
  return `Motion analysis (derived from inter-frame optical difference):\n${lines.join("\n")}${cutNote}`;
}

export async function analyzeMotion(
  path: string,
  opts: { fps?: number; width?: number; height?: number; durationSeconds?: number | null } = {},
): Promise<MotionProfile> {
  const fps = opts.fps ?? 8;
  const width = opts.width ?? 64;
  const height = opts.height ?? 36;

  let buffer: Buffer;
  try {
    const { stdout } = await execFileAsync(
      "ffmpeg",
      [
        "-hide_banner",
        "-i", path,
        "-vf", `fps=${fps},scale=${width}:${height},format=gray,tblend=all_mode=difference`,
        "-f", "rawvideo",
        "-pix_fmt", "gray",
        "-",
      ],
      { encoding: "buffer", maxBuffer: 256 * 1024 * 1024 },
    );
    buffer = stdout as Buffer;
  } catch {
    return emptyProfile(fps, width, height);
  }

  const frames = reduceMotionField(buffer, width, height, fps);
  if (frames.length < 3) return emptyProfile(fps, width, height);

  const cuts = markSceneCuts(frames);
  const duration = opts.durationSeconds && opts.durationSeconds > 0
    ? opts.durationSeconds
    : frames[frames.length - 1].t + 1 / fps;
  const segments = buildSegments(frames, cuts, duration);
  const activityPeaks = segments
    .filter((segment) => segment.peakEnergy >= 2.5)
    .map((segment) => segment.peakSeconds);

  return { fps, width, height, frames, cuts, segments, activityPeaks, ok: true };
}
