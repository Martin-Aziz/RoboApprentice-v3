import { describe, expect, it } from "vitest";
import {
  buildSegments,
  computeActivityZones,
  describeFramePosition,
  markSceneCuts,
  reduceMotionField,
  summariseMotion,
  type MotionFrame,
  type MotionProfile,
} from "@/lib/video-motion";

/** Build a width*height gray8 difference frame with a bright blob at (bx,by). */
function makeFrame(width: number, height: number, bx: number, by: number, radius: number): number[] {
  const data: number[] = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const inBlob = Math.abs(x - bx) <= radius && Math.abs(y - by) <= radius;
      data.push(inBlob ? 200 : 0);
    }
  }
  return data;
}

describe("reduceMotionField", () => {
  it("locates the motion centroid and bounding box of a moving blob", () => {
    const w = 16;
    const h = 16;
    const buffer = Uint8Array.from(makeFrame(w, h, 4, 12, 1));
    const [frame] = reduceMotionField(buffer, w, h, 8);

    expect(frame.centroid).not.toBeNull();
    expect(frame.centroid!.x).toBeCloseTo(4 / 16, 1);
    expect(frame.centroid!.y).toBeCloseTo(12 / 16, 1);
    expect(frame.bbox).not.toBeNull();
    expect(frame.energy).toBeGreaterThan(0);
  });

  it("reports no centroid for a still frame", () => {
    const w = 16;
    const h = 16;
    const buffer = new Uint8Array(w * h); // all zero = no motion
    const [frame] = reduceMotionField(buffer, w, h, 8);
    expect(frame.centroid).toBeNull();
    expect(frame.bbox).toBeNull();
  });
});

describe("markSceneCuts", () => {
  it("flags whole-frame energy spikes as cuts but leaves real motion alone", () => {
    const frames: MotionFrame[] = [3, 4, 60, 5, 4, 3].map((energy, i) => ({
      t: i / 8,
      energy,
      centroid: { x: 0.5, y: 0.5 },
      bbox: { x0: 0, y0: 0, x1: 1, y1: 1 },
      isCut: false,
    }));

    const cuts = markSceneCuts(frames);
    expect(cuts).toHaveLength(1);
    expect(frames[2].isCut).toBe(true);
    expect(frames.filter((f) => f.isCut)).toHaveLength(1);
  });
});

describe("buildSegments", () => {
  it("segments between cuts and classifies a descend-then-grip motion", () => {
    // One segment 0..5s: centroid drifts downward (y increases) = approach/contact.
    const frames: MotionFrame[] = [];
    for (let i = 0; i < 40; i += 1) {
      const t = i / 8;
      frames.push({
        t,
        energy: 5,
        centroid: { x: 0.5, y: 0.3 + (t / 5) * 0.4 },
        bbox: { x0: 0.4, y0: 0.2, x1: 0.6, y1: 0.8 },
        isCut: false,
      });
    }

    const segments = buildSegments(frames, [], 5);
    expect(segments).toHaveLength(1);
    expect(segments[0].verticalTrend).toBeGreaterThan(0.12);
    expect(segments[0].summary).toMatch(/descent/i);
  });
});

describe("computeActivityZones", () => {
  function frameAt(t: number, x: number, y: number, energy = 6): MotionFrame {
    return { t, energy, centroid: { x, y }, bbox: { x0: x - 0.05, y0: y - 0.05, x1: x + 0.05, y1: y + 0.05 }, isCut: false };
  }

  it("clusters recurring activity locations into distinct zones", () => {
    const frames: MotionFrame[] = [];
    // Activity alternates between a pick area (left) and a place area (right).
    for (let i = 0; i < 20; i += 1) frames.push(frameAt(i / 8, 0.2, 0.6));
    for (let i = 20; i < 40; i += 1) frames.push(frameAt(i / 8, 0.8, 0.4));

    const zones = computeActivityZones(frames);
    expect(zones).toHaveLength(2);
    const xs = zones.map((zone) => zone.x).sort((a, b) => a - b);
    expect(xs[0]).toBeCloseTo(0.2, 1);
    expect(xs[1]).toBeCloseTo(0.8, 1);
    expect(zones[0].strength + zones[1].strength).toBeCloseTo(1, 1);
  });

  it("ignores cuts, still frames, and negligible clusters", () => {
    const frames: MotionFrame[] = [
      { t: 0, energy: 40, centroid: { x: 0.5, y: 0.5 }, bbox: null, isCut: true },
      { t: 0.125, energy: 0.4, centroid: null, bbox: null, isCut: false },
    ];
    for (let i = 2; i < 30; i += 1) frames.push({ t: i / 8, energy: 6, centroid: { x: 0.3, y: 0.3 }, bbox: null, isCut: false });
    const zones = computeActivityZones(frames);
    expect(zones).toHaveLength(1);
    expect(zones[0].strength).toBe(1);
  });

  it("describes frame positions in plain language", () => {
    expect(describeFramePosition(0.2, 0.2)).toBe("upper-left");
    expect(describeFramePosition(0.5, 0.5)).toBe("mid-center");
    expect(describeFramePosition(0.9, 0.9)).toBe("lower-right");
  });
});

describe("summariseMotion", () => {
  it("renders a timeline with a scene-cut note", () => {
    const profile: MotionProfile = {
      fps: 8,
      width: 64,
      height: 36,
      frames: [],
      cuts: [5, 10],
      segments: [
        {
          startSeconds: 0,
          endSeconds: 5,
          peakSeconds: 3.5,
          peakEnergy: 7,
          peakCentroid: { x: 0.5, y: 0.6 },
          verticalTrend: 0.3,
          horizontalTrend: 0,
          summary: "downward descent (likely approach/contact).",
        },
      ],
      activityPeaks: [3.5],
      zones: [
        { x: 0.25, y: 0.6, radius: 0.08, strength: 0.62, firstSeconds: 0.5, lastSeconds: 4.2 },
        { x: 0.75, y: 0.4, radius: 0.07, strength: 0.38, firstSeconds: 5.5, lastSeconds: 9.8 },
      ],
      ok: true,
    };

    const text = summariseMotion(profile);
    expect(text).toMatch(/Segment 1/);
    expect(text).toMatch(/2 hard scene cut/);
    expect(text).toMatch(/Object activity zones/);
    expect(text).toMatch(/mid-left/);
    expect(text).toMatch(/62% of motion/);
  });
});
