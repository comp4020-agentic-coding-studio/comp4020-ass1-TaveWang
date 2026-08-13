/*
 * Units for a page that has to carry the reader from the Sun's surface to the
 * edge of the observable universe without ever lying about how far that is.
 *
 * Both constants below are DEFINITIONS, not measurements — they have no
 * uncertainty, which is why they're the only numbers in this project without a
 * source URL attached. Everything else in src/data/cosmos.ts is measured or
 * inferred and carries its citation.
 */

/** IAU 2012 Resolution B2 fixes the astronomical unit at exactly 149 597 870 700 m. */
export const AU_KM = 149_597_870.7;

/**
 * The IAU light-year is exactly the distance light covers in a Julian year:
 * 299 792 458 m/s × 31 557 600 s = 9 460 730 472 580 800 m.
 */
export const LY_KM = 9_460_730_472_580.8;

/** Below this the reader gets kilometres; at and above it, light-years. */
export const INTERSTELLAR_THRESHOLD_KM = LY_KM;

/** Above this, a kilometre figure is long enough to want an AU alongside it. */
const AU_SECONDARY_FROM_KM = 1e8;

export type PrimaryUnit = "km" | "ly";

export interface Reading {
  /** e.g. "4.5 billion km" or "2.5 million light-years" */
  primary: string;
  /** e.g. "30 AU" — null when a second unit would only add noise. */
  secondary: string | null;
  unit: PrimaryUnit;
}

/**
 * Three significant figures, no trailing zeros, grouped. Deliberately capped:
 * quoting a galaxy's distance to six figures would imply a precision no
 * measurement in this dataset has.
 */
function sig(value: number): string {
  return Number(value.toPrecision(3)).toLocaleString("en-AU");
}

function kilometres(km: number): string {
  if (km < 1e6) return `${Math.round(km).toLocaleString("en-AU")} km`;
  if (km < 1e9) return `${sig(km / 1e6)} million km`;
  if (km < 1e12) return `${sig(km / 1e9)} billion km`;
  return `${sig(km / 1e12)} trillion km`;
}

function lightYears(km: number): string {
  const ly = km / LY_KM;
  if (ly < 1e3) {
    const rounded = sig(ly);
    return `${rounded} light-year${rounded === "1" ? "" : "s"}`;
  }
  if (ly < 1e6) return `${sig(ly / 1e3)} thousand light-years`;
  if (ly < 1e9) return `${sig(ly / 1e6)} million light-years`;
  return `${sig(ly / 1e9)} billion light-years`;
}

/**
 * Renders a distance the way the page should read it at that scale.
 *
 * The switch to light-years happens at exactly one light-year, not at a round
 * kilometre figure — so the boundary is a real astronomical fact the page can
 * explain ("one light-year is 9.46 trillion km") rather than an arbitrary
 * threshold the reader has to take on trust.
 */
export function format(km: number): Reading {
  if (km >= INTERSTELLAR_THRESHOLD_KM) {
    return { primary: lightYears(km), secondary: null, unit: "ly" };
  }
  return {
    primary: kilometres(km),
    secondary: km >= AU_SECONDARY_FROM_KM ? `${sig(km / AU_KM)} AU` : null,
    unit: "km",
  };
}

/** The unit `format` would use, without building the strings. */
export function unitFor(km: number): PrimaryUnit {
  return km >= INTERSTELLAR_THRESHOLD_KM ? "ly" : "km";
}

/**
 * True only on the frame where a zoom step carries the reader across the
 * kilometres→light-years boundary, in either direction. The page uses this to
 * show the unit-change explanation once, at the moment it becomes relevant,
 * rather than parking a permanent caveat on screen.
 */
export function crossesInterstellar(fromKm: number, toKm: number): boolean {
  return unitFor(fromKm) !== unitFor(toKm);
}
