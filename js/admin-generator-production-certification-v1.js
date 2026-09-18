/* FPL Challenge Studio — Generator v3.2 production certification runner v1.0.0.
   Read-only shadow sweep: runs the real seven-day generator once for every supported formation,
   captures certification evidence, clears each shadow batch, and never publishes to Supabase. */
(() => {
  "use strict";

  if (window.__FPL_DAILY_PRODUCTION_CERTIFICATION_V1__) return;
  window.__FPL_DAILY_PRODUCTION_CERTIFICATION_V1__ = true;

  const VERSION = "1.0.0";
  const FORMATION_ORDER = Object.freeze(["4-4-2", "4-3-3", "3-4-3", "3-5-2", "5-3-2", "5-4-1", "4-2-3-1"]);
  const DAYS = 7;
  const PROMPTS_PER_DAY = 11;
  const WEEKLY_PROMPTS = DAYS * PROMPTS_PER_DAY;
  let running = false;
  let lastReport = null;

  const byId = id => document.getElementById(id);

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function installStyles() {
    if (byId("generatorProductionCertificationCss")) return;
    const style = document.createElement("style");
    style.id = "generatorProductionCertificationCss";
    style.textContent = `
      .generator-production-cert{margin-top:14px;padding:13px;border:1px solid rgba(98,201,255,.18);border-radius:15px;background:rgba(98,201,255,.035)}
      .generator-production-cert-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
      .generator-production-cert-head strong,.generator-production-cert-head span{display:block}
      .generator-production-cert-head strong{color:#f4fff8;font-size:.78rem}
      .generator-production-cert-head span{margin-top:4px;color:#8da99a;font-size:.66rem;line-height:1.45}
      .generator-production-cert-state{flex:0 0 auto!important;margin:0!important;padding:5px 8px;border:1px solid rgba(98,201,255,.2);border-radius:999px;background:rgba(98,201,255,.07);color:#62c9ff!important;font-size:.61rem!important;font-weight:950;letter-spacing:.05em;text-transform:uppercase}
      .generator-production-cert .button-row{margin-top:10px}
      .generator-production-cert-status{margin:9px 1px 0;color:#9bb7a8;font-size:.66rem;line-height:1.5}
      .generator-production-cert-status[data-state="pass"]{color:#62eaa3}
      .generator-production-cert-status[data-state="fail"]{color:#ffc0ce}
    `;
    document.head.appendChild(style);
  }

  function installPanel() {
    if (byId("generatorProductionCertification")) return;
    const planner = byId("batchPlanner");
    if (!planner) return;
    installStyles();
    const panel = document.createElement("section");
    panel.id = "generatorProductionCertification";
    panel.className = "generator-production-cert";
    panel.setAttribute("aria-label", "Generator production certification");
    panel.innerHTML = `
      <div class="generator-production-cert-head">
        <div>
          <strong>Generator v3.2 production certification</strong>
          <span>Read-only shadow sweep across all seven supported formations. It uses the real saved-library generator and validator, clears each test batch, and never publishes.</span>
        </div>
        <span id="generatorProductionCertificationState" class="generator-production-cert-state">Not run</span>
      </div>
      <div class="button-row compact-row">
        <button id="runGeneratorProductionCertificationBtn" class="button secondary" type="button">Run 7-formation certification</button>
        <button id="downloadGeneratorProductionCertificationBtn" class="button secondary" type="button" disabled>Download certification JSON</button>
      </div>
      <p id="generatorProductionCertificationStatus" class="generator-production-cert-status" data-state="neutral" role="status">This does not publish or alter the Supabase schedule.</p>
    `;
    const review = byId("batchReview");
    if (review?.parentElement === planner) review.insertAdjacentElement("afterend", panel);
    else planner.appendChild(panel);

    byId("runGeneratorProductionCertificationBtn")?.addEventListener("click", run);
    byId("downloadGeneratorProductionCertificationBtn")?.addEventListener("click", download);
    document.addEventListener("click", event => {
      if (!running) return;
      const target = event.target instanceof Element ? event.target.closest("#publishWeekSupabaseBtn") : null;
      if (!target) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      setUi("Publishing is locked while the read-only production certification sweep is running.", "neutral", "Running");
    }, true);
  }

  function setUi(message, state = "neutral", badge = null) {
    const status = byId("generatorProductionCertificationStatus");
    if (status) {
      status.textContent = message;
      status.dataset.state = state;
    }
    const chip = byId("generatorProductionCertificationState");
    if (chip && badge != null) chip.textContent = badge;
  }

  function expectedFormationCounts(batch, key) {
    const formation = batch?.formations?.[key];
    return clone(formation?.counts || null);
  }

  function sameCounts(actual, expected) {
    if (!actual || !expected) return false;
    return ["GK", "DEF", "MID", "FWD"].every(position => Number(actual[position] || 0) === Number(expected[position] || 0));
  }

  function auditFormation(formation, guard, batch) {
    const results = batch.getResults?.() || [];
    const plan = guard.getLastFamilyPlan?.() || null;
    const timing = guard.getLastTiming?.() || null;
    const leaderAudit = batch.getTopAnswerDayAudit?.() || null;
    const expected = expectedFormationCounts(batch, formation);
    const issues = [];
    const ids = results.flatMap(result => Array.isArray(result.promptIds) ? result.promptIds.map(String) : []);
    const uniqueIds = new Set(ids);
    const familyCounts = plan?.targets && typeof plan.targets === "object" ? plan.targets : {};
    const representedFamilies = Object.values(familyCounts).filter(value => Number(value) > 0).length;
    const minAntiMeta = Math.max(0, Number(byId("minAntiMeta")?.value) || 0);

    if (results.length !== DAYS) issues.push(`Expected ${DAYS} days; got ${results.length}.`);
    if (ids.length !== WEEKLY_PROMPTS || uniqueIds.size !== WEEKLY_PROMPTS) issues.push(`Expected ${WEEKLY_PROMPTS} unique prompt IDs; got ${uniqueIds.size}/${ids.length}.`);
    for (const result of results) {
      const day = result.releaseDate || result.date || "unknown date";
      if (result.status !== "PASS") issues.push(`${day} status is ${result.status || "missing"}.`);
      if (String(result.formation || "") !== formation) issues.push(`${day} formation is ${result.formation || "missing"}, expected ${formation}.`);
      if (!sameCounts(result.formationCounts, expected)) issues.push(`${day} formation counts do not match ${formation}.`);
      if (Number(result.promptMix?.nationality || 0) !== 1) issues.push(`${day} does not contain exactly one nationality prompt.`);
      if (Number(result.antiMetaCount || 0) < minAntiMeta) issues.push(`${day} anti-meta count is below ${minAntiMeta}.`);
      if ((result.issues || []).length) issues.push(`${day}: ${result.issues[0]}`);
    }
    if (representedFamilies !== 18) issues.push(`Expected all 18 prompt families; got ${representedFamilies}.`);
    if (Number(plan?.nationalityCount || 0) < DAYS) issues.push("Weekly nationality floor was not met.");
    if (Number(plan?.excludeTopResultTarget || 0) < 4) issues.push("Exclude Top Result weekly floor was not met.");
    if (Number(plan?.leaderPromptCap || 0) > 3) issues.push("Reservoir leader prompt cap exceeded 3.");
    if (!leaderAudit) issues.push("Top-answer day audit is unavailable.");
    else {
      if (Number(leaderAudit.sameDayRepeatPrompts || 0) !== 0) issues.push("Same-day top-answer repeats were detected.");
      if (Number(leaderAudit.spacingViolationCount || 0) !== 0) issues.push("Leader spacing violations were detected.");
      if (Number(leaderAudit.hardCapBreachCount || 0) !== 0) issues.push("Leader hard-cap breaches were detected.");
      if (Number(leaderAudit.maxAppearanceDays || 0) > 3) issues.push("A top-answer leader appeared on more than three days.");
    }

    return {
      formation,
      pass: issues.length === 0,
      issues,
      dateRange: results.length ? {
        first: String(results[0]?.releaseDate || results[0]?.date || ""),
        last: String(results[results.length - 1]?.releaseDate || results[results.length - 1]?.date || "")
      } : null,
      days: results.length,
      promptIds: ids.length,
      uniquePromptIds: uniqueIds.size,
      representedFamilies,
      familyCounts: clone(familyCounts),
      nationalityCount: Number(plan?.nationalityCount || 0),
      excludeTopResultCount: Number(plan?.excludeTopResultTarget || 0),
      antiMetaCount: Number(plan?.antiMetaCount || 0),
      leaderPromptCap: Number(plan?.leaderPromptCap || 0),
      reservoirAttempt: Number(plan?.reservoirRetry || timing?.reservoirAttempts || 0),
      topAnswerDiversity: clone(plan?.topAnswerDiversity || null),
      leaderDayAudit: clone(leaderAudit),
      timing: clone(timing),
      challenges: clone(results)
    };
  }

  async function waitForReady(timeoutMs = 30000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const guard = window.FPL_DAILY_GENERATOR_GUARD;
      const batch = window.FPL_STUDIO_BATCH_CALENDAR;
      if (guard?.qualityReady?.() && guard?.scheduleReady?.() && typeof guard.generate === "function" && typeof batch?.getResults === "function") {
        return { guard, batch };
      }
      await new Promise(resolve => setTimeout(resolve, 120));
    }
    throw new Error("Generator certification could not start because the curated authority or live schedule did not become ready.");
  }

  async function run() {
    if (running) return;
    running = true;
    lastReport = null;
    const runButton = byId("runGeneratorProductionCertificationBtn");
    const downloadButton = byId("downloadGeneratorProductionCertificationBtn");
    const publishButton = byId("publishWeekSupabaseBtn");
    const formationInput = byId("batchFormation");
    const themeInput = byId("batchThemePreset");
    const original = {
      formation: formationInput?.value || "4-4-2",
      theme: themeInput?.value || "generated-mix"
    };
    if (runButton) runButton.disabled = true;
    if (downloadButton) downloadButton.disabled = true;
    if (publishButton) publishButton.disabled = true;
    setUi("Waiting for the curated authority and live schedule…", "neutral", "Starting");

    const runs = [];
    const started = performance?.now ? performance.now() : Date.now();

    try {
      const { guard, batch } = await waitForReady();
      if (themeInput) themeInput.value = "custom";

      for (let index = 0; index < FORMATION_ORDER.length; index += 1) {
        const formation = FORMATION_ORDER[index];
        if (!batch.formations?.[formation]) {
          runs.push({ formation, pass: false, issues: ["Formation is not exposed by the production batch generator."] });
          continue;
        }
        setUi(`Running ${formation} · ${index + 1}/${FORMATION_ORDER.length}…`, "neutral", `${index + 1}/${FORMATION_ORDER.length}`);
        batch.clear?.(false);
        if (formationInput) {
          formationInput.value = formation;
          formationInput.dispatchEvent(new Event("change", { bubbles: true }));
        }
        await new Promise(resolve => setTimeout(resolve, 0));
        await guard.generate();
        const audited = auditFormation(formation, guard, batch);
        runs.push(audited);
        if (!audited.pass) {
          setUi(`${formation} failed certification: ${audited.issues[0] || "unknown failure"} Continuing the remaining formations…`, "fail", `${index + 1}/${FORMATION_ORDER.length}`);
        }
        batch.clear?.(false);
        await new Promise(resolve => setTimeout(resolve, 0));
      }

      const finished = performance?.now ? performance.now() : Date.now();
      const cutover = window.FPL_DAILY_LIBRARY_CUTOVER_V1?.getState?.() || {};
      const passed = runs.filter(run => run.pass).length;
      lastReport = Object.freeze({
        schemaVersion: 1,
        kind: "fpl-generator-v3-production-certification",
        certificationVersion: VERSION,
        generatedAt: new Date().toISOString(),
        generatorVersion: String(window.FPL_DAILY_GENERATOR_GUARD?.version || ""),
        semanticDiversityVersion: String(window.FPL_DAILY_SEMANTIC_DIVERSITY?.version || ""),
        curatedAuthority: {
          total: Number(cutover.total || 0),
          families: Number(cutover.families || 0),
          promotionFingerprint: String(cutover.manifest?.promotionFingerprint || "")
        },
        schedule: {
          today: String(window.FPL_STUDIO_SCHEDULE?.today || ""),
          next: String(window.FPL_DAILY_GENERATOR_GUARD?.getExpectedNext?.().date || "")
        },
        formationCount: FORMATION_ORDER.length,
        passed,
        failed: FORMATION_ORDER.length - passed,
        allPassed: passed === FORMATION_ORDER.length,
        elapsedMs: Math.round(finished - started),
        runs
      });
      if (downloadButton) downloadButton.disabled = false;
      if (lastReport.allPassed) setUi(`Production certification passed: ${passed}/${FORMATION_ORDER.length} formations · no publishing occurred. Download the JSON report for the freeze record.`, "pass", "PASS");
      else setUi(`Production certification finished with ${lastReport.failed} failed formation(s). Download the JSON report before changing anything.`, "fail", "FAIL");
      window.dispatchEvent(new CustomEvent("fpl:generator-production-certification-complete", { detail: clone(lastReport) }));
    } catch (error) {
      console.error(error);
      setUi(error instanceof Error ? error.message : String(error), "fail", "Stopped");
    } finally {
      try { window.FPL_STUDIO_BATCH_CALENDAR?.clear?.(false); } catch {}
      if (formationInput) formationInput.value = original.formation;
      if (themeInput) themeInput.value = original.theme;
      window.FPL_DAILY_GENERATOR_GUARD?.sync?.();
      running = false;
      if (runButton) runButton.disabled = false;
      if (publishButton) publishButton.disabled = true;
    }
  }

  function download() {
    if (!lastReport) return;
    const today = new Date().toISOString().slice(0, 10);
    const blob = new Blob([JSON.stringify(lastReport, null, 2) + "\n"], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `fpl-generator-v3-production-certification-${today}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  window.FPL_DAILY_PRODUCTION_CERTIFICATION = Object.freeze({
    version: VERSION,
    formations: [...FORMATION_ORDER],
    run,
    download,
    getLastReport: () => clone(lastReport),
    isRunning: () => running
  });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", installPanel, { once: true });
  else installPanel();
})();
