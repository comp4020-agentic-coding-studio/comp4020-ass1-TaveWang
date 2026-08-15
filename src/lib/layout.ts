import type { CosmicObject } from "../data/cosmos";
import { OBJECTS } from "../data/cosmos";
import { MIN_MARKER_PX, fractionAt } from "./camera";
import { orbitPath, positionAtEpoch } from "./orbits";
import { AU_KM } from "./units";

/*
 * Turns a camera scale and a viewport size into everything the page has to
 * draw. Pure — no canvas, no DOM, no React — so the visibility rules, the
 * symbol sizes and the label collision pass can all be tested directly rather
 * than inferred from a screenshot.
 *
 * Visibility is derived entirely from distance and camera scale. There is no
 * step counter and no hand-authored "appears at stage 4": an object is on
 * screen when the arithmetic puts it on screen.
 */

/** Beyond this fraction of the visible radius, a point object is off screen. */
const EDGE = 0.92;

/**
 * Structures are meant to be seen from inside — the Milky Way should surround
 * the reader long before its far edge fits on screen — so they are allowed to
 * overflow the viewport by this factor before being culled.
 */
const STRUCTURE_EDGE = 4;

/**
 * Closer to the centre than this and an object is indistinguishable from the
 * Sun's marker. This is what makes the whole Solar System collapse into a
 * single point without anything being told to disappear.
 */
const CORE = 0.004;

/** Labels live in a narrower band than their objects: not crowding the centre… */
const LABEL_MIN = 0.045;
/** …and not hanging off the edge. */
const LABEL_MAX = 0.9;

/*
 * --- The tilt -------------------------------------------------------------
 *
 * The planets share a plane, so the planetary system is drawn as that plane
 * seen at an angle: y is foreshortened, and a body's height out of the plane
 * shows as a vertical offset. That is what makes real inclinations visible —
 * Mercury's 7° genuinely lifts its orbit off Earth's.
 *
 * It applies to the planets and the Kuiper belt and to nothing else. The
 * heliopause, the Oort Cloud and the observable-universe horizon are shells,
 * not discs, and a sphere's outline is a circle from every angle — drawing
 * those tilted would be a nicer picture and a worse claim.
 */
export const TILT_Y = 0.46;
const TILT_Z = 0.86;

/*
 * --- Symbol sizes ---------------------------------------------------------
 *
 * No planet is ever within a thousand times of being drawable at its true
 * size: Earth's true radius never exceeds a fiftieth of a pixel anywhere in
 * this zoom range. So a planet is drawn as a SYMBOL, and a symbol's size is
 *
 *     SYMBOL_MAX × unit × sizeRank(true radius) × systemProminence^DECAY
 *
 * where `systemProminence` is ONE number for the whole planetary system, taken
 * from the outermost planet. Every planet on screen shares it, so the only
 * thing that separates two symbols is the bodies' real radii. That is the
 * whole point, and it replaces a per-object prominence that produced two bugs:
 *
 * - Prominence rises with distance from the Sun, so an outer planet outgrew an
 *   inner one whatever their real sizes. Jupiter was drawn at 8.7px next to a
 *   20.5px Neptune — Jupiter is 2.8× Neptune's radius, drawn at 42% its size.
 * - The Sun's floor was the largest planet symbol *currently on screen*, a
 *   maximum over a set whose membership jumps. Every planet arriving at the
 *   rim therefore resized the Sun at the centre: eight visible jumps across
 *   the zoom range, the worst of them +291%.
 *
 * A single shared prominence fixes both at once. It is a continuous function
 * of the camera scale alone, so nothing at the centre moves when something
 * crosses the frame edge; and it cancels out of any comparison between two
 * symbols, so drawn size orders exactly as real size does.
 *
 * The system still arrives large and shrinks: a planet appears at the rim at
 * full size, and once the outermost planet starts falling inward every symbol
 * shrinks together, converging on the centre.
 *
 * The Sun runs through the same formula with the same size rank — it is simply
 * the largest body, so it is always drawn largest. It is drawn at its true
 * size for as long as that is bigger than its symbol, and once the symbol
 * falls under a couple of pixels it stops being a body at all and becomes a
 * "you are here" pin.
 */
const SYMBOL_MAX = 0.095;
const SYMBOL_FULL_AT = 0.85;
/** Sub-linear decay, so a settled body keeps some presence instead of vanishing. */
const SYMBOL_DECAY = 0.6;
/** Below this a symbol is not worth texturing with a photograph. */
export const PHOTO_MIN_PX = 7;

const SMALLEST_BODY_KM = 2439.4;
const LARGEST_BODY_KM = 700_000;

