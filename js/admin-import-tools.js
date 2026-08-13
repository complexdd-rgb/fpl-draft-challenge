/* FPL Challenge Studio · admin import-tools loader v16.0.6 */
(() => {
  "use strict";
  const load = (src, done) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = false;
    if (done) script.addEventListener("load", done, { once: true });
    document.head.appendChild(script);
  };
  load("js/admin-import-tools-base.js?v=16.0.1-unified1", () => {
    load("js/career-shape-rules.js?v=1.1.2-repair", () => {
      load("js/career-shape-workspace-repair.js?v=1.0.0", () => {
        load("js/career-shape-unified-generator.js?v=1.0.0", () => {
          load("js/career-shape-future-quality-guard.js?v=1.0.0", () => {
            load("js/career-shape-unified-fixes.js?v=1.0.1");
          });
        });
      });
    });
  });
})();
