const photos = [...document.querySelectorAll<HTMLElement>(".milestone__photo")];

if (photos.length > 0 && "IntersectionObserver" in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    },
    { threshold: 0.3 },
  );

  for (const photo of photos) observer.observe(photo);
}
