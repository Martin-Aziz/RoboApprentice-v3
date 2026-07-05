import { describe, expect, it } from "vitest";
import {
  buildLocalPerceptionEvidence,
  summarisePerceptionEvidence,
} from "@/lib/perception-evidence";
import type { ExtractedFrames } from "@/lib/video-frames";
import type { MotionProfile } from "@/lib/video-motion";

function makeExtracted(overrides: Partial<ExtractedFrames> = {}): ExtractedFrames {
  return {
    frames: ["abc"],
    samples: [
      { data: "abc", timestampSeconds: 0.5, reason: "start", label: "Frame 1 at 0.50s (start)" },
      { data: "def", timestampSeconds: 3.2, reason: "action", label: "Frame 2 at 3.20s (action)" },
    ],
    mediaType: "image/jpeg",
    sourcePath: "/tmp/video.mp4",
    durationSeconds: 10,
    sceneChanges: [5],
    motionSummary: "some motion",
    motion: null,
    note: "",
    ...overrides,
  };
}

function makeMotion(): MotionProfile {
  const frames = Array.from({ length: 40 }, (_, i) => ({
    t: i * 0.25,
    energy: i === 12 ? 8 : 1.8,
    centroid: { x: i < 20 ? 0.25 : 0.75, y: 0.5 },
    bbox: { x0: 0.2, y0: 0.4, x1: 0.4, y1: 0.6 },
    isCut: false,
  }));
  return {
    fps: 4,
    width: 64,
    height: 36,
    frames,
    cuts: [5],
    segments: [
      {
        startSeconds: 0,
        endSeconds: 5,
        peakSeconds: 3,
        peakEnergy: 8,
        peakCentroid: { x: 0.25, y: 0.5 },
        verticalTrend: 0.2,
        horizontalTrend: 0.02,
        summary: "downward descent (likely approach/contact).",
      },
      {
        startSeconds: 5,
        endSeconds: 10,
        peakSeconds: 7,
        peakEnergy: 6,
        peakCentroid: { x: 0.75, y: 0.5 },
        verticalTrend: -0.2,
        horizontalTrend: 0.3,
        summary: "upward lift (likely retract after grip), then rightward transfer.",
      },
    ],
    activityPeaks: [3, 7],
    zones: [
      { x: 0.25, y: 0.5, radius: 0.1, strength: 0.55, firstSeconds: 0.5, lastSeconds: 4.5 },
      { x: 0.75, y: 0.5, radius: 0.1, strength: 0.45, firstSeconds: 5.2, lastSeconds: 9.8 },
    ],
    ok: true,
  };
}

describe("buildLocalPerceptionEvidence", () => {
  it("derives tracks from motion zones and events from segments/cuts", () => {
    const bundle = buildLocalPerceptionEvidence("/demos/test.mp4", makeExtracted(), makeMotion());

    expect(bundle.provider.mode).toBe("local-fallback");
    expect(bundle.fallbackReason).toBeTruthy();
    expect(bundle.tracks).toHaveLength(2);
    expect(bundle.tracks[0].trackId).toBe("zone-track-1");
    expect(bundle.tracks[0].source).toBe("motion-cluster");
    expect(bundle.tracks[0].score).toBeGreaterThan(0);
    expect(bundle.tracks[0].score).toBeLessThanOrEqual(1);

    const types = bundle.events.map((event) => event.type);
    expect(types).toContain("scene_cut");
    expect(types).toContain("motion_peak");
    expect(types).toContain("grasp_candidate");
    expect(types).toContain("release_candidate");
    expect(types).toContain("transfer");
    // Events are chronological.
    const timestamps = bundle.events.map((event) => event.timestampSeconds);
    expect(timestamps).toEqual([...timestamps].sort((a, b) => a - b));
  });

  it("keeps detections/masks empty and depth unavailable in the local fallback", () => {
    const bundle = buildLocalPerceptionEvidence("/demos/test.mp4", makeExtracted(), makeMotion());
    expect(bundle.detections).toEqual([]);
    expect(bundle.masks).toEqual([]);
    expect(bundle.depth.available).toBe(false);
    expect(bundle.depth.source).toBe("none");
  });

  it("caps confidence well below certainty and never exceeds 0.6 locally", () => {
    const bundle = buildLocalPerceptionEvidence("/demos/test.mp4", makeExtracted(), makeMotion());
    expect(bundle.sceneConfidence).toBeGreaterThan(0);
    expect(bundle.sceneConfidence).toBeLessThanOrEqual(0.6);
  });

  it("degrades gracefully when video and motion are unavailable", () => {
    const bundle = buildLocalPerceptionEvidence(
      "blob:local",
      makeExtracted({ frames: [], samples: [], sourcePath: null, durationSeconds: null, note: "no video" }),
      null,
    );
    expect(bundle.tracks).toEqual([]);
    expect(bundle.events).toEqual([]);
    expect(bundle.sceneConfidence).toBe(0);
    expect(bundle.warnings.join(" ")).toMatch(/no video|Motion analysis unavailable/i);
  });

  it("summarises the bundle with tracks, events, and caveats", () => {
    const summary = summarisePerceptionEvidence(
      buildLocalPerceptionEvidence("/demos/test.mp4", makeExtracted(), makeMotion()),
    );
    expect(summary).toContain("local-fallback");
    expect(summary).toContain("zone-track-1");
    expect(summary).toContain("Motion events:");
    expect(summary).toContain("Evidence caveats:");
    expect(summary).toMatch(/Overall evidence confidence: 0\.\d\d/);
  });
});
