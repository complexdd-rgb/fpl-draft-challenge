/* FPL Career Shape rule loader · v1.2.1 */
(() => {
  "use strict";
  if (document.readyState === "loading") {
    document.write('<script src="js/career-shape-rules-base.js?v=1.1.0"><\/script>');
    document.write('<script src="js/career-shape-quality-calibration.js?v=1.0.0"><\/script>');
    document.write('<script src="js/career-shape-calibration-cache.js?v=1.0.0"><\/script>');
    return;
  }
  const load = (src, done) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = false;
    if (done) script.addEventListener("load", done, { once: true });
    document.head.appendChild(script);
  };
  load("js/career-shape-rules-base.js?v=1.1.0", () => {
    load("js/career-shape-quality-calibration.js?v=1.0.0", () => {
      load("js/career-shape-calibration-cache.js?v=1.0.0");
    });
  });
})();