/* FPL Draft Challenge — Prompt Library Shards v1.1.0
   Durable family-shard storage for verified Promotion output. Uses IndexedDB rather than
   localStorage so 100k+ compact prompt records survive refresh without quota misuse.
   The same saved snapshot now powers a read-only Daily Challenge family-balance view. */
(() => {
  "use strict";

  if (window.FPL_PROMPT_LIBRARY_SHARDS_V1?.ready && window.FPL_PROMPT_LIBRARY_SHARDS_V1.version === "1.1.0") return;

  const VERSION = "1.1.0";
  const DB_NAME = "fplPromptLibraryShardsV1";
  const DB_VERSION = 1;
  const META_STORE = "meta";
  const FAMILY_STORE = "families";
  const CURRENT_KEY = "current";
  const CHUNK_SIZE = 2000;
  const PACKAGE_SCHEMA = 1;
  const WEEKLY_PROMPT_SLOTS = 77;

  const state = {
    saving: false,
    restoring: false,
    savedManifest: null,
    savedSnapshot: null,
    lastError: "",
    observer: null,
    dailyObserver: null,
    queued: false,
    dailyQueued: false
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

  function familyLabel(value) {
    const text = String(value || "uncategorised").replace(/[_-]+/g, " ").trim();
    return text.replace(/\b\w/g, char => char.toUpperCase());
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
      state.savedSnapshot = snapshot;
      state.savedManifest = snapshot?.manifest || null;
      state.lastError = "";
      render();
      return state.savedManifest;
    } catch (error) {
      state.savedSnapshot = null;
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
      state.savedSnapshot = snapshot;
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
      state.savedSnapshot = snapshot;
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
      state.savedSnapshot = null;
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
    const snapshot = state.savedSnapshot || await readSavedSnapshot();
    if (!snapshot) throw new Error("No saved Prompt Library shard snapshot is available.");
    state.savedSnapshot = snapshot;
    state.savedManifest = snapshot.manifest;
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
    link.href = window.FPL_ASSET_MANIFEST?.url?.("promptLibraryShardsCssV1") || "admin-prompt-library-shards-v1.css?v=1.1.0";
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

  function ensureDailyMount() {
    const planner = document.getElementById("batchPlanner");
    if (!planner) return false;
    let mount = document.getElementById("promptLibraryDailyBalanceMount");
    if (!mount) {
      mount = document.createElement("div");
      mount.id = "promptLibraryDailyBalanceMount";
      mount.dataset.promptLibraryDailyBalance = "v1";
      const head = planner.querySelector(".batch-planner-head");
      if (head) head.insertAdjacentElement("afterend", mount);
      else planner.prepend(mount);
    }
    renderDaily();
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

  function queueDailyEnsure() {
    if (state.dailyQueued) return;
    state.dailyQueued = true;
    queueMicrotask(() => {
      state.dailyQueued = false;
      ensureDailyMount();
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

  function observeDaily() {
    if (state.dailyObserver) return;
    const workspace = document.getElementById("workspace-challenge") || document.querySelector('[data-workspace="challenge"]');
    if (!workspace) return;
    state.dailyObserver = new MutationObserver(() => {
      if (!document.getElementById("promptLibraryDailyBalanceMount")) queueDailyEnsure();
    });
    state.dailyObserver.observe(workspace, { childList: true, subtree: true });
  }

  function londonDateKey() {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(new Date());
    const values = Object.fromEntries(parts.filter(part => part.type !== "literal").map(part => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  }

  function knownHistoricalUsage() {
    const today = londonDateKey();
    const promptIds = new Set();
    const dates = new Set();
    const collect = (date, ids) => {
      const key = String(date || "");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || key > today) return;
      dates.add(key);
      for (const id of Array.isArray(ids) ? ids : []) if (id) promptIds.add(String(id));
    };

    const manifestRows = Array.isArray(window.FPL_CHALLENGE_MANIFEST?.challenges)
      ? window.FPL_CHALLENGE_MANIFEST.challenges
      : [];
    for (const row of manifestRows) collect(row?.date, row?.promptIds);

    const browserRows = window.FPL_STUDIO_PHASE3?.getHistory?.() || [];
    for (const row of Array.isArray(browserRows) ? browserRows : []) {
      collect(row?.releaseDate || row?.date, row?.promptIds);
    }

    return { promptIds, dates };
  }

  function futureScheduleSummary() {
    const today = londonDateKey();
    const rows = Array.isArray(window.FPL_STUDIO_SCHEDULE?.scheduled)
      ? window.FPL_STUDIO_SCHEDULE.scheduled.filter(row => String(row?.release_date || "") > today)
      : [];
    const batches = new Set(rows.map(row => String(row?.published_at || row?.batch_id || "unknown")));
    return { days: rows.length, batches: rows.length ? batches.size : 0 };
  }

  function repositoryGenerationState() {
    const repo = window.FPL_REPOSITORY_CERTIFIED_PROMPT_POOL?.getState?.();
    if (!repo) return { total: 0, ready: false, reason: "Production pool state is still loading." };
    return {
      total: Number(repo.total ?? repo.prompts?.length ?? 0),
      ready: repo.ready !== false,
      reason: String(repo.reason || "")
    };
  }

  function dailyBalanceModel() {
    const snapshot = state.savedSnapshot;
    if (!snapshot?.manifest || !Array.isArray(snapshot.shards)) return null;
    const total = Number(snapshot.manifest.total || 0);
    const usage = knownHistoricalUsage();
    const savedIds = new Set();
    const rows = [];

    for (const shard of snapshot.shards) {
      const records = Array.isArray(shard.records) ? shard.records : [];
      let used = 0;
      for (const record of records) {
        const id = String(record?.id || "");
        if (!id) continue;
        savedIds.add(id);
        if (usage.promptIds.has(id)) used += 1;
      }
      const count = records.length;
      rows.push({
        family: String(shard.family || "uncategorised"),
        count,
        used,
        unused: Math.max(0, count - used),
        share: total ? (count / total) * 100 : 0,
        weeklyTarget: total ? (count / total) * WEEKLY_PROMPT_SLOTS : 0
      });
    }

    let knownUsed = 0;
    for (const id of usage.promptIds) if (savedIds.has(id)) knownUsed += 1;
    rows.sort((a, b) => b.count - a.count || a.family.localeCompare(b.family));
    const maxShare = Math.max(1, ...rows.map(row => row.share));
    return {
      manifest: snapshot.manifest,
      total,
      rows,
      maxShare,
      knownUsed,
      unused: Math.max(0, total - knownUsed),
      coverage: total ? (knownUsed / total) * 100 : 0,
      knownPastDays: usage.dates.size,
      future: futureScheduleSummary(),
      generation: repositoryGenerationState()
    };
  }

  function renderDaily() {
    const mount = document.getElementById("promptLibraryDailyBalanceMount");
    if (!mount) return false;
    installStyles();
    const model = dailyBalanceModel();

    if (!model) {
      mount.innerHTML = `<section class="daily-library-balance empty" aria-labelledby="dailyLibraryBalanceHeading">
        <div class="daily-library-balance-head">
          <div><p class="eyebrow">Saved Prompt Library</p><h4 id="dailyLibraryBalanceHeading">Library balance</h4><p>The promoted family-shard library has not been restored on this browser yet. Weekly generation authority is unchanged.</p></div>
          <span class="phase-chip">Waiting for saved library</span>
        </div>
      </section>`;
      return true;
    }

    const generationAligned = model.total > 0 && model.generation.total === model.total;
    const familyRows = model.rows.map(row => {
      const width = Math.max(3, Math.min(100, (row.share / model.maxShare) * 100));
      return `<article class="daily-family-row">
        <div class="daily-family-row-head"><strong>${esc(familyLabel(row.family))}</strong><span>${row.share.toFixed(1)}%</span></div>
        <div class="daily-family-share-track" aria-hidden="true"><span style="width:${width.toFixed(1)}%"></span></div>
        <div class="daily-family-row-meta"><span>${row.count.toLocaleString("en-GB")} saved</span><span>${row.used.toLocaleString("en-GB")} known used</span><span>${row.unused.toLocaleString("en-GB")} unused</span><strong>≈ ${row.weeklyTarget.toFixed(1)} / 77</strong></div>
      </article>`;
    }).join("");

    mount.innerHTML = `<section class="daily-library-balance" aria-labelledby="dailyLibraryBalanceHeading">
      <div class="daily-library-balance-head">
        <div>
          <p class="eyebrow">Saved Prompt Library · read-only</p>
          <h4 id="dailyLibraryBalanceHeading">17-family balance and rotation coverage</h4>
          <p>This is the promoted library we have saved. It is visible here for planning only; the weekly generator is not switched to it until the production cutover is explicitly completed.</p>
        </div>
        <span class="phase-chip">${Number(model.manifest.families || model.rows.length)} families</span>
      </div>

      <div class="daily-library-summary-grid">
        <article><span>Saved prompts</span><strong>${model.total.toLocaleString("en-GB")}</strong><small>${Number(model.manifest.variantGroups || 0).toLocaleString("en-GB")} variant groups</small></article>
        <article><span>Known used</span><strong>${model.knownUsed.toLocaleString("en-GB")}</strong><small>${model.coverage.toFixed(2)}% of this saved pool</small></article>
        <article><span>Unused</span><strong>${model.unused.toLocaleString("en-GB")}</strong><small>Available for future proportional rotation</small></article>
        <article><span>Known past days</span><strong>${model.knownPastDays.toLocaleString("en-GB")}</strong><small>Public manifest + browser history</small></article>
      </div>

      <div class="daily-library-boundary ${generationAligned ? "aligned" : "pending"}">
        <div><span>Generation authority</span><strong>${model.generation.total.toLocaleString("en-GB")} production-certified</strong><small>${esc(model.generation.reason || (generationAligned ? "Saved and production pools are aligned." : "Saved library is not yet the live generation authority."))}</small></div>
        <span class="daily-library-boundary-chip">${generationAligned ? "Aligned" : "Cutover pending"}</span>
      </div>

      <div class="daily-library-future-note">
        <div><span>Future published schedule</span><strong>${model.future.days} day${model.future.days === 1 ? "" : "s"}${model.future.batches ? ` · ${model.future.batches} batch${model.future.batches === 1 ? "" : "es"}` : ""}</strong></div>
        <small>Spoiler-safe: future Supabase prompt IDs and family details are deliberately not included in used/unused coverage. Day/week removal remains in Published schedule below.</small>
      </div>

      <details class="daily-family-balance-details" open>
        <summary><span>Proportional family plan</span><strong>${model.rows.length} families · ${WEEKLY_PROMPT_SLOTS} prompt slots per 7-day week</strong></summary>
        <p class="daily-family-balance-copy">The “≈ / 77” figure is each family’s proportional share of a full week. It is a planning preview only; formation compatibility, validation and cooldown rules will still be applied when the generator is deliberately cut over.</p>
        <div class="daily-family-balance-list">${familyRows}</div>
      </details>
    </section>`;
    return true;
  }

  function render() {
    installStyles();
    const mount = document.getElementById("promptLibraryShardsMount");
    if (mount) {
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
    }
    renderDaily();
    return Boolean(mount);
  }

  async function initialiseStorage() {
    ensureMount();
    ensureDailyMount();
    const manifest = await readSavedManifest();
    if (manifest && canonicalLibrary().length === 0) await restoreSaved();
  }

  function install() {
    ensureMount();
    ensureDailyMount();
    observe();
    observeDaily();
    requestAnimationFrame(() => {
      ensureMount();
      ensureDailyMount();
    });
    setTimeout(() => {
      ensureMount();
      ensureDailyMount();
    }, 220);
    window.addEventListener("fpl:prompt-studio-clean-ready", queueEnsure);
    window.addEventListener("fpl:prompt-studio-clean-rendered", queueEnsure);
    window.addEventListener("fpl:studio-workspace-changed", event => {
      if (event?.detail?.workspace === "challenge") queueDailyEnsure();
    });
    window.addEventListener("fpl:schedule-status", renderDaily);
    window.addEventListener("fpl:prompt-library-changed", renderDaily);
    window.addEventListener("fpl:repository-certified-prompt-pool-ready", renderDaily);
    document.documentElement.dataset.promptLibraryShards = "v1-1";
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
    render,
    renderDaily
  });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
  else install();
})();
