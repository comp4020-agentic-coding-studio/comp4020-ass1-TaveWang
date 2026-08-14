/*
 * Real orbits, from real elements.
 *
 * Every number here comes from JPL's "Approximate Positions of the Planets"
 * Keplerian element table (J2000 epoch, valid 1800–2050), and the algorithm is
 * the one that page publishes alongside it. That buys three things the earlier
 * hand-picked bearings could not:
 *
 * - orbits are true ellipses with the Sun at a focus, so Mercury's e = 0.206
 *   is visibly off-centre rather than drawn as a circle;
 * - each planet sits where it actually was at J2000 (1 January 2000), rather
 *   than at an angle chosen to keep labels apart;
 * - inclinations are real, so the orbits genuinely do not share one plane.
 *
 * This is still a STATIC arrangement — one epoch, computed once, never
 * advanced. It is not an ephemeris and does not track today's sky. The page
 * says so.
 */

export interface Elements {
  /** Semi-major axis, au. */
  a: number;
  /** Eccentricity. */
  e: number;
  /** Inclination to the ecliptic, degrees. */
  I: number;
  /** Mean longitude at J2000, degrees. */
  L: number;
  /** Longitude of perihelion, degrees. */
  peri: number;
  /** Longitude of the ascending node, degrees. */
  node: number;
}

/** Heliocentric ecliptic coordinates, in au. z is out of the ecliptic plane. */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

const rad = (degrees: number): number => (degrees * Math.PI) / 180;

/** Wrap to [-180, 180) so Kepler's equation converges from a sane start. */
function wrap(degrees: number): number {
  return ((((degrees + 180) % 360) + 360) % 360) - 180;
}

/**
 * Solve M = E − e·sin E for the eccentric anomaly, by Newton's method. Six
 * iterations is already past double precision for every eccentricity in this
 * dataset (the largest is Mercury's 0.206); twelve is free insurance.
 */
export function eccentricAnomaly(meanAnomaly: number, e: number): number {
  let E = meanAnomaly + e * Math.sin(meanAnomaly);
  for (let i = 0; i < 12; i++) {
    const delta = meanAnomaly - (E - e * Math.sin(E));
    E += delta / (1 - e * Math.cos(E));
  }
  return E;
}

/**
 * Heliocentric ecliptic position for a given eccentric anomaly — the standard
 * perifocal-to-ecliptic rotation through the argument of perihelion, the
 * inclination and the ascending node.
 */
export function pointAt(elements: Elements, E: number): Vec3 {
  const { a, e } = elements;
  const xp = a * (Math.cos(E) - e);
  const yp = a * Math.sqrt(1 - e * e) * Math.sin(E);

  const w = rad(elements.peri - elements.node);
  const node = rad(elements.node);
  const inc = rad(elements.I);

  const cw = Math.cos(w);
  const sw = Math.sin(w);
  const cn = Math.cos(node);
  const sn = Math.sin(node);
  const ci = Math.cos(inc);
  const si = Math.sin(inc);

  return {
    x: (cw * cn - sw * sn * ci) * xp + (-sw * cn - cw * sn * ci) * yp,
    y: (cw * sn + sw * cn * ci) * xp + (-sw * sn + cw * cn * ci) * yp,
    z: sw * si * xp + cw * si * yp,
  };
}

/** Where the planet actually was at J2000. */
export function positionAtEpoch(elements: Elements): Vec3 {
  const meanAnomaly = rad(wrap(elements.L - elements.peri));
  return pointAt(elements, eccentricAnomaly(meanAnomaly, elements.e));
}

/** The whole ellipse, as points — closed, so a renderer can just stroke it. */
export function orbitPath(elements: Elements, steps = 160): Vec3[] {
  const path: Vec3[] = [];
  for (let i = 0; i <= steps; i++) {
    path.push(pointAt(elements, (i / steps) * Math.PI * 2));
  }
  return path;
}

/** Distance from the Sun, in au. */
export function magnitude(v: Vec3): number {
  return Math.hypot(v.x, v.y, v.z);
}

/** Closest and furthest the orbit gets from the Sun, in au. */
export function perihelion(elements: Elements): number {
  return elements.a * (1 - elements.e);
}

export function aphelion(elements: Elements): number {
  return elements.a * (1 + elements.e);
}
