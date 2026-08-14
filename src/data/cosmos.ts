import type { Elements } from "../lib/orbits";
import { AU_KM, LY_KM } from "../lib/units";

/*
 * The curated dataset.
 *
 * Rules this file lives by (also in CLAUDE.md, because they're the ones that
 * are easiest to quietly break):
 *
 * - Every record cites a page that was actually fetched and read during
 *   development. Nothing here is from memory. Where the source states a value
 *   in AU or light-years, the arithmetic converting it to the canonical
 *   kilometre field is left visible in the expression rather than pre-computed,
 *   so the sourced figure and the conversion can both be checked by eye.
 * - `distanceKm` is the single canonical quantity. Display units are derived
 *   (src/lib/units.ts); layout is derived (src/lib/camera.ts). Never lay
 *   anything out from a formatted string.
 * - Where a boundary is a convention, an estimate, or a hypothesis rather than
 *   a measurement, `uncertaintyNote` says so in the reader's words, and the
 *   page shows it. Several of the most interesting objects here have never
 *   been directly observed at all.
 * - `angleDeg` is chosen for label legibility, not measured. Every record that
 *   uses one is flagged `positionIsDiagrammatic`, and the page discloses that
 *   this is a distance model, not a sky map. Radial order is the accurate
 *   variable; bearing is not.
 *
 * Objects that were researched and deliberately left out: Voyager 1 (NASA's
 * live tracker gives a projected distance from EARTH, not the Sun, and this
 * map is Sun-centred — including it would quietly change what the number
 * means); Barnard's Star and Sirius (no NASA/ESA page reachable during
 * development stated their distances, and an unsourced number doesn't ship).
 */

export type Category =
  | "star"
  | "planet"
  | "region"
  | "nebula"
  | "galaxy"
  | "structure"
  | "horizon";

export interface Source {
  name: string;
  url: string;
  /** ISO date this URL was fetched and the figure read off it. */
  accessed: string;
}

export interface CosmicObject {
  id: string;
  name: string;
  category: Category;
  /** Canonical: kilometres from the Sun to the object, or to a structure's far edge. */
  distanceKm: number;
  /** Physical radius, where drawing the body to scale is meaningful. */
  radiusKm?: number;
  /**
   * Radii and distances come from different tables even at the same
   * institution — JPL publishes orbital elements and physical parameters
   * separately — so a body's size carries its own citation rather than
   * silently borrowing the one attached to its distance. Required whenever
   * `radiusKm` is set; `spec/dataset.test.ts` enforces it.
   */
  radiusSource?: Source;
  /** Draw a ring at this radius from the Sun (orbits, region boundaries). */
  ring?: boolean;
  /**
   * A structure drawn as a circle of this radius, centred on `centre` rather
   * than on the Sun — which is the only honest way to show that the Sun sits
   * off-centre inside the Milky Way.
   */
  structureRadiusKm?: number;
  centre?: { ofId: string; fraction: number };
  /** 1 is highest. Ties break by distance. See LABEL_PRIORITY in the overlay. */
  labelPriority: number;
  shortDescription: string;
  source: Source;
  uncertaintyNote?: string;
  positionIsDiagrammatic?: boolean;
  /** Editorial nudge to when this enters, in decades. Validated to stay small. */
  enterAdjust?: number;
  /** Bearing in degrees, chosen to keep labels apart. Never measured. */
  angleDeg: number;
  visualStyleKey: string;
  photo?: Photo;
  /**
   * Visual weight for objects that have no `radiusKm` — galaxies, nebulae,
   * clusters, other stars. Plays the part `sizeRank(radiusKm)` plays for
   * bodies: it sets how large the symbol can get, so a galaxy is not drawn as
   * a three-pixel dot at the scale where it is the whole point.
   */
  symbolRank?: number;
  /**
   * Full Keplerian elements, for the bodies that have a real orbit to draw.
   * When present, the object's drawn position and orbit path come from these
   * rather than from `angleDeg` — a true ellipse with the Sun at a focus, at
   * the planet's actual J2000 position, on its actual inclined plane.
   */
  elements?: Elements;
  /**
   * True for things that are genuinely a flat disc, and so are drawn tilted
   * with the planets. Shells — the heliopause, the Oort Cloud, the
   * observable-universe horizon — are left as circles, because a sphere's
   * outline is a circle from every angle and tilting it would be a nicer
   * picture making a worse claim.
   */
  planar?: boolean;
}

