/**
 * Perception evidence contract for the teach pipeline.
 *
 * This module defines the layered-perception interface between raw video
 * analysis and scene interpretation. The bundle it produces is the single
 * evidence artifact the interpretation prompt (and later, planning) consumes:
 * sampled frames, detected objects, object tracks, motion events, depth/size
 * hints, and honest confidence/fallback metadata.
 *
 * Today the only implemented provider is the deterministic local fallback,
 * which derives tracks and events from the existing ffmpeg motion pass
 * (activity zones, segments, cuts) and the adaptive frame sampler. The types
 * are deliberately shaped so that Grounding DINO (detections), SAM 2 (masks),
 * CoTracker (tracks), and Depth Anything V2 (depth) can each populate their
 * section later without changing any consumer.
 *
 * Pure and server-side: no model calls, no browser APIs, unit-testable.
 */

import type { ExtractedFrames } from "./video-frames";
import type { MotionProfile } from "./video-motion";
import { describeFramePosition } from "./video-motion";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** One 2D detection in a specific sampled frame (Grounding DINO shaped). */
export interface PerceptionFrameDetection {
  /** Timestamp of the frame the detection was made in. */
  timestampSeconds: number;
  /** Open-vocabulary label, e.g. "blue tote", "robot gripper". */
  label: string;
  /** Detector confidence, 0–1. */
  score: number;
  /** Normalised frame-space bounding box (0–1). */
  bbox: { x0: number; y0: number; x1: number; y1: number };
  /** Track this detection was associated with, when tracking ran. */
  trackId?: string;
}

/** A persistent object hypothesis across time (CoTracker / zone-cluster shaped). */
export interface PerceptionObjectTrack {
  trackId: string;
  /** Best label for the tracked object ("activity zone N" in local fallback). */
  label: string;
  /** Aggregate confidence that this track is a real, distinct object/station. */
  score: number;
  firstSeconds: number;
  lastSeconds: number;
  /** Sparse normalised centroid path over time. */
  path: Array<{ t: number; x: number; y: number }>;
  /** Approximate normalised extent of the tracked region. */
  radius: number;
  /** Share of total observed motion attributed to this track (local fallback). */
  motionShare?: number;
  /** Which perception layer produced the track. */
  source: "motion-cluster" | "cotracker" | "detector-association";
}

/** Segmentation summary for one mask (SAM 2 shaped; empty in local fallback). */
export interface PerceptionMaskSummary {
  maskId: string;
  trackId?: string;
  /** Fraction of the frame area covered by the mask, 0–1. */
  areaFraction: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
  source: "sam2" | "none";
}

/** Monocular depth summary (Depth Anything V2 shaped). */
export interface PerceptionDepthSummary {
  available: boolean;
  /**
   * Relative nearness per track, 0 (far) to 1 (near camera). Monocular depth is
   * relative only — never treat these as metric distances.
   */
  relativeNearness: Array<{ trackId: string; nearness: number }>;
  note: string;
  source: "depth-anything-v2" | "none";
}

export type PerceptionEventType =
  | "motion_peak"
  | "scene_cut"
  | "grasp_candidate"
  | "release_candidate"
  | "dwell"
  | "transfer";

/** A discrete moment of interest in the demonstration. */
export interface PerceptionEvent {
  type: PerceptionEventType;
  timestampSeconds: number;
  /** Plain-language description suitable for prompting and operator review. */
  description: string;
  confidence: number;
  /** Track the event happened at/near, when attributable. */
  trackId?: string;
}

export interface PerceptionProviderMetadata {
  name: string;
  /** Perception models involved (empty in the local fallback). */
  models: string[];
  mode: "local-fallback" | "advanced";
}

/** The complete evidence artifact handed to interpretation and planning. */
export interface PerceptionEvidenceBundle {
  /** The task's stored video URL/path. */
  videoUrl: string;
  /** Resolved on-disk path actually analysed, or null when unreadable. */
  sourcePath: string | null;
  durationSeconds: number | null;
  /** Timestamps + selection reasons of the frames sampled as visual evidence. */
  sampledFrames: Array<{ timestampSeconds: number; reason: string }>;
  detections: PerceptionFrameDetection[];
  tracks: PerceptionObjectTrack[];
  events: PerceptionEvent[];
  masks: PerceptionMaskSummary[];
  depth: PerceptionDepthSummary;
  /** Overall confidence that the evidence describes the scene well, 0–1. */
  sceneConfidence: number;
  warnings: string[];
  provider: PerceptionProviderMetadata;
  /** Why advanced perception did not run (always set in local fallback). */
  fallbackReason?: string;
}

// ---------------------------------------------------------------------------
// Local deterministic fallback provider
// ---------------------------------------------------------------------------

