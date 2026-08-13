import { describe, expect, it } from "vitest";
import {
  MAX_LOG_R,
  MIN_LOG_R,
  clampLogR,
  ease,
  fractionAt,
  logRAtPercent,
  percentOf,
} from "../src/lib/camera";
import { OBJECTS, SCALE_LEVELS, allSources, levelAt, objectById } from "../src/data/cosmos";
import { AU_KM, LY_KM, crossesInterstellar, format, unitFor } from "../src/lib/units";

/*
 * The dataset and the camera are where this project can go quietly wrong: a
 * mistyped exponent or a missing citation looks exactly like correct code and
 * renders a plausible picture. These are the sensors for that.
 *
 * Nothing here touches the DOM — the interaction contract is asserted in
 * spec/assignment-1.test.ts against the built page.
 */

describe("dataset integrity", () => {
  it("gives every object a unique id", () => {
    const ids = OBJECTS.map((o) => o.id);
    expect(new Set(ids).size, `duplicate id in ${ids.join(", ")}`).toBe(ids.length);
  });

  it("orders objects by distance from the Sun, outward", () => {
    for (let i = 1; i < OBJECTS.length; i++) {
      expect(
        OBJECTS[i].distanceKm,
        `${OBJECTS[i].id} (${OBJECTS[i].distanceKm} km) must come after ${OBJECTS[i - 1].id} (${OBJECTS[i - 1].distanceKm} km) — radial order is the one thing this map gets exactly right, so the source of truth has to be in order too`,
      ).toBeGreaterThan(OBJECTS[i - 1].distanceKm);
    }
  });

  it("gives every distance and radius a finite, non-negative value", () => {
    for (const object of OBJECTS) {
      expect(Number.isFinite(object.distanceKm), `${object.id} distanceKm`).toBe(true);
      expect(object.distanceKm, `${object.id} distanceKm`).toBeGreaterThanOrEqual(0);
      if (object.radiusKm !== undefined) {
        expect(object.radiusKm, `${object.id} radiusKm`).toBeGreaterThan(0);
      }
      if (object.structureRadiusKm !== undefined) {
        expect(object.structureRadiusKm, `${object.id} structureRadiusKm`).toBeGreaterThan(0);
      }
    }
  });

  it("cites a real, dated source for every scientific claim", () => {
    for (const object of OBJECTS) {
      expect(object.source.name.trim().length, `${object.id} source name`).toBeGreaterThan(0);
      expect(
        object.source.url.startsWith("https://"),
        `${object.id} cites "${object.source.url}" — every source must be an https URL that was actually fetched during development`,
      ).toBe(true);
      expect(
        /^\d{4}-\d{2}-\d{2}$/.test(object.source.accessed),
        `${object.id} needs an ISO access date, so a reader can tell how old the figure is`,
      ).toBe(true);
      expect(object.shortDescription.trim().length, `${object.id} description`).toBeGreaterThan(0);
    }
  });

  it("cites a body's size separately from its distance", () => {
    // Caught by oxlint, not by a human read-through: the JPL physical-parameters
    // table was imported and never used, which meant every planet's radius was
    // implicitly cited to the orbital-elements page — a table that contains no
    // radii at all. A size shown to the reader is its own claim and needs its
    // own source.
    for (const object of OBJECTS) {
      if (object.radiusKm === undefined) continue;
      expect(
        object.radiusSource?.url.startsWith("https://"),
        `${object.id} shows a radius of ${object.radiusKm} km — that figure needs its own citation, not the one attached to its distance`,
      ).toBe(true);
    }
  });

  it("admits uncertainty wherever a boundary is a convention or an inference", () => {
    // Regions, structures and horizons are the objects with no crisp edge —
    // the Oort Cloud has never been observed at all. Any of these that ships
    // without saying so is the page overclaiming.
    for (const object of OBJECTS) {
      if (!["region", "structure", "horizon"].includes(object.category)) continue;
      expect(
        (object.uncertaintyNote?.trim().length ?? 0) > 0,
        `${object.id} is a ${object.category} — it needs an uncertaintyNote saying what is estimated, conventional or inferred about it`,
      ).toBe(true);
    }
  });

  it("flags every invented bearing as diagrammatic", () => {
    // Rings and discs are rotationally symmetric, so their angle only places a
    // label. A point drawn at a bearing is making a claim about direction that
    // this dataset cannot support, and must say so.
    for (const object of OBJECTS) {
      const isPoint = !object.ring && object.structureRadiusKm === undefined;
      if (!isPoint || object.angleDeg === 0) continue;
      expect(
        object.positionIsDiagrammatic === true,
        `${object.id} is drawn as a point at ${object.angleDeg}° — that bearing is chosen for legibility, so it must be flagged positionIsDiagrammatic`,
      ).toBe(true);
    }
  });

  it("resolves every structure's centre to a real object", () => {
    for (const object of OBJECTS) {
      if (!object.centre) continue;
      expect(
        objectById(object.centre.ofId),
        `${object.id} is centred on "${object.centre.ofId}", which is not in the dataset`,
      ).toBeTruthy();
      expect(object.centre.fraction).toBeGreaterThan(0);
      expect(object.centre.fraction).toBeLessThanOrEqual(1);
    }
  });

  it("keeps editorial nudges too small to break radial order", () => {
    for (const object of OBJECTS) {
      if (object.enterAdjust === undefined) continue;
      expect(
        Math.abs(object.enterAdjust),
        `${object.id} nudges its entrance by ${object.enterAdjust} decades — thresholds may be tuned for legibility, but not far enough to reorder the map`,
      ).toBeLessThanOrEqual(0.5);
    }
  });

  it("collects every distinct source for the sources section", () => {
    const sources = allSources();
    expect(sources.length).toBeGreaterThan(5);
    expect(new Set(sources.map((s) => s.url)).size).toBe(sources.length);
  });
});

