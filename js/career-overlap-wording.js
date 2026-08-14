/* FPL Challenge Studio — career-overlap wording clarity v1.0.2
   Presentation/migration helper only. The rule remains: both players recorded Premier
   League minutes in at least one matching season; they do not need to share a club. */
(() => {
  "use strict";

  const MANAGER_KEY = "fplChallengeStudioPromptManagerV1";
  const ROOT_SELECTOR = '[data-workspace="prompts"]';

  function rewriteLabel(value) {
    let text = String(value || "");
    text = text.replace(
      /\bwhose recorded Premier League career overlapped with (.+?)(?=\s+and who scored|\s+and scored|\s+—|$)/i,
      "who played in the Premier League in at least one of the same seasons as $1"
    );
    text = text.replace(
      /\bwhose career overlapped with (.+?)(?=\s+and who scored|\s+and scored|\s+—|$)/i,
      "who played in the Premier League in at least one of the same seasons as $1"
    );
    text = text.replace(/\s+and who scored\s+/i, " and scored ");
    return text;
  }

  function rewriteFail(value) {
    let text = String(value || "");
    text = text.replace(
      /must overlap with (.+?) and score at least/i,
      "must have recorded Premier League minutes in at least one of the same seasons as $1 and score at least"
    );
    return text;
  }

  function rewritePrompt(prompt) {
    if (!prompt || typeof prompt !== "object") return false;
    const oldLabel = String(prompt.label || "");
    if (!/career overlapped with/i.test(oldLabel)) return false;
    const nextLabel = rewriteLabel(oldLabel);
    const oldFail = String(prompt.fail || prompt.failMessage || "");
    const nextFail = rewriteFail(oldFail);
    let changed = false;
    try {
      if (nextLabel !== oldLabel) { prompt.label = nextLabel; changed = true; }
      if (nextFail !== oldFail) {
        if ("fail" in prompt) prompt.fail = nextFail;
        if ("failMessage" in prompt) prompt.failMessage = nextFail;
        changed = true;
      }
    } catch (_) {}
    return changed;
  }

  function migrateBrowserManager() {
    try {
      const raw = localStorage.getItem(MANAGER_KEY);
      if (!raw) return 0;
      const state = JSON.parse(raw);
      if (!state || typeof state !== "object") return 0;
      let changed = 0;
      if (Array.isArray(state.customs)) {
        for (const prompt of state.customs) if (rewritePrompt(prompt)) changed += 1;
      }
      if (state.overrides && typeof state.overrides === "object") {
        for (const override of Object.values(state.overrides)) {
          if (!override || typeof override !== "object") continue;
          if (typeof override.label === "string") {
            const next = rewriteLabel(override.label);
            if (next !== override.label) { override.label = next; changed += 1; }
          }
          for (const key of ["fail", "failMessage"]) {
            if (typeof override[key] !== "string") continue;
            const next = rewriteFail(override[key]);
            if (next !== override[key]) { override[key] = next; changed += 1; }
          }
        }
      }
      if (changed) localStorage.setItem(MANAGER_KEY, JSON.stringify(state));
      return changed;
    } catch (_) {
      return 0;
    }
  }

  function rewriteTextNode(node) {
    if (!node || node.nodeType !== Node.TEXT_NODE) return;
    const oldText = node.nodeValue || "";
    if (!/career overlapped with/i.test(oldText)) return;
    const nextText = rewriteFail(rewriteLabel(oldText));
    if (nextText !== oldText) node.nodeValue = nextText;
  }

  function rewriteDom(root) {
    if (!root) return;
    if (root.nodeType === Node.TEXT_NODE) {
      rewriteTextNode(root);
      return;
    }
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) rewriteTextNode(node);
  }

  function installDomObserver() {
    const root = document.querySelector(ROOT_SELECTOR);
    if (!root) return;
    rewriteDom(root);
    const observer = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) rewriteDom(node);
        if (mutation.type === "characterData") rewriteTextNode(mutation.target);
      }
    });
    observer.observe(root, { childList: true, subtree: true, characterData: true });

    // Automatic Creator keeps its generated batch in memory until "Add selected" is
    // pressed. Once it persists the selection, migrate those browser customs too.
    root.addEventListener("click", event => {
      const button = event.target.closest?.("button");
      if (!button || !/add selected/i.test(button.textContent || "")) return;
      window.setTimeout(() => {
        migrateBrowserManager();
        rewriteDom(root);
        window.dispatchEvent(new CustomEvent("fpl:relationship-wording-updated"));
      }, 50);
    }, true);
  }

  function loadQualityPromptPackStatus() {
    if (document.querySelector('script[data-quality-prompt-pack-status]')) return;
    const status = document.createElement("script");
    status.src = new URL("js/prompt-quality-pack-status.js?v=1.0.0", document.baseURI).toString();
    status.async = false;
    status.dataset.qualityPromptPackStatus = "1";
    document.head.appendChild(status);
  }

  function loadQualityPromptPack() {
    const existing = document.querySelector('script[data-quality-prompt-pack-v1]');
    if (existing) {
      loadQualityPromptPackStatus();
      return;
    }
    const script = document.createElement("script");
    script.src = new URL("js/prompt-quality-pack-v1.js?v=1.0.1", document.baseURI).toString();
    script.async = false;
    script.dataset.qualityPromptPackV1 = "1";
    script.addEventListener("load", loadQualityPromptPackStatus, { once: true });
    document.head.appendChild(script);
  }

  // Keep a small public helper so the eventual repository-baseline export can migrate
  // the same family deliberately rather than maintaining two wording definitions.
  window.FPL_CAREER_OVERLAP_WORDING = Object.freeze({
    rewriteLabel,
    rewriteFail,
    migrateBrowserManager
  });

  migrateBrowserManager();
  loadQualityPromptPack();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", installDomObserver, { once: true });
  } else {
    installDomObserver();
  }
  window.addEventListener("fpl:prompt-tools-ready", () => {
    migrateBrowserManager();
    installDomObserver();
    loadQualityPromptPackStatus();
  });
})();
