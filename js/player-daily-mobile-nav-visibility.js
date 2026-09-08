/* Daily UI mobile navigation visibility helper.
   Presentation only: hides the fixed bottom nav while the draft board itself is on screen. */
(() => {
  "use strict";

  const grid = document.getElementById("grid");
  const nav = document.getElementById("phase45BottomNav");
  if (!grid || !nav || !("IntersectionObserver" in window)) return;

  const mobile = window.matchMedia("(max-width: 720px)");
  let gridVisible = false;

  function sync() {
    document.body.classList.toggle("daily-grid-in-view", mobile.matches && gridVisible);
  }

  const observer = new IntersectionObserver(entries => {
    const entry = entries[0];
    gridVisible = Boolean(entry?.isIntersecting && entry.intersectionRect.height > 0);
    sync();
  }, { threshold: 0, rootMargin: "0px 0px -12% 0px" });

  observer.observe(grid);
  if (mobile.addEventListener) mobile.addEventListener("change", sync);
  else if (mobile.addListener) mobile.addListener(sync);
  sync();
})();
