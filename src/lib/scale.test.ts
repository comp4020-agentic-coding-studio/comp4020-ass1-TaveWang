import { describe, expect, it } from "vitest";
import { distanceAtScroll, formatDistance, layerForDistance, type Milestone } from "./scale";

const SECTION_PX = 900;

const MILESTONES: Milestone[] = [
  { id: "a", name: "A", distanceM: 0, category: "atmosphere", fact: "", source: { name: "", url: "" } },
  { id: "b", name: "B", distanceM: 100_000, category: "atmosphere", fact: "", source: { name: "", url: "" } },
  { id: "c", name: "C", distanceM: 384_400_000, category: "orbit", fact: "", source: { name: "", url: "" } },
];

describe("distanceAtScroll", () => {
  it("starts at the first milestone's distance", () => {
    expect(distanceAtScroll(MILESTONES, 0, SECTION_PX)).toBe(0);
  });

  it("reaches each milestone's exact distance at its section boundary", () => {
    expect(distanceAtScroll(MILESTONES, SECTION_PX, SECTION_PX)).toBeCloseTo(100_000);
    expect(distanceAtScroll(MILESTONES, SECTION_PX * 2, SECTION_PX)).toBeCloseTo(384_400_000);
  });

  it("is monotonically non-decreasing as scroll increases", () => {
    let previous = -Infinity;
    for (let px = 0; px <= SECTION_PX * 3; px += 17) {
      const distance = distanceAtScroll(MILESTONES, px, SECTION_PX);
      expect(distance).toBeGreaterThanOrEqual(previous);
      previous = distance;
    }
  });

  it("clamps to the last milestone past the end of the journey", () => {
    expect(distanceAtScroll(MILESTONES, SECTION_PX * 50, SECTION_PX)).toBe(384_400_000);
  });

  it("clamps to the first milestone for negative scroll", () => {
    expect(distanceAtScroll(MILESTONES, -500, SECTION_PX)).toBe(0);
  });

  it("compresses log-linearly, not linearly, once past a zero-distance milestone", () => {
    // Halfway (in scroll terms) between 100,000 m and 384,400,000 m should be
    // far below the linear midpoint — that's the whole point of the log
    // interpolation: most of the *scroll* is spent on the smallest distances.
    const halfway = distanceAtScroll(MILESTONES, SECTION_PX * 1.5, SECTION_PX);
    const linearMidpoint = (100_000 + 384_400_000) / 2;
    expect(halfway).toBeLessThan(linearMidpoint / 10);
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
