import { describe, expect, it } from "vitest";
import { buildAdaptiveSamplePlan, parseSceneTimestamps } from "@/lib/video-frames";

describe("adaptive video frame sampling", () => {
  it("keeps segment midpoints across a seven-part demonstration", () => {
    const plan = buildAdaptiveSamplePlan(
      35,
      [5, 10, 15, 20, 25, 30],
      24,
    );

    const midpoints = plan.filter((sample) => sample.reason === "segment-midpoint");
    expect(plan.length).toBeLessThanOrEqual(24);
    expect(midpoints.length).toBeGreaterThanOrEqual(7);
    expect(midpoints.map((sample) => Math.round(sample.timestampSeconds))).toEqual(
      expect.arrayContaining([3, 8, 13, 18, 23, 28, 33]),
    );
  });

  it("falls back to inferred temporal segments when scene detection is absent", () => {
    const plan = buildAdaptiveSamplePlan(35, [], 24);
    const midpoints = plan.filter((sample) => sample.reason === "segment-midpoint");

    expect(midpoints.length).toBeGreaterThanOrEqual(7);
    expect(plan[0].reason).toBe("start");
    expect(plan.at(-1)?.reason).toBe("end");
  });

  it("parses ffmpeg showinfo scene timestamps and ignores edge noise", () => {
    const stderr = [
      "[Parsed_showinfo_1] n:   0 pts:      0 pts_time:0.04",
      "[Parsed_showinfo_1] n: 120 pts:  61440 pts_time:5.00",
      "[Parsed_showinfo_1] n: 240 pts: 122880 pts_time:10.00",
      "[Parsed_showinfo_1] n: 845 pts: 432640 pts_time:34.80",
    ].join("\n");

    expect(parseSceneTimestamps(stderr, 35)).toEqual([5, 10]);
  });
});
