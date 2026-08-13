const photos = [...document.querySelectorAll<HTMLElement>(".milestone__photo")];
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Under reduced motion, no listener is attached at all — photos stay at
// their CSS default (fully opaque), rather than relying on the sitewide
// zeroed-transition-duration rule to mask a scroll-driven opacity change.
if (photos.length > 0 && !reduceMotion) {
  const sections = photos.map((photo) => photo.parentElement as HTMLElement);
  const MIN_OPACITY = 0.15;

  const update = () => {
    const viewportCenter = window.innerHeight / 2;
    sections.forEach((section, i) => {
      const rect = section.getBoundingClientRect();
      const sectionCenter = rect.top + rect.height / 2;
      const distance = Math.abs(sectionCenter - viewportCenter);
      const t = Math.max(0, 1 - distance / (rect.height * 0.8 || 1));
      photos[i].style.opacity = String(MIN_OPACITY + (1 - MIN_OPACITY) * t);
    });
  };

  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      update();
      ticking = false;
    });
  };

  update();
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", update, { passive: true });
}
