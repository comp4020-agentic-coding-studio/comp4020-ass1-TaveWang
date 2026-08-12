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
 * Interpolates the displayed distance for a scroll position, given each
 * milestone's real pixel position on the page (`anchorsPx[i]`, ascending,
 * same length as `milestones` — measure these from the actual rendered
 * sections rather than assuming a fixed section height, since real content
 * makes sections different heights). Linear near ground (log(0) is
 * undefined), log-linear afterwards so the compression needed to fit
 * atmosphere-to-interstellar on one page is continuous rather than a
 * jump-cut at each milestone.
 */
export function distanceAtPosition(
  milestones: Milestone[],
  anchorsPx: number[],
  scrollY: number,
): number {
  if (milestones.length === 0) return 0;

  const y = Math.max(anchorsPx[0], Math.min(scrollY, anchorsPx[anchorsPx.length - 1]));

  let i = 0;
  while (i < anchorsPx.length - 2 && y >= anchorsPx[i + 1]) i++;

  const spanPx = anchorsPx[i + 1] - anchorsPx[i];
  const t = spanPx > 0 ? (y - anchorsPx[i]) / spanPx : 0;

  const a = milestones[i].distanceM;
  const b = milestones[i + 1].distanceM;

  if (a <= 0) return a + (b - a) * t;

  const logA = Math.log(a);
  const logB = Math.log(b);
  return Math.exp(logA + (logB - logA) * t);
}

/**
 * Where a scroll position sits along the journey, as a 0–100 percent —
 * the inverse of `positionForPercent`. Used to keep a scrubber control in
 * sync with normal scrolling.
 */
export function percentForPosition(anchorsPx: number[], scrollY: number): number {
  const start = anchorsPx[0];
  const end = anchorsPx[anchorsPx.length - 1];
  const span = end - start;
  if (span <= 0) return 0;
  const y = Math.max(start, Math.min(scrollY, end));
  return ((y - start) / span) * 100;
}

/**
 * The scroll position for a given percent (0–100) along the journey — the
 * inverse of `percentForPosition`. Used to jump the page when a scrubber
 * control is dragged.
 */
export function positionForPercent(anchorsPx: number[], percent: number): number {
  const start = anchorsPx[0];
  const end = anchorsPx[anchorsPx.length - 1];
  const clamped = Math.max(0, Math.min(percent, 100));
  return start + (clamped / 100) * (end - start);
}
