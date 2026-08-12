export interface MilestoneSource {
  name: string;
  url: string;
}

export interface Milestone {
  id: string;
  name: string;
  /** Canonical distance in metres. Ground→Moon: distance from Earth. Mercury
   * onward: mean distance from the Sun — see the heliocentric-reframe note
   * on the karman-line milestone for why. */
  distanceM: number;
  category: "atmosphere" | "orbit" | "solar-system" | "interstellar";
  fact: string;
  source: MilestoneSource;
  note?: string;
}

const LAYERS: Array<{ upToM: number; name: string }> = [
  { upToM: 12_000, name: "troposphere" },
  { upToM: 50_000, name: "stratosphere" },
  { upToM: 85_000, name: "mesosphere" },
  { upToM: 600_000, name: "thermosphere" },
  { upToM: 10_000_000, name: "exosphere" },
];

export function layerForDistance(m: number): string {
  for (const layer of LAYERS) {
    if (m < layer.upToM) return layer.name;
  }
  return "interplanetary space";
}

export function formatDistance(m: number): string {
  if (m < 100_000) return `${Math.round(m).toLocaleString()} m`;
  if (m < 1_000_000_000) return `${Math.round(m / 1_000).toLocaleString()} km`;
  if (m < 1_000_000_000_000) return `${(m / 1_000_000_000).toLocaleString(undefined, { maximumFractionDigits: 1 })} million km`;
  return `${(m / 1_000_000_000_000).toLocaleString(undefined, { maximumFractionDigits: 2 })} billion km`;
}

/**
 * Interpolates the displayed distance for a scroll position, given milestones
 * laid out one-per-section at world position `i * sectionPx`. Linear near
 * ground (log(0) is undefined), log-linear afterwards so the compression
 * needed to fit atmosphere-to-interstellar on one page is continuous rather
 * than a jump-cut at each milestone.
 */
export function distanceAtScroll(
  milestones: Milestone[],
  scrollY: number,
  sectionPx: number,
): number {
  if (milestones.length === 0) return 0;
  if (sectionPx <= 0) return milestones[0].distanceM;

  const position = Math.max(0, scrollY) / sectionPx;
  const i = Math.min(Math.floor(position), milestones.length - 1);
  if (i >= milestones.length - 1) return milestones[milestones.length - 1].distanceM;

  const t = Math.min(Math.max(position - i, 0), 1);
  const a = milestones[i].distanceM;
  const b = milestones[i + 1].distanceM;

  if (a <= 0) return a + (b - a) * t;

  const logA = Math.log(a);
  const logB = Math.log(b);
  return Math.exp(logA + (logB - logA) * t);
}
