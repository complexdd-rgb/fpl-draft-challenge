/* FPL Challenge Studio — legacy compatibility entrypoint.
   Historical name retained temporarily; active responsibilities now live in
   prompt-studio-loader.js and career-shape-validation-bridge.js. */
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

  load("js/prompt-studio-loader.js?v=1.2.0-targetexplore", "data-prompt-studio-loader", () => {
    load("js/career-shape-validation-bridge.js", "data-career-shape-validation-bridge");
  });
})();
