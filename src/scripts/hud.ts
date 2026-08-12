import { MILESTONES } from "../data/milestones";
import {
  distanceAtPosition,
  formatDistance,
  layerForDistance,
  percentForPosition,
  positionForPercent,
} from "../lib/scale";

const distanceEl = document.querySelector<HTMLElement>('[data-testid="distance"]');
const layerEl = document.querySelector<HTMLElement>(".hud__layer");
const scrubberEl = document.querySelector<HTMLInputElement>('[data-testid="scrubber"]');
const sections = [...document.querySelectorAll<HTMLElement>(".milestone")];

if (distanceEl && sections.length === MILESTONES.length) {
  let anchorsPx = measureAnchors();
  window.addEventListener(
    "resize",
    () => {
      anchorsPx = measureAnchors();
    },
    { passive: true },
  );

  let ticking = false;
  window.addEventListener(
    "scroll",
    () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        render(anchorsPx);
        ticking = false;
      });
    },
    { passive: true },
  );

  // Dragging (or arrow-keying) the scrubber jumps the page itself, rather
  // than duplicating the distance calculation: the resulting native scroll
  // event re-enters the same render() path above.
  scrubberEl?.addEventListener("input", () => {
    const target = positionForPercent(anchorsPx, Number(scrubberEl.value));
    window.scrollTo({ top: target });
  });
}

function measureAnchors(): number[] {
  return sections.map((el) => el.getBoundingClientRect().top + window.scrollY);
}

function render(anchorsPx: number[]) {
  const distance = distanceAtPosition(MILESTONES, anchorsPx, window.scrollY);
  distanceEl!.textContent = formatDistance(distance);
  distanceEl!.setAttribute("data-distance-m", String(Math.round(distance)));
  if (layerEl) layerEl.textContent = layerForDistance(distance);
  if (scrubberEl) scrubberEl.value = String(percentForPosition(anchorsPx, window.scrollY));
}
