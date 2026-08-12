import type { Milestone } from "../lib/scale";

/*
 * Every distanceM below is checked against a live source, not memory (see
 * PROCESS.md / CLAUDE.md for the research trail). Ground through the Moon is
 * distance from Earth; Mars onward is mean distance from the Sun — Mercury
 * and Venus orbit closer to the Sun than Earth does, so "further from Earth"
 * stops being one clean number for them, and they're left out rather than
 * forced into a sequence that doesn't fit. See the note on "The Sun" and
 * "Mars" below.
 */
export const MILESTONES: Milestone[] = [
  {
    id: "sea-level",
    name: "Sea level",
    distanceM: 0,
    category: "atmosphere",
    fact: "Every altitude on this page is measured from here: mean sea level.",
    source: {
      name: "NOAA JetStream",
      url: "https://www.noaa.gov/jetstream/atmosphere",
    },
  },
  {
    id: "everest",
    name: "Summit of Mount Everest",
    distanceM: 8_848.86,
    category: "atmosphere",
    fact: "The 2020 joint Nepal–China survey put the summit at 8,848.86 m — about a metre taller than the figure used for the previous 45 years.",
    source: {
      name: "Daily Sabah",
      url: "https://www.dailysabah.com/life/environment/growth-spurt-mount-everests-height-revised-to-8849-meters-china-and-nepal-announce",
    },
    note: "Measured to the snow surface — the point climbers actually stand on.",
  },
  {
    id: "karman-line",
    name: "The Kármán line",
    distanceM: 100_000,
    category: "atmosphere",
    fact: "100 km is the altitude the world's air-sports federation uses to mark where aeronautics ends and astronautics begins.",
    source: {
      name: "Fédération Aéronautique Internationale",
      url: "https://www.fai.org/news/statement-about-karman-line",
    },
    note: "Not universal: NASA and the US military use 80.5 km instead. The boundary is a convention, not a physical wall — and from here on, so is the scale of this page.",
  },
  {
    id: "iss-orbit",
    name: "International Space Station orbit",
    distanceM: 420_000,
    category: "orbit",
    fact: "The ISS orbits at an average of about 420 km — inside the thermosphere, in thin atmosphere, not open space.",
    source: {
      name: "NASA",
      url: "https://www.nasa.gov/reference/international-space-station/",
    },
  },
  {
    id: "moon",
    name: "The Moon",
    distanceM: 384_400_000,
    category: "orbit",
    fact: "384,400 km away on average — close enough that light takes a little over a second to cross the gap.",
    source: {
      name: "NASA Space Place",
      url: "https://spaceplace.nasa.gov/moon-distance/en/",
    },
    note: "The real distance varies by about 42,000 km across the Moon's elliptical orbit.",
  },
  {
    id: "sun",
    name: "The Sun",
    distanceM: 149_600_000_000,
    category: "solar-system",
    fact: "About 149.6 million km — 1 astronomical unit, the ruler the rest of the Solar System gets measured with.",
    source: {
      name: "NASA/JPL Solar System reference",
      url: "https://www.jpl.nasa.gov/edu/pdfs/scaless_reference.pdf",
    },
    note: "Mercury and Venus orbit closer to the Sun than Earth does, so there's no clean 'further out' number for them on an outward journey. Left out here, not forgotten.",
  },
  {
    id: "mars",
    name: "Mars",
    distanceM: 227_900_000_000,
    category: "solar-system",
    fact: "Mars orbits about 227.9 million km from the Sun on average.",
    source: {
      name: "NASA/JPL Solar System reference",
      url: "https://www.jpl.nasa.gov/edu/pdfs/scaless_reference.pdf",
    },
    note: "From here on, distances are mean distance from the Sun, not from Earth — Earth and each planet are both moving, so 'distance from Earth' stops being one fixed number.",
  },
  {
    id: "jupiter",
    name: "Jupiter",
    distanceM: 778_600_000_000,
    category: "solar-system",
    fact: "Jupiter's mean distance from the Sun is about 778.6 million km — more than five times Earth's.",
    source: {
      name: "NASA/JPL Solar System reference",
      url: "https://www.jpl.nasa.gov/edu/pdfs/scaless_reference.pdf",
    },
  },
  {
    id: "saturn",
    name: "Saturn",
    distanceM: 1_433_500_000_000,
    category: "solar-system",
    fact: "About 1.43 billion km from the Sun on average — this is where the compression on this page stops being subtle.",
    source: {
      name: "NASA/JPL Solar System reference",
      url: "https://www.jpl.nasa.gov/edu/pdfs/scaless_reference.pdf",
    },
  },
  {
    id: "uranus",
    name: "Uranus",
    distanceM: 2_872_500_000_000,
    category: "solar-system",
    fact: "About 2.87 billion km from the Sun on average.",
    source: {
      name: "NASA/JPL Solar System reference",
      url: "https://www.jpl.nasa.gov/edu/pdfs/scaless_reference.pdf",
    },
  },
  {
    id: "neptune",
    name: "Neptune",
    distanceM: 4_500_000_000_000,
    category: "solar-system",
    fact: "About 4.5 billion km from the Sun on average — the outermost recognised planet.",
    source: {
      name: "NASA/JPL Solar System reference",
      url: "https://www.jpl.nasa.gov/edu/pdfs/scaless_reference.pdf",
    },
    note: "NASA/JPL's reference figures round Neptune's mean solar distance to about 4.5 billion km.",
  },
  {
    id: "pale-blue-dot",
    name: 'Voyager 1\'s "Pale Blue Dot"',
    distanceM: 6_060_000_000_000,
    category: "interstellar",
    fact: "From 6.06 billion km away, Voyager 1 looked back on 14 February 1990 and Earth was 0.12 pixels wide — a point of scattered light caught in a sunbeam.",
    source: {
      name: "NASA (Pale Blue Dot)",
      url: "https://science.nasa.gov/resource/voyager-pale-blue-dot-download/",
    },
    note: "The furthest Voyager 1 ever looked back. It has since travelled much further outward without turning around again.",
  },
];
