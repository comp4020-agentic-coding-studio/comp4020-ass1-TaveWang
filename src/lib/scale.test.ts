import { describe, expect, it } from "vitest";
import {
  distanceAtPosition,
  formatDistance,
  layerForDistance,
  percentForPosition,
  positionForPercent,
  type Milestone,
} from "./scale";

const SECTION_PX = 900;

const MILESTONES: Milestone[] = [
  { id: "a", name: "A", distanceM: 0, category: "atmosphere", fact: "", source: { name: "", url: "" }, photoAlt: "" },
  { id: "b", name: "B", distanceM: 100_000, category: "atmosphere", fact: "", source: { name: "", url: "" }, photoAlt: "" },
  { id: "c", name: "C", distanceM: 384_400_000, category: "orbit", fact: "", source: { name: "", url: "" }, photoAlt: "" },
];

// Real anchors come from measuring rendered section positions; a uniform
// spacing here is just the simplest stand-in for that in a test.
const ANCHORS = MILESTONES.map((_, i) => i * SECTION_PX);

describe("distanceAtPosition", () => {
  it("starts at the first milestone's distance", () => {
    expect(distanceAtPosition(MILESTONES, ANCHORS, 0)).toBe(0);
  });

  it("reaches each milestone's exact distance at its anchor", () => {
    expect(distanceAtPosition(MILESTONES, ANCHORS, SECTION_PX)).toBeCloseTo(100_000);
    expect(distanceAtPosition(MILESTONES, ANCHORS, SECTION_PX * 2)).toBeCloseTo(384_400_000);
  });

  it("is monotonically non-decreasing as scroll increases", () => {
    let previous = -Infinity;
    for (let px = 0; px <= SECTION_PX * 3; px += 17) {
      const distance = distanceAtPosition(MILESTONES, ANCHORS, px);
      expect(distance).toBeGreaterThanOrEqual(previous);
      previous = distance;
    }
  });

  it("clamps to the last milestone past the end of the journey", () => {
    // exp(log(x)) doesn't always round-trip exactly, so this is toBeCloseTo,
    // not toBe.
    expect(distanceAtPosition(MILESTONES, ANCHORS, SECTION_PX * 50)).toBeCloseTo(384_400_000);
  });

  it("clamps to the first milestone for negative scroll", () => {
    expect(distanceAtPosition(MILESTONES, ANCHORS, -500)).toBe(0);
  });

  it("compresses log-linearly, not linearly, once past a zero-distance milestone", () => {
    // Halfway (in scroll terms) between 100,000 m and 384,400,000 m should be
    // far below the linear midpoint — that's the whole point of the log
    // interpolation: most of the *scroll* is spent on the smallest distances.
    const halfway = distanceAtPosition(MILESTONES, ANCHORS, SECTION_PX * 1.5);
    const linearMidpoint = (100_000 + 384_400_000) / 2;
    expect(halfway).toBeLessThan(linearMidpoint / 10);
  });

  it("handles unevenly-spaced anchors (real sections have different heights)", () => {
    const uneven = [0, 500, 3_000];
    expect(distanceAtPosition(MILESTONES, uneven, 250)).toBeCloseTo(50_000);
    expect(distanceAtPosition(MILESTONES, uneven, 500)).toBeCloseTo(100_000);
  });
});

describe("formatDistance", () => {
  it.each([
    [0, "0 m"],
    [8_848.86, "8,849 m"],
    [420_000, "420 km"],
    [384_400_000, "384,400 km"],
    [149_600_000_000, "149.6 million km"],
    [6_060_000_000_000, "6.06 billion km"],
  ])("formats %d as %s", (m, expected) => {
    expect(formatDistance(m)).toBe(expected);
  });
});

describe("percentForPosition / positionForPercent", () => {
  it("round-trip: position -> percent -> position lands back on the anchor", () => {
    expect(positionForPercent(ANCHORS, percentForPosition(ANCHORS, ANCHORS[0]))).toBeCloseTo(ANCHORS[0]);
    expect(positionForPercent(ANCHORS, percentForPosition(ANCHORS, ANCHORS[2]))).toBeCloseTo(ANCHORS[2]);
  });

  it("maps the start and end of the journey to 0 and 100 percent", () => {
    expect(percentForPosition(ANCHORS, ANCHORS[0])).toBe(0);
    expect(percentForPosition(ANCHORS, ANCHORS[ANCHORS.length - 1])).toBe(100);
  });

  it("clamps percent to the journey's ends for out-of-range scroll", () => {
    expect(percentForPosition(ANCHORS, -500)).toBe(0);
    expect(percentForPosition(ANCHORS, ANCHORS[ANCHORS.length - 1] + 5_000)).toBe(100);
  });

  it("clamps out-of-range percent to the journey's ends", () => {
    expect(positionForPercent(ANCHORS, -10)).toBe(ANCHORS[0]);
    expect(positionForPercent(ANCHORS, 110)).toBe(ANCHORS[ANCHORS.length - 1]);
  });
});

describe("layerForDistance", () => {
  it.each([
    [0, "troposphere"],
    [11_999, "troposphere"],
    [12_000, "stratosphere"],
    [49_999, "stratosphere"],
    [84_999, "mesosphere"],
    [100_000, "thermosphere"],
    [599_999, "thermosphere"],
    [600_000, "exosphere"],
    [9_999_999, "exosphere"],
    [10_000_000, "interplanetary space"],
    [384_400_000, "interplanetary space"],
  ])("classifies %d m as %s", (m, expected) => {
    expect(layerForDistance(m)).toBe(expected);
  });
});
