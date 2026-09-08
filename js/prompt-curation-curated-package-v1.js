/* FPL Draft Challenge — Curated Prompt Package v1.0.0
   Read-only materialiser for the frozen 4,897-prompt Phase 1 survivor set.
   It verifies the static selector manifest against the immutable saved promoted snapshot,
   then builds an in-memory curated family-shard package. It never replaces saved shards,
   Daily generation authority, publishing, or certification authority. */
(() => {
  "use strict";

  if (window.FPL_PROMPT_CURATED_PACKAGE_V1?.ready) return;

  const VERSION = "1.0.0";
  const SELECTOR_MANIFEST_PATH = "prompt-library-curated-v1/manifest.json";
  const EXPECTED_SOURCE_FINGERPRINT = "shards_134765_1pkuiu3";
  const EXPECTED_SOURCE_TOTAL = 134765;
  const EXPECTED_SELECTED = 4897;
  const EXPECTED_FAMILIES = 17;
  const EXPECTED_ID_SHA256 = "3d3b0776ca0df171f6017c8e436f167308c4bfdd4d0b74b4e57b6089edff972d";
  const state = { busy:false, lastPayload:null, lastError:"", status:"" };

  const esc = value => String(value ?? "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#039;");

  const familyPrefix = family => `factory_${String(family || "").replaceAll("-", "_")}_`;

  function selectorIds(selector) {
    const family = String(selector?.family || "");
    const positions = selector?.positions && typeof selector.positions === "object" ? selector.positions : {};
    const ids = [];
    for (const [position, suffixes] of Object.entries(positions)) {
      if (!["any","gk","def","mid","fwd"].includes(position)) throw new Error(`Selector ${family} has unsupported position bucket ${position}.`);
      if (!Array.isArray(suffixes)) throw new Error(`Selector ${family}/${position} is not an array.`);
      for (const suffix of suffixes) {
        const clean = String(suffix || "").trim();
        if (!clean) throw new Error(`Selector ${family}/${position} contains a blank suffix.`);
        ids.push(`${familyPrefix(family)}${position}_${clean}`);
      }
    }
    if (ids.length !== Number(selector?.count || 0)) throw new Error(`Selector ${family} expected ${selector?.count || 0} IDs but reconstructs ${ids.length}.`);
    if (new Set(ids).size !== ids.length) throw new Error(`Selector ${family} contains duplicate reconstructed IDs.`);
    return ids;
  }

  async function sha256Text(text) {
    if (!globalThis.crypto?.subtle) throw new Error("Web Crypto SHA-256 is unavailable in this browser.");
    const bytes = new TextEncoder().encode(String(text));
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, "0")).join("");
  }

  async function fetchText(path) {
    const response = await fetch(new URL(path, document.baseURI).toString(), { cache:"no-store" });
    if (!response.ok) throw new Error(`Could not load curated package asset ${path} (${response.status}).`);
    return response.text();
  }

  async function loadSelectorDefinition() {
    const manifestText = await fetchText(SELECTOR_MANIFEST_PATH);
    const manifest = JSON.parse(manifestText);
    if (manifest?.kind !== "fpl-prompt-curated-library-selector-manifest") throw new Error("Curated selector manifest kind is invalid.");
    if (String(manifest.packageVersion || "") !== VERSION) throw new Error(`Curated selector package version ${manifest.packageVersion || "(missing)"} is not ${VERSION}.`);
    if (String(manifest.sourcePromotionFingerprint || "") !== EXPECTED_SOURCE_FINGERPRINT) throw new Error("Curated selector source fingerprint drifted.");
    if (Number(manifest.sourcePrompts || 0) !== EXPECTED_SOURCE_TOTAL) throw new Error("Curated selector source total drifted.");
    if (Number(manifest.selected || 0) !== EXPECTED_SELECTED) throw new Error("Curated selector survivor count drifted.");
    if (Number(manifest.families || 0) !== EXPECTED_FAMILIES) throw new Error("Curated selector family count drifted.");
    if (String(manifest.survivorIdSha256 || "") !== EXPECTED_ID_SHA256) throw new Error("Curated selector survivor-ID digest drifted.");
    if (manifest.authority?.dailyAuthorityChanged !== false || manifest.authority?.productionCutoverApproved !== false) {
      throw new Error("Curated selector manifest incorrectly claims production authority.");
    }
    const descriptors = Array.isArray(manifest.familySelectors) ? manifest.familySelectors : [];
    if (descriptors.length !== EXPECTED_FAMILIES) throw new Error(`Expected ${EXPECTED_FAMILIES} family selectors, found ${descriptors.length}.`);

    const selectors = [];
    for (const descriptor of descriptors) {
      const raw = await fetchText(descriptor.path);
      const actualHash = await sha256Text(raw);
      if (actualHash !== String(descriptor.sha256 || "")) throw new Error(`Selector SHA-256 mismatch for ${descriptor.family}.`);
      const selector = JSON.parse(raw);
      if (selector?.kind !== "fpl-prompt-curation-frozen-survivor-selector-family") throw new Error(`Selector kind is invalid for ${descriptor.family}.`);
      if (String(selector.promotionFingerprint || "") !== EXPECTED_SOURCE_FINGERPRINT) throw new Error(`Selector source fingerprint drifted for ${descriptor.family}.`);
      if (String(selector.family || "") !== String(descriptor.family || "")) throw new Error(`Selector family/path mismatch for ${descriptor.family}.`);
      if (Number(selector.count || 0) !== Number(descriptor.count || 0)) throw new Error(`Selector count mismatch for ${descriptor.family}.`);
      selectors.push(selector);
    }

    const allIds = selectors.flatMap(selectorIds).sort();
    if (allIds.length !== EXPECTED_SELECTED || new Set(allIds).size !== EXPECTED_SELECTED) throw new Error("Curated selector IDs do not form 4,897 unique survivors.");
    const idHash = await sha256Text(`${allIds.join("\n")}\n`);
    if (idHash !== EXPECTED_ID_SHA256) throw new Error(`Curated selector survivor-ID digest mismatch: ${idHash}.`);
    return { manifest, selectors, allIds, idHash };
  }

  function validateSource(source, selectorManifest) {
    if (source?.kind !== "fpl-prompt-library-family-shards" || !source?.manifest || !Array.isArray(source?.shards)) {
      throw new Error("Saved source is not a Prompt Library family-shard package.");
    }
    const fingerprint = String(source.manifest.promotionFingerprint || "");
    if (fingerprint !== String(selectorManifest.sourcePromotionFingerprint || "")) {
      throw new Error(`Saved Promotion fingerprint ${fingerprint || "(missing)"} does not match frozen source ${selectorManifest.sourcePromotionFingerprint}.`);
    }
    if (Number(source.manifest.total || 0) !== Number(selectorManifest.sourcePrompts || 0)) {
      throw new Error(`Saved source contains ${Number(source.manifest.total || 0).toLocaleString("en-GB")} prompts; frozen source expects ${Number(selectorManifest.sourcePrompts || 0).toLocaleString("en-GB")}.`);
    }
  }

  function selectedRecordProblem(record, expectedFamily) {
    if (!record || typeof record !== "object") return "record is not an object";
    if (!String(record.id || "").trim()) return "missing prompt ID";
    if (String(record.family || "") !== expectedFamily) return "family mismatch";
    if (!String(record.label || "").trim()) return "missing label";
    if (!Array.isArray(record.conditions) || !record.conditions.length) return "conditions missing";
    if (String(record.qualityStatus || "") !== "pass") return "quality status is not pass";
    if (record.enabled === false) return "prompt disabled";
    return "";
  }

  function buildPackageFromData(source, selectorManifest, selectors) {
    validateSource(source, selectorManifest);
    const descriptors = new Map((selectorManifest.familySelectors || []).map(item => [String(item.family || ""), item]));
    const selectorByFamily = new Map((selectors || []).map(item => [String(item.family || ""), item]));
    if (selectorByFamily.size !== EXPECTED_FAMILIES) throw new Error(`Expected ${EXPECTED_FAMILIES} selector families, found ${selectorByFamily.size}.`);

    const sourceByFamily = new Map((source.shards || []).map(shard => [String(shard?.family || ""), shard]));
    const selectedIds = new Set();
    const selectedShards = [];
    const variantGroups = new Set();

    for (const [family, descriptor] of descriptors) {
      const selector = selectorByFamily.get(family);
      if (!selector) throw new Error(`Missing frozen selector for ${family}.`);
      const wanted = new Set(selectorIds(selector));
      const sourceShard = sourceByFamily.get(family);
      if (!sourceShard || !Array.isArray(sourceShard.records)) throw new Error(`Saved source is missing family ${family}.`);
      const records = [];
      for (const record of sourceShard.records) {
        const id = String(record?.id || "");
        if (!wanted.has(id)) continue;
        if (selectedIds.has(id)) throw new Error(`Duplicate selected source ID ${id}.`);
        const problem = selectedRecordProblem(record, family);
        if (problem) throw new Error(`Frozen survivor ${id} is invalid: ${problem}.`);
        selectedIds.add(id);
        wanted.delete(id);
        if (record.variantGroup) variantGroups.add(String(record.variantGroup));
        records.push(record);
      }
      if (wanted.size) throw new Error(`${family} is missing ${wanted.size} frozen survivor(s) from the saved source; first missing ID: ${[...wanted][0]}.`);
      if (records.length !== Number(descriptor.count || 0)) throw new Error(`${family} materialised ${records.length} survivors; expected ${descriptor.count}.`);
      selectedShards.push({
        family,
        path:`prompt-library-curated-v1/families/${family}.json`,
        count:records.length,
        records
      });
    }

    if (selectedIds.size !== EXPECTED_SELECTED) throw new Error(`Curated package contains ${selectedIds.size} unique prompts; expected ${EXPECTED_SELECTED}.`);
    if (variantGroups.size !== Number(selectorManifest.selectedVariantGroups || 0)) {
      throw new Error(`Curated package contains ${variantGroups.size} variant groups; expected ${selectorManifest.selectedVariantGroups}.`);
    }

    const familyShards = selectedShards.map(shard => ({ family:shard.family, path:shard.path, count:shard.count }));
    return {
      schemaVersion:1,
      kind:"fpl-prompt-curated-library-package",
      packageVersion:VERSION,
      generatedAt:new Date().toISOString(),
      source:{
        promotionFingerprint:String(source.manifest.promotionFingerprint || ""),
        sourcePrompts:Number(source.manifest.total || 0)
      },
      freeze:{
        selected:EXPECTED_SELECTED,
        survivorIdSha256:EXPECTED_ID_SHA256,
        selectorManifestPath:SELECTOR_MANIFEST_PATH
      },
      manifest:{
        schemaVersion:1,
        version:VERSION,
        source:"prompt-library-curated-v1",
        promotionFingerprint:String(source.manifest.promotionFingerprint || ""),
        total:selectedIds.size,
        families:selectedShards.length,
        variantGroups:variantGroups.size,
        qualityPass:selectedIds.size,
        qualityReview:0,
        familyShards
      },
      shards:selectedShards,
      authority:{
        dailyAuthorityChanged:false,
        productionCutoverApproved:false
      }
    };
  }

  async function runSavedPackage({ download = false } = {}) {
    if (state.busy) return state.lastPayload;
    const shardsApi = window.FPL_PROMPT_LIBRARY_SHARDS_V1;
    if (!shardsApi?.buildRepositoryPackage) throw new Error("Prompt Library shard storage is not ready yet.");
    state.busy = true; state.lastError = ""; state.status = "Verifying frozen survivor selectors…"; render();
    try {
      const definition = await loadSelectorDefinition();
      state.status = "Materialising 4,897 frozen survivors from the immutable promoted snapshot…"; render();
      const source = await shardsApi.buildRepositoryPackage();
      const payload = buildPackageFromData(source, definition.manifest, definition.selectors);
      state.lastPayload = payload; state.status = "";
      window.dispatchEvent(new CustomEvent("fpl:prompt-curated-package-ready", {
        detail:{ version:VERSION, source:payload.source, manifest:payload.manifest, authority:payload.authority }
      }));
      if (download) downloadPayload(payload);
      return payload;
    } catch (error) {
      state.lastError = error?.message || String(error);
      throw error;
    } finally {
      state.busy = false; render();
    }
  }

  function downloadPayload(payload = state.lastPayload) {
    if (!payload) return false;
    const blob = new Blob([JSON.stringify(payload)], { type:"application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `fpl-prompt-curated-library-v1-${payload.source.promotionFingerprint}.json`;
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 0);
    return true;
  }

  function ensureMount() {
    const root = document.getElementById("promptStudioCleanRoot");
    if (!root) return null;
    let mount = document.getElementById("promptCuratedPackageMount");
    if (mount) return mount;
    mount = document.createElement("div");
    mount.id = "promptCuratedPackageMount";
    mount.dataset.promptCuratedPackage = "v1";
    const survivor = document.getElementById("promptCurationSurvivorBuilderMount");
    const review = document.getElementById("promptCurationReviewExportMount");
    const roadmap = root.querySelector(".prompt-clean-roadmap");
    if (survivor) survivor.after(mount);
    else if (review) review.after(mount);
    else if (roadmap) roadmap.before(mount);
    else root.appendChild(mount);
    return mount;
  }

  function render() {
    const mount = ensureMount();
    if (!mount) return false;
    const saved = window.FPL_PROMPT_LIBRARY_SHARDS_V1?.getSavedManifest?.();
    const sourceReady = String(saved?.promotionFingerprint || "") === EXPECTED_SOURCE_FINGERPRINT
      && Number(saved?.total || 0) === EXPECTED_SOURCE_TOTAL;
    const last = state.lastPayload;
    const summary = last
      ? `${Number(last.manifest.total).toLocaleString("en-GB")} frozen survivors verified · ${Number(last.manifest.variantGroups).toLocaleString("en-GB")} variant groups · Daily authority unchanged`
      : "Frozen selector package has not been materialised in this page yet.";
    mount.innerHTML = `<section class="prompt-library-shards" aria-labelledby="promptCuratedPackageHeading">
      <div class="prompt-library-shards-head"><div><p class="eyebrow">Frozen curation package</p><h3 id="promptCuratedPackageHeading">Curated 4,897-prompt package</h3><p>Rebuild and verify the exact frozen survivor set from the immutable saved 134,765-prompt source. This is a read-only pre-cutover package and does not alter saved shards, Daily generation, publishing or certification authority.</p></div><span class="phase-chip">v${esc(VERSION)}</span></div>
      <div class="prompt-library-shards-summary"><strong>${sourceReady ? "Frozen source ready" : "Frozen source unavailable"}</strong><span>${esc(summary)}</span></div>
      <div class="button-row"><button id="promptCuratedPackageBuild" class="button primary" type="button" ${!sourceReady || state.busy ? "disabled" : ""}>${state.busy ? "Building curated package…" : "Build & verify curated package"}</button><button id="promptCuratedPackageDownload" class="button secondary" type="button" ${last && !state.busy ? "" : "disabled"}>Download curated package JSON</button></div>
      <p class="action-status" role="status">${esc(state.lastError || state.status || "The package must reproduce the frozen 4,897-ID digest before it can be considered for Daily cutover.")}</p>
    </section>`;
    mount.querySelector("#promptCuratedPackageBuild")?.addEventListener("click", () => runSavedPackage().catch(() => {}));
    mount.querySelector("#promptCuratedPackageDownload")?.addEventListener("click", () => downloadPayload());
    return true;
  }

  function install() {
    render();
    window.addEventListener("fpl:prompt-studio-clean-rendered", render);
    window.addEventListener("fpl:prompt-studio-clean-ready", render);
    window.addEventListener("fpl:prompt-library-shards-saved", render);
    window.addEventListener("fpl:prompt-library-shards-restored", render);
    window.dispatchEvent(new CustomEvent("fpl:prompt-curated-package-installed", { detail:{ version:VERSION } }));
  }

  window.FPL_PROMPT_CURATED_PACKAGE_V1 = Object.freeze({
    ready:true,
    version:VERSION,
    selectorManifestPath:SELECTOR_MANIFEST_PATH,
    expectedSourceFingerprint:EXPECTED_SOURCE_FINGERPRINT,
    expectedSelected:EXPECTED_SELECTED,
    selectorIds,
    buildPackageFromData,
    loadSelectorDefinition,
    runSavedPackage,
    getLastPayload:() => state.lastPayload,
    downloadLast:() => downloadPayload(),
    render
  });

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once:true });
    else install();
  }
})();