export interface Photo {
  /** Filename under public/images/objects/. Referenced relatively at use. */
  file: string;
  /** Describes the photograph. Real content, not decoration. */
  alt: string;
  /** Credit line exactly as the hosting page states it. */
  credit: string;
  /** The page the image was taken from, and the date it was taken. */
  url: string;
  accessed: string;
  /**
   * Fraction of the image's width occupied by the body's own disc. The Sun is
   * drawn to scale, so its photo has to be scaled so that the PHOTOSPHERE
   * lands on the computed radius — not the image frame, which includes corona
   * and black margin. Getting this wrong would understate the Sun's size while
   * looking perfectly plausible.
   */
  discFraction: number;
}

const NASA_PHOTO_ACCESSED = "2026-08-13";

const JPL_ELEMENTS: Source = {
  name: "NASA JPL — Approximate Positions of the Planets",
  url: "https://ssd.jpl.nasa.gov/planets/approx_pos.html",
  accessed: "2026-08-13",
};

const JPL_PHYSICAL: Source = {
  name: "NASA JPL — Planetary Physical Parameters",
  url: "https://ssd.jpl.nasa.gov/planets/phys_par.html",
  accessed: "2026-08-13",
};

const NASA_SUN: Source = {
  name: "NASA — Sun Facts",
  url: "https://science.nasa.gov/sun/facts/",
  accessed: "2026-08-13",
};

const NASA_KUIPER: Source = {
  name: "NASA — Kuiper Belt Facts",
  url: "https://science.nasa.gov/solar-system/kuiper-belt/facts/",
  accessed: "2026-08-13",
};

const NASA_OORT: Source = {
  name: "NASA — Oort Cloud Facts",
  url: "https://science.nasa.gov/solar-system/oort-cloud/facts/",
  accessed: "2026-08-13",
};

const NASA_VOYAGER: Source = {
  name: "NASA — Voyager Interstellar Mission",
  url: "https://science.nasa.gov/mission/voyager/interstellar-mission/",
  accessed: "2026-08-13",
};

const NASA_STARS: Source = {
  name: "NASA — Stars",
  url: "https://science.nasa.gov/universe/stars/",
  accessed: "2026-08-13",
};

const NASA_MILKY_WAY: Source = {
  name: "NASA Imagine the Universe — The Milky Way Galaxy",
  url: "https://imagine.gsfc.nasa.gov/science/objects/milkyway1.html",
  accessed: "2026-08-13",
};

const NASA_NEAREST_GALAXIES: Source = {
  name: "NASA Imagine the Universe — The Nearest Galaxies",
  url: "https://imagine.gsfc.nasa.gov/features/cosmic/nearest_galaxy_info.html",
  accessed: "2026-08-13",
};

const NASA_LOCAL_GROUP: Source = {
  name: "NASA Imagine the Universe — The Local Group",
  url: "https://imagine.gsfc.nasa.gov/features/cosmic/local_group_info.html",
  accessed: "2026-08-13",
};

const NASA_SUPERCLUSTER: Source = {
  name: "NASA Imagine the Universe — The Local Supercluster",
  url: "https://imagine.gsfc.nasa.gov/features/cosmic/local_supercluster_info.html",
  accessed: "2026-08-13",
};

const NASA_M31: Source = {
  name: "NASA — Hubble Messier Catalog: Messier 31",
  url: "https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/messier-31/",
  accessed: "2026-08-13",
};

const NASA_M33: Source = {
  name: "NASA — Hubble Messier Catalog: Messier 33",
  url: "https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/messier-33/",
  accessed: "2026-08-13",
};

const TULLY_2014: Source = {
  name: "Tully et al. (2014), “The Laniakea supercluster of galaxies”, Nature 513, 71–73",
  url: "https://arxiv.org/abs/1409.0880",
  accessed: "2026-08-13",
};

const NASA_WMAP: Source = {
  name: "NASA — WMAP Mission Overview",
  url: "https://science.nasa.gov/mission/wmap/wmap-overview/",
  accessed: "2026-08-13",
};

