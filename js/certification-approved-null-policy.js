/* FPL Challenge Studio — explicit approved-null starting-price certification policy. */
(() => {
  "use strict";
  const engine = window.ValidationEngine;
  if (!engine?.seasonHealth || !engine?.certifySeason) return;

  const hasNumericValue = value => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));
  const priceStatus = record => String(record?.startingPriceStatus ?? record?.source?.startingPriceStatus ?? "").trim().toUpperCase();
  const isApprovedNullStartingPrice = record => !hasNumericValue(record?.startingPrice) && record?.pricePromptEligible === false && priceStatus(record) === "APPROVED NULL";
  const startingPriceDecisionIsValid = record => hasNumericValue(record?.startingPrice) ? record?.pricePromptEligible !== false : isApprovedNullStartingPrice(record);

  /*
   * Small, explicit metadata corrections used by the database auditor.
   * These do not merge players or alter scoring data. They only document
   * genuinely separate same-name footballers and a verified age exception.
   */
  const IDENTITY_DISAMBIGUATORS = Object.freeze({
    "joe-riley": "Manchester United Joe Riley",
    "joe-riley-bolton": "Bolton Wanderers Joe Riley",
    "paul-robinson": "Burnley goalkeeper Paul Robinson",
    "paul-robinson-bolton": "Bolton defender Paul Robinson",
    "tommy-smith": "Huddersfield Town Tommy Smith",
    "tommy-smith-qpr": "Queens Park Rangers Tommy Smith"
  });

  function applyAuditMetadataCorrections() {
    const players = Array.isArray(window.FPL_PLAYERS) ? window.FPL_PLAYERS : [];
    for (const player of players) {
      const disambiguator = IDENTITY_DISAMBIGUATORS[player?.playerId];
      if (disambiguator) player.identityDisambiguator = disambiguator;

      if (player?.playerId === "brad-friedel") {
        const season = (player.seasons || []).find(item => item?.season === "2011/12");
        if (season && Number(season.ageAtSeasonStart) === 40) season.ageVerified = true;
      }
    }
  }

  applyAuditMetadataCorrections();

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

  /*
   * Phase 7's older auditor still treats every positive-minute startingPrice
   * blank as a blocker. Filter only rows that satisfy the same explicit
   * APPROVED NULL + pricePromptEligible:false policy used by certification.
   * The audit report arrays are mutated in place so its CSV/JSON exports and
   * issue list all inherit the corrected result without weakening genuine
   * missing-price failures in any season.
   */
  function approvedNullAuditKeys() {
    const keys = new Set();
    for (const player of Array.isArray(window.FPL_PLAYERS) ? window.FPL_PLAYERS : []) {
      for (const record of Array.isArray(player?.seasons) ? player.seasons : []) {
        if (isApprovedNullStartingPrice(record)) keys.add(`${player.playerId}::${record.season}`);
      }
    }
    return keys;
  }

  function countBy(rows, field) {
    return rows.reduce((counts, row) => {
      const key = row?.[field] || "unknown";
      counts[key] = (counts[key] || 0) + 1;
      return counts;
    }, {});
  }

  function syncAuditUi(report, exempted) {
    const summary = report?.summary || {};
    const critical = Number(summary.blockingOccurrences || 0);
    const warnings = Number(summary.warningOccurrences || 0);
    const info = Number(summary.metadataOccurrences || 0);
    const setText = (id, value) => {
      const element = document.getElementById(id);
      if (element) element.textContent = value;
    };

    setText("auditCriticalCount", critical.toLocaleString());
    setText("auditWarningCount", warnings.toLocaleString());
    setText("auditInfoCount", info.toLocaleString());
    setText("auditActionStatus", `Audit complete: ${critical.toLocaleString()} blocking occurrences, ${warnings.toLocaleString()} warnings and ${info.toLocaleString()} metadata gaps. ${exempted.toLocaleString()} approved-null starting-price decisions correctly excluded from blockers.`);

    const statusText = critical > 0 ? `${critical.toLocaleString()} blockers found` : warnings > 0 ? "Passed with warnings" : "Database passed";
    setText("auditStatusTop", statusText);
    setText("auditReadyChip", statusText);
    const chip = document.getElementById("auditReadyChip");
    if (chip) {
      chip.classList.remove("audit-ready", "audit-warning", "audit-blocked");
      chip.classList.add(critical > 0 ? "audit-blocked" : warnings > 0 ? "audit-warning" : "audit-ready");
    }

    if (critical > 0) {
      setText("auditReadinessHeading", "Fix blockers before expanding the player pool");
      setText("auditReadinessCopy", "The current game can continue running, but remaining structural blockers should be resolved before another season import.");
    } else if (warnings > 0) {
      setText("auditReadinessHeading", "Safe to expand carefully");
      setText("auditReadinessCopy", "No blocking corruption was found. Review the remaining warnings, then add one historical season at a time and rerun this audit after each import.");
    } else {
      setText("auditReadinessHeading", "Ready for controlled expansion");
      setText("auditReadinessCopy", "The database passed all blocking and warning checks. Metadata gaps are listed separately and are not structural errors.");
    }

    const categories = summary.categories || {};
    document.querySelectorAll("[data-audit-category]").forEach(button => {
      const count = Number(categories[button.dataset.auditCategory] || 0);
      const strong = button.querySelector("strong");
      if (strong) strong.textContent = count.toLocaleString();
    });
  }

  document.addEventListener("fplstudio:databaseauditcomplete", event => {
    const report = event?.detail?.report;
    const rows = report?.detailedFindings;
    const groups = report?.groupedFindings;
    if (!Array.isArray(rows) || !Array.isArray(groups)) return;

    const approved = approvedNullAuditKeys();
    const keptRows = rows.filter(row => !(row?.code === "invalid-number-startingPrice" && approved.has(`${row.playerId}::${row.season}`)));
    const exempted = rows.length - keptRows.length;
    if (!exempted) return;

    rows.splice(0, rows.length, ...keptRows);
    for (let index = groups.length - 1; index >= 0; index -= 1) {
      const group = groups[index];
      const matchingRows = rows.filter(row => row.code === group.code);
      if (!matchingRows.length) {
        groups.splice(index, 1);
        continue;
      }
      group.count = matchingRows.length;
      group.samples = matchingRows.slice(0, 6);
    }

    const severity = countBy(rows, "severity");
    const categories = countBy(rows, "category");
    report.summary = {
      ...report.summary,
      blockingOccurrences: Number(severity.critical || 0),
      warningOccurrences: Number(severity.warning || 0),
      metadataOccurrences: Number(severity.info || 0),
      issueTypes: groups.length,
      categories,
      approvedNullStartingPriceExemptions: exempted
    };
    window.FPL_DATABASE_AUDIT_REPORT = report;

    setTimeout(() => syncAuditUi(report, exempted), 0);
  });

  window.FPL_APPROVED_NULL_STARTING_PRICE_POLICY = Object.freeze({
    isApprovedNullStartingPrice,
    startingPriceDecisionIsValid
  });

  window.ValidationEngine = Object.freeze({ ...engine, seasonHealth, certifySeason, ...(originalInspectPlayer ? { inspectPlayer } : {}) });
})();