describe("the camera contains the dataset", () => {
  it("opens close enough that the Sun fills the view", () => {
    const sun = objectById("sun");
    expect(sun?.radiusKm).toBeDefined();
    const fraction = (sun?.radiusKm ?? 0) / 10 ** MIN_LOG_R;
    expect(
      fraction,
      "at the closest scale the Sun must span most of the visible radius — that is the page's opening claim",
    ).toBeGreaterThan(0.5);
    expect(fraction).toBeLessThanOrEqual(1);
  });

  it("pulls back far enough to contain every object", () => {
    for (const object of OBJECTS) {
      expect(
        fractionAt(object.distanceKm, MAX_LOG_R),
        `${object.id} is still outside the frame at maximum zoom — either it does not belong in this dataset or MAX_LOG_R must grow`,
      ).toBeLessThanOrEqual(0.95);
    }
  });

  it("brings every object into view somewhere inside the zoom range", () => {
    for (const object of OBJECTS) {
      if (object.distanceKm === 0) continue;
      const enters = Math.log10(object.distanceKm) + (object.enterAdjust ?? 0);
      expect(enters, `${object.id} never enters the frame`).toBeLessThanOrEqual(MAX_LOG_R);
    }
  });
});

describe("scale levels", () => {
  it("run in order and stay inside the camera range", () => {
    expect(SCALE_LEVELS[0].fromLogR).toBe(MIN_LOG_R);
    for (let i = 1; i < SCALE_LEVELS.length; i++) {
      expect(SCALE_LEVELS[i].fromLogR).toBeGreaterThan(SCALE_LEVELS[i - 1].fromLogR);
    }
    expect(SCALE_LEVELS[SCALE_LEVELS.length - 1].fromLogR).toBeLessThan(MAX_LOG_R);
  });

  it("names a level for every scale the reader can reach", () => {
    for (let logR = MIN_LOG_R; logR <= MAX_LOG_R; logR += 0.1) {
      expect(levelAt(logR).name.length, `no level at logR ${logR}`).toBeGreaterThan(0);
    }
    expect(levelAt(MIN_LOG_R).id).toBe("sun");
    expect(levelAt(MAX_LOG_R).id).toBe("horizon");
  });
});