const LOCAL_FALLBACK_REASON =
  "Advanced perception models (Grounding DINO, SAM 2, CoTracker, Depth Anything V2) are not installed; evidence derived from ffmpeg motion analysis and frame sampling only.";

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** Tracks from recurring motion zones: each zone is a persistent-station hypothesis. */
function tracksFromMotion(motion: MotionProfile): PerceptionObjectTrack[] {
  return motion.zones.map((zone, index) => {
    const trackId = `zone-track-${index + 1}`;
    // Sparse centroid path: frames whose centroid falls inside this zone.
    const path = motion.frames
      .filter(
        (frame) =>
          !frame.isCut &&
          frame.centroid &&
          Math.hypot(frame.centroid.x - zone.x, frame.centroid.y - zone.y) <= zone.radius * 1.5,
      )
      .filter((_, i) => i % 4 === 0)
      .slice(0, 40)
      .map((frame) => ({ t: frame.t, x: frame.centroid!.x, y: frame.centroid!.y }));
    return {
      trackId,
      label: `activity zone ${index + 1} (${describeFramePosition(zone.x, zone.y)} of frame)`,
      score: clamp01(0.3 + zone.strength * 0.6),
      firstSeconds: zone.firstSeconds,
      lastSeconds: zone.lastSeconds,
      path,
      radius: zone.radius,
      motionShare: zone.strength,
      source: "motion-cluster" as const,
    };
  });
}

function nearestTrackId(
  tracks: PerceptionObjectTrack[],
  motion: MotionProfile,
  timestampSeconds: number,
): string | undefined {
  const frame = motion.frames.reduce<{ d: number; c: { x: number; y: number } | null }>(
    (best, f) => {
      if (f.isCut || !f.centroid) return best;
      const d = Math.abs(f.t - timestampSeconds);
      return d < best.d ? { d, c: f.centroid } : best;
    },
    { d: Infinity, c: null },
  );
  if (!frame.c) return undefined;
  let bestId: string | undefined;
  let bestDistance = Infinity;
  for (const track of tracks) {
    const zonePoint = track.path[0];
    if (!zonePoint) continue;
    const cx = track.path.reduce((s, p) => s + p.x, 0) / track.path.length;
    const cy = track.path.reduce((s, p) => s + p.y, 0) / track.path.length;
    const distance = Math.hypot(frame.c.x - cx, frame.c.y - cy);
    if (distance < bestDistance && distance <= track.radius * 2) {
      bestDistance = distance;
      bestId = track.trackId;
    }
  }
  return bestId;
}

/** Events from the motion timeline: cuts, activity peaks, and grasp/release candidates. */
function eventsFromMotion(motion: MotionProfile, tracks: PerceptionObjectTrack[]): PerceptionEvent[] {
  const events: PerceptionEvent[] = [];

  for (const cut of motion.cuts) {
    events.push({
      type: "scene_cut",
      timestampSeconds: cut,
      description: `Hard scene cut at ${cut.toFixed(1)}s — an edit boundary, potentially a distinct workcell stage.`,
      confidence: 0.85,
    });
  }

  for (const segment of motion.segments) {
    if (segment.peakEnergy < 2.5) {
      events.push({
        type: "dwell",
        timestampSeconds: segment.peakSeconds,
        description: `Low-motion interval ${segment.startSeconds.toFixed(1)}–${segment.endSeconds.toFixed(1)}s (hold or transition).`,
        confidence: 0.5,
      });
      continue;
    }
    const trackId = nearestTrackId(tracks, motion, segment.peakSeconds);
    events.push({
      type: "motion_peak",
      timestampSeconds: segment.peakSeconds,
      description: `Activity peak at ${segment.peakSeconds.toFixed(1)}s: ${segment.summary}`,
      confidence: 0.6,
      trackId,
    });
    // Vertical descent ending in a peak reads as a grasp/contact candidate;
    // a lift after the peak reads as a retract-after-grip. These are candidates,
    // not confirmations — grasp truth requires reading the gripper in frames.
    if (segment.verticalTrend > 0.12) {
      events.push({
        type: "grasp_candidate",
        timestampSeconds: segment.peakSeconds,
        description: `Downward approach into contact around ${segment.peakSeconds.toFixed(1)}s — candidate grasp or place; confirm gripper state in frames.`,
        confidence: 0.45,
        trackId,
      });
    } else if (segment.verticalTrend < -0.12) {
      events.push({
        type: "release_candidate",
        timestampSeconds: segment.peakSeconds,
        description: `Upward lift around ${segment.peakSeconds.toFixed(1)}s — candidate retract after grip or release; confirm in frames.`,
        confidence: 0.45,
        trackId,
      });
    }
    if (Math.abs(segment.horizontalTrend) > 0.12) {
      events.push({
        type: "transfer",
        timestampSeconds: segment.peakSeconds,
        description: `Lateral ${segment.horizontalTrend > 0 ? "rightward" : "leftward"} transfer in segment ${segment.startSeconds.toFixed(1)}–${segment.endSeconds.toFixed(1)}s.`,
        confidence: 0.5,
        trackId,
      });
    }
  }

  return events.sort((a, b) => a.timestampSeconds - b.timestampSeconds);
}