export const OBJECTS: CosmicObject[] = [
  {
    id: "sun",
    name: "The Sun",
    category: "star",
    distanceKm: 0,
    radiusKm: 700_000,
    radiusSource: NASA_SUN,
    labelPriority: 1,
    angleDeg: 0,
    visualStyleKey: "sun",
    photo: {
      file: "sun.jpg",
      alt: "The Sun's disc in extreme ultraviolet light, its surface a mottled orange tangle of magnetic loops, with the corona flaring beyond the limb.",
      credit: "NASA/SDO",
      url: "https://science.nasa.gov/sun/",
      accessed: NASA_PHOTO_ACCESSED,
      discFraction: 0.8,
    },
    shortDescription:
      "One ordinary star, about 700,000 km in radius. Everything else on this page is measured outward from here.",
    source: NASA_SUN,
  },

  // --- The planets. Semi-major axis, not current position: this is a static
  // explanatory arrangement, not an ephemeris. -------------------------------
  {
    id: "mercury",
    name: "Mercury",
    category: "planet",
    distanceKm: 0.387_099_27 * AU_KM,
    radiusKm: 2439.4,
    radiusSource: JPL_PHYSICAL,
    ring: true,
    labelPriority: 3,
    angleDeg: 24,
    visualStyleKey: "rocky",
    elements: { a: 0.38709927, e: 0.20563593, I: 7.00497902, L: 252.2503235, peri: 77.45779628, node: 48.33076593 },
    photo: {
      file: "mercury.jpg",
      alt: "Mercury as a complete grey globe, its surface saturated with overlapping impact craters.",
      credit: "NASA/Johns Hopkins University Applied Physics Laboratory/Carnegie Institution of Washington",
      url: "https://science.nasa.gov/mercury/",
      accessed: NASA_PHOTO_ACCESSED,
      discFraction: 0.94,
    },
    shortDescription: "Semi-major axis 0.387 AU. The innermost planet, and the first thing to collapse into the Sun's glare as you pull back.",
    source: JPL_ELEMENTS,
    uncertaintyNote:
      "Its orbit is the most eccentric of the eight (e = 0.206), which is why the ellipse drawn here is visibly off-centre from the Sun. The distance quoted is the semi-major axis — the long radius — which every planet on this page uses consistently; Mercury's real distance swings between 46 and 70 million km.",
    positionIsDiagrammatic: true,
  },
  {
    id: "venus",
    name: "Venus",
    category: "planet",
    distanceKm: 0.723_335_66 * AU_KM,
    radiusKm: 6051.8,
    radiusSource: JPL_PHYSICAL,
    ring: true,
    labelPriority: 3,
    angleDeg: 108,
    visualStyleKey: "rocky",
    elements: { a: 0.72333566, e: 0.00677672, I: 3.39467605, L: 181.9790995, peri: 131.60246718, node: 76.67984255 },
    photo: {
      file: "venus.jpg",
      alt: "Venus as a full globe in false-colour radar, its cloud-hidden surface rendered in gold and rust.",
      credit: "NASA/JPL-Caltech",
      url: "https://science.nasa.gov/venus/",
      accessed: NASA_PHOTO_ACCESSED,
      discFraction: 0.62,
    },
    shortDescription: "Semi-major axis 0.723 AU. Almost Earth's twin in size — 6,052 km in radius against Earth's 6,371 km.",
    source: JPL_ELEMENTS,
    positionIsDiagrammatic: true,
  },
  {
    id: "earth",
    name: "Earth",
    category: "planet",
    distanceKm: 1.000_002_61 * AU_KM,
    radiusKm: 6371.0084,
    radiusSource: JPL_PHYSICAL,
    ring: true,
    labelPriority: 2,
    angleDeg: 192,
    visualStyleKey: "earth",
    elements: { a: 1.00000261, e: 0.01671123, I: -1.531e-05, L: 100.46457166, peri: 102.93768193, node: 0.0 },
    photo: {
      file: "earth.jpg",
      alt: "Earth as a full blue and white sphere, Africa and Antarctica visible under swirls of cloud — the Apollo 17 \u201cBlue Marble\u201d.",
      credit: "NASA",
      url: "https://images.nasa.gov/details/as17-148-22727",
      accessed: NASA_PHOTO_ACCESSED,
      discFraction: 0.92,
    },
    shortDescription: "One astronomical unit, by definition the yardstick for everything inside the Solar System. Light takes eight minutes to get here.",
    source: JPL_ELEMENTS,
    uncertaintyNote:
      "JPL's element table gives 1.0000026 AU for the Earth–Moon barycentre — the point the pair orbits together — rather than for Earth alone.",
    positionIsDiagrammatic: true,
  },
  {
    id: "mars",
    name: "Mars",
    category: "planet",
    distanceKm: 1.523_710_34 * AU_KM,
    radiusKm: 3389.5,
    radiusSource: JPL_PHYSICAL,
    ring: true,
    labelPriority: 3,
    angleDeg: 300,
    visualStyleKey: "rocky",
    elements: { a: 1.52371034, e: 0.0933941, I: 1.84969142, L: -4.55343205, peri: -23.94362959, node: 49.55953891 },
    photo: {
      file: "mars.jpg",
      alt: "Mars as a complete rust-orange globe, the Valles Marineris canyon system cutting across its middle and a white polar cap at the top.",
      credit: "NASA/JPL-Caltech/USGS",
      url: "https://images.nasa.gov/details/PIA00407",
      accessed: NASA_PHOTO_ACCESSED,
      discFraction: 0.98,
    },
    shortDescription: "Semi-major axis 1.524 AU. The outer edge of the rocky planets, and the last world within easy reach of a spacecraft.",
    source: JPL_ELEMENTS,
    positionIsDiagrammatic: true,
  },
  {
    id: "jupiter",
    name: "Jupiter",
    category: "planet",
    distanceKm: 5.202_887 * AU_KM,
    radiusKm: 69_911,
    radiusSource: JPL_PHYSICAL,
    ring: true,
    labelPriority: 3,
    angleDeg: 60,
    visualStyleKey: "gas",
    elements: { a: 5.202887, e: 0.04838624, I: 1.30439695, L: 34.39644051, peri: 14.72847983, node: 100.47390909 },
    photo: {
      file: "jupiter.jpg",
      alt: "Jupiter as a full banded disc in cream and orange, the Great Red Spot below and left of centre.",
      credit: "NASA/JPL",
      url: "https://science.nasa.gov/jupiter/",
      accessed: NASA_PHOTO_ACCESSED,
      discFraction: 0.96,
    },
    shortDescription: "Semi-major axis 5.20 AU, radius 69,911 km — eleven Earths across, and still a tenth the width of the Sun.",
    source: JPL_ELEMENTS,
    positionIsDiagrammatic: true,
  },
  {
    id: "saturn",
    name: "Saturn",
    category: "planet",
    distanceKm: 9.536_675_94 * AU_KM,
    radiusKm: 58_232,
    radiusSource: JPL_PHYSICAL,
    ring: true,
    labelPriority: 3,
    angleDeg: 150,
    visualStyleKey: "gas",
    elements: { a: 9.53667594, e: 0.05386179, I: 2.48599187, L: 49.95424423, peri: 92.59887831, node: 113.66242448 },
    photo: {
      file: "saturn.jpg",
      alt: "Saturn in natural colour, its pale gold globe encircled by the ring system seen at a shallow angle.",
      credit: "NASA/JPL/Space Science Institute",
      url: "https://science.nasa.gov/saturn/",
      accessed: NASA_PHOTO_ACCESSED,
      discFraction: 0.3,
    },
    shortDescription: "Semi-major axis 9.54 AU. Nearly ten times Earth's distance from the Sun; sunlight arrives here about eighty minutes old.",
    source: JPL_ELEMENTS,
    positionIsDiagrammatic: true,
  },
  {
    id: "uranus",
    name: "Uranus",
    category: "planet",
    distanceKm: 19.189_164_64 * AU_KM,
    radiusKm: 25_362,
    radiusSource: JPL_PHYSICAL,
    ring: true,
    labelPriority: 3,
    angleDeg: 246,
    visualStyleKey: "ice",
    elements: { a: 19.18916464, e: 0.04725744, I: 0.77263783, L: 313.23810451, peri: 170.9542763, node: 74.01692503 },
    photo: {
      file: "uranus.jpg",
      alt: "Uranus as an almost featureless pale cyan sphere.",
      credit: "NASA/JPL-Caltech",
      url: "https://science.nasa.gov/uranus/",
      accessed: NASA_PHOTO_ACCESSED,
      discFraction: 0.86,
    },
    shortDescription: "Semi-major axis 19.19 AU. Twice as far out as Saturn — the spacing between the outer planets grows as fast as the planets themselves shrink.",
    source: JPL_ELEMENTS,
    positionIsDiagrammatic: true,
  },
  {
    id: "neptune",
    name: "Neptune",
    category: "planet",
    distanceKm: 30.069_922_76 * AU_KM,
    radiusKm: 24_622,
    radiusSource: JPL_PHYSICAL,
    ring: true,
    labelPriority: 3,
    angleDeg: 336,
    visualStyleKey: "ice",
    elements: { a: 30.06992276, e: 0.00859048, I: 1.77004347, L: -55.12002969, peri: 44.96476227, node: 131.78422574 },
    photo: {
      file: "neptune.jpg",
      alt: "Neptune as a deep blue globe, a dark storm and thin white cloud streaks visible across it.",
      credit: "NASA/JPL",
      url: "https://science.nasa.gov/neptune/",
      accessed: NASA_PHOTO_ACCESSED,
      discFraction: 0.6,
    },
    shortDescription: "Semi-major axis 30.07 AU — 4.5 billion km. The outermost planet, and the last object here whose position anyone would call settled.",
    source: JPL_ELEMENTS,
    positionIsDiagrammatic: true,
  },

  // --- The edge that isn't an edge. -----------------------------------------
  {
    id: "kuiper-belt",
    name: "Kuiper Belt",
    category: "region",
    distanceKm: 50 * AU_KM,
    ring: true,
    planar: true,
    labelPriority: 4,
    angleDeg: 20,
    visualStyleKey: "belt",
    shortDescription:
      "A ring of icy bodies beginning at Neptune's orbit, about 30 AU out, and thinning away around 50 AU.",
    source: NASA_KUIPER,
    uncertaintyNote:
      "The main belt ends near 50 AU, but an overlapping scattered disk continues to nearly 1,000 AU, and objects like Sedna swing out to about 1,200 AU. The ring drawn here is the main belt only.",
  },
  {
    id: "heliopause",
    name: "The heliopause",
    category: "region",
    distanceKm: 122 * AU_KM,
    ring: true,
    labelPriority: 3,
    angleDeg: 200,
    visualStyleKey: "boundary",
    shortDescription:
      "Where the Sun's outward wind is finally stopped by the gas between the stars. Voyager 1 crossed it on 25 August 2012 at about 122 AU — roughly 18 billion km.",
    source: NASA_VOYAGER,
    uncertaintyNote:
      "This is one crossing, at one time, in one direction — not a measured sphere. Voyager 2 crossed six years later, elsewhere. NASA describes the shape of the boundary as still an open research question.",
  },
  {
    id: "oort-inner",
    name: "Oort Cloud (inner edge)",
    category: "region",
    distanceKm: 2000 * AU_KM,
    ring: true,
    labelPriority: 4,
    angleDeg: 320,
    visualStyleKey: "boundary",
    shortDescription:
      "The nearest edge of a shell of icy bodies thought to surround the whole Solar System, estimated at 2,000–5,000 AU.",
    source: NASA_OORT,
    uncertaintyNote:
      "The Oort Cloud has never been observed. It was proposed in 1950 to explain why long-period comets arrive from every direction rather than along the plane the planets share. Its boundaries are inferences, and NASA's own page gives two different figures for the inner edge.",
  },
  {
    id: "oort-outer",
    name: "Oort Cloud (outer edge)",
    category: "region",
    distanceKm: 100_000 * AU_KM,
    ring: true,
    labelPriority: 3,
    angleDeg: 140,
    visualStyleKey: "boundary",
    shortDescription:
      "The far edge of that same theorised shell, somewhere between 10,000 and 100,000 AU — perhaps a quarter of the way to the next star.",
    source: NASA_OORT,
    uncertaintyNote:
      "An order-of-magnitude estimate of the outer bound of a structure nobody has seen. Drawn at the outermost figure NASA quotes.",
  },

  // --- Other stars. --------------------------------------------------------
  {
    id: "proxima-centauri",
    name: "Proxima Centauri",
    category: "star",
    distanceKm: 4.24 * LY_KM,
    labelPriority: 2,
    angleDeg: 70,
    visualStyleKey: "star",
    symbolRank: 0.5,
    shortDescription:
      "The closest star to the Sun, 4.24 light-years away. By the time it appears here, the entire Solar System has shrunk to a dot.",
    source: NASA_SUN,
    uncertaintyNote:
      "NASA's Sun facts page gives 4.24 light-years; NASA's Imagine the Universe gives 4.25. The disagreement is in the last digit of a very carefully measured number. It has no photograph here: NASA's image library holds a portrait of Alpha Centauri A and B, but Proxima is not in that frame, and borrowing it would be labelling the wrong star.",
    positionIsDiagrammatic: true,
  },
  {
    id: "alpha-centauri",
    name: "Alpha Centauri A & B",
    category: "star",
    distanceKm: 4.37 * LY_KM,
    labelPriority: 3,
    angleDeg: 88,
    visualStyleKey: "star",
    symbolRank: 0.5,
    photo: {
      file: "alpha-centauri.jpg",
      alt: "Alpha Centauri A and B photographed by Hubble as two brilliant white points, each flaring into a four-pointed diffraction cross.",
      credit: "NASA/ESA Hubble Space Telescope",
      url: "https://images.nasa.gov/details/GSFC_20171208_Archive_e000214",
      accessed: NASA_PHOTO_ACCESSED,
      discFraction: 0.8,
    },
    shortDescription:
      "A pair of Sun-like stars 4.37 light-years out, bound together with Proxima in one system.",
    source: NASA_SUN,
    positionIsDiagrammatic: true,
  },
  {
    id: "helix-nebula",
    name: "Helix Nebula",
    category: "nebula",
    distanceKm: 650 * LY_KM,
    labelPriority: 5,
    angleDeg: 235,
    visualStyleKey: "nebula",
    symbolRank: 0.6,
    photo: {
      file: "helix-nebula.jpg",
      alt: "The Helix Nebula in infrared: a pale blue-white ring of cast-off gas around the dying star at its centre, set in a dense field of stars.",
      credit: "NASA/JPL-Caltech (Spitzer Space Telescope)",
      url: "https://images.nasa.gov/details/PIA15658",
      accessed: NASA_PHOTO_ACCESSED,
      discFraction: 0.38,
    },
    shortDescription:
      "The cast-off outer layers of a dying Sun-like star, 650 light-years away — one plausible picture of this Sun's own distant future.",
    source: NASA_STARS,
    positionIsDiagrammatic: true,
  },
  {
    id: "tycho-remnant",
    name: "Tycho's supernova remnant",
    category: "nebula",
    distanceKm: 13_000 * LY_KM,
    labelPriority: 5,
    angleDeg: 15,
    visualStyleKey: "nebula",
    symbolRank: 0.62,
    photo: {
      file: "tycho-remnant.jpg",
      alt: "Tycho's supernova remnant as a near-perfect expanding bubble, its shell rendered in green and yellow with a blue-violet rim, from combined X-ray and infrared observations.",
      credit: "MPIA/NASA/Calar Alto Observatory",
      url: "https://images.nasa.gov/details/PIA11435",
      accessed: NASA_PHOTO_ACCESSED,
      discFraction: 0.62,
    },
    shortDescription:
      "The wreckage of a star seen to explode in 1572, about 13,000 light-years away and still expanding.",
    source: NASA_STARS,
    positionIsDiagrammatic: true,
  },

  // --- The Galaxy. ---------------------------------------------------------
  {
    id: "galactic-centre",
    name: "Galactic Centre",
    category: "region",
    distanceKm: 25_000 * LY_KM,
    labelPriority: 2,
    angleDeg: 180,
    visualStyleKey: "core",
    symbolRank: 0.55,
    shortDescription:
      "The middle of the Milky Way, about 25,000 light-years from here. The Sun has never been anywhere near it.",
    source: NASA_MILKY_WAY,
    uncertaintyNote:
      "Published estimates of the Sun's distance from the Galactic Centre range from roughly 25,000 to 27,000 light-years depending on the method used. It is the one object here with no photograph: the best-looking candidate turned out to be an artist's impression, and an illustration presented as an observation is worse than no picture at all.",
    positionIsDiagrammatic: true,
  },
  {
    id: "milky-way",
    name: "The Milky Way",
    category: "structure",
    // Far edge from the Sun: 25,000 ly to the centre + a 50,000 ly disc radius.
    distanceKm: 75_000 * LY_KM,
    structureRadiusKm: 50_000 * LY_KM,
    centre: { ofId: "galactic-centre", fraction: 1 },
    labelPriority: 2,
    angleDeg: 180,
    enterAdjust: -0.3,
    visualStyleKey: "galaxy-disc",
    shortDescription:
      "A disc of roughly 100 billion stars, about 100,000 light-years across. The Sun sits about a quarter of the way in from its edge — drawn here off-centre, because it is.",
    source: NASA_MILKY_WAY,
    uncertaintyNote:
      "The Galaxy has no sharp rim; 100,000 light-years is a conventional figure for the bright stellar disc, and published values differ. The spiral arms are not drawn, because their exact geometry is not settled.",
  },
  {
    id: "lmc",
    name: "Large Magellanic Cloud",
    category: "galaxy",
    distanceKm: 179_000 * LY_KM,
    labelPriority: 4,
    angleDeg: 300,
    visualStyleKey: "galaxy",
    symbolRank: 0.75,
    photo: {
      file: "lmc.jpg",
      alt: "The Large Magellanic Cloud in infrared, a broad irregular sprawl of dust and star-forming regions filling the frame.",
      credit: "NASA/JPL-Caltech/STScI (Spitzer Space Telescope)",
      url: "https://images.nasa.gov/details/PIA07137",
      accessed: NASA_PHOTO_ACCESSED,
      discFraction: 0.85,
    },
    shortDescription: "A satellite galaxy of the Milky Way, 179,000 light-years away and visible to the unaided eye from the southern hemisphere.",
    source: NASA_NEAREST_GALAXIES,
    positionIsDiagrammatic: true,
  },
  {
    id: "smc",
    name: "Small Magellanic Cloud",
    category: "galaxy",
    distanceKm: 210_000 * LY_KM,
    labelPriority: 5,
    angleDeg: 330,
    visualStyleKey: "galaxy",
    symbolRank: 0.68,
    photo: {
      file: "smc.jpg",
      alt: "The Small Magellanic Cloud in infrared, a wispy elongated cloud of dust and young stars.",
      credit: "NASA/JPL-Caltech/UCLA (WISE)",
      url: "https://images.nasa.gov/details/PIA13124",
      accessed: NASA_PHOTO_ACCESSED,
      discFraction: 0.72,
    },
    shortDescription: "The Large Cloud's smaller companion, 210,000 light-years out.",
    source: NASA_NEAREST_GALAXIES,
    positionIsDiagrammatic: true,
  },

  // --- The Local Group. ----------------------------------------------------
  {
    id: "andromeda",
    name: "Andromeda Galaxy",
    category: "galaxy",
    distanceKm: 2_500_000 * LY_KM,
    labelPriority: 2,
    angleDeg: 45,
    visualStyleKey: "galaxy",
    symbolRank: 0.8,
    photo: {
      file: "andromeda.jpg",
      alt: "The Andromeda Galaxy in ultraviolet, its spiral arms picked out as blue-white rings of hot young stars around a golden core, seen at a steep angle.",
      credit: "NASA/JPL-Caltech (GALEX)",
      url: "https://images.nasa.gov/details/PIA15416",
      accessed: NASA_PHOTO_ACCESSED,
      discFraction: 0.7,
    },
    shortDescription:
      "The nearest large spiral galaxy, 2.5 million light-years away — and the most distant thing a human eye can see unaided.",
    source: NASA_M31,
    uncertaintyNote:
      "NASA's Hubble pages give 2.5 million light-years; NASA's Imagine the Universe gives 2.3 million. Both are current NASA figures for the same galaxy.",
    positionIsDiagrammatic: true,
  },
  {
    id: "triangulum",
    name: "Triangulum Galaxy",
    category: "galaxy",
    distanceKm: 3_000_000 * LY_KM,
    labelPriority: 4,
    angleDeg: 75,
    visualStyleKey: "galaxy",
    symbolRank: 0.72,
    photo: {
      file: "triangulum.jpg",
      alt: "The Triangulum Galaxy in infrared, a loose blue spiral of star-forming regions seen close to face-on.",
      credit: "NASA/JPL-Caltech/UCLA (WISE)",
      url: "https://images.nasa.gov/details/PIA13452",
      accessed: NASA_PHOTO_ACCESSED,
      discFraction: 0.62,
    },
    shortDescription: "The Local Group's third-largest member, about 3 million light-years away and roughly half the Milky Way's size.",
    source: NASA_M33,
    uncertaintyNote: "NASA rounds this to about 3 million light-years; other published measurements cluster nearer 2.7 million.",
    positionIsDiagrammatic: true,
  },
  {
    id: "local-group",
    name: "The Local Group",
    category: "structure",
    // Centre lies between the Milky Way and Andromeda; radius ~5 Mly.
    distanceKm: 6_250_000 * LY_KM,
    structureRadiusKm: 5_000_000 * LY_KM,
    centre: { ofId: "andromeda", fraction: 0.5 },
    labelPriority: 2,
    angleDeg: 45,
    enterAdjust: -0.25,
    visualStyleKey: "group",
    shortDescription:
      "Over thirty galaxies spread across about 10 million light-years, with the Milky Way and Andromeda as its two heavyweights.",
    source: NASA_LOCAL_GROUP,
    uncertaintyNote:
      "The Local Group has no boundary you could stand on. NASA places its centre somewhere between the Milky Way and Andromeda, which is where this circle is drawn from.",
  },

  // --- Beyond. -------------------------------------------------------------
  {
    id: "virgo-cluster",
    name: "Virgo Cluster",
    category: "structure",
    distanceKm: 65_000_000 * LY_KM,
    labelPriority: 3,
    angleDeg: 130,
    visualStyleKey: "cluster",
    symbolRank: 0.8,
    photo: {
      file: "virgo-cluster.jpg",
      alt: "A field in the Virgo Cluster: dozens of galaxies — spirals seen edge-on and face-on, and fuzzy ellipticals — scattered across one infrared frame.",
      credit: "NASA/JPL-Caltech/SSC (Spitzer Space Telescope)",
      url: "https://images.nasa.gov/details/PIA07906",
      accessed: NASA_PHOTO_ACCESSED,
      // A wide, faint field: zoomed in so galaxies fill the symbol rather than
      // reading as a dark speck once it is drawn at 24 pixels.
      discFraction: 0.5,
    },
    shortDescription:
      "About 2,000 galaxies packed together 65 million light-years away — the nearest place the universe gets genuinely crowded.",
    source: NASA_SUPERCLUSTER,
    uncertaintyNote:
      "65 million light-years is NASA's quoted figure and sits at the upper end of the published range; other measurements put the cluster nearer 55–60 million light-years. Its distance is one of the load-bearing rungs of the cosmic distance ladder, which is why it is still argued about.",
    positionIsDiagrammatic: true,
  },
  {
    id: "local-supercluster",
    name: "The Local Supercluster",
    category: "structure",
    distanceKm: 115_000_000 * LY_KM,
    structureRadiusKm: 50_000_000 * LY_KM,
    centre: { ofId: "virgo-cluster", fraction: 1 },
    labelPriority: 3,
    angleDeg: 130,
    visualStyleKey: "group",
    shortDescription:
      "The Local Group is one of about fifty small groups drawn toward Virgo, forming a flattened cluster of clusters roughly 100 million light-years across.",
    source: NASA_SUPERCLUSTER,
    uncertaintyNote: "We sit near one edge of it, not inside its centre.",
  },
  {
    id: "laniakea",
    name: "Laniakea",
    category: "structure",
    distanceKm: 260_000_000 * LY_KM,
    structureRadiusKm: 260_000_000 * LY_KM,
    labelPriority: 2,
    angleDeg: 130,
    enterAdjust: -0.2,
    visualStyleKey: "group",
    shortDescription:
      "A 2014 survey of galaxy motions found the Local Supercluster is one lobe of something larger — about 520 million light-years across, containing perhaps 100,000 galaxies.",
    source: TULLY_2014,
    uncertaintyNote:
      "Laniakea is defined by how galaxies move, not by anything you could see or point at, and what counts as a supercluster is still argued over in the literature. Treat this circle as a model, not an object.",
    positionIsDiagrammatic: true,
  },
  {
    id: "observable-universe",
    name: "The observable universe",
    category: "horizon",
    distanceKm: 46_000_000_000 * LY_KM,
    ring: true,
    labelPriority: 1,
    angleDeg: 0,
    visualStyleKey: "horizon",
    shortDescription:
      "The limit of what light has had time to reach us from — about 46 billion light-years in every direction. Not the edge of the universe; the edge of the part we can see.",
    source: NASA_WMAP,
    uncertaintyNote:
      "The universe is 13.77 billion years old, so this radius looks impossible — but space expanded while that light was in transit, carrying its source further away as it travelled. Published values for the present radius range from about 45.6 to 46.6 billion light-years, depending on the cosmological parameters used and on whether the figure quotes the particle horizon or the surface the microwave background came from. NASA's WMAP mission fixes the age; the radius is a calculation on top of it.",
  },
];

