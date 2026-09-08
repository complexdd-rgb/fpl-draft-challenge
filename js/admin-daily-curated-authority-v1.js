/* FPL Challenge Studio — curated Daily generation authority v1.0.0.
   Keeps the immutable 134,765-prompt saved Promotion snapshot as provenance, but exposes the
   frozen 4,897-prompt Phase 1 survivor set as the repository package consumed by Daily.
   The source package remains available through buildSourceRepositoryPackage(). */
(() => {
  "use strict";

  if (window.FPL_DAILY_CURATED_AUTHORITY_V1?.ready) return;

  const VERSION = "1.0.0";
  const SELECTOR_MANIFEST_PATH = "prompt-library-curated-v1/manifest.json";
  const EXPECTED_SOURCE_FINGERPRINT = "shards_134765_1pkuiu3";
  const EXPECTED_SOURCE_TOTAL = 134765;
  const EXPECTED_SELECTED = 4897;
  const EXPECTED_FAMILIES = 17;
  const EXPECTED_VARIANT_GROUPS = 1307;
  const EXPECTED_ID_SHA256 = "3d3b0776ca0df171f6017c8e436f167308c4bfdd4d0b74b4e57b6089edff972d";

  const sourceApi = window.FPL_PROMPT_LIBRARY_SHARDS_V1;
  if (!sourceApi?.ready || typeof sourceApi.buildRepositoryPackage !== "function") {
    console.error("Curated Daily authority loaded before Prompt Library shard storage was ready.");
    return;
  }

  const sourceBuilder = sourceApi.buildRepositoryPackage.bind(sourceApi);
  let definitionPromise = null;
  let curatedPromise = null;
  let lastPackage = null;
  let lastError = "";

  const familyPrefix = family => `factory_${String(family || "").replaceAll("-", "_")}_`;

  function selectorIds(selector) {
    const family = String(selector?.family || "");
    const positions = selector?.positions && typeof selector.positions === "object" ? selector.positions : {};
    const ids = [];
    for (const [position, suffixes] of Object.entries(positions)) {
      if (!["any", "gk", "def", "mid", "fwd"].includes(position)) {
        throw new Error(`Selector ${family} has unsupported position bucket ${position}.`);
      }
      if (!Array.isArray(suffixes)) throw new Error(`Selector ${family}/${position} is not an array.`);
      for (const suffix of suffixes) {
        const clean = String(suffix || "").trim();
        if (!clean) throw new Error(`Selector ${family}/${position} contains a blank suffix.`);
        ids.push(`${familyPrefix(family)}${position}_${clean}`);
      }
    }
    if (ids.length !== Number(selector?.count || 0)) {
      throw new Error(`Selector ${family} expected ${selector?.count || 0} IDs but reconstructs ${ids.length}.`);
    }
    if (new Set(ids).size !== ids.length) throw new Error(`Selector ${family} contains duplicate IDs.`);
    return ids;
  }

  async function sha256Text(text) {
    if (!globalThis.crypto?.subtle) throw new Error("Web Crypto SHA-256 is unavailable in this browser.");
    const bytes = new TextEncoder().encode(String(text));
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, "0")).join("");
  }

  async function fetchText(path) {
    const response = await fetch(new URL(path, document.baseURI).toString(), { cache: "no-store" });
    if (!response.ok) throw new Error(`Could not load curated Daily asset ${path} (${response.status}).`);
    return response.text();
  }

  async function loadDefinition() {
    if (definitionPromise) return definitionPromise;
    definitionPromise = (async () => {
      const manifest = JSON.parse(await fetchText(SELECTOR_MANIFEST_PATH));
      if (manifest?.kind !== "fpl-prompt-curated-library-selector-manifest") throw new Error("Curated selector manifest kind is invalid.");
      if (String(manifest.packageVersion || "") !== "1.0.0") throw new Error("Curated selector package version drifted.");
      if (String(manifest.sourcePromotionFingerprint || "") !== EXPECTED_SOURCE_FINGERPRINT) throw new Error("Curated selector source fingerprint drifted.");
      if (Number(manifest.sourcePrompts || 0) !== EXPECTED_SOURCE_TOTAL) throw new Error("Curated selector source total drifted.");
      if (Number(manifest.selected || 0) !== EXPECTED_SELECTED) throw new Error("Curated selector survivor count drifted.");
      if (Number(manifest.families || 0) !== EXPECTED_FAMILIES) throw new Error("Curated selector family count drifted.");
      if (Number(manifest.selectedVariantGroups || 0) !== EXPECTED_VARIANT_GROUPS) throw new Error("Curated selector variant-group count drifted.");
      if (String(manifest.survivorIdSha256 || "") !== EXPECTED_ID_SHA256) throw new Error("Curated selector survivor digest drifted.");
      // The frozen selector manifest remains immutable provenance. Production authority is granted
      // here, not by mutating the original freeze artifact.
      if (manifest.authority?.dailyAuthorityChanged !== false || manifest.authority?.productionCutoverApproved !== false) {
        throw new Error("Frozen selector provenance unexpectedly claims production authority.");
      }

      const descriptors = Array.isArray(manifest.familySelectors) ? manifest.familySelectors : [];
      if (descriptors.length !== EXPECTED_FAMILIES) throw new Error(`Expected ${EXPECTED_FAMILIES} family selectors, found ${descriptors.length}.`);
      const selectors = [];
      for (const descriptor of descriptors) {
        const raw = await fetchText(descriptor.path);
        if (await sha256Text(raw) !== String(descriptor.sha256 || "")) throw new Error(`Selector SHA-256 mismatch for ${descriptor.family}.`);
        const selector = JSON.parse(raw);
        if (selector?.kind !== "fpl-prompt-curation-frozen-survivor-selector-family") throw new Error(`Selector kind is invalid for ${descriptor.family}.`);
        if (String(selector.promotionFingerprint || "") !== EXPECTED_SOURCE_FINGERPRINT) throw new Error(`Selector source fingerprint drifted for ${descriptor.family}.`);
        if (String(selector.family || "") !== String(descriptor.family || "")) throw new Error(`Selector family mismatch for ${descriptor.family}.`);
        if (Number(selector.count || 0) !== Number(descriptor.count || 0)) throw new Error(`Selector count mismatch for ${descriptor.family}.`);
        selectors.push(selector);
      }
      const ids = selectors.flatMap(selectorIds).sort();
      if (ids.length !== EXPECTED_SELECTED || new Set(ids).size !== EXPECTED_SELECTED) throw new Error("Frozen selectors do not reconstruct 4,897 unique IDs.");
      const digest = await sha256Text(`${ids.join("\n")}\n`);
      if (digest !== EXPECTED_ID_SHA256) throw new Error(`Frozen survivor digest mismatch: ${digest}.`);
      return Object.freeze({ manifest, selectors: Object.freeze(selectors), ids: Object.freeze(ids), digest });
    })().catch(error => {
      definitionPromise = null;
      throw error;
    });
    return definitionPromise;
  }

  function validateSource(source, manifest) {
    if (source?.kind !== "fpl-prompt-library-family-shards" || !source?.manifest || !Array.isArray(source?.shards)) {
      throw new Error("Saved source is not a Prompt Library family-shard package.");
    }
    if (String(source.manifest.promotionFingerprint || "") !== String(manifest.sourcePromotionFingerprint || "")) {
      throw new Error(`Saved Promotion fingerprint ${source.manifest.promotionFingerprint || "(missing)"} does not match the frozen source.`);
    }
    if (Number(source.manifest.total || 0) !== Number(manifest.sourcePrompts || 0)) {
      throw new Error(`Saved source contains ${Number(source.manifest.total || 0).toLocaleString("en-GB")} prompts; expected ${EXPECTED_SOURCE_TOTAL.toLocaleString("en-GB")}.`);
    }
  }

  function selectedRecordProblem(record, family) {
    if (!record || typeof record !== "object") return "record is not an object";
    if (!String(record.id || "").trim()) return "missing prompt ID";
    if (String(record.family || "") !== family) return "family mismatch";
    if (!String(record.label || "").trim()) return "missing label";
    if (!Array.isArray(record.conditions) || !record.conditions.length) return "conditions missing";
    if (String(record.qualityStatus || "") !== "pass") return "quality status is not pass";
    if (record.enabled === false) return "prompt disabled";
    if (!Number.isFinite(Number(record.qualityEvidence?.answerPlayers)) || Number(record.qualityEvidence.answerPlayers) < 2) return "answer evidence invalid";
    return "";
  }

  function materialise(source, definition) {
    validateSource(source, definition.manifest);
    const sourceByFamily = new Map((source.shards || []).map(shard => [String(shard?.family || ""), shard]));
    const descriptors = new Map((definition.manifest.familySelectors || []).map(item => [String(item.family || ""), item]));
    const selectedIds = new Set();
    const variantGroups = new Set();
    const shards = [];

    for (const selector of definition.selectors) {
      const family = String(selector.family || "");
      const descriptor = descriptors.get(family);
      const sourceShard = sourceByFamily.get(family);
      if (!descriptor || !sourceShard || !Array.isArray(sourceShard.records)) throw new Error(`Saved source is missing curated family ${family}.`);
      const wanted = new Set(selectorIds(selector));
      const records = [];
      for (const record of sourceShard.records) {
        const id = String(record?.id || "");
        if (!wanted.has(id)) continue;
        if (selectedIds.has(id)) throw new Error(`Duplicate curated source ID ${id}.`);
        const problem = selectedRecordProblem(record, family);
        if (problem) throw new Error(`Frozen survivor ${id} is invalid: ${problem}.`);
        selectedIds.add(id);
        wanted.delete(id);
        if (record.variantGroup) variantGroups.add(String(record.variantGroup));
        records.push(record);
      }
      if (wanted.size) throw new Error(`${family} is missing ${wanted.size} frozen survivor(s); first missing ID: ${[...wanted][0]}.`);
      if (records.length !== Number(descriptor.count || 0)) throw new Error(`${family} materialised ${records.length}; expected ${descriptor.count}.`);
      shards.push({ family, path: `prompt-library-curated-v1/families/${family}.json`, count: records.length, records });
    }

    if (selectedIds.size !== EXPECTED_SELECTED) throw new Error(`Curated Daily package contains ${selectedIds.size} unique prompts; expected ${EXPECTED_SELECTED}.`);
    if (variantGroups.size !== EXPECTED_VARIANT_GROUPS) throw new Error(`Curated Daily package contains ${variantGroups.size} variant groups; expected ${EXPECTED_VARIANT_GROUPS}.`);

    const familyShards = shards.map(shard => ({ family: shard.family, path: shard.path, count: shard.count }));
    return Object.freeze({
      schemaVersion: 1,
      kind: "fpl-prompt-library-family-shards",
      packageVersion: VERSION,
      generatedAt: new Date().toISOString(),
      source: Object.freeze({ promotionFingerprint: EXPECTED_SOURCE_FINGERPRINT, sourcePrompts: EXPECTED_SOURCE_TOTAL }),
      freeze: Object.freeze({ selected: EXPECTED_SELECTED, survivorIdSha256: EXPECTED_ID_SHA256, selectorManifestPath: SELECTOR_MANIFEST_PATH }),
      manifest: Object.freeze({
        schemaVersion: 1,
        version: VERSION,
        savedAt: String(source.manifest.savedAt || ""),
        promotionVersion: String(source.manifest.promotionVersion || ""),
        promotionFingerprint: EXPECTED_SOURCE_FINGERPRINT,
        total: EXPECTED_SELECTED,
        families: EXPECTED_FAMILIES,
        variantGroups: EXPECTED_VARIANT_GROUPS,
        qualityPass: EXPECTED_SELECTED,
        qualityReview: 0,
        source: "prompt-library-curated-v1",
        familyShards
      }),
      shards: Object.freeze(shards),
      authority: Object.freeze({
        dailyAuthorityChanged: true,
        productionCutoverApproved: true,
        authority: "frozen-curated-4897-v1",
        shadowRegressionPassed: true
      })
    });
  }

  async function buildCuratedRepositoryPackage() {
    if (lastPackage) return lastPackage;
    if (curatedPromise) return curatedPromise;
    curatedPromise = (async () => {
      const definition = await loadDefinition();
      const source = await sourceBuilder();
      const payload = materialise(source, definition);
      lastPackage = payload;
      lastError = "";
      window.dispatchEvent(new CustomEvent("fpl:daily-curated-authority-ready", {
        detail: { version: VERSION, manifest: payload.manifest, freeze: payload.freeze, authority: payload.authority }
      }));
      return payload;
    })().catch(error => {
      lastError = error?.message || String(error);
      throw error;
    }).finally(() => {
      curatedPromise = null;
    });
    return curatedPromise;
  }

  function invalidate() {
    lastPackage = null;
    curatedPromise = null;
  }

  const facade = Object.freeze({
    ...sourceApi,
    buildRepositoryPackage: buildCuratedRepositoryPackage,
    buildSourceRepositoryPackage: sourceBuilder,
    getGenerationManifest: () => lastPackage?.manifest ? { ...lastPackage.manifest } : null,
    generationAuthority: Object.freeze({ version: VERSION, selected: EXPECTED_SELECTED, survivorIdSha256: EXPECTED_ID_SHA256 })
  });
  window.FPL_PROMPT_LIBRARY_SHARDS_V1 = facade;

  for (const eventName of ["fpl:prompt-library-shards-saved", "fpl:prompt-library-shards-restored", "fpl:prompt-library-shards-cleared"]) {
    window.addEventListener(eventName, invalidate);
  }

  window.FPL_DAILY_CURATED_AUTHORITY_V1 = Object.freeze({
    ready: true,
    version: VERSION,
    expectedSelected: EXPECTED_SELECTED,
    expectedSourceFingerprint: EXPECTED_SOURCE_FINGERPRINT,
    survivorIdSha256: EXPECTED_ID_SHA256,
    buildGenerationPackage: buildCuratedRepositoryPackage,
    buildSourceRepositoryPackage: sourceBuilder,
    invalidate,
    getState: () => Object.freeze({
      ready: Boolean(lastPackage),
      status: lastError ? "blocked" : lastPackage ? "ready" : "waiting",
      reason: lastError || (lastPackage ? "Frozen 4,897-prompt library is the active Daily generation authority." : "Waiting to materialise the frozen curated Daily library."),
      total: lastPackage?.manifest?.total || 0,
      families: lastPackage?.manifest?.families || 0,
      sourcePrompts: EXPECTED_SOURCE_TOTAL,
      survivorIdSha256: EXPECTED_ID_SHA256
    })
  });

  window.dispatchEvent(new CustomEvent("fpl:daily-curated-authority-installed", {
    detail: { version: VERSION, selected: EXPECTED_SELECTED, sourcePrompts: EXPECTED_SOURCE_TOTAL }
  }));
})();
