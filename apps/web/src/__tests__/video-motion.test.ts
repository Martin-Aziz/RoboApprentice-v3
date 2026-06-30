import { describe, expect, it } from "vitest";
import {
  buildSegments,
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
      ok: true,
    };

    const text = summariseMotion(profile);
    expect(text).toMatch(/Segment 1/);
    expect(text).toMatch(/2 hard scene cut/);
  });
});
