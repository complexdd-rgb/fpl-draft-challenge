/* FPL Challenge Studio — explicit approved-null starting-price certification policy. */
(() => {
  "use strict";
  const engine = window.ValidationEngine;
  if (!engine?.seasonHealth || !engine?.certifySeason) return;

  const hasNumericValue = value => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));
  const priceStatus = record => String(record?.startingPriceStatus ?? record?.source?.startingPriceStatus ?? "").trim().toUpperCase();
  const isApprovedNullStartingPrice = record => !hasNumericValue(record?.startingPrice) && record?.pricePromptEligible === false && priceStatus(record) === "APPROVED NULL";
  const startingPriceDecisionIsValid = record => hasNumericValue(record?.startingPrice) ? record?.pricePromptEligible !== false : isApprovedNullStartingPrice(record);

  const originalSeasonHealth = engine.seasonHealth.bind(engine);
  const originalCertifySeason = engine.certifySeason.bind(engine);
  const originalInspectPlayer = engine.inspectPlayer?.bind(engine);

  function patchHealth(health) {
    if (!health?.ok || !Array.isArray(health.rows)) return health;
    const rows = health.rows;
    const approvedNullStartingPrice = rows.filter(isApprovedNullStartingPrice).length;
    const invalidStartingPriceDecision = rows.filter(record => !startingPriceDecisionIsValid(record)).length;
    const missingFinalPrice = rows.filter(record => !hasNumericValue(record?.finalPrice)).length;
    const summary = { ...health.summary, approvedNullStartingPrice, invalidStartingPriceDecision, missingFinalPrice };
    const requiredMetadataGaps = Number(summary.missingDob || 0) + Number(summary.missingAge || 0) + invalidStartingPriceDecision + Number(summary.missingLeaguePosition || 0) + Number(summary.missingManagers || 0);
    const possibleRequiredMetadata = rows.length * 5;
    const completeness = possibleRequiredMetadata ? Math.max(0, Math.round(((possibleRequiredMetadata - requiredMetadataGaps) / possibleRequiredMetadata) * 100)) : 0;
    const status = health.blocking > 0 ? "Blocked" : requiredMetadataGaps === 0 ? "Ready" : completeness >= 95 ? "Review" : "Incomplete";
    return { ...health, summary, metadataGaps: requiredMetadataGaps, optionalMetadataGaps: missingFinalPrice, completeness, status };
  }

  function seasonHealth(seasonLabel) {
    return patchHealth(originalSeasonHealth(seasonLabel));
  }

  function certifySeason(seasonLabel) {
    const result = originalCertifySeason(seasonLabel);
    if (!result?.ok) return result;
    const health = seasonHealth(seasonLabel);
    result.health = health;
    const metadataTest = (result.tests || []).find(test => test.id === "metadata");
    if (metadataTest) {
      const approved = Number(health.summary?.approvedNullStartingPrice || 0);
      const optionalFinal = Number(health.summary?.missingFinalPrice || 0);
      const invalid = Number(health.summary?.invalidStartingPriceDecision || 0);
      metadataTest.passed = health.metadataGaps === 0;
      metadataTest.actual = `${health.metadataGaps} missing required values · ${approved} approved-null starting prices · ${optionalFinal} optional final-price values absent`;
      metadataTest.expected = "0 missing required values";
      metadataTest.details = [
        `${approved} starting-price decisions are explicitly APPROVED NULL and excluded from starting-price prompts.`,
        `${invalid} starting-price decisions are missing without a valid approved-null exclusion.`,
        "Rows eligible for starting-price prompts still require a numeric starting price.",
        "Final price is optional historical data and is excluded from certification completeness."
      ];
    }
    const criticalFailures = (result.tests || []).filter(test => test.severity === "critical" && !test.passed);
    result.criticalFailures = criticalFailures.length;
    result.status = criticalFailures.length === 0 ? "Certified" : "Failed";
    result.certified = result.status === "Certified";
    return result;
  }

  function inspectPlayer(reference, seasonLabel) {
    if (!originalInspectPlayer) return null;
    const result = originalInspectPlayer(reference, seasonLabel);
    if (!result?.ok) return result;
    if (isApprovedNullStartingPrice(result.record)) {
      const priceCheck = (result.checks || []).find(check => check.label === "Starting price");
      if (priceCheck) {
        priceCheck.passed = true;
        priceCheck.actual = "Approved null";
        priceCheck.explanation = "Starting price is intentionally unavailable and this player-season is excluded from starting-price prompts.";
      }
      const passed = (result.checks || []).filter(check => check.passed).length;
      result.health = { ...result.health, passed, total: result.checks.length, percentage: Math.round((passed / result.checks.length) * 100) };
    }
    return result;
  }

  window.ValidationEngine = Object.freeze({ ...engine, seasonHealth, certifySeason, ...(originalInspectPlayer ? { inspectPlayer } : {}) });
})();
