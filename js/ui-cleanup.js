/* FPL Draft Challenge — live UI compatibility entrypoint.
   Older loaders may still request ui-cleanup.js; active presentation startup now lives in live-ui-bootstrap.js. */
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

  load("js/live-ui-bootstrap.js", "data-live-ui-bootstrap");
})();
