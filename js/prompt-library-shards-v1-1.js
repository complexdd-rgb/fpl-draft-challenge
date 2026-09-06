/* FPL Draft Challenge — Prompt Library Shards v1.0.1
   Durable family-shard storage for verified Promotion output. Uses IndexedDB rather than
   localStorage so 100k+ compact prompt records survive refresh without quota misuse. */
(() => {
  "use strict";

  if (window.FPL_PROMPT_LIBRARY_SHARDS_V1?.ready && window.FPL_PROMPT_LIBRARY_SHARDS_V1.version === "1.0.1") return;

  const VERSION = "1.0.1";
  const DB_NAME = "fplPromptLibraryShardsV1";
  const DB_VERSION = 1;
  const META_STORE = "meta";
  const FAMILY_STORE = "families";
  const CURRENT_KEY = "current";
  const CHUNK_SIZE = 2000;
  const PACKAGE_SCHEMA = 1;

  const state = {
    saving: false,
    restoring: false,
    savedManifest: null,
    lastError: "",
    observer: null,
    queued: false
  };

  const esc = value => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  const slug = value => String(value || "uncategorised")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "uncategorised";

  function canonicalLibrary() {
    if (!Array.isArray(window.FPL_PROMPT_LIBRARY)) window.FPL_PROMPT_LIBRARY = [];
    return window.FPL_PROMPT_LIBRARY;
  }

  function familyOf(record) {
    return String(record?.family || "uncategorised").trim() || "uncategorised";
  }

  function fallbackFingerprint(records) {
    let hash = 2166136261;
    for (const record of records) {
      for (const value of [record?.id, record?.variantGroup, record?.qualityStatus, familyOf(record)]) {
        for (const char of String(value || "")) {
          hash ^= char.charCodeAt(0);
          hash = Math.imul(hash, 16777619);
        }
      }
    }
    return `shards_${records.length}_${(hash >>> 0).toString(36)}`;
  }

  function createSnapshot(records, detail = {}) {
    const input = Array.isArray(records) ? records : [];
    const byFamily = new Map();
    const variantGroups = new Set();
    let pass = 0;
    let review = 0;

    for (const record of input) {
      const family = familyOf(record);
      if (!byFamily.has(family)) byFamily.set(family, []);
      byFamily.get(family).push(record);
      if (record?.variantGroup) variantGroups.add(String(record.variantGroup));
      if (record?.qualityStatus === "pass") pass += 1;
      else if (record?.qualityStatus === "review") review += 1;
    }

    const shards = [...byFamily.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([family, familyRecords]) => ({
        family,
        path: `prompt-library-shards/${slug(family)}.json`,
        count: familyRecords.length,
        records: familyRecords
      }));

    const manifest = {
      schemaVersion: PACKAGE_SCHEMA,
      version: VERSION,
      source: "prompt-library-shards-v1",
      savedAt: new Date().toISOString(),
      promotionVersion: String(detail.version || "1.0.0"),
      promotionFingerprint: String(detail.fingerprint || fallbackFingerprint(input)),
      total: shards.reduce((sum, shard) => sum + shard.count, 0),
      families: shards.length,
      variantGroups: variantGroups.size,
      qualityPass: pass,
      qualityReview: review,
      familyShards: shards.map(shard => ({ family: shard.family, path: shard.path, count: shard.count }))
    };

    return { manifest, shards };
  }

  function openDb() {
    if (!window.indexedDB) return Promise.reject(new Error("IndexedDB is not available in this browser."));
    return new Promise((resolve, reject) => {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(META_STORE)) db.createObjectStore(META_STORE);
        if (!db.objectStoreNames.contains(FAMILY_STORE)) db.createObjectStore(FAMILY_STORE, { keyPath: "family" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Could not open Prompt Library shard storage."));
      request.onblocked = () => reject(new Error("Prompt Library shard storage is blocked by another open page."));
    });
  }

  function transactionDone(transaction) {
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error("Prompt Library shard transaction failed."));
      transaction.onabort = () => reject(transaction.error || new Error("Prompt Library shard transaction was aborted."));
    });
  }

  function requestValue(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Prompt Library shard read failed."));
    });
  }

  async function persistSnapshot(snapshot) {
    const db = await openDb();
    try {
      const transaction = db.transaction([META_STORE, FAMILY_STORE], "readwrite");
      const done = transactionDone(transaction);
      const meta = transaction.objectStore(META_STORE);
      const families = transaction.objectStore(FAMILY_STORE);
      families.clear();
      for (const shard of snapshot.shards) {
        families.put({ family: shard.family, path: shard.path, count: shard.count, records: shard.records });
      }
      meta.put(snapshot.manifest, CURRENT_KEY);
      await done;
    } finally {
      db.close();
    }
  }

  async function readSavedSnapshot() {
    const db = await openDb();
    try {
      const transaction = db.transaction([META_STORE, FAMILY_STORE], "readonly");
      const done = transactionDone(transaction);
      const metaRequest = transaction.objectStore(META_STORE).get(CURRENT_KEY);
      const shardsRequest = transaction.objectStore(FAMILY_STORE).getAll();
      const [manifest, storedShards] = await Promise.all([requestValue(metaRequest), requestValue(shardsRequest)]);
      await done;
      if (!manifest || !Array.isArray(manifest.familyShards)) return null;

      const shardMap = new Map((storedShards || []).map(shard => [shard.family, shard]));
      const shards = manifest.familyShards.map(descriptor => {
        const shard = shardMap.get(descriptor.family);
        if (!shard || !Array.isArray(shard.records)) throw new Error(`Saved family shard is missing: ${descriptor.family}`);
        if (Number(shard.count) !== shard.records.length || Number(descriptor.count) !== shard.records.length) {
          throw new Error(`Saved family shard count mismatch: ${descriptor.family}`);
        }
        return shard;
      });

      const total = shards.reduce((sum, shard) => sum + shard.records.length, 0);
      if (total !== Number(manifest.total || 0)) throw new Error(`Saved manifest expected ${manifest.total} prompts but shards contain ${total}.`);
      return { manifest, shards };
    } finally {
      db.close();
    }
  }

  async function readSavedManifest() {
    try {
      const snapshot = await readSavedSnapshot();
      state.savedManifest = snapshot?.manifest || null;
      state.lastError = "";
      render();
      return state.savedManifest;
    } catch (error) {
      state.lastError = String(error?.message || error);
      render();
      return null;
    }
  }

  function installRecords(records, source = "prompt-library-shards-v1") {
    const library = canonicalLibrary();
    library.length = 0;
    for (let index = 0; index < records.length; index += CHUNK_SIZE) library.push(...records.slice(index, index + CHUNK_SIZE));
    window.FPL_PROMPT_STUDIO_CLEAN?.renderLibraryBrowser?.();
    window.dispatchEvent(new CustomEvent("fpl:prompt-library-changed", {
      detail: { source, version: VERSION, total: library.length, persistent: true }
    }));
    return library.length;
  }

  async function saveCurrentPromotion(detail = {}) {
    if (state.saving) return null;
    const records = canonicalLibrary();
    const expected = Number(detail.total || records.length);
    if (!records.length || records.length !== expected) {
      state.lastError = `Save blocked: Promotion reported ${expected.toLocaleString("en-GB")} prompts but canonical contains ${records.length.toLocaleString("en-GB")}.`;
      render();
      return null;
    }

    state.saving = true;
    state.lastError = "";
    render();
    try {
      const snapshot = createSnapshot(records, detail);
      await persistSnapshot(snapshot);
      state.savedManifest = snapshot.manifest;
      window.dispatchEvent(new CustomEvent("fpl:prompt-library-shards-saved", { detail: { ...snapshot.manifest } }));
      return { ...snapshot.manifest };
    } catch (error) {
      state.lastError = String(error?.message || error);
      return null;
    } finally {
      state.saving = false;
      render();
    }
  }

  async function restoreSaved({ force = false } = {}) {
    if (state.restoring) return null;
    const current = canonicalLibrary();
    if (current.length && !force) return { restored: false, reason: "canonical-not-empty", total: current.length };

    state.restoring = true;
    state.lastError = "";
    render();
    try {
      const snapshot = await readSavedSnapshot();
      if (!snapshot) return { restored: false, reason: "no-snapshot", total: 0 };
      const records = snapshot.shards.flatMap(shard => shard.records);
      const total = installRecords(records);
      state.savedManifest = snapshot.manifest;
      window.dispatchEvent(new CustomEvent("fpl:prompt-library-shards-restored", { detail: { ...snapshot.manifest, total } }));
      return { restored: true, total, manifest: { ...snapshot.manifest } };
    } catch (error) {
      state.lastError = String(error?.message || error);
      return null;
    } finally {
      state.restoring = false;
      render();
    }
  }

  async function clearSaved() {
    try {
      const db = await openDb();
      try {
        const transaction = db.transaction([META_STORE, FAMILY_STORE], "readwrite");
        const done = transactionDone(transaction);
        transaction.objectStore(META_STORE).clear();
        transaction.objectStore(FAMILY_STORE).clear();
        await done;
      } finally {
        db.close();
      }
      state.savedManifest = null;
      state.lastError = "";
      window.dispatchEvent(new CustomEvent("fpl:prompt-library-shards-cleared", { detail: { version: VERSION } }));
      render();
      return true;
    } catch (error) {
      state.lastError = String(error?.message || error);
      render();
      return false;
    }
  }

  async function buildRepositoryPackage() {
    const snapshot = await readSavedSnapshot();
    if (!snapshot) throw new Error("No saved Prompt Library shard snapshot is available.");
    return {
      schemaVersion: PACKAGE_SCHEMA,
      kind: "fpl-prompt-library-family-shards",
      generatedAt: new Date().toISOString(),
      manifest: snapshot.manifest,
      repositoryLayout: {
        manifestPath: "prompt-library-shards/manifest.json",
        familyDirectory: "prompt-library-shards/"
      },
      shards: snapshot.shards.map(shard => ({ family: shard.family, path: shard.path, count: shard.count, records: shard.records }))
    };
  }

  async function downloadRepositoryPackage() {
    try {
      const payload = await buildRepositoryPackage();
      const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `fpl-prompt-library-shards-v1-${payload.manifest.promotionFingerprint || "snapshot"}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(link.href), 0);
      setStatus("Repository shard package downloaded. The IndexedDB snapshot remains saved.");
      return true;
    } catch (error) {
      state.lastError = String(error?.message || error);
      render();
      return false;
    }
  }

  function setStatus(message) {
    const node = document.getElementById("promptShardStatus");
    if (node) node.textContent = message;
  }

  function installStyles() {
    if (document.querySelector("link[data-prompt-shards-style]")) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.dataset.promptShardsStyle = "1";
    link.href = window.FPL_ASSET_MANIFEST?.url?.("promptLibraryShardsCssV1") || "admin-prompt-library-shards-v1.css?v=1.0.0";
    document.head.appendChild(link);
  }

  function ensureMount() {
    const root = document.getElementById("promptStudioCleanRoot");
    if (!root) return false;
    let mount = document.getElementById("promptLibraryShardsMount");
    if (!mount) {
      mount = document.createElement("div");
      mount.id = "promptLibraryShardsMount";
      mount.dataset.promptLibraryShardsMount = "v1";
      const promotionMount = document.getElementById("promptPromotionMount");
      const roadmap = root.querySelector(".prompt-clean-roadmap");
      if (promotionMount?.parentNode === root) promotionMount.insertAdjacentElement("afterend", mount);
      else if (roadmap) root.insertBefore(mount, roadmap);
      else root.appendChild(mount);
    }
    render();
    return true;
  }

  function queueEnsure() {
    if (state.queued) return;
    state.queued = true;
    queueMicrotask(() => {
      state.queued = false;
      ensureMount();
    });
  }

  function observe() {
    if (state.observer) return;
    const workspace = document.getElementById("workspace-prompts") || document.querySelector('[data-workspace="prompts"]');
    if (!workspace) return;
    state.observer = new MutationObserver(() => {
      if (!document.getElementById("promptLibraryShardsMount")) queueEnsure();
    });
    state.observer.observe(workspace, { childList: true, subtree: true });
  }

  function render() {
    const mount = document.getElementById("promptLibraryShardsMount");
    if (!mount) return false;
    installStyles();
    const manifest = state.savedManifest;
    const canonicalCount = canonicalLibrary().length;
    const busy = state.saving || state.restoring;
    mount.innerHTML = `<section class="prompt-library-shards" aria-labelledby="promptShardHeading">
      <div class="prompt-library-browser-head">
        <div>
          <p class="eyebrow">Permanent Save · v1</p>
          <h3 id="promptShardHeading">Save once, reuse without rerunning Factory</h3>
          <p>A successful Promotion is automatically split into family shards and stored in IndexedDB. The saved snapshot survives refreshes on this browser and can be packaged for repository publication later.</p>
        </div>
        <span class="phase-chip">${VERSION}</span>
      </div>

      <div class="prompt-shard-summary-grid">
        <div class="prompt-clean-status-card"><span>Saved prompts</span><strong>${Number(manifest?.total || 0).toLocaleString("en-GB")}</strong></div>
        <div class="prompt-clean-status-card"><span>Family shards</span><strong>${Number(manifest?.families || 0).toLocaleString("en-GB")}</strong></div>
        <div class="prompt-clean-status-card"><span>Variant groups</span><strong>${Number(manifest?.variantGroups || 0).toLocaleString("en-GB")}</strong></div>
        <div class="prompt-clean-status-card"><span>Current canonical</span><strong>${canonicalCount.toLocaleString("en-GB")}</strong></div>
      </div>

      <div class="prompt-shard-state ${manifest ? "saved" : "empty"}">
        <strong>${manifest ? "Saved snapshot available" : "No saved snapshot yet"}</strong>
        <span>${manifest ? `${manifest.total.toLocaleString("en-GB")} prompts across ${manifest.families} family shards · ${esc(manifest.promotionFingerprint)} · saved ${esc(manifest.savedAt)}` : "Run Factory, Quality and Promotion once. Promotion will then auto-save the verified pool here."}</span>
      </div>

      <div class="prompt-shard-actions">
        <button id="promptShardRestore" class="button" type="button"${manifest && !busy ? "" : " disabled"}>Restore saved library</button>
        <button id="promptShardDownload" class="button secondary" type="button"${manifest && !busy ? "" : " disabled"}>Download repository shard package</button>
        <button id="promptShardClear" class="button secondary" type="button"${manifest && !busy ? "" : " disabled"}>Clear saved snapshot</button>
        <span id="promptShardStatus">${state.lastError ? `Storage error: ${esc(state.lastError)}` : state.saving ? "Saving promoted family shards…" : state.restoring ? "Restoring saved family shards…" : manifest ? "Saved snapshot is durable on this browser." : "Waiting for a successful Promotion."}</span>
      </div>

      <div class="prompt-shard-boundary">
        <strong>No repeat required</strong>
        <span>Once this snapshot exists, Factory and Quality do not need to be rerun just to recover or package the same library. Repository certification remains a separate explicit step.</span>
      </div>

      <div class="prompt-shard-family-list">${manifest?.familyShards?.length ? manifest.familyShards.map(shard => `<div><span>${esc(shard.family)}</span><strong>${Number(shard.count).toLocaleString("en-GB")}</strong><code>${esc(shard.path)}</code></div>`).join("") : ""}</div>
    </section>`;

    document.getElementById("promptShardRestore")?.addEventListener("click", () => restoreSaved({ force: true }));
    document.getElementById("promptShardDownload")?.addEventListener("click", downloadRepositoryPackage);
    document.getElementById("promptShardClear")?.addEventListener("click", clearSaved);
    return true;
  }

  async function initialiseStorage() {
    ensureMount();
    const manifest = await readSavedManifest();
    if (manifest && canonicalLibrary().length === 0) await restoreSaved();
  }

  function install() {
    ensureMount();
    observe();
    requestAnimationFrame(ensureMount);
    setTimeout(ensureMount, 220);
    window.addEventListener("fpl:prompt-studio-clean-ready", queueEnsure);
    window.addEventListener("fpl:prompt-studio-clean-rendered", queueEnsure);
    document.documentElement.dataset.promptLibraryShards = "v1";
    initialiseStorage();
    window.dispatchEvent(new CustomEvent("fpl:prompt-library-shards-ready", { detail: { version: VERSION } }));
  }

  window.FPL_PROMPT_LIBRARY_SHARDS_V1 = Object.freeze({
    ready: true,
    version: VERSION,
    dbName: DB_NAME,
    createSnapshot,
    saveCurrentPromotion,
    restoreSaved,
    clearSaved,
    getSavedManifest: () => state.savedManifest ? { ...state.savedManifest, familyShards: state.savedManifest.familyShards.map(item => ({ ...item })) } : null,
    buildRepositoryPackage,
    render
  });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
  else install();
})();