/**
 * Named bands of the journey. These drive the screen-reader announcement, the
 * heading shown beside the scale readout, and the textual fallback — they do
 * NOT drive object visibility, which comes from distance alone.
 */
export interface ScaleLevel {
  id: string;
  name: string;
  fromLogR: number;
  insight: string;
}

export const SCALE_LEVELS: ScaleLevel[] = [
  {
    id: "sun",
    name: "The Sun",
    fromLogR: 6,
    insight: "At this scale the Sun is everything. Zoom out.",
  },
  {
    id: "inner",
    name: "Inner Solar System",
    fromLogR: 7.8,
    insight: "Four rocky planets, and the Sun already reduced to a disc among them.",
  },
  {
    id: "outer",
    name: "Outer Solar System",
    fromLogR: 8.9,
    insight: "The gaps grow faster than the planets do. The inner four are already a smudge at the centre.",
  },
  {
    id: "edge",
    name: "The Solar System's uncertain edge",
    fromLogR: 9.9,
    insight:
      "There is no single wall where the Solar System ends — it depends entirely on which definition you use.",
  },
  {
    id: "stars",
    name: "The nearest stars",
    fromLogR: 13.2,
    insight: "Everything you have looked at so far now fits inside the dot at the centre.",
  },
  {
    id: "neighbourhood",
    name: "The stellar neighbourhood",
    fromLogR: 14.6,
    insight:
      "Between the nearest star and the centre of the Galaxy, almost nothing on this map changes for a very long way. That emptiness is the finding, not a gap in the data.",
  },
  {
    id: "galaxy",
    name: "The Milky Way",
    fromLogR: 17.3,
    insight: "A hundred billion stars, and the Sun is not at the middle of them.",
  },
  {
    id: "local-group",
    name: "The Local Group",
    fromLogR: 19.3,
    insight: "The whole Galaxy is now one of thirty-odd smudges.",
  },
  {
    id: "beyond",
    name: "Beyond the Local Group",
    fromLogR: 20.7,
    insight: "Groups of galaxies turn out to be part of larger flows, which are part of larger ones still.",
  },
  {
    id: "horizon",
    name: "The observable universe",
    fromLogR: 22.6,
    insight: "This is as far as light has had time to travel. It is not the edge of anything.",
  },
];

export function levelAt(logR: number): ScaleLevel {
  let level = SCALE_LEVELS[0];
  for (const candidate of SCALE_LEVELS) {
    if (logR >= candidate.fromLogR) level = candidate;
  }
  return level;
}

export function objectById(id: string): CosmicObject | undefined {
  return OBJECTS.find((object) => object.id === id);
}

/** Every distinct source cited, in first-use order, for the Sources section. */
export function allSources(): Source[] {
  const seen = new Map<string, Source>();
  for (const object of OBJECTS) {
    const photoSource: Source | undefined = object.photo
      ? { name: `${object.photo.credit} — photograph of ${object.name}`, url: object.photo.url, accessed: object.photo.accessed }
      : undefined;
    for (const source of [object.source, object.radiusSource, photoSource]) {
      if (source && !seen.has(source.url)) seen.set(source.url, source);
    }
  }
  return [...seen.values()];
}
