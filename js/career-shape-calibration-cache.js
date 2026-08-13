/* FPL Career Shape calibration cache guard · v1.0.0 */
(() => {
  "use strict";
  const descriptor = Object.getOwnPropertyDescriptor(window, "FPL_PROMPT_LIBRARY");
  if (!descriptor || descriptor.configurable === false) return;
  const previousGet = descriptor.get;
  const previousSet = descriptor.set;
  let cached;
  try { cached = previousGet ? previousGet.call(window) : descriptor.value; }
  catch (_) { cached = descriptor.value; }

  try {
    Object.defineProperty(window, "FPL_PROMPT_LIBRARY", {
      configurable: true,
      enumerable: descriptor.enumerable !== false,
      get() { return cached; },
      set(value) {
        if (previousSet) {
          previousSet.call(window, value);
          try { cached = previousGet ? previousGet.call(window) : value; }
          catch (_) { cached = value; }
        } else {
          cached = window.FPL_CAREER_SHAPE_CALIBRATION?.calibrateLibrary?.(value) || value;
        }
      }
    });
  } catch (_) {}
})();