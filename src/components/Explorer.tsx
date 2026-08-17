import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  MAX_LOG_R,
  MIN_LOG_R,
  STEP,
  WHEEL_SENSITIVITY,
  clampLogR,
  ease,
  logRAtPercent,
  percentOf,
  radiusKm,
} from "../lib/camera";
import { CLOSING_LINES, OBJECTS, levelAt, objectById } from "../data/cosmos";
import { PHOTO_MIN_PX, TILT_Y, layout } from "../lib/layout";
import { aphelion, perihelion } from "../lib/orbits";
import { AU_KM, LY_KM, format } from "../lib/units";

/*
 * One island, deliberately. Camera scale and selection are the only live state
 * and both are read by the readout, the labels, the slider and the panel — in
 * separate roots that would need a store to share (see CLAUDE.md). One root
 * with plain useState is simpler and cheaper than four roots plus a store.
 *
 * The canvas is decoration: it is aria-hidden, and every label, control and
 * fact also exists as real DOM. That is the deliberate inversion of NASA Eyes,
 * where "SUN" and "Voyager 1" are painted into a canvas and appear nowhere in
 * the accessible tree.
 */

/** Scale at which kilometres give way to light-years. */
const LY_CROSS = Math.log10(LY_KM);

/** SSR has no viewport. These only affect pixel positions, never which objects
 *  are visible — that is a pure function of the camera scale — so the built
 *  HTML carries the right content and hydration corrects the geometry. */
const SSR_SIZE = { width: 1200, height: 800 };

interface Star {
  x: number;
  y: number;
  r: number;
  a: number;
}

/** Seeded so the star field is identical every frame. A field that reshuffles
 *  on each render reads as noise and competes with the real, labelled objects. */
function makeStars(count: number): Star[] {
  let seed = 20260813;
  const random = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  return Array.from({ length: count }, () => ({
    x: random(),
    y: random(),
    r: random() * 0.9 + 0.25,
    a: random() * 0.5 + 0.12,
  }));
}

const STARS = makeStars(700);

const CATEGORY_LABEL: Record<string, string> = {
  star: "Star",
  planet: "Planet",
  region: "Region",
  nebula: "Nebula",
  galaxy: "Galaxy",
  structure: "Structure",
  horizon: "Horizon",
};

const FILL: Record<string, string> = {
  sun: "#ffcf7a",
  rocky: "#c9a184",
  earth: "#7ea8c4",
  gas: "#d8b382",
  ice: "#9fc4d8",
  star: "#fff2d5",
  nebula: "#b58fc4",
  galaxy: "#c3ccea",
  belt: "#8d8f9c",
  boundary: "#e6b164",
  core: "#ffd9a0",
  "galaxy-disc": "#8fa2d6",
  group: "#7f8fc0",
  cluster: "#a8b6e0",
  horizon: "#e6b164",
};

