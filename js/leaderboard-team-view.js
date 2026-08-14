/* FPL Draft Challenge — verified leaderboard team-sheet viewer.
   Team sheets unlock only after this browser has submitted its own verified result. */
(() => {
  "use strict";
  if (window.__FPL_LEADERBOARD_TEAM_VIEW__) return;
  window.__FPL_LEADERBOARD_TEAM_VIEW__ = true;

  let entries = [];
  let viewer = null;
  let playerMap = null;

  const formatTime = value => {
    const total = Math.max(0, Number(value) || 0);
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
  };

  function playersById() {
    if (playerMap) return playerMap;
    playerMap = new Map();
    for (const player of Array.isArray(window.FPL_PLAYERS) ? window.FPL_PLAYERS : []) {
      if (player?.playerId) playerMap.set(String(player.playerId), player);
    }
    return playerMap;
  }

  function resolvePick(pick) {
    const player = playersById().get(String(pick?.playerId || ""));
    const season = Array.isArray(player?.seasons)
      ? player.seasons.find(row => String(row?.season || "") === String(pick?.season || ""))
      : null;
    return {
      position: String(pick?.position || season?.position || "XI"),
      name: String(player?.name || pick?.playerId || "Unknown player"),
      season: String(pick?.season || season?.season || ""),
      club: String(season?.club || ""),
      points: Number(pick?.points ?? season?.points ?? 0) || 0
    };
  }

  function addStyles() {
    if (document.getElementById("leaderboardTeamViewStyles")) return;
    const style = document.createElement("style");
    style.id = "leaderboardTeamViewStyles";
    style.textContent = `
      .leaderboard-team-hint{margin:8px 0 12px;padding:9px 11px;border-radius:12px;background:rgba(95,229,255,.055);border:1px solid rgba(95,229,255,.14);color:var(--muted);font-size:.66rem;line-height:1.4}
      .leaderboard-team-hint.unlocked{color:#c9f5ff;border-color:rgba(0,255,135,.16);background:rgba(0,255,135,.045)}
      .leaderboard-team-name{appearance:none;border:0;background:none;padding:0;color:#fff;font:inherit;font-weight:850;text-align:left;cursor:pointer;text-decoration:underline;text-decoration-color:rgba(0,255,135,.45);text-underline-offset:3px}
      .leaderboard-team-name:hover,.leaderboard-team-name:focus-visible{color:var(--accent);outline:none;text-decoration-color:var(--accent)}
      .leaderboard-team-name:disabled{cursor:default;color:inherit;text-decoration:none;opacity:1}
      .leaderboard-team-you{margin-left:4px;color:var(--muted);font-size:.64rem}
      .leaderboard-team-modal{position:fixed;inset:0;z-index:10050;display:grid;place-items:center;padding:18px;background:rgba(0,0,0,.72);backdrop-filter:blur(8px)}
      .leaderboard-team-modal.hidden{display:none}
      .leaderboard-team-dialog{width:min(760px,100%);max-height:min(86vh,820px);overflow:auto;border-radius:24px;border:1px solid rgba(0,255,135,.2);background:linear-gradient(155deg,#0a241a,#071510);box-shadow:0 28px 80px rgba(0,0,0,.5);padding:18px}
      .leaderboard-team-dialog-head{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;margin-bottom:14px}
      .leaderboard-team-dialog-head h2{margin:3px 0 4px;font-size:1.25rem}.leaderboard-team-dialog-head p{margin:0;color:var(--muted);font-size:.7rem;line-height:1.45}
      .leaderboard-team-close{width:38px;height:38px;flex:0 0 38px;border-radius:12px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.05);color:#fff;font-size:1.15rem;cursor:pointer}
      .leaderboard-team-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}
      .leaderboard-team-card{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:10px;align-items:center;padding:11px;border-radius:15px;border:1px solid rgba(255,255,255,.075);background:rgba(255,255,255,.035)}
      .leaderboard-team-pos{min-width:38px;padding:6px 7px;border-radius:10px;background:rgba(0,255,135,.08);border:1px solid rgba(0,255,135,.16);color:var(--accent);font-size:.58rem;font-weight:950;text-align:center;text-transform:uppercase}
      .leaderboard-team-player{min-width:0}.leaderboard-team-player strong,.leaderboard-team-player small{display:block}.leaderboard-team-player strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.82rem}.leaderboard-team-player small{margin-top:3px;color:var(--muted);font-size:.62rem}
      .leaderboard-team-points{text-align:right}.leaderboard-team-points strong,.leaderboard-team-points small{display:block}.leaderboard-team-points strong{color:#fff;font-size:.86rem}.leaderboard-team-points small{color:var(--muted);font-size:.55rem;text-transform:uppercase}
      .leaderboard-team-unavailable{padding:18px;border-radius:15px;border:1px dashed rgba(255,255,255,.13);color:var(--muted);font-size:.72rem;line-height:1.5;text-align:center}
      @media(max-width:620px){.leaderboard-team-grid{grid-template-columns:1fr}.leaderboard-team-dialog{padding:14px;border-radius:20px}.leaderboard-team-modal{padding:10px}}
    `;
    document.head.appendChild(style);
  }

  function ensureModal() {
    let modal = document.getElementById("leaderboardTeamModal");
    if (modal) return modal;
    modal = document.createElement("div");
    modal.id = "leaderboardTeamModal";
    modal.className = "leaderboard-team-modal hidden";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", "leaderboardTeamTitle");
    modal.innerHTML = `
      <section class="leaderboard-team-dialog">
        <div class="leaderboard-team-dialog-head">
          <div><span class="overview-kicker">Verified team sheet</span><h2 id="leaderboardTeamTitle">Leaderboard XI</h2><p id="leaderboardTeamMeta"></p></div>
          <button class="leaderboard-team-close" type="button" aria-label="Close team sheet">×</button>
        </div>
        <div class="leaderboard-team-grid" id="leaderboardTeamGrid"></div>
      </section>`;
    document.body.appendChild(modal);
    modal.querySelector(".leaderboard-team-close")?.addEventListener("click", closeModal);
    modal.addEventListener("click", event => { if (event.target === modal) closeModal(); });
    return modal;
  }

  function closeModal() {
    document.getElementById("leaderboardTeamModal")?.classList.add("hidden");
  }

  function openTeam(row) {
    if (!viewer || !row) return;
    const modal = ensureModal();
    const title = modal.querySelector("#leaderboardTeamTitle");
    const meta = modal.querySelector("#leaderboardTeamMeta");
    const grid = modal.querySelector("#leaderboardTeamGrid");
    if (!title || !meta || !grid) return;

    title.textContent = `${row.displayName || "Player"} — Used XI`;
    meta.textContent = `Rank #${Number(row.rank) || "–"} · ${Number(row.finalScore || 0).toLocaleString()} pts · ${Number(row.efficiency || 0).toFixed(1)}% · ${formatTime(row.elapsedSeconds)}`;
    grid.replaceChildren();

    const team = Array.isArray(row.team) ? row.team.map(resolvePick) : [];
    if (!team.length) {
      const empty = document.createElement("div");
      empty.className = "leaderboard-team-unavailable";
      empty.style.gridColumn = "1 / -1";
      empty.textContent = "This result was submitted before verified team sheets were stored, so its XI cannot be recovered from the leaderboard entry.";
      grid.appendChild(empty);
    } else {
      for (const pick of team) {
        const card = document.createElement("article");
        card.className = "leaderboard-team-card";

        const pos = document.createElement("span");
        pos.className = "leaderboard-team-pos";
        pos.textContent = pick.position || "XI";

        const player = document.createElement("div");
        player.className = "leaderboard-team-player";
        const strong = document.createElement("strong");
        strong.textContent = pick.name;
        const small = document.createElement("small");
        small.textContent = [pick.season, pick.club].filter(Boolean).join(" · ");
        player.append(strong, small);

        const points = document.createElement("div");
        points.className = "leaderboard-team-points";
        const score = document.createElement("strong");
        score.textContent = Number(pick.points || 0).toLocaleString();
        const label = document.createElement("small");
        label.textContent = "FPL pts";
        points.append(score, label);

        card.append(pos, player, points);
        grid.appendChild(card);
      }
    }

    modal.classList.remove("hidden");
    modal.querySelector(".leaderboard-team-close")?.focus();
  }

  function nameButton(row) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "leaderboard-team-name";
    button.textContent = String(row?.displayName || "Player");
    const hasStoredTeam = Array.isArray(row?.team) && row.team.length > 0;
    const unlocked = Boolean(viewer);
    button.disabled = !unlocked || !hasStoredTeam;
    if (unlocked && hasStoredTeam) {
      button.dataset.rank = String(row.rank);
      button.title = `View ${row.displayName || "player"}'s verified XI`;
    } else if (!unlocked) {
      button.title = "Submit your own verified result to unlock team sheets.";
    } else {
      button.title = "This older result does not have a stored XI.";
    }
    return button;
  }

  function enhanceLeaderboard() {
    const panel = document.getElementById("liveLeaderboardPanel");
    if (!panel) return;
    addStyles();

    let hint = document.getElementById("leaderboardTeamHint");
    if (!hint) {
      hint = document.createElement("div");
      hint.id = "leaderboardTeamHint";
      hint.className = "leaderboard-team-hint";
      const table = panel.querySelector(".leaderboard-table-wrap");
      table?.insertAdjacentElement("beforebegin", hint);
    }
    hint.classList.toggle("unlocked", Boolean(viewer));
    hint.textContent = viewer
      ? "Team sheets unlocked — tap an underlined leaderboard name to see the verified XI they used."
      : "Team sheets unlock after you submit your own verified result, so nobody can reveal answers before playing.";

    const rows = [...panel.querySelectorAll("#leaderboardRows tr")];
    rows.forEach((tr, index) => {
      const row = entries[index];
      const cell = tr.children?.[1];
      if (!row || !cell) return;
      cell.replaceChildren(nameButton(row));
      if (row.isCurrentDevice) {
        const you = document.createElement("small");
        you.className = "leaderboard-team-you";
        you.textContent = "(you)";
        cell.appendChild(you);
      }
    });

    const podium = [...panel.querySelectorAll("#leaderboardPodium .leaderboard-podium-card")];
    podium.forEach((card, index) => {
      const row = entries[index];
      const strong = card.querySelector("strong");
      if (!row || !strong) return;
      strong.replaceChildren(nameButton(row));
    });
  }

  window.addEventListener("fpl:leaderboard-updated", event => {
    const detail = event.detail || {};
    entries = Array.isArray(detail.entries) ? detail.entries : [];
    viewer = detail.viewer || null;
    enhanceLeaderboard();
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") closeModal();
  });

  document.addEventListener("click", event => {
    const button = event.target.closest?.(".leaderboard-team-name[data-rank]");
    if (!button) return;
    const rank = Number(button.dataset.rank);
    openTeam(entries.find(row => Number(row.rank) === rank));
  });

  addStyles();
  const cached = window.FPL_LEADERBOARD_LAST_UPDATE;
  if (cached) {
    entries = Array.isArray(cached.entries) ? cached.entries : [];
    viewer = cached.viewer || null;
    enhanceLeaderboard();
  }
})();