/** 0.40 (Mercury) … 1.00 (the Sun), on a log scale. */
export function sizeRank(radiusKm: number): number {
  const lo = Math.log10(SMALLEST_BODY_KM);
  const hi = Math.log10(LARGEST_BODY_KM);
  const t = (Math.log10(radiusKm) - lo) / (hi - lo);
  return 0.4 + 0.6 * Math.min(1, Math.max(0, t));
}

/**
 * How much of the frame a body's distance spans: 1 at the rim or beyond, 0 at
 * the centre. Continuous everywhere, including through both clamps.
 */
export function prominence(fraction: number): number {
  return Math.min(1, Math.max(0, fraction / SYMBOL_FULL_AT));
}

/** The one place a symbol's radius in pixels is decided. */
function symbolPx(unit: number, rank: number, atProminence: number): number {
  return SYMBOL_MAX * unit * rank * atProminence ** SYMBOL_DECAY;
}

export interface Placed {
  object: CosmicObject;
  /** Distance as a fraction of the visible radius. */
  fraction: number;
  /** Screen position of the object itself, in CSS pixels. */
  x: number;
  y: number;
  /** Set when the object's orbit or boundary is drawn as a ring about the Sun. */
  ringRadiusPx?: number;
  /** Radius the body is actually drawn at — true size for the Sun, symbol otherwise. */
  symbolPx?: number;
  /** The planet's real elliptical orbit, already projected to screen points. */
  orbit?: Array<{ x: number; y: number }>;
  /** Set for structures drawn as a circle centred somewhere other than the Sun. */
  structure?: { cx: number; cy: number; r: number };
  labelX: number;
  labelY: number;
  /** Which way the label box extends, so the tick mark sits against the object. */
  labelSide: LabelSide;
}

export interface Layout {
  placed: Placed[];
  /** The subset whose labels survived the collision pass, highest priority first. */
  labelled: Placed[];
  /** True once the Sun is too small to draw honestly and becomes a location marker. */
  sunIsMarker: boolean;
  sunRadiusPx: number;
}

/**
 * Where a label sits relative to its object. Tried in order, first fit wins.
 * Without this the Sun's label — always dead centre, always highest priority —
 * blocks whatever is drawn near the middle, which at galactic scale meant the
 * Milky Way itself going unlabelled inside the band named after it.
 */
const PLACEMENTS = [
  { side: "right", dx: 10, dy: -18 },
  { side: "right", dx: 10, dy: 20 },
  { side: "left", dx: -10, dy: -18 },
  { side: "left", dx: -10, dy: 20 },
] as const;

export type LabelSide = (typeof PLACEMENTS)[number]["side"];

function radians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Structures and the horizon are set uppercase and letterspaced, which makes
 * them far wider than a plain character count predicts — "THE OBSERVABLE
 * UNIVERSE" ran straight through the Sun's label while the collision pass
 * believed the two were clear of each other.
 */
const WIDE_FACTOR = 1.45;

/**
 * Rough text box for a label, used only for collision avoidance. Estimated
 * from character count rather than measured: measuring would mean a layout
 * read per label per frame, and this only has to be close enough to keep two
 * labels off each other.
 */
function labelBox(
  name: string,
  x: number,
  y: number,
  charWidth: number,
  side: LabelSide,
  gap: number,
  wide: boolean,
) {
  const w = name.length * charWidth * (wide ? WIDE_FACTOR : 1) + 16 + gap;
  // Two lines on a desktop — the name and the category beneath it — not one.
  // Modelling this as a single 22px line let vertically-adjacent labels
  // overlap on screen while the estimate believed they were clear; the phone
  // hides the category line, so it really is one line there.
  const h = (charWidth < 7 ? 21 : 32) + gap;
  const left = side === "right" ? x : x - w;
  return { left, right: left + w, top: y - h / 2, bottom: y + h / 2 };
}

/**
 * Extra clearance demanded around each label. A phone gets a wide one: without
 * it the collision pass alone let a small screen carry the same label load as a
 * 1920px one, just packed tighter — which is the wall of text this is meant to
 * prevent, not a lighter version of it.
 */
function labelGap(width: number): number {
  return width < 600 ? 14 : 0;
}

/** True for the label styles that are set uppercase and letterspaced. */
function isWide(entry: Placed): boolean {
  return entry.object.category === "structure" || entry.object.category === "horizon";
}

/** The screen box a placed label actually occupies. */
export function labelBounds(entry: Placed, width: number) {
  return labelBox(
    entry.object.name,
    entry.labelX,
    entry.labelY,
    width < 600 ? 6 : 7,
    entry.labelSide,
    labelGap(width),
    isWide(entry),
  );
}

function overlaps(
  a: ReturnType<typeof labelBox>,
  b: ReturnType<typeof labelBox>,
): boolean {
  return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
}

