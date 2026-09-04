import fs from "node:fs";
import { spawnSync } from "node:child_process";

const root = new URL("../", import.meta.url);
const auditPath = new URL("audit-refinement-incubator.mjs", import.meta.url);
const tempPath = new URL(".tmp-refinement-survivor-trial.mjs", import.meta.url);
const auditSource = fs.readFileSync(auditPath, "utf8");

const appendix = String.raw`

// --- Full-library survivor trial appended by trial-refinement-survivors.mjs ---
const incubatorRows = rows.filter(row => row.state === "incubator");
const rowById = new Map(incubatorRows.map(row => [row.id, row]));
const incubatorEntries = source.filter(prompt => rowById.has(String(prompt?.id || ""))).map(prompt => {
  const row = rowById.get(String(prompt.id));
  return {
    id: String(prompt.id),
    position: String(prompt.position || ""),
    label: String(prompt.label || ""),
    fail: String(prompt.fail || ""),
    difficulty: String(prompt.difficulty || "medium"),
    tags: Array.isArray(prompt.tags) ? [...prompt.tags] : [],
    rating: Number(prompt.rating || 0),
    cooldown: Number(prompt.cooldown || 0),
    enabled: false,
    studioRule: prompt.studioRule && typeof prompt.studioRule === "object" ? prompt.studioRule : null,
    testSource: String(prompt.testSource || prompt.studioRule?.source || ""),
    qualityV2: {
      state: "incubator",
      rawRating: row.rawRating,
      rawScore: row.rawScore,
      adjustedScore: row.adjustedScore,
      familyBonus: row.familyBonus,
      playerCount: row.playerCount,
      overlap: row.overlap,
      issues: [...row.issues]
    }
  };
});

localStorage.setItem("fplPromptQualityIncubatorV2", JSON.stringify({
  version: "2.0.0",
  sourceFingerprint: "headless-audit",
  updatedAt: new Date().toISOString(),
  total: incubatorEntries.length,
  items: incubatorEntries
}));

run("js/prompt-refinement-incubator.js");
if (typeof window.FPL_PROMPT_REFINEMENT_INCUBATOR?.refine !== "function") {
  throw new Error("Refinement Incubator API did not initialise.");
}

await window.FPL_PROMPT_REFINEMENT_INCUBATOR.refine();
await new Promise(resolve => setTimeout(resolve, 25));

const refinementRun = JSON.parse(localStorage.getItem("fplPromptRefinementIncubatorRunV1") || "null");
const managerState = JSON.parse(localStorage.getItem("fplChallengeStudioPromptManagerV1") || "null");
const selectedRaw = Array.isArray(managerState?.customs)
  ? managerState.customs.filter(prompt => Array.isArray(prompt?.tags) && prompt.tags.includes("refinement-candidate"))
  : [];

function compileTest(sourceText) {
  try {
    const fn = Function('"use strict"; return (' + sourceText + ');')();
    return typeof fn === "function" ? fn : null;
  } catch (_) { return null; }
}

const selectedCandidates = selectedRaw.map(prompt => ({ ...prompt, test: compileTest(prompt.testSource) })).filter(prompt => typeof prompt.test === "function");
const rowStateById = new Map(rows.map(row => [row.id, row.state]));
const certifiedBase = source.filter(prompt => ["certified", "rescued"].includes(rowStateById.get(String(prompt?.id || ""))));
const fullReview = [...certifiedBase, ...selectedCandidates];

console.log(`Incubator runtime attempted ${Number(refinementRun?.parentsAttempted || 0)} parent(s), tested ${Number(refinementRun?.variantsTested || 0)} variants and selected ${selectedCandidates.length} provisional winner(s).`);
console.log(`Rechecking ${selectedCandidates.length} provisional winner(s) against the full ${fullReview.length.toLocaleString("en-GB")}-prompt candidate library…`);

const fullResults = selectedCandidates.length ? await engine.analyseLibrary(fullReview, window.FPL_PLAYERS, {
  progress(current, total) {
    if (current === total || current % 200 === 0) console.log(`Full-library survivor check ${current}/${total}`);
  }
}) : [];
const fullById = new Map(fullResults.map(result => [String(result?.id || ""), result]));

const candidateToParent = new Map((refinementRun?.candidates || []).map(item => [String(item.id), String(item.parentId)]));
const survivorRows = selectedCandidates.map(prompt => {
  const result = fullById.get(String(prompt.id));
  const d = decision(prompt, result);
  return {
    id: String(prompt.id),
    parentId: candidateToParent.get(String(prompt.id)) || "",
    position: String(prompt.position || ""),
    label: String(prompt.label || ""),
    fail: String(prompt.fail || ""),
    tags: Array.isArray(prompt.tags) ? [...prompt.tags] : [],
    studioRule: prompt.studioRule || null,
    testSource: String(prompt.testSource || ""),
    state: d.state,
    rawRating: d.rawRating,
    rawScore: d.rawScore,
    adjustedScore: d.adjustedScore,
    familyBonus: d.bonus,
    playerCount: d.playerCount,
    overlap: d.overlap,
    issues: d.issues,
    predictedPromotion: ["certified", "rescued"].includes(d.state)
  };
});

const survivors = survivorRows.filter(row => row.predictedPromotion);
const failures = survivorRows.filter(row => !row.predictedPromotion);
const trial = {
  generatedAt: new Date().toISOString(),
  parentsAvailable: incubatorEntries.length,
  parentsAttempted: Number(refinementRun?.parentsAttempted || 0),
  variantsTested: Number(refinementRun?.variantsTested || 0),
  provisionalWinners: selectedCandidates.length,
  fullLibrarySizeWithCandidates: fullReview.length,
  predictedPromotions: survivors.length,
  predictedFailures: failures.length,
  survivors: survivorRows
};

fs.writeFileSync(new URL("refinement-survivor-trial.json", outDir), JSON.stringify(trial, null, 2) + "\n");
const mdTrial = `# Refinement survivor trial\n\nGenerated: ${trial.generatedAt}\n\n## Result\n\n- Incubator parents available: **${trial.parentsAvailable}**\n- Parents attempted by the actual Incubator runtime: **${trial.parentsAttempted}**\n- Controlled variants tested: **${trial.variantsTested}**\n- Provisional parent winners selected: **${trial.provisionalWinners}**\n- Full-library candidate pool rechecked: **${trial.fullLibrarySizeWithCandidates} prompts**\n- Predicted full-library promotions: **${trial.predictedPromotions}**\n- Predicted failures after full-pool recheck: **${trial.predictedFailures}**\n\n## Candidate outcomes\n\n${survivorRows.length ? survivorRows.map(row => `### ${row.id}\n\n- Parent: \`${row.parentId}\`\n- Position: ${row.position}\n- Label: ${row.label}\n- Full-library state: **${row.state}**\n- Raw score: ${row.rawScore}\n- Adjusted score: ${row.adjustedScore}\n- Answers: ${row.playerCount}\n- Max overlap: ${row.overlap.toFixed(3)}\n- Promotion: **${row.predictedPromotion ? "YES" : "NO"}**\n- Issues: ${row.issues.length ? row.issues.join(", ") : "none"}\n`).join("\n") : "No provisional candidates were selected by the Incubator runtime."}\n\n## Interpretation\n\nThis trial uses the repository's real \`prompt-refinement-incubator.js\` to generate and select controlled variants. It then removes the incubated parents, combines the selected candidates with the currently certified/rescued base, and reruns the same Prompt Quality Analyser across the full candidate library. A predicted promotion therefore has passed both the Incubator's provisional screen and a full-pool overlap/quality recheck.\n`;
fs.writeFileSync(new URL("refinement-survivor-trial.md", outDir), mdTrial);

console.log(`Predicted full-library promotions: ${survivors.length}/${selectedCandidates.length}.`);
for (const row of survivorRows) console.log(`SURVIVOR ${row.parentId} -> ${row.id}: ${row.state}; score=${row.rawScore}; adjusted=${row.adjustedScore}; answers=${row.playerCount}; overlap=${row.overlap.toFixed(3)}; promote=${row.predictedPromotion}`);
`;

fs.writeFileSync(tempPath, auditSource + appendix);
try {
  const result = spawnSync(process.execPath, [tempPath.pathname], { cwd: new URL("../", import.meta.url), stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exitCode = result.status ?? 1;
} finally {
  try { fs.unlinkSync(tempPath); } catch (_) {}
}
