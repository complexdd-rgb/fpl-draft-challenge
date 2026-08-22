/* FPL Draft Challenge — legacy live-UI entrypoint.
   Kept temporarily so older loaders can keep requesting ui-cleanup.js while the
   responsibilities live in explicitly named modules. */
(() => {
  "use strict";

  const load = (src, marker, done) => {
    const existing = document.querySelector(`script[${marker}]`);
    if (existing) {
      if (done) {
        if (existing.dataset.loaded === "true") done();
        else existing.addEventListener("load", done, { once: true });
      }
      return;
    }

    const script = document.createElement("script");
    script.src = new URL(src, document.baseURI).toString();
    script.async = false;
    script.setAttribute(marker, "1");
    script.addEventListener("load", () => {
      script.dataset.loaded = "true";
      done?.();
    }, { once: true });
    document.head.appendChild(script);
  };

  load("js/live-ui-bootstrap.js", "data-live-ui-bootstrap", () => {
    load("js/retired-panel-compat.js", "data-retired-panel-compat");
  });
})();