export function layout(
  logR: number,
  width: number,
  height: number,
  /** Phones get fewer simultaneous labels; a wall of text is not information. */
  maxLabels = 12,
): Layout {
  const cx = width / 2;
  const cy = height / 2;
  // The visible radius is half the SHORTER side, measured along the map's
  // un-foreshortened horizontal axis, so the circle it describes is always
  // fully on screen.
  const unit = Math.min(width, height) / 2;
  const scaleKm = 10 ** logR;

  /** Ecliptic au → screen pixels, through the tilt. */
  const project = (auX: number, auY: number, auZ: number) => {
    const fx = (auX * AU_KM) / scaleKm;
    const fy = (auY * AU_KM) / scaleKm;
    const fz = (auZ * AU_KM) / scaleKm;
    return { x: cx + fx * unit, y: cy + (fy * TILT_Y - fz * TILT_Z) * unit };
  };

  const sunObject = OBJECTS[0];
  const sunTruePx = ((sunObject.radiusKm ?? 0) / scaleKm) * unit;

  // --- One prominence for the whole planetary system -----------------------
  //
  // Taken over EVERY planet, on screen or not, so this depends on the camera
  // scale and nothing else. That is what makes it safe to build the Sun's size
  // on: a planet crossing the frame edge changes what happens at the rim and
  // leaves the centre alone. It is the outermost planet's in practice, but
  // computing the maximum keeps that true if a planet is ever added.
  const systemProminence = OBJECTS.reduce(
    (max, object) =>
      object.elements
        ? Math.max(max, prominence(fractionAt(object.distanceKm, logR)))
        : max,
    0,
  );

  // The Sun through the same formula as every planet. Its size rank is 1 and
  // no planet's reaches 0.76, so "the Sun is never drawn smaller than a
  // planet" is a property of the arithmetic rather than a floor bolted on
  // afterwards — and it inherits the same smoothness.
  const sunDrawnPx = Math.max(
    sunTruePx,
    symbolPx(unit, sizeRank(sunObject.radiusKm ?? 0), systemProminence),
  );
  const sunIsPin = sunDrawnPx < MIN_MARKER_PX;

  const placed: Placed[] = [];

  for (const object of OBJECTS) {
    const fraction = fractionAt(object.distanceKm, logR);
    const isStructure = object.structureRadiusKm !== undefined;

    // `enterAdjust` shifts when an object arrives, in decades of zoom — a
    // legibility nudge, bounded by spec/dataset.test.ts so it can never
    // reorder the map.
    const adjusted = fractionAt(object.distanceKm, logR - (object.enterAdjust ?? 0));
    // Structures and the horizon are boundaries the reader is *inside*, so
    // their arc should be visible well before the whole circle fits on screen.
    const surrounds = isStructure || object.category === "horizon";
    const limit = surrounds ? STRUCTURE_EDGE : EDGE;

    if (object.id !== "sun") {
      if (adjusted > limit) continue;
      // Planets are culled by the Sun's disc instead, once their position
      // reaches it — see below.
      if (fraction < CORE && !surrounds && object.elements === undefined) continue;
      if (isStructure && (object.structureRadiusKm ?? 0) / scaleKm < CORE) continue;
    }

    const angle = radians(object.angleDeg);
    let x = cx + Math.cos(angle) * fraction * unit;
    let y = cy + Math.sin(angle) * fraction * unit;

    const entry: Placed = { object, fraction, x, y, labelX: x, labelY: y, labelSide: "right" };

    // --- planets: real position, real ellipse, real inclination ------------
    if (object.elements) {
      const at = positionAtEpoch(object.elements);
      const screen = project(at.x, at.y, at.z);
      // A planet whose position has reached the Sun's disc has merged into it.
      // The Sun is drawn last and over it, so most of it is already hidden;
      // this is a boundary that means something on screen, rather than a fixed
      // fraction of the frame, and it lands the disappearance at the scale
      // where the system really has collapsed to a point.
      //
      // Waiting for the planet's whole symbol to be covered would be a softer
      // transition but a worse map: distance shrinks faster than the symbols
      // do, so Neptune would survive another decade of zoom and litter the
      // interstellar scales as a sub-pixel dot.
      if (Math.hypot(screen.x - cx, screen.y - cy) < sunDrawnPx) continue;
      x = screen.x;
      y = screen.y;
      entry.x = x;
      entry.y = y;
      entry.orbit = orbitPath(object.elements, 128).map((point) =>
        project(point.x, point.y, point.z),
      );
    } else if (object.ring) {
      entry.ringRadiusPx = fraction * unit;
    }

    if (object.id === "sun") {
      // Never on top of the Sun itself. Above the disc while it is large,
      // because below it is where the opening instruction sits; below the
      // marker once the Sun is small, so it reads as a caption on the
      // "you are here" crosshair. `sunDrawnPx` only ever decreases as the
      // camera pulls back, so this crosses over exactly once.
      entry.y = sunDrawnPx > 40 ? cy - sunDrawnPx - 13 : cy + sunDrawnPx + 12;
      entry.labelY = entry.y;
    }

    // --- how big to draw it -----------------------------------------------
    // Galaxies, nebulae and other stars have no radius in this dataset — their
    // size is not the point at the scales they appear on — but they should not
    // be three-pixel dots either. They get the same prominence curve as the
    // planets, weighted by a curated visual rank instead of a physical one.
    if (object.radiusKm === undefined && object.symbolRank !== undefined) {
      // These never share a frame with a planet, and their rank is an
      // editorial judgement rather than a radius, so they keep a prominence of
      // their own — there is no size relationship here to preserve.
      entry.symbolPx = symbolPx(unit, object.symbolRank, prominence(fraction));
    }

    if (object.radiusKm !== undefined) {
      // Sun or planet: the only objects with a measured radius. Every one of
      // them is sized from the shared prominence, so what separates two
      // symbols on screen is their real radii and nothing else. A planet's
      // true size is not folded in — it never reaches a pixel, so a maximum
      // against it would be decoration, and spec/dataset.test.ts says so.
      entry.symbolPx =
        object.id === "sun"
          ? sunDrawnPx
          : symbolPx(unit, sizeRank(object.radiusKm), systemProminence);
    }

    if (isStructure) {
      const centreObject = object.centre
        ? OBJECTS.find((o) => o.id === object.centre?.ofId)
        : undefined;
      const centreDistance = centreObject
        ? centreObject.distanceKm * (object.centre?.fraction ?? 1)
        : 0;
      const centreAngle = radians(centreObject?.angleDeg ?? 0);
      const cFraction = fractionAt(centreDistance, logR);
      const scx = cx + Math.cos(centreAngle) * cFraction * unit;
      const scy = cy + Math.sin(centreAngle) * cFraction * unit;
      const r = fractionAt(object.structureRadiusKm ?? 0, logR) * unit;
      entry.structure = { cx: scx, cy: scy, r };
      // Label a structure on its rim, not at a centre the reader can't see.
      entry.x = scx + Math.cos(angle) * r * 0.72;
      entry.y = scy + Math.sin(angle) * r * 0.72;
    }

    placed.push(entry);
  }

  // --- Labels -------------------------------------------------------------
  // Deterministic priority, then distance. Never random, never frame-dependent:
  // a label that flickers between frames is worse than no label.
  const charWidth = width < 600 ? 6 : 7;
  const gap = labelGap(width);
  const candidates = placed
    .filter((entry) => {
      if (entry.object.id === "sun") return true;
      if (entry.object.structureRadiusKm !== undefined) {
        return entry.structure !== undefined && entry.structure.r > 28;
      }
      return entry.fraction >= LABEL_MIN && entry.fraction <= LABEL_MAX;
    })
    .sort(
      (a, b) =>
        a.object.labelPriority - b.object.labelPriority ||
        a.object.distanceKm - b.object.distanceKm,
    );

  const labelled: Placed[] = [];
  const boxes: ReturnType<typeof labelBox>[] = [];

  for (const entry of candidates) {
    if (labelled.length >= maxLabels) break;
    // Clear the body itself, so a big symbol never sits under its own label.
    // The Sun is exempt: its anchor is already offset above or below the disc,
    // and a clearance the width of that disc would fling the label off sideways.
    const clearance = entry.object.id === "sun" ? 10 : (entry.symbolPx ?? 0) + 8;
    for (const placement of PLACEMENTS) {
      const x = entry.x + (placement.dx > 0 ? clearance : -clearance);
      const y = entry.y + placement.dy;
      const box = labelBox(entry.object.name, x, y, charWidth, placement.side, gap, isWide(entry));
      if (box.left < 4 || box.right > width - 4 || box.top < 4 || box.bottom > height - 4) {
        continue;
      }
      if (boxes.some((other) => overlaps(box, other))) continue;
      boxes.push(box);
      labelled.push({ ...entry, labelX: x, labelY: y, labelSide: placement.side });
      break;
    }
  }

  return { placed, labelled, sunIsMarker: sunIsPin, sunRadiusPx: sunDrawnPx };
}

/**
 * The objects a reader can reach right now, for the keyboard-navigable list
 * that stands in for clicking a dot. Ordered outward, like the map.
 */
export function reachable(logR: number, width: number, height: number): CosmicObject[] {
  return layout(logR, width, height, Number.POSITIVE_INFINITY).placed.map((p) => p.object);
}