/**
 * Builds the perception evidence bundle from the existing local analysis
 * (frame sampling + motion pass). Deterministic, no model dependencies.
 * When advanced perception providers exist, they replace this builder while
 * emitting the same bundle shape.
 */
export function buildLocalPerceptionEvidence(
  videoUrl: string,
  extracted: ExtractedFrames,
  motion: MotionProfile | null,
): PerceptionEvidenceBundle {
  const warnings: string[] = [];
  const sampledFrames = extracted.samples.map((sample) => ({
    timestampSeconds: sample.timestampSeconds,
    reason: sample.reason,
  }));

  const tracks = motion?.ok ? tracksFromMotion(motion) : [];
  const events = motion?.ok ? eventsFromMotion(motion, tracks) : [];

  if (!extracted.sourcePath) {
    warnings.push(extracted.note || "Video was not readable on the server; no visual evidence available.");
  }
  if (!motion?.ok) {
    warnings.push("Motion analysis unavailable; no object tracks or motion events derived.");
  }
  if (tracks.length > 0) {
    warnings.push(
      "Object tracks are motion-cluster hypotheses (recurring activity locations), not verified object detections.",
    );
  }

  // Confidence reflects evidence richness, capped well below certainty because
  // the local fallback never verifies object identity.
  let sceneConfidence = 0;
  if (extracted.samples.length > 0) sceneConfidence += 0.25;
  if (motion?.ok) sceneConfidence += 0.15;
  sceneConfidence += Math.min(tracks.length, 4) * 0.05;
  sceneConfidence = clamp01(Math.min(sceneConfidence, 0.6));

  return {
    videoUrl,
    sourcePath: extracted.sourcePath,
    durationSeconds: extracted.durationSeconds,
    sampledFrames,
    detections: [],
    tracks,
    events,
    masks: [],
    depth: {
      available: false,
      relativeNearness: [],
      note: "Monocular depth estimation not available in the local fallback; object sizes are unverified hints.",
      source: "none",
    },
    sceneConfidence,
    warnings,
    provider: {
      name: "aurevix-local-motion",
      models: [],
      mode: "local-fallback",
    },
    fallbackReason: LOCAL_FALLBACK_REASON,
  };
}

// ---------------------------------------------------------------------------
// Prompt summary
// ---------------------------------------------------------------------------

/** Compact model/operator-readable summary of the evidence bundle. */
export function summarisePerceptionEvidence(bundle: PerceptionEvidenceBundle): string {
  const lines: string[] = [];
  lines.push(
    `Perception provider: ${bundle.provider.name} (${bundle.provider.mode}${bundle.provider.models.length ? `, models: ${bundle.provider.models.join(", ")}` : ""}).`,
  );
  if (bundle.fallbackReason) lines.push(`Fallback: ${bundle.fallbackReason}`);
  lines.push(
    `Evidence: ${bundle.sampledFrames.length} sampled frame(s), ${bundle.detections.length} detection(s), ${bundle.tracks.length} object track(s), ${bundle.events.length} motion event(s), depth ${bundle.depth.available ? "available (relative only)" : "unavailable"}.`,
  );

  if (bundle.tracks.length) {
    lines.push("Object tracks (persistent activity locations):");
    for (const track of bundle.tracks) {
      lines.push(
        `- ${track.trackId}: ${track.label}, active ${track.firstSeconds.toFixed(1)}–${track.lastSeconds.toFixed(1)}s` +
          `${track.motionShare !== undefined ? `, ${Math.round(track.motionShare * 100)}% of motion` : ""}, confidence ${track.score.toFixed(2)}.`,
      );
    }
  }

  if (bundle.events.length) {
    lines.push("Motion events:");
    for (const event of bundle.events.slice(0, 12)) {
      lines.push(`- [${event.timestampSeconds.toFixed(1)}s] ${event.type}${event.trackId ? ` @ ${event.trackId}` : ""}: ${event.description}`);
    }
  }

  if (bundle.warnings.length) {
    lines.push("Evidence caveats:");
    for (const warning of bundle.warnings) lines.push(`- ${warning}`);
  }

  lines.push(`Overall evidence confidence: ${bundle.sceneConfidence.toFixed(2)} (0–1).`);
  return lines.join("\n");
}
