import { MILESTONES } from "../data/milestones";
import { distanceAtPosition, formatDistance, layerForDistance } from "../lib/scale";

const distanceEl = document.querySelector<HTMLElement>('[data-testid="distance"]');
const layerEl = document.querySelector<HTMLElement>(".hud__layer");
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
}

function measureAnchors(): number[] {
  return sections.map((el) => el.getBoundingClientRect().top + window.scrollY);
}

function render(anchorsPx: number[]) {
  const distance = distanceAtPosition(MILESTONES, anchorsPx, window.scrollY);
  distanceEl!.textContent = formatDistance(distance);
  distanceEl!.setAttribute("data-distance-m", String(Math.round(distance)));
  if (layerEl) layerEl.textContent = layerForDistance(distance);
}
