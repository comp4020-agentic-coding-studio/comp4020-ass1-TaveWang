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
import { PHOTO_MIN_PX, labelBounds, layout, sizeRank } from "../src/lib/layout";
import { aphelion, magnitude, orbitPath, perihelion, positionAtEpoch } from "../src/lib/orbits";
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

  it("cites and describes every photograph it shows", () => {
    for (const object of OBJECTS) {
      if (!object.photo) continue;
      const photo = object.photo;
      expect(photo.file, `${object.id} photo file`).toMatch(/^[a-z0-9-]+\.jpg$/);
      expect(
        photo.alt.trim().length,
        `${object.id}'s photograph needs real alt text — it is documentary content, not decoration`,
      ).toBeGreaterThan(20);
      expect(
        photo.credit.trim().length,
        `${object.id}'s photograph needs the credit line exactly as its host states it`,
      ).toBeGreaterThan(2);
      expect(photo.url.startsWith("https://"), `${object.id} photo source`).toBe(true);
      expect(/^\d{4}-\d{2}-\d{2}$/.test(photo.accessed), `${object.id} photo access date`).toBe(true);
      // discFraction scales the image so the BODY lands on its computed size.
      // A default of 1 would silently understate anything photographed with
      // margin around it, which is most things.
      expect(photo.discFraction, `${object.id} discFraction`).toBeGreaterThan(0.2);
      expect(photo.discFraction).toBeLessThanOrEqual(1);
    }
  });

  it("photographs the Sun, the one object ever drawn to scale", () => {
    expect(
      objectById("sun")?.photo,
      "the Sun is the only body whose true angular size ever exceeds the minimum marker, so it is the only one whose photograph can go on the map honestly",
    ).toBeDefined();
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

describe("label placement", () => {
  // The stage is a wide, short band (62vh), not the viewport — a structure's
  // circle is much smaller there than in a square box, which is how the Milky
  // Way came to be unlabelled inside the band named after it even though a
  // full-viewport test said otherwise. Test the shape that actually ships.
  const names = (logR: number, w = 1920, h = 669) =>
    layout(logR, w, h).labelled.map((entry) => entry.object.name);

  it("labels the landmark each scale band is named after", () => {
    // Regression: the Sun's label sits dead centre and outranks everything, so
    // with a single fixed label position it blocked the Milky Way's label at
    // exactly the scale the band is named for. Caught in a browser, not by a
    // test — hence this one.
    expect(names(18.6).join(" ")).toContain("Milky Way");
    expect(names(19.9).join(" ")).toContain("Local Group");
    expect(names(MAX_LOG_R).join(" ")).toContain("observable universe");
  });

  it("never draws a label across the Sun", () => {
    // The collision pass compares labels with each other, and the Sun is not a
    // label — so nothing stopped "Venus" landing on the photosphere, where
    // white text on a white-hot photograph cannot be read. Found by looking at
    // the deployed page at 1920×1080, which is the only place it was visible.
    for (const [width, height] of [
      [1920, 669],
      [390, 354],
    ]) {
      for (let logR = MIN_LOG_R; logR <= 12; logR += 0.05) {
        const view = layout(logR, width, height, width < 600 ? 5 : 12);
        const sun = {
          left: width / 2 - view.sunRadiusPx,
          right: width / 2 + view.sunRadiusPx,
          top: height / 2 - view.sunRadiusPx,
          bottom: height / 2 + view.sunRadiusPx,
        };
        for (const entry of view.labelled) {
          // The Sun's own caption is anchored against its disc by design.
          if (entry.object.id === "sun") continue;
          const box = labelBounds(entry, width);
          const clear =
            box.right <= sun.left ||
            box.left >= sun.right ||
            box.bottom <= sun.top ||
            box.top >= sun.bottom;
          expect(
            clear,
            `${entry.object.name}'s label is drawn across the Sun at logR ${logR.toFixed(2)} on ${width}×${height}`,
          ).toBe(true);
        }
      }
    }
  });

  it("labels the inner planets as one once the frame has compressed them", () => {
    // Well separated: label them individually.
    const spread = layout(8.5, 1920, 669);
    expect(spread.group, "8.5 spreads the inner planets across half the frame").toBeUndefined();
    expect(spread.labelled.map((entry) => entry.object.id)).toContain("earth");

    // Compressed: one label, and none of its members labelled separately.
    const packed = layout(8.7, 1920, 669);
    expect(packed.group?.name).toBe("Inner planets");
    expect(packed.group?.members.length ?? 0).toBeGreaterThanOrEqual(2);
    for (const id of ["mercury", "venus", "earth", "mars"]) {
      expect(
        packed.labelled.some((entry) => entry.object.id === id),
        `${id} is labelled individually as well as inside the group`,
      ).toBe(false);
    }
    // The group names what it stands for, so nothing is lost to a reader.
    for (const member of packed.group?.members ?? []) {
      expect(member.length).toBeGreaterThan(0);
    }
  });

  it("never places two labels on top of each other", () => {
    for (let logR = MIN_LOG_R; logR <= MAX_LOG_R; logR += 0.25) {
      for (const [width, height] of [
        [1920, 669],
        [390, 440],
      ]) {
        const { labelled } = layout(logR, width, height, width < 600 ? 5 : 12);
        for (let i = 0; i < labelled.length; i++) {
          for (let j = i + 1; j < labelled.length; j++) {
            const a = labelBounds(labelled[i], width);
            const b = labelBounds(labelled[j], width);
            const clear =
              a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom;
            expect(
              clear,
              `${labelled[i].object.name} and ${labelled[j].object.name} overlap at logR ${logR.toFixed(2)} on ${width}×${height}`,
            ).toBe(true);
          }
        }
      }
    }
  });

  it("shows fewer labels on a phone than on a desktop", () => {
    let phoneTotal = 0;
    let desktopTotal = 0;
    for (let logR = MIN_LOG_R; logR <= MAX_LOG_R; logR += 0.5) {
      const phone = layout(logR, 390, 440, 5).labelled.length;
      phoneTotal += phone;
      desktopTotal += layout(logR, 1920, 669, 12).labelled.length;
      expect(phone, `too many labels on a phone at logR ${logR}`).toBeLessThanOrEqual(5);
    }
    expect(
      phoneTotal,
      "a phone must carry a lighter label load across the journey, not just the same one in a smaller box",
    ).toBeLessThan(desktopTotal);
  });

  it("keeps every label inside the viewport", () => {
    for (let logR = MIN_LOG_R; logR <= MAX_LOG_R; logR += 0.25) {
      for (const entry of layout(logR, 390, 440, 5).labelled) {
        expect(entry.labelX, `${entry.object.name} at logR ${logR}`).toBeGreaterThanOrEqual(0);
        expect(entry.labelX).toBeLessThanOrEqual(390);
        expect(entry.labelY).toBeGreaterThanOrEqual(0);
        expect(entry.labelY).toBeLessThanOrEqual(440);
      }
    }
  });

  it("always keeps the Sun's location labelled", () => {
    for (let logR = MIN_LOG_R; logR <= MAX_LOG_R; logR += 0.25) {
      expect(names(logR), `the Sun is unlabelled at logR ${logR}`).toContain("The Sun");
    }
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

describe("orbits", () => {
  const planets = OBJECTS.filter((object) => object.elements);

  it("gives every planet a full set of real orbital elements", () => {
    expect(planets.length).toBe(8);
    for (const planet of planets) {
      const el = planet.elements!;
      expect(el.e, `${planet.id} eccentricity`).toBeGreaterThanOrEqual(0);
      expect(el.e, `${planet.id} eccentricity`).toBeLessThan(1);
      expect(Math.abs(el.I), `${planet.id} inclination`).toBeLessThan(30);
      // The canonical distance IS the semi-major axis, so they must agree.
      expect(el.a * AU_KM).toBeCloseTo(planet.distanceKm, 0);
    }
  });

  it("puts the Sun at a focus, not at the centre of the ellipse", () => {
    for (const planet of planets) {
      const el = planet.elements!;
      const path = orbitPath(el, 240).map(magnitude);
      expect(Math.min(...path), `${planet.id} perihelion`).toBeCloseTo(perihelion(el), 4);
      expect(Math.max(...path), `${planet.id} aphelion`).toBeCloseTo(aphelion(el), 4);
    }
  });

  it("places each planet where it actually was at J2000", () => {
    const el = objectById("earth")!.elements!;
    const r = magnitude(positionAtEpoch(el));
    // J2000 is 1 January 2000, days before Earth's early-January perihelion,
    // so Earth should be very near its closest approach — 0.983 au, not 1.000.
    expect(r).toBeGreaterThan(0.98);
    expect(r).toBeLessThan(0.987);

    for (const planet of planets) {
      const distance = magnitude(positionAtEpoch(planet.elements!));
      expect(distance, `${planet.id} at epoch`).toBeGreaterThanOrEqual(
        perihelion(planet.elements!) - 1e-9,
      );
      expect(distance, `${planet.id} at epoch`).toBeLessThanOrEqual(
        aphelion(planet.elements!) + 1e-9,
      );
    }
  });

  it("does not lay every orbit in one plane", () => {
    // Mercury is inclined 7 degrees; if the projection ever flattens that to
    // zero the map has quietly become a lie about the shape of the system.
    const mercury = objectById("mercury")!.elements!;
    const heights = orbitPath(mercury, 120).map((point) => Math.abs(point.z));
    expect(Math.max(...heights)).toBeGreaterThan(0.04);
    const earth = objectById("earth")!.elements!;
    expect(Math.max(...orbitPath(earth, 120).map((p) => Math.abs(p.z)))).toBeLessThan(0.001);
  });
});

describe("how big things are drawn", () => {
  const STAGE = [1400, 760] as const;
  const at = (logR: number) => layout(logR, STAGE[0], STAGE[1]);

  it("never draws a planet larger than the Sun", () => {
    // The one size comparison a reader will make without thinking. Symbol
    // sizes encode prominence rather than size, so this has to be enforced
    // rather than hoped for.
    for (let logR = MIN_LOG_R; logR <= 13; logR += 0.1) {
      const { placed } = at(logR);
      const sun = placed.find((entry) => entry.object.id === "sun");
      for (const entry of placed) {
        if (!entry.object.elements) continue;
        expect(
          sun?.symbolPx ?? 0,
          `${entry.object.name} is drawn larger than the Sun at logR ${logR.toFixed(1)}`,
        ).toBeGreaterThanOrEqual(entry.symbolPx ?? 0);
      }
    }
  });

  it("ranks bodies by real size", () => {
    const radius = (id: string) => objectById(id)!.radiusKm!;
    const order = ["sun", "jupiter", "saturn", "uranus", "neptune", "earth", "mars", "mercury"];
    for (let i = 1; i < order.length; i++) {
      expect(
        sizeRank(radius(order[i - 1])),
        `${order[i - 1]} must rank above ${order[i]}`,
      ).toBeGreaterThan(sizeRank(radius(order[i])));
    }
  });

  it("never draws a smaller world larger than a bigger one", () => {
    // The guarantee the shared system prominence buys, and the reason it is
    // shared. When each body carried its own prominence, the factor did not
    // cancel between two symbols and distance won: Jupiter was drawn at 8.7px
    // beside a 20.5px Neptune, at 42% the size of a world 2.8× smaller. Every
    // planet now takes the same factor, so the only thing separating two
    // symbols is sizeRank, which is monotonic in the real radius.
    for (let logR = MIN_LOG_R; logR <= 13; logR += 0.02) {
      const bodies = layout(logR, STAGE[0], STAGE[1]).placed.filter(
        (entry) => entry.object.radiusKm !== undefined,
      );
      for (const a of bodies) {
        for (const b of bodies) {
          if (a.object.radiusKm! <= b.object.radiusKm!) continue;
          expect(
            a.symbolPx ?? 0,
            `${a.object.name} (${a.object.radiusKm} km) is drawn smaller than ` +
              `${b.object.name} (${b.object.radiusKm} km) at logR ${logR.toFixed(2)}`,
          ).toBeGreaterThanOrEqual((b.symbolPx ?? 0) - 1e-9);
        }
      }
    }
  });

  it("never resizes the Sun because something else arrived at the rim", () => {
    // The bug this test exists for: the Sun's size used to be a maximum over
    // the planets CURRENTLY ON SCREEN, so every arrival changed it — eight
    // jumps across the range, the worst +291% when Mercury appeared. The
    // reader was watching the Sun and it flinched at something happening in
    // the corner of the frame.
    //
    // Both halves matter. Monotonicity says pulling back never makes the Sun
    // bigger; the step bound says it never lurches. The step here is 0.004
    // decades, over which pure 1/scale shrink is 0.93%, so 2% leaves room for
    // the geometry and none for a pop.
    const STEP = 0.004;
    let previous = layout(MIN_LOG_R, STAGE[0], STAGE[1]).sunRadiusPx;
    for (let logR = MIN_LOG_R + STEP; logR <= MAX_LOG_R; logR += STEP) {
      const size = layout(logR, STAGE[0], STAGE[1]).sunRadiusPx;
      expect(size, `the Sun grew as the camera pulled back at logR ${logR.toFixed(3)}`).toBeLessThanOrEqual(previous + 1e-9);
      expect(
        Math.abs(size - previous) / Math.max(previous, 0.5),
        `the Sun jumped at logR ${logR.toFixed(3)} — ${previous.toFixed(2)}px to ${size.toFixed(2)}px`,
      ).toBeLessThan(0.02);
      previous = size;
    }
  });

  it("never folds a planet's true size in, because it never reaches a pixel", () => {
    // Justifies sizing planets from the symbol alone. If this ever fails, a
    // planet has become drawable to scale and the encoding needs revisiting
    // rather than a silent maximum putting it right.
    for (let logR = MIN_LOG_R; logR <= MAX_LOG_R; logR += 0.05) {
      for (const entry of layout(logR, STAGE[0], STAGE[1]).placed) {
        if (!entry.object.elements) continue;
        const truePx = (entry.object.radiusKm! / 10 ** logR) * (Math.min(...STAGE) / 2);
        expect(
          truePx,
          `${entry.object.name} is drawable at true size at logR ${logR.toFixed(2)}`,
        ).toBeLessThan(1);
      }
    }
  });

  it("draws a planet large when it arrives and shrinks it as it is left behind", () => {
    const sizeOf = (logR: number) =>
      at(logR).placed.find((entry) => entry.object.id === "neptune")?.symbolPx ?? 0;
    const onArrival = sizeOf(9.75);
    expect(onArrival, "a planet should arrive big enough to see its photograph").toBeGreaterThan(
      12,
    );
    let previous = onArrival;
    for (let logR = 9.9; logR <= 11.6; logR += 0.1) {
      const size = sizeOf(logR);
      expect(size, `Neptune grew at logR ${logR.toFixed(1)}`).toBeLessThanOrEqual(previous + 1e-9);
      previous = size;
    }
    expect(previous, "and eventually collapse toward the centre").toBeLessThan(3);
  });

  it("gives the Sun back its pin once the planets are gone", () => {
    const wide = at(13);
    expect(wide.placed.some((entry) => entry.object.elements)).toBe(false);
    expect(wide.sunIsMarker).toBe(true);
  });

  it("draws real ellipses, not circles", () => {
    // Mercury's e = 0.206: the Sun sits well off the centre of its orbit, so
    // the near and far points of the drawn path must differ substantially.
    const mercury = at(8.1).placed.find((entry) => entry.object.id === "mercury");
    expect(mercury?.orbit?.length ?? 0).toBeGreaterThan(50);
    const cx = STAGE[0] / 2;
    const cy = STAGE[1] / 2;
    const radii = mercury!.orbit!.map((p) => Math.hypot(p.x - cx, p.y - cy));
    expect(Math.max(...radii) / Math.min(...radii)).toBeGreaterThan(1.3);
  });
});

describe("nothing worth showing is drawn as a bare dot", () => {
  it("draws every photographed object large enough to show its photograph", () => {
    // The complaint this answers: most objects outside the Solar System were
    // three-pixel dots, so their photographs would never have been visible.
    for (const object of OBJECTS) {
      if (!object.photo) continue;
      let best = 0;
      for (let logR = MIN_LOG_R; logR <= MAX_LOG_R; logR += 0.05) {
        const entry = layout(logR, 1400, 760).placed.find((p) => p.object.id === object.id);
        best = Math.max(best, entry?.symbolPx ?? 0);
      }
      expect(
        best,
        `${object.name} never gets bigger than ${best.toFixed(1)}px, so its photograph is never visible`,
      ).toBeGreaterThanOrEqual(PHOTO_MIN_PX);
    }
  });

  it("gives every non-structure object either a radius or a symbol rank", () => {
    for (const object of OBJECTS) {
      if (object.structureRadiusKm !== undefined) continue;
      if (object.category === "region" || object.category === "horizon") continue;
      expect(
        object.radiusKm !== undefined || object.symbolRank !== undefined,
        `${object.name} would be drawn as a bare dot — give it a radius or a symbolRank`,
      ).toBe(true);
    }
  });
});