export default function Explorer() {
  const [logR, setLogR] = useState(MIN_LOG_R);
  const [size, setSize] = useState(SSR_SIZE);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [hasZoomed, setHasZoomed] = useState(false);
  const [journeyOpen, setJourneyOpen] = useState(false);

  const targetRef = useRef(MIN_LOG_R);
  const currentRef = useRef(MIN_LOG_R);
  const frameRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const levelRef = useRef(levelAt(MIN_LOG_R).id);
  const reduceMotionRef = useRef(false);
  // The Sun is the only object ever drawn at its true angular size, so it is
  // the only one whose photograph goes on the canvas. Everything else is a
  // marker, and a marker textured with a photo would read as a claim about
  // size that this page spends its time denying.
  const photosRef = useRef(new Map<string, HTMLImageElement>());
  const [photosLoaded, setPhotosLoaded] = useState(0);

  const maxLabels = size.width < 600 ? 5 : 12;
  const view = layout(logR, size.width, size.height, maxLabels);
  const level = levelAt(logR);
  const reading = format(radiusKm(logR));
  const selected = selectedId ? objectById(selectedId) : undefined;

  /* --- zooming ---------------------------------------------------------- */

  // The eased value lives in a ref and the loop schedules itself from outside
  // React's updater. It first shipped with the rAF call *inside* setLogR's
  // updater, which React is free to invoke more than once — so the animation
  // could double-schedule or stall partway. A state updater must be pure;
  // scheduling the next frame is a side effect and belongs out here.
  const runLoop = useCallback(() => {
    if (frameRef.current !== null) return;
    const tick = () => {
      const next = reduceMotionRef.current
        ? targetRef.current
        : ease(currentRef.current, targetRef.current);
      currentRef.current = next;
      setLogR(next);
      frameRef.current = next === targetRef.current ? null : requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
  }, []);

  const zoomBy = useCallback(
    (decades: number) => {
      targetRef.current = clampLogR(targetRef.current + decades);
      setHasZoomed(true);
      runLoop();
    },
    [runLoop],
  );

  const zoomTo = useCallback(
    (value: number) => {
      targetRef.current = clampLogR(value);
      setHasZoomed(true);
      runLoop();
    },
    [runLoop],
  );

  useEffect(() => {
    reduceMotionRef.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  // The nav's "Text version" link targets the journey, which is now collapsed.
  // Browsers do not reliably expand a closed <details> on fragment navigation,
  // and a link that scrolls to a summary the reader still has to click is a
  // broken link with extra steps — so open it here instead.
  useEffect(() => {
    const openIfTargeted = () => {
      if (window.location.hash === "#journey-text") setJourneyOpen(true);
    };
    openIfTargeted();
    window.addEventListener("hashchange", openIfTargeted);
    return () => window.removeEventListener("hashchange", openIfTargeted);
  }, []);

  useEffect(() => {
    for (const object of OBJECTS) {
      if (!object.photo) continue;
      const image = new Image();
      image.decoding = "async";
      // Relative, never root-relative: these must resolve under the Pages subpath.
      image.src = `./images/objects/${object.photo.file}`;
      image.onload = () => {
        photosRef.current.set(object.id, image);
        setPhotosLoaded((count) => count + 1);
      };
    }
  }, []);

  useEffect(() => {
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, []);

  /* --- viewport --------------------------------------------------------- */
  // Resizing changes how many pixels a kilometre gets and nothing else. The
  // camera scale is never recomputed from pixel dimensions, which is why the
  // reader stays exactly where they were through a rotation or a resize.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const measure = () => {
      const rect = stage.getBoundingClientRect();
      setSize({ width: Math.round(rect.width), height: Math.round(rect.height) });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  /* --- wheel and pinch, scoped to the model only ------------------------ */
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const onWheel = (event: WheelEvent) => {
      // Ctrl+wheel is the browser's own page zoom. Never take that away.
      if (event.ctrlKey) return;
      event.preventDefault();
      zoomBy(event.deltaY * WHEEL_SENSITIVITY);
    };

    let pinchStart: { distance: number; logR: number } | null = null;
    const spread = (touches: TouchList) => {
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      return Math.hypot(dx, dy);
    };
    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 2) return;
      pinchStart = { distance: spread(event.touches), logR: targetRef.current };
    };
    const onTouchMove = (event: TouchEvent) => {
      if (event.touches.length !== 2 || !pinchStart) return;
      event.preventDefault();
      const ratio = spread(event.touches) / pinchStart.distance;
      if (ratio > 0) zoomTo(pinchStart.logR - Math.log10(ratio) * 2.2);
    };
    const onTouchEnd = () => {
      pinchStart = null;
    };

    stage.addEventListener("wheel", onWheel, { passive: false });
    stage.addEventListener("touchstart", onTouchStart, { passive: true });
    stage.addEventListener("touchmove", onTouchMove, { passive: false });
    stage.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      stage.removeEventListener("wheel", onWheel);
      stage.removeEventListener("touchstart", onTouchStart);
      stage.removeEventListener("touchmove", onTouchMove);
      stage.removeEventListener("touchend", onTouchEnd);
    };
  }, [zoomBy, zoomTo]);

  /* --- announcements ---------------------------------------------------- */
  // Announce when the camera SETTLES, never per frame. Firing per frame feeds
  // a live region an eased value several times a second (CLAUDE.md has that
  // scar), but the fix for it — fire only when the band changes — was wrong in
  // a way nobody hears unless they use the page with a screen reader: the band
  // changes mid-ease, so the radius captured with it was whatever the camera
  // was passing through at the time, and nothing ever corrected it. A sighted
  // reader saw 452 million km while a screen-reader reader was told 773
  // million; at the widest scale the two differed by a factor of 12.
  //
  // Settling is the honest trigger. It is once per gesture rather than once
  // per frame, and it reads the same `logR` the readout renders from, so the
  // two cannot disagree. spec/interaction.test.tsx holds them together.
  const announcedRef = useRef(false);
  useEffect(() => {
    // Still easing: targetRef is where the camera is going, logR is where it is.
    if (logR !== targetRef.current) return;
    // Don't announce the opening state — nobody asked for it and a live region
    // that speaks on load is noise.
    if (!announcedRef.current) {
      announcedRef.current = true;
      levelRef.current = level.id;
      return;
    }
    levelRef.current = level.id;
    setAnnouncement(`${level.name}. Visible radius ${reading.primary}.`);
  }, [logR, level, reading.primary]);

  /* --- selection -------------------------------------------------------- */
  const select = useCallback((id: string, trigger: HTMLElement | null) => {
    triggerRef.current = trigger;
    setSelectedId(id);
  }, []);

  const closePanel = useCallback(() => {
    setSelectedId(null);
    triggerRef.current?.focus();
    triggerRef.current = null;
  }, []);

  useEffect(() => {
    if (selectedId) closeRef.current?.focus();
  }, [selectedId]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && selectedId) closePanel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, closePanel]);

  const onStageKey = (event: ReactKeyboardEvent) => {
    const actions: Record<string, () => void> = {
      "+": () => zoomBy(-STEP),
      "=": () => zoomBy(-STEP),
      "-": () => zoomBy(STEP),
      _: () => zoomBy(STEP),
      ArrowUp: () => zoomBy(-STEP),
      ArrowDown: () => zoomBy(STEP),
      Home: () => zoomTo(MIN_LOG_R),
      End: () => zoomTo(MAX_LOG_R),
    };
    const action = actions[event.key];
    if (!action) return;
    event.preventDefault();
    action();
  };

  /* --- canvas ----------------------------------------------------------- */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    // Cap the buffer: a 3x device pixel ratio on a large screen allocates a
    // surface several times the size of anything the reader can resolve.
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const { width, height } = size;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, height);

    const cx = width / 2;
    const cy = height / 2;

    // Background stars: illustrative, never labelled, and disclosed as such in
    // the method note. Density grows with scale so wider views feel populated
    // without competing with the curated objects.
    const density = Math.min(1, (logR - MIN_LOG_R) / 9);
    const shown = Math.floor(STARS.length * (0.15 + 0.85 * density));
    for (let i = 0; i < shown; i++) {
      const star = STARS[i];
      context.globalAlpha = star.a * (0.4 + 0.6 * density);
      context.fillStyle = "#cfd8f0";
      context.beginPath();
      context.arc(star.x * width, star.y * height, star.r, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;

    // Structures first, behind everything.
    for (const item of view.placed) {
      if (!item.structure) continue;
      const { cx: sx, cy: sy, r } = item.structure;
      const colour = FILL[item.object.visualStyleKey] ?? "#8fa2d6";
      const gradient = context.createRadialGradient(sx, sy, 0, sx, sy, Math.max(r, 1));
      gradient.addColorStop(0, `${colour}4a`);
      gradient.addColorStop(0.75, `${colour}1e`);
      gradient.addColorStop(1, `${colour}00`);
      context.fillStyle = gradient;
      context.beginPath();
      context.arc(sx, sy, r, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = `${colour}55`;
      context.lineWidth = 1;
      context.stroke();
    }

    // Shell boundaries: circles, because a sphere's outline is a circle from
    // every angle. The Kuiper belt is a disc, so it gets the same tilt as the
    // planets instead.
    for (const item of view.placed) {
      if (item.ringRadiusPx === undefined || item.ringRadiusPx < 2) continue;
      const isBoundary = item.object.category === "region" || item.object.category === "horizon";
      context.strokeStyle = isBoundary ? "rgb(230 177 100 / 34%)" : "rgb(255 255 255 / 14%)";
      context.lineWidth = 1;
      context.setLineDash(isBoundary ? [4, 5] : []);
      context.beginPath();
      if (item.object.planar) {
        context.ellipse(cx, cy, item.ringRadiusPx, item.ringRadiusPx * TILT_Y, 0, 0, Math.PI * 2);
      } else {
        context.arc(cx, cy, item.ringRadiusPx, 0, Math.PI * 2);
      }
      context.stroke();
      context.setLineDash([]);
    }

    // Real orbits: true ellipses with the Sun at a focus, on their own
    // inclined planes, already projected in src/lib/layout.ts.
    for (const item of view.placed) {
      if (!item.orbit || item.orbit.length < 2) continue;
      context.strokeStyle =
        item.object.id === selectedId ? "rgb(255 255 255 / 45%)" : "rgb(255 255 255 / 17%)";
      context.lineWidth = 1;
      context.beginPath();
      for (const [index, point] of item.orbit.entries()) {
        if (index === 0) context.moveTo(point.x, point.y);
        else context.lineTo(point.x, point.y);
      }
      context.stroke();
    }

    // Bodies. A planet is drawn as a symbol whose size is its prominence at
    // this scale, never its physical size — see the Method note on the page.
    // Draw smallest-first so a larger neighbour is never hidden behind one.
    const bodies = view.placed
      .filter((item) => item.object.id !== "sun" && !item.structure)
      .sort((a, b) => (a.symbolPx ?? 0) - (b.symbolPx ?? 0));

    for (const item of bodies) {
      const r = Math.max(item.symbolPx ?? 3, 1.5);
      const photo = photosRef.current.get(item.object.id);
      const discFraction = item.object.photo?.discFraction ?? 1;

      if (photo && r >= PHOTO_MIN_PX) {
        const drawn = (r * 2) / discFraction;
        context.save();
        context.beginPath();
        context.arc(item.x, item.y, r, 0, Math.PI * 2);
        context.clip();
        context.drawImage(photo, item.x - drawn / 2, item.y - drawn / 2, drawn, drawn);
        context.restore();
      } else {
        context.fillStyle = FILL[item.object.visualStyleKey] ?? "#dcdcdc";
        context.beginPath();
        context.arc(item.x, item.y, r, 0, Math.PI * 2);
        context.fill();
      }

      if (item.object.id === selectedId) {
        context.strokeStyle = "#ffffff";
        context.lineWidth = 1.5;
        context.beginPath();
        context.arc(item.x, item.y, r + 6, 0, Math.PI * 2);
        context.stroke();
      }
    }

    // The Sun, last and in the middle.
    if (view.sunIsMarker) {
      // Too small to draw honestly. A location marker, not an enlarged Sun.
      context.strokeStyle = "#ffcf7a";
      context.lineWidth = 1.25;
      context.beginPath();
      context.arc(cx, cy, 6, 0, Math.PI * 2);
      context.stroke();
      context.beginPath();
      context.moveTo(cx - 11, cy);
      context.lineTo(cx - 8, cy);
      context.moveTo(cx + 8, cy);
      context.lineTo(cx + 11, cy);
      context.moveTo(cx, cy - 11);
      context.lineTo(cx, cy - 8);
      context.moveTo(cx, cy + 8);
      context.lineTo(cx, cy + 11);
      context.stroke();
    } else {
      const glow = context.createRadialGradient(cx, cy, 0, cx, cy, view.sunRadiusPx * 2.2);
      glow.addColorStop(0, "rgb(255 216 150 / 55%)");
      glow.addColorStop(1, "rgb(255 190 110 / 0%)");
      context.fillStyle = glow;
      context.beginPath();
      context.arc(cx, cy, view.sunRadiusPx * 2.2, 0, Math.PI * 2);
      context.fill();
      const photo = photosRef.current.get("sun");
      const discFraction = objectById("sun")?.photo?.discFraction ?? 1;
      if (photo) {
        // Scale so the PHOTOSPHERE matches the computed radius — the image
        // frame also contains corona and black margin, and drawing the frame
        // to that radius would understate the Sun while looking plausible.
        const drawn = (view.sunRadiusPx * 2) / discFraction;
        context.save();
        context.beginPath();
        // Clipped exactly at the photosphere. Clipping wider to let the corona
        // show also pulled in the source image's black margin, which rendered
        // as a hard dark ring around the Sun; the warm gradient drawn behind
        // does that job without the seam.
        context.arc(cx, cy, view.sunRadiusPx, 0, Math.PI * 2);
        context.clip();
        context.drawImage(photo, cx - drawn / 2, cy - drawn / 2, drawn, drawn);
        context.restore();
      } else {
        // Until the photograph loads, a flat disc of the right size. The page
        // is never wrong about the Sun's scale, only about its texture.
        context.fillStyle = "#ffd489";
        context.beginPath();
        context.arc(cx, cy, view.sunRadiusPx, 0, Math.PI * 2);
        context.fill();
      }
    }
  }, [logR, size, view, selectedId, photosLoaded]);

  /* --- scale bar -------------------------------------------------------- */
  const barPx = size.width < 600 ? 90 : 130;
  const unitPx = Math.min(size.width, size.height) / 2;
  const barReading = format((barPx / Math.max(unitPx, 1)) * radiusKm(logR));

  const showUnitNotice = logR > LY_CROSS - 0.35 && logR < LY_CROSS + 0.9;

  /* --- camera radius is not the horizon --------------------------------- */
  // The camera can pull back further than the horizon itself, on purpose: the
  // widest scale has to fit the whole circle on screen with room to label it.
  // The cost is that the readout says one number ("visible radius 53 billion
  // light-years") directly beneath a band named after a different one, and a
  // reader is entitled to read that as the size of the observable universe.
  // Whenever the camera is outside the horizon, say which number is which.
  // Both are derived, so neither can drift from what is drawn.
  // Settled at the far end — not merely passing through it on the way.
  const atWidest = logR >= MAX_LOG_R && logR === targetRef.current;

  const horizonKm = objectById("observable-universe")?.distanceKm ?? 0;
  const horizonReading = format(horizonKm);
  const cameraIsBeyondHorizon = radiusKm(logR) > horizonKm;

  return (
    <div className="explorer">
      {/* The console is the model, the number that says what scale it is, and
          the controls that drive it. It exists as an element so the phone's
          sticky control bar has a containing block that ENDS here: the bar
          stays with the model while the model is on screen, and releases
          rather than riding over the reading sections below. */}
      <div className="explorer__console">
      <div className="explorer__plate">
      <div
        className="explorer__stage"
        ref={stageRef}
        tabIndex={0}
        role="group"
        aria-label="Scale model of the universe, centred on the Sun. Use the arrow keys, or plus and minus, to zoom. Home returns to the Sun; End goes to the widest scale."
        onKeyDown={onStageKey}
      >
        <canvas className="explorer__canvas" ref={canvasRef} aria-hidden="true" />

        <ul className="explorer__labels">
          {view.labelled.map((item) => (
            <li
              key={item.object.id}
              className={`label label--${item.object.category} label--${item.labelSide}`}
              style={{
                transform: `translate(${item.labelX}px, ${item.labelY}px)${
                  item.labelSide === "left" ? " translateX(-100%)" : ""
                }`,
              }}
            >
              <button
                type="button"
                className="label__button"
                aria-pressed={item.object.id === selectedId}
                onClick={(event) => select(item.object.id, event.currentTarget)}
              >
                <span className="label__text">
                  <span className="label__name">{item.object.name}</span>
                  <span
                    className="label__type"
                    data-testid={
                      item.object.id === "sun" && view.sunIsMarker ? "you-are-here" : undefined
                    }
                  >
                    {item.object.id === "sun" && view.sunIsMarker
                      ? "You are here"
                      : (CATEGORY_LABEL[item.object.category] ?? item.object.category)}
                  </span>
                </span>
              </button>
            </li>
          ))}
          {/*
            One label for the inner planets once the frame has compressed them.
            It is a span, not a button: there is nothing left to point at — the
            four of them share a few pixels at this scale — and a control that
            opens one arbitrary member's panel would be worse than none. Each
            planet keeps its own entry in the text journey below, and zooming
            in restores the individual buttons.
          */}
          {view.group && (
            <li
              className={`label label--group label--${view.group.labelSide}`}
              data-testid="group-label"
              style={{
                transform: `translate(${view.group.labelX}px, ${view.group.labelY}px)${
                  view.group.labelSide === "left" ? " translateX(-100%)" : ""
                }`,
              }}
            >
              <span className="label__button label__button--static">
                <span className="label__text">
                  <span className="label__name">{view.group.name}</span>
                  <span className="label__type">{view.group.members.join(" · ")}</span>
                </span>
              </span>
            </li>
          )}
        </ul>

        {/*
          The end of the journey belongs where the journey happened. Reaching
          the widest scale used to leave the reader looking at a marker with no
          statement of what it meant — the point of the whole page sat below
          the text journey and the sources, which is past where most readers
          stop. Shown only once the camera has actually settled at the far end,
          so it is a conclusion rather than a caption.
        */}
        {atWidest && (
          <div className="stage__coda" data-testid="coda">
            {CLOSING_LINES.map((line) => (
              <p className="stage__coda-line" key={line}>
                {line}
              </p>
            ))}
            <button
              type="button"
              className="stage__coda-return"
              data-testid="return-to-sun"
              onClick={() => zoomTo(MIN_LOG_R)}
            >
              Return to the Sun
            </button>
          </div>
        )}

        {!hasZoomed && (
          <p className="explorer__hint">
            <span>At this scale, the Sun is everything.</span>
            <strong>Zoom out.</strong>
            <span className="explorer__hint-how">Scroll, pinch, or use the controls below.</span>
          </p>
        )}
      </div>

      <div className="readout">
        <p className="readout__level">{level.name}</p>
        <p className="readout__value" data-testid="scale-readout" data-log-r={logR.toFixed(4)}>
          <span className="readout__label">Visible radius</span>
          <span className="readout__primary" data-testid="scale-primary" data-unit={reading.unit}>
            {reading.primary}
          </span>
          {reading.secondary && (
            <span className="readout__secondary">· {reading.secondary}</span>
          )}
        </p>
        <p className="readout__insight">{level.insight}</p>

        {cameraIsBeyondHorizon && (
          <p className="readout__caveat" data-testid="horizon-caveat">
            <strong>{reading.primary}</strong> is the camera radius — how far
            this frame reaches. The observable horizon, drawn as the dashed
            circle, is <strong>{horizonReading.primary}</strong>. The view is
            pulled back past it so the whole circle fits on screen.
          </p>
        )}

        <div className="scalebar" aria-hidden="true">
          <span className="scalebar__bar" style={{ width: `${barPx}px` }} />
          <span className="scalebar__text">
            {barReading.primary}
            {barReading.secondary ? ` · ${barReading.secondary}` : ""}
          </span>
        </div>
      </div>
      </div>

      {showUnitNotice && (
        <p className="notice" data-testid="unit-notice">
          There is no single wall where the Solar System ends — its edge depends
          entirely on which definition you use. From here, light-years are the
          more useful ruler: one light-year is 9.46 trillion km.
        </p>
      )}

      <div className="controls">
        <button
          type="button"
          className="controls__button"
          data-testid="zoom-in"
          onClick={() => zoomBy(-STEP)}
          disabled={logR <= MIN_LOG_R}
        >
          <span aria-hidden="true">+</span>
          <span className="visually-hidden">Zoom in</span>
        </button>
        <button
          type="button"
          className="controls__button"
          data-testid="zoom-out"
          onClick={() => zoomBy(STEP)}
          disabled={logR >= MAX_LOG_R}
        >
          <span aria-hidden="true">−</span>
          <span className="visually-hidden">Zoom out</span>
        </button>

        <input
          type="range"
          className="controls__slider"
          data-testid="zoom-slider"
          aria-label="Scale, from the Sun's surface to the edge of the observable universe"
          min="0"
          max="100"
          step="0.1"
          value={percentOf(logR)}
          onChange={(event) => zoomTo(logRAtPercent(Number(event.currentTarget.value)))}
        />

        <button
          type="button"
          className="controls__restart"
          data-testid="restart"
          onClick={() => zoomTo(MIN_LOG_R)}
        >
          Restart at the Sun
        </button>
      </div>
      </div>

      <p className="visually-hidden" aria-live="polite" data-testid="announcer">
        {announcement}
      </p>

      {selected && (
        <div
          className="panel"
          role="dialog"
          aria-modal="false"
          aria-labelledby="panel-title"
          data-testid="detail-panel"
        >
          <div className="panel__head">
            <div>
              <h2 className="panel__title" id="panel-title">
                {selected.name}
              </h2>
              <p className="panel__type">
                {CATEGORY_LABEL[selected.category] ?? selected.category}
              </p>
            </div>
            <button
              type="button"
              className="panel__close"
              data-testid="panel-close"
              ref={closeRef}
              onClick={closePanel}
            >
              <span aria-hidden="true">×</span>
              <span className="visually-hidden">Close details for {selected.name}</span>
            </button>
          </div>

          {selected.photo && (
            <figure className="panel__figure">
              <img
                className="panel__photo"
                src={`./images/objects/${selected.photo.file}`}
                alt={selected.photo.alt}
                width="480"
                height="480"
                loading="lazy"
              />
              <figcaption className="panel__credit">
                {selected.photo.credit} ·{" "}
                <a href={selected.photo.url}>source</a>{" "}
                <span className="panel__accessed">(read {selected.photo.accessed})</span>
              </figcaption>
            </figure>
          )}

          <dl className="panel__facts">
            <dt>Distance from the Sun</dt>
            <dd>
              {selected.distanceKm === 0
                ? "The centre of this map"
                : [format(selected.distanceKm).primary, format(selected.distanceKm).secondary]
                    .filter(Boolean)
                    .join(" · ")}
            </dd>
            {selected.radiusKm !== undefined && (
              <>
                <dt>Radius</dt>
                <dd>{format(selected.radiusKm).primary}</dd>
              </>
            )}
            {selected.elements && (
              <>
                <dt>Orbit</dt>
                <dd>
                  Eccentricity {selected.elements.e.toFixed(3)} — closest{" "}
                  {format(perihelion(selected.elements) * AU_KM).primary}, furthest{" "}
                  {format(aphelion(selected.elements) * AU_KM).primary}.{" "}
                  {Math.abs(selected.elements.I) < 0.01
                    ? "This is the plane the others are measured against."
                    : `Inclined ${Math.abs(selected.elements.I).toFixed(1)}° to Earth's orbital plane.`}
                </dd>
              </>
            )}
          </dl>

          <p className="panel__description">{selected.shortDescription}</p>

          {selected.uncertaintyNote && (
            <p className="panel__uncertainty">
              <strong>How firm is this?</strong> {selected.uncertaintyNote}
            </p>
          )}

          {selected.positionIsDiagrammatic && (
            <p className="panel__uncertainty">
              <strong>Direction is illustrative.</strong> Its distance from the
              Sun is real; the bearing it is drawn at was chosen to keep labels
              apart.
            </p>
          )}

          <p className="panel__source">
            Source: <a href={selected.source.url}>{selected.source.name}</a>{" "}
            <span className="panel__accessed">(read {selected.source.accessed})</span>
          </p>
          {selected.radiusSource && selected.radiusSource.url !== selected.source.url && (
            <p className="panel__source">
              Radius: <a href={selected.radiusSource.url}>{selected.radiusSource.name}</a>{" "}
              <span className="panel__accessed">(read {selected.radiusSource.accessed})</span>
            </p>
          )}
        </div>
      )}

      <details className="method">
        <summary>Method &amp; scale</summary>
        <p>
          <strong>Zooming is logarithmic; the picture is not.</strong> Each step
          outward covers vastly more space than the last, but within any single
          view, distances from the Sun are drawn strictly to scale. What is on
          screen at any instant is a true-to-scale distance map.
        </p>
        <p>
          <strong>Bodies are drawn as symbols, not at their true size.</strong>{" "}
          No planet ever comes close to being drawable to scale here — Earth's
          true radius never exceeds a fiftieth of a pixel at any scale this page
          reaches. A symbol is sized from the body's real radius on a
          logarithmic rank, multiplied by one factor shared by everything in the
          planetary system. Because the factor is shared, it cancels out of any
          comparison you make: <em>a larger world is never drawn smaller than a
          smaller one</em>, at any scale, and the Sun — the largest body here —
          is always drawn largest. What the shared factor does is set how
          prominent the whole system is right now, so the planets arrive at full
          size, then shrink together and converge on the centre as you pull
          back. It depends only on how far out you have zoomed, which is why
          nothing at the centre changes size when a planet crosses the rim.
          The ranking is compressed, though, so read it as an order and not as
          a ratio: Jupiter is 11 times Earth&rsquo;s radius and is drawn about
          1.5 times its symbol.
        </p>
        <p>
          <strong>The orbits are real.</strong> Every planet's path is computed
          from JPL's J2000 Keplerian elements, so each is a true ellipse with the
          Sun at one focus — Mercury's is visibly off-centre — on its own
          inclined plane. Each planet sits where it actually was on 1 January
          2000. Nothing here advances with time: it is one epoch, computed once,
          not an ephemeris, and it does not track today's sky.
        </p>
        <p>
          <strong>The planets' plane is drawn at an angle</strong>, which is what
          makes their real inclinations visible instead of flattening every orbit
          into one disc. The Kuiper Belt is tilted with them because it is a
          disc too. The heliopause, the Oort Cloud and the observable-universe
          horizon stay circular, because they are shells, and a sphere's outline
          is a circle from every angle.
        </p>
        <p>
          <strong>Beyond the Solar System this is a distance model, not a sky
          map.</strong> Radial order and distance from the Sun are accurate; the
          direction each object is drawn in was chosen to keep labels legible,
          and every object whose bearing is invented says so in its details.
          Faint background stars are illustrative texture and are never
          labelled; every named object is sourced.
        </p>
      </details>

      {/*
        Collapsed, not removed. Twenty-eight entries with a source link each is
        the longest thing on the page, and leaving it open pushed the closing
        section so far down that the point of the page was effectively unread.
        <details> keeps every word in the DOM whether or not it is open, so the
        textual fallback is still shipped in the built HTML and still reachable
        by assistive technology — it just no longer sits between the reader and
        the end. `journeyOpen` handles the nav link, which must open it.
      */}
      <details
        className="journey"
        id="journey-text"
        open={journeyOpen}
        onToggle={(event) => setJourneyOpen(event.currentTarget.open)}
        aria-label="The scale journey in text"
      >
        <summary className="journey__summary">Read the journey as text</summary>
        <p>
          A summary for reading rather than zooming. Every object here appears
          on the map at the scale named beside it. All twenty-eight are listed
          in order of distance, each with the source its figures came from.
        </p>
        <ol>
          {OBJECTS.map((object) => (
            <li key={object.id}>
              <strong>{object.name}</strong> —{" "}
              {object.distanceKm === 0
                ? "the centre of the map"
                : [format(object.distanceKm).primary, format(object.distanceKm).secondary]
                    .filter(Boolean)
                    .join(" · ")}
              . {object.shortDescription}{" "}
              <a href={object.source.url}>{object.source.name}</a>
            </li>
          ))}
        </ol>
      </details>
    </div>
  );
}