describe("units", () => {
  it("uses kilometres through the familiar Solar System", () => {
    expect(unitFor(1e6)).toBe("km");
    expect(format(1e6).primary).toBe("1 million km");
    expect(format(0.387_099_27 * AU_KM).primary).toBe("57.9 million km");
  });

  it("adds AU as a secondary unit once kilometre figures get unwieldy", () => {
    expect(format(1e6).secondary).toBeNull();
    expect(format(AU_KM).secondary).toBe("1 AU");
    expect(format(30.069_922_76 * AU_KM).primary).toBe("4.5 billion km");
    expect(format(30.069_922_76 * AU_KM).secondary).toBe("30.1 AU");
  });

  it("switches to light-years at exactly one light-year", () => {
    expect(unitFor(LY_KM * 0.999)).toBe("km");
    expect(unitFor(LY_KM)).toBe("ly");
    expect(format(LY_KM).primary).toBe("1 light-year");
    expect(format(4.24 * LY_KM).primary).toBe("4.24 light-years");
  });

  it("scales light-years up through thousands, millions and billions", () => {
    expect(format(25_000 * LY_KM).primary).toBe("25 thousand light-years");
    expect(format(2_500_000 * LY_KM).primary).toBe("2.5 million light-years");
    expect(format(46_000_000_000 * LY_KM).primary).toBe("46 billion light-years");
  });

  it("never quotes more than three significant figures", () => {
    // 4,498,252,900 km would render as "4.4982529 billion km" if this slipped.
    expect(format(30.069_922_76 * AU_KM).primary).toBe("4.5 billion km");
    expect(format(4.37 * LY_KM).primary).toBe("4.37 light-years");
  });

  it("detects the unit crossing in both directions", () => {
    expect(crossesInterstellar(LY_KM * 0.9, LY_KM * 1.1)).toBe(true);
    expect(crossesInterstellar(LY_KM * 1.1, LY_KM * 0.9)).toBe(true);
    expect(crossesInterstellar(1e6, 1e9)).toBe(false);
    expect(crossesInterstellar(LY_KM * 2, LY_KM * 3)).toBe(false);
  });
});

describe("camera maths", () => {
  it("clamps to its range and never escapes", () => {
    expect(clampLogR(-99)).toBe(MIN_LOG_R);
    expect(clampLogR(999)).toBe(MAX_LOG_R);
    expect(clampLogR(Number.NaN)).toBe(MIN_LOG_R);
    expect(clampLogR(12)).toBe(12);
  });

  it("places the Sun at the centre and the visible radius at the edge", () => {
    expect(fractionAt(0, 12)).toBe(0);
    expect(fractionAt(10 ** 12, 12)).toBeCloseTo(1);
    expect(fractionAt(10 ** 13, 12)).toBeCloseTo(10);
  });

  it("shrinks an object monotonically as the camera pulls back", () => {
    const sun = objectById("sun");
    const radius = sun?.radiusKm ?? 0;
    let previous = Infinity;
    for (let logR = MIN_LOG_R; logR <= MAX_LOG_R; logR += 0.5) {
      const size = radius / 10 ** logR;
      expect(size, `the Sun must shrink at logR ${logR}`).toBeLessThan(previous);
      previous = size;
    }
  });

  it("settles exactly on the target so the animation loop can stop", () => {
    let current = 6;
    for (let i = 0; i < 200 && current !== 12; i++) current = ease(current, 12);
    expect(current, "ease must reach the target exactly, or rAF runs forever").toBe(12);
  });

  it("round-trips through the percentage a range control uses", () => {
    expect(percentOf(MIN_LOG_R)).toBe(0);
    expect(percentOf(MAX_LOG_R)).toBe(100);
    for (const percent of [0, 12.5, 37, 80, 100]) {
      expect(percentOf(logRAtPercent(percent))).toBeCloseTo(percent);
    }
    expect(logRAtPercent(-50)).toBe(MIN_LOG_R);
    expect(logRAtPercent(150)).toBe(MAX_LOG_R);
  });
});
