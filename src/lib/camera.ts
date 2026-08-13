/*
 * The camera.
 *
 * There is exactly one piece of camera state in this project: `logR`, the
 * base-10 logarithm of the VISIBLE RADIUS in kilometres — the real distance
 * from the Sun at the centre to the nearest edge of the viewport.
 *
 * Two consequences worth keeping:
 *
 * 1. It is semantic, not pixel-derived. Resizing the window changes how many
 *    pixels a kilometre gets, and changes nothing about where the reader is.
 *    Never store a zoom level in pixels, and never recompute logR from
 *    viewport size.
 *
 * 2. Zooming is logarithmic; the picture is not. Within any single frame the
 *    radial mapping is strictly linear (`fractionAt` below is a plain ratio),
 *    so what's on screen at any instant is a true-to-scale map. Only the act
 *    of zooming is compressed. That is a stronger claim than log-compressing
 *    positions inside the frame, and it's what lets the inner planets
 *    genuinely collapse toward the centre as the reader retreats — because
 *    that is what actually happens.
 */

/**
 * Closest approach: a visible radius of 10^6 km. The Sun's radius is
 * ~7.0 × 10^5 km, so at this scale the Sun spans about 70% of the visible
 * radius — unmistakably the whole picture, which is the page's opening claim.
 * `spec/dataset.test.ts` asserts that relationship rather than trusting this
 * comment.
 */
export const MIN_LOG_R = 6;

/**
 * Widest view: a visible radius of ~10^23.7 km ≈ 53 billion light-years, far
 * enough out that the observable-universe horizon sits inside the frame with
 * room to label it. `spec/dataset.test.ts` asserts every object in the dataset
 * fits inside this, so adding a more distant object fails loudly instead of
 * silently rendering off-screen forever.
 */
export const MAX_LOG_R = 23.7;

/** Decades of zoom per button press or arrow key. */
export const STEP = 0.5;

/**
 * Decades of zoom per unit of wheel deltaY. A standard mouse notch reports
 * deltaY ≈ 100, giving ~0.35 decades — the view roughly doubles per notch,
 * which reads as continuous rather than as a slide change.
 */
export const WHEEL_SENSITIVITY = 0.0035;

/** Fraction of the visible radius toward which a body eases each frame. */
const EASING = 0.18;

/** Below this the ease is finished and the animation loop must stop. */
const SETTLED = 0.0005;

export function clampLogR(logR: number): number {
  if (Number.isNaN(logR)) return MIN_LOG_R;
  return Math.min(MAX_LOG_R, Math.max(MIN_LOG_R, logR));
}

/** Visible radius in kilometres for a camera scale. */
export function radiusKm(logR: number): number {
  return 10 ** logR;
}

/**
 * Where an object sits as a fraction of the visible radius: 0 is the Sun at
 * the centre, 1 is the nearest viewport edge, >1 is off screen.
 */
export function fractionAt(distanceKm: number, logR: number): number {
  return distanceKm / radiusKm(logR);
}

/**
 * The radius an object would be drawn at if drawn to scale, in the same
 * fraction-of-visible-radius units. Almost always far below one pixel — which
 * is exactly why `MIN_MARKER_PX` exists and why the page has to say so.
 */
export function trueSizeFraction(objectRadiusKm: number, logR: number): number {
  return objectRadiusKm / radiusKm(logR);
}

/**
 * Smallest radius, in CSS pixels, at which a body is still drawn as itself.
 * Below this it becomes a marker whose size means nothing physical, and the
 * page discloses that rather than letting the reader assume otherwise.
 */
export const MIN_MARKER_PX = 2.5;

/**
 * One easing step toward `target`. Returns `target` exactly once the remaining
 * distance is below the settle threshold, so a caller can compare `next ===
 * target` to decide whether to stop the animation loop — no timer, no
 * perpetual rAF burning battery on a still picture.
 */
export function ease(current: number, target: number): number {
  const next = current + (target - current) * EASING;
  return Math.abs(target - next) < SETTLED ? target : next;
}

/** Camera scale as a 0–100 percentage, for a native range control. */
export function percentOf(logR: number): number {
  return ((logR - MIN_LOG_R) / (MAX_LOG_R - MIN_LOG_R)) * 100;
}

/** Inverse of `percentOf`. */
export function logRAtPercent(percent: number): number {
  const t = Math.min(100, Math.max(0, percent)) / 100;
  return MIN_LOG_R + t * (MAX_LOG_R - MIN_LOG_R);
}
