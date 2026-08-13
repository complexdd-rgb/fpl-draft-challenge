/* FPL Draft Challenge — full player-facing visual overhaul v1.
   Presentation only: no scoring, eligibility, challenge, account or leaderboard logic lives here. */
(() => {
  "use strict";

  const runtime = window.FPL_CHALLENGE_RUNTIME || {};
  const challenge = window.FPL_DAILY_CHALLENGE || null;
  const app = document.querySelector("main.app");
  if (!app) return;

  document.documentElement.classList.add("fpl-visual-overhaul");
  document.body.classList.add("fpl-visual-overhaul-body");

  function installStyles() {
    if (document.getElementById("fplVisualOverhaulStyles")) return;
    const style = document.createElement("style");
    style.id = "fplVisualOverhaulStyles";
    style.textContent = `
      :root{
        --vo-bg:#06100c;
        --vo-bg-2:#081711;
        --vo-surface:#0b1c14;
        --vo-surface-2:#10271c;
        --vo-surface-3:#153426;
        --vo-text:#f7fff9;
        --vo-muted:#9db8a9;
        --vo-line:rgba(255,255,255,.09);
        --vo-line-strong:rgba(255,255,255,.15);
        --vo-accent:#00ff87;
        --vo-accent-soft:#b7ff50;
        --vo-cyan:#5fe5ff;
        --vo-gold:#ffd166;
        --vo-danger:#ff6681;
        --vo-shadow:0 18px 50px rgba(0,0,0,.24);
        --vo-shadow-deep:0 28px 80px rgba(0,0,0,.36);
        --vo-radius:22px;
        --vo-radius-sm:14px;
      }

      html.fpl-visual-overhaul{background:var(--vo-bg)}
      .fpl-visual-overhaul-body{
        color:var(--vo-text);
        background:
          radial-gradient(circle at 12% -6%,rgba(0,255,135,.11),transparent 30rem),
          radial-gradient(circle at 96% 13%,rgba(95,229,255,.075),transparent 34rem),
          linear-gradient(180deg,#07150f 0%,#05100b 44%,#040b08 100%)!important;
      }
      .fpl-visual-overhaul-body::before{
        opacity:.13!important;
        background-size:34px 34px!important;
      }
      .fpl-visual-overhaul-body::after{
        content:"";
        position:fixed;
        inset:0;
        pointer-events:none;
        z-index:-1;
        background:linear-gradient(90deg,transparent 0,rgba(255,255,255,.012) 50%,transparent 100%);
      }

      .fpl-visual-overhaul-body .app{
        width:min(1160px,100%);
        max-width:1160px;
        padding:14px 18px 132px;
      }

      .vo-brandbar{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:18px;
        min-height:62px;
        margin:0 0 12px;
        padding:8px 4px;
      }
      .vo-brandlockup{display:flex;align-items:center;gap:11px;min-width:0}
      .vo-brandmark{
        width:42px;height:42px;flex:0 0 42px;
        display:grid;place-items:center;
        border-radius:13px;
        color:#04110b;
        background:linear-gradient(145deg,var(--vo-accent),var(--vo-accent-soft));
        box-shadow:0 8px 24px rgba(0,255,135,.22),inset 0 1px rgba(255,255,255,.5);
        font-size:.84rem;font-weight:1000;letter-spacing:-.04em;
      }
      .vo-brandcopy{min-width:0}
      .vo-brandcopy strong,.vo-brandcopy span{display:block}
      .vo-brandcopy strong{font-size:.88rem;letter-spacing:-.02em;color:#fff}
      .vo-brandcopy span{margin-top:2px;color:var(--vo-muted);font-size:.62rem;font-weight:750}
      .vo-brandmeta{display:flex;align-items:center;justify-content:flex-end;gap:7px;flex-wrap:wrap}
      .vo-brandmeta span{
        display:inline-flex;align-items:center;min-height:29px;padding:6px 9px;
        border:1px solid var(--vo-line);border-radius:999px;
        background:rgba(255,255,255,.025);color:#cfe1d6;
        font-size:.58rem;font-weight:900;text-transform:uppercase;letter-spacing:.065em;
      }
      .vo-brandmeta span:first-child{color:var(--vo-accent);border-color:rgba(0,255,135,.18);background:rgba(0,255,135,.055)}

      .fpl-visual-overhaul-body .hero{
        position:relative;
        isolation:isolate;
        overflow:hidden;
        padding:26px 26px 22px;
        border:1px solid rgba(0,255,135,.19);
        border-radius:28px;
        background:
          radial-gradient(circle at 83% 15%,rgba(95,229,255,.12),transparent 19rem),
          linear-gradient(135deg,rgba(0,255,135,.105),transparent 48%),
          linear-gradient(150deg,#112b1f 0%,#0a1e15 58%,#08160f 100%);
        box-shadow:var(--vo-shadow-deep);
      }
      .fpl-visual-overhaul-body .hero::before{
        content:"";
        position:absolute;
        z-index:-1;
        width:360px;height:360px;
        right:-118px;top:-136px;
        border:1px solid rgba(255,255,255,.055);
        border-radius:50%;
        box-shadow:0 0 0 38px rgba(255,255,255,.016),0 0 0 78px rgba(255,255,255,.011);
      }
      .fpl-visual-overhaul-body .hero::after{
        content:"";
        position:absolute;
        z-index:-1;
        left:0;right:0;bottom:0;height:1px;
        background:linear-gradient(90deg,transparent,var(--vo-accent),transparent);
        opacity:.38;
      }
      .fpl-visual-overhaul-body .hero .eyebrow{
        display:inline-flex;align-items:center;gap:7px;
        margin-bottom:2px;
        color:var(--vo-accent);
        font-size:.65rem;font-weight:950;letter-spacing:.12em;
      }
      .fpl-visual-overhaul-body .hero .eyebrow::before{
        content:"";width:7px;height:7px;border-radius:50%;background:currentColor;box-shadow:0 0 16px currentColor;
      }
      .fpl-visual-overhaul-body .hero h1{
        max-width:820px;
        margin:9px 0 9px;
        font-size:clamp(2rem,6.1vw,4.35rem);
        line-height:.96;
        letter-spacing:-.058em;
        text-wrap:balance;
      }
      .fpl-visual-overhaul-body .hero p{
        max-width:760px;
        margin:0 0 18px;
        color:#c6d9cd;
        font-size:.9rem;line-height:1.62;
      }
      .fpl-visual-overhaul-body .hero .status{gap:8px}
      .fpl-visual-overhaul-body .hero .pill{
        min-height:35px;
        display:inline-flex;align-items:center;
        padding:7px 11px;
        border:1px solid rgba(255,255,255,.095);
        background:rgba(0,0,0,.16);
        color:#e6f2ea;
        font-size:.68rem;font-weight:850;
        backdrop-filter:blur(10px);
      }
      .fpl-visual-overhaul-body .hero .pill.penalty{color:#ffb4c1;border-color:rgba(255,102,129,.15)}
      .fpl-visual-overhaul-body .v4-meta{margin:15px 0 8px;gap:7px}
      .fpl-visual-overhaul-body .v4-badge{
        min-height:31px;padding:6px 9px;border-radius:999px;
        font-size:.64rem;letter-spacing:.02em;
        background:rgba(255,255,255,.035);
        border-color:rgba(255,255,255,.09);
      }
      .fpl-visual-overhaul-body .v4-badge.difficulty{background:linear-gradient(145deg,var(--vo-accent),var(--vo-accent-soft));color:#04110b;border:0}
      .fpl-visual-overhaul-body .v4-badge.countdown{color:var(--vo-cyan)}
      .fpl-visual-overhaul-body .v4-progress-shell{height:7px;margin:13px 0 1px;border:0;background:rgba(255,255,255,.065)}
      .fpl-visual-overhaul-body .v4-progress-bar{background:linear-gradient(90deg,var(--vo-accent),var(--vo-cyan));box-shadow:0 0 20px rgba(0,255,135,.26)}

      .fpl-visual-overhaul-body .challenge-overview,
      .fpl-visual-overhaul-body .phase45-dashboard,
      .fpl-visual-overhaul-body .phase45-sidecard,
      .fpl-visual-overhaul-body .phase45-panel,
      .fpl-visual-overhaul-body .local-history,
      .fpl-visual-overhaul-body .challenge-calendar-nav,
      .fpl-visual-overhaul-body .results,
      .fpl-visual-overhaul-body .leaderboard-panel{
        border:1px solid var(--vo-line)!important;
        background:linear-gradient(155deg,rgba(15,39,28,.96),rgba(7,22,15,.98))!important;
        box-shadow:var(--vo-shadow)!important;
      }

      .fpl-visual-overhaul-body .challenge-overview{
        grid-template-columns:minmax(0,1.25fr) minmax(300px,.75fr);
        gap:22px;
        margin:16px 0 13px;
        padding:20px 22px;
        border-radius:22px;
      }
      .fpl-visual-overhaul-body .overview-kicker,
      .fpl-visual-overhaul-body .phase45-kicker{
        color:var(--vo-accent);
        font-size:.61rem;
        letter-spacing:.11em;
      }
      .fpl-visual-overhaul-body .overview-copy h2,
      .fpl-visual-overhaul-body .section-heading h2{
        margin:5px 0 6px;
        font-size:clamp(1.25rem,2.8vw,1.75rem);
        letter-spacing:-.035em;
      }
      .fpl-visual-overhaul-body .overview-copy p,
      .fpl-visual-overhaul-body .section-heading p{color:var(--vo-muted);font-size:.76rem;line-height:1.55}
      .fpl-visual-overhaul-body .overview-rules{gap:7px}
      .fpl-visual-overhaul-body .overview-rules div{
        padding:11px 7px;
        border-color:var(--vo-line);
        border-radius:13px;
        background:rgba(0,0,0,.13);
      }
      .fpl-visual-overhaul-body .overview-rules strong{color:var(--vo-accent);font-size:1.08rem}
      .fpl-visual-overhaul-body .overview-rules span{color:var(--vo-muted);font-size:.59rem}

      .fpl-visual-overhaul-body .phase45-shell{gap:14px;margin-top:14px}
      .fpl-visual-overhaul-body .phase45-hero{gap:12px;grid-template-columns:minmax(0,1.35fr) minmax(300px,.75fr)}
      .fpl-visual-overhaul-body .phase45-dashboard,
      .fpl-visual-overhaul-body .phase45-sidecard,
      .fpl-visual-overhaul-body .phase45-panel{padding:16px;border-radius:20px}
      .fpl-visual-overhaul-body .phase45-dashboard::after{opacity:.55}
      .fpl-visual-overhaul-body .history-chip,
      .fpl-visual-overhaul-body .history-stat{
        border:1px solid var(--vo-line)!important;
        background:rgba(255,255,255,.028)!important;
        border-radius:13px!important;
      }

      .fpl-visual-overhaul-body .section-heading{
        margin:27px 2px 10px;
        padding:0 2px;
      }
      .fpl-visual-overhaul-body #grid{
        display:grid;
        grid-template-columns:repeat(2,minmax(0,1fr));
        gap:10px;
        margin-top:10px;
        align-items:start;
      }
      .fpl-visual-overhaul-body .slot{
        --vo-pos:#7da4ff;
        position:relative;
        overflow:visible;
        padding:14px 14px 13px;
        border:1px solid var(--vo-line);
        border-radius:17px;
        background:linear-gradient(145deg,rgba(18,44,32,.98),rgba(8,26,18,.99));
        box-shadow:0 10px 24px rgba(0,0,0,.16);
        transition:transform .18s ease,border-color .18s ease,box-shadow .18s ease,background .18s ease;
      }
      .fpl-visual-overhaul-body .slot::before{
        content:"";
        position:absolute;
        left:-1px;top:16px;bottom:16px;width:3px;
        border-radius:0 4px 4px 0;
        background:var(--vo-pos);
        opacity:.7;
      }
      .fpl-visual-overhaul-body .slot::after{opacity:.42;transform:scale(.82)}
      .fpl-visual-overhaul-body .slot[data-position="GK"]{--vo-pos:#f6c956}
      .fpl-visual-overhaul-body .slot[data-position="DEF"]{--vo-pos:#59a1ff}
      .fpl-visual-overhaul-body .slot[data-position="MID"]{--vo-pos:#b07cff}
      .fpl-visual-overhaul-body .slot[data-position="FWD"]{--vo-pos:#ff7188}
      .fpl-visual-overhaul-body .slot:hover{transform:translateY(-1px);border-color:rgba(255,255,255,.15);box-shadow:0 14px 30px rgba(0,0,0,.21)}
      .fpl-visual-overhaul-body .slot:focus-within{border-color:rgba(0,255,135,.3);box-shadow:0 0 0 3px rgba(0,255,135,.06),0 16px 34px rgba(0,0,0,.22)}
      .fpl-visual-overhaul-body .slot.valid,
      .fpl-visual-overhaul-body .slot.phase45-locked{
        border-color:rgba(0,255,135,.27);
        background:linear-gradient(145deg,rgba(16,52,35,.98),rgba(8,30,20,.99));
        box-shadow:0 10px 28px rgba(0,255,135,.045);
      }
      .fpl-visual-overhaul-body .slot.valid::after{width:22px;height:22px;right:10px;top:10px;font-size:.72rem}
      .fpl-visual-overhaul-body .slot-head{gap:9px;padding-right:26px}
      .fpl-visual-overhaul-body .pos{
        min-width:42px;
        padding:7px 8px;
        border-radius:10px;
        background:color-mix(in srgb,var(--vo-pos) 78%,#13281f)!important;
        box-shadow:none!important;
        font-size:.68rem;
      }
      .fpl-visual-overhaul-body .prompt{font-size:.79rem;line-height:1.42;letter-spacing:-.008em}
      .fpl-visual-overhaul-body .choice-row{grid-template-columns:minmax(0,1fr) 112px auto;gap:7px;margin-top:10px}
      .fpl-visual-overhaul-body .player-search,
      .fpl-visual-overhaul-body .season-select,
      .fpl-visual-overhaul-body #leaderboardDisplayName,
      .fpl-visual-overhaul-body .leaderboard-account-form input{
        min-height:42px;
        border:1px solid rgba(255,255,255,.105);
        border-radius:11px;
        background:#071911;
        color:#f7fff9;
        box-shadow:inset 0 1px rgba(255,255,255,.015);
      }
      .fpl-visual-overhaul-body .player-search:focus,
      .fpl-visual-overhaul-body .season-select:focus,
      .fpl-visual-overhaul-body #leaderboardDisplayName:focus,
      .fpl-visual-overhaul-body .leaderboard-account-form input:focus{
        outline:none;
        border-color:rgba(0,255,135,.58);
        box-shadow:0 0 0 3px rgba(0,255,135,.075);
      }
      .fpl-visual-overhaul-body .confirm,
      .fpl-visual-overhaul-body .btn.primary{
        min-height:42px;
        border-radius:11px;
        color:#031109;
        background:linear-gradient(145deg,var(--vo-accent),var(--vo-accent-soft));
        box-shadow:0 8px 20px rgba(0,255,135,.12);
        transition:transform .15s ease,filter .15s ease,box-shadow .15s ease;
      }
      .fpl-visual-overhaul-body .confirm:not(:disabled):hover,
      .fpl-visual-overhaul-body .btn.primary:not(:disabled):hover{transform:translateY(-1px);filter:brightness(1.04);box-shadow:0 11px 26px rgba(0,255,135,.18)}
      .fpl-visual-overhaul-body .btn.secondary,
      .fpl-visual-overhaul-body .leaderboard-refresh,
      .fpl-visual-overhaul-body .leaderboard-edit-name,
      .fpl-visual-overhaul-body .leaderboard-account-button{
        border:1px solid var(--vo-line-strong)!important;
        border-radius:11px!important;
        background:rgba(255,255,255,.035)!important;
        color:#edf8f1!important;
        box-shadow:none!important;
      }
      .fpl-visual-overhaul-body button:focus-visible,
      .fpl-visual-overhaul-body a:focus-visible,
      .fpl-visual-overhaul-body input:focus-visible,
      .fpl-visual-overhaul-body select:focus-visible,
      .fpl-visual-overhaul-body summary:focus-visible{outline:2px solid var(--vo-cyan);outline-offset:2px}
      .fpl-visual-overhaul-body .feedback{min-height:17px;font-size:.68rem}
      .fpl-visual-overhaul-body .selected-meta{font-size:.67rem}
      .fpl-visual-overhaul-body .suggestions{
        top:calc(100% + 7px);
        border-radius:13px;
        border-color:rgba(255,255,255,.12);
        background:#081c13;
        box-shadow:0 22px 55px rgba(0,0,0,.48);
      }
      .fpl-visual-overhaul-body .suggestion{padding:10px 11px;border-bottom-color:rgba(255,255,255,.055);font-size:.76rem}
      .fpl-visual-overhaul-body .suggestion:hover,
      .fpl-visual-overhaul-body .suggestion.active{background:rgba(0,255,135,.075)}
      .fpl-visual-overhaul-body .suggestion small{font-size:.62rem;color:var(--vo-muted)}

      .fpl-visual-overhaul-body .confirmed-summary{gap:9px}
      .fpl-visual-overhaul-body .confirmed-player strong{font-size:.8rem}
      .fpl-visual-overhaul-body .confirmed-player span{font-size:.62rem;color:var(--vo-muted)}
      .fpl-visual-overhaul-body .compact-efficiency{border-radius:10px!important;padding:7px 8px!important;background:rgba(0,0,0,.13)!important}
      .fpl-visual-overhaul-body .compact-efficiency span{font-size:.54rem!important}
      .fpl-visual-overhaul-body .compact-efficiency strong{font-size:.76rem!important}
      .fpl-visual-overhaul-body .compact-track{height:4px!important;margin-top:8px!important}

      .fpl-visual-overhaul-body .draft-progress-dock{
        position:sticky;
        bottom:74px;
        z-index:65;
        margin:14px auto 0;
        width:min(610px,calc(100% - 10px));
        padding:8px;
        border:1px solid rgba(255,255,255,.105);
        border-radius:18px;
        background:rgba(5,18,12,.82);
        box-shadow:0 16px 42px rgba(0,0,0,.28);
        backdrop-filter:blur(18px);
      }
      .fpl-visual-overhaul-body .dock-stat{padding:7px 10px}
      .fpl-visual-overhaul-body .dock-stat strong{font-size:.82rem}
      .fpl-visual-overhaul-body .dock-stat span{font-size:.52rem}
      .fpl-visual-overhaul-body .dock-progress-track{height:5px;background:rgba(255,255,255,.07)}
      .fpl-visual-overhaul-body .actions{
        position:static;
        margin:12px 0 18px;
        padding:0;
        background:none;
        backdrop-filter:none;
      }

      .fpl-visual-overhaul-body .results{
        margin-top:28px;
        padding:20px;
        border-radius:26px;
      }
      .fpl-visual-overhaul-body .result-hero{
        border:1px solid rgba(0,255,135,.15)!important;
        background:linear-gradient(145deg,rgba(0,255,135,.07),rgba(255,255,255,.018))!important;
        border-radius:20px!important;
      }
      .fpl-visual-overhaul-body .results-v2-scoreboard{gap:8px}
      .fpl-visual-overhaul-body .results-v2-headline-stat{border-radius:16px;background:rgba(255,255,255,.028);box-shadow:none}
      .fpl-visual-overhaul-body .results-v2-headline-stat.emphasis{background:linear-gradient(145deg,rgba(0,255,135,.095),rgba(255,255,255,.018))}
      .fpl-visual-overhaul-body .xi-comparison{gap:12px}
      .fpl-visual-overhaul-body .xi-panel{border-color:var(--vo-line)!important;border-radius:18px!important;background:rgba(255,255,255,.025)!important}
      .fpl-visual-overhaul-body .pitch{
        border:1px solid rgba(255,255,255,.24)!important;
        border-radius:18px;
        background:
          linear-gradient(90deg,rgba(255,255,255,.022) 50%,transparent 50%) 0 0/36px 100%,
          linear-gradient(180deg,#12623b,#0c4d2e)!important;
        box-shadow:inset 0 0 0 1px rgba(255,255,255,.05),inset 0 18px 60px rgba(0,0,0,.12);
      }
      .fpl-visual-overhaul-body .shirt-icon{filter:drop-shadow(0 5px 7px rgba(0,0,0,.24))}
      .fpl-visual-overhaul-body .score-card{gap:7px;padding:10px;border-color:var(--vo-line);background:rgba(0,0,0,.12)}
      .fpl-visual-overhaul-body .score-card div{border:1px solid rgba(255,255,255,.045);background:rgba(255,255,255,.025)}
      .fpl-visual-overhaul-body .review{border-color:var(--vo-line);background:rgba(255,255,255,.025);border-radius:13px}
      .fpl-visual-overhaul-body .review summary{font-size:.76rem}
      .fpl-visual-overhaul-body .results-v2-analysis{border-color:var(--vo-line);background:rgba(255,255,255,.024)}
      .fpl-visual-overhaul-body .phase45-share-preview{border-color:var(--vo-line);background:rgba(255,255,255,.02)}
      .fpl-visual-overhaul-body .share-card{border-color:rgba(0,255,135,.12);background:radial-gradient(circle at 100% 0,rgba(0,255,135,.12),transparent 34%),linear-gradient(145deg,#0e261b,#071811)}

      .fpl-visual-overhaul-body .leaderboard-panel{
        margin:24px 0;
        padding:18px;
        border-radius:24px;
      }
      .fpl-visual-overhaul-body .leaderboard-head{padding-bottom:3px}
      .fpl-visual-overhaul-body .leaderboard-head h2{font-size:1.25rem;letter-spacing:-.03em}
      .fpl-visual-overhaul-body .leaderboard-state{background:rgba(0,255,135,.045);border-color:rgba(0,255,135,.15);font-size:.55rem}
      .fpl-visual-overhaul-body .leaderboard-account{
        margin:11px 0;
        padding:10px 11px;
        border-color:rgba(95,229,255,.105);
        background:rgba(95,229,255,.025);
        border-radius:13px;
      }
      .fpl-visual-overhaul-body .leaderboard-tabs{padding:4px!important;border:1px solid var(--vo-line)!important;background:rgba(0,0,0,.13)!important;border-radius:13px!important}
      .fpl-visual-overhaul-body .leaderboard-tab{border-radius:9px!important}
      .fpl-visual-overhaul-body .leaderboard-tab.active{background:rgba(0,255,135,.105)!important;color:var(--vo-accent)!important}
      .fpl-visual-overhaul-body .leaderboard-submit-card,
      .fpl-visual-overhaul-body .leaderboard-personal,
      .fpl-visual-overhaul-body .leaderboard-podium-card{
        border-color:var(--vo-line)!important;
        background:rgba(255,255,255,.022)!important;
        border-radius:14px!important;
      }
      .fpl-visual-overhaul-body .leaderboard-rank-orb{border-radius:18px;background:rgba(0,255,135,.06)}
      .fpl-visual-overhaul-body .leaderboard-table-wrap{border-color:var(--vo-line);border-radius:14px;background:rgba(0,0,0,.09)}
      .fpl-visual-overhaul-body .leaderboard-table th{background:rgba(255,255,255,.018);color:#91ad9d}
      .fpl-visual-overhaul-body .leaderboard-table th,
      .fpl-visual-overhaul-body .leaderboard-table td{border-bottom-color:rgba(255,255,255,.05)}
      .fpl-visual-overhaul-body .leaderboard-row-me{background:rgba(0,255,135,.04)}
      .fpl-visual-overhaul-body .leaderboard-account-dialog{border-color:var(--vo-line-strong);background:#081a12;border-radius:20px}

      .fpl-visual-overhaul-body .challenge-calendar-nav{border-radius:22px;padding:16px!important}
      .fpl-visual-overhaul-body .archive-entry{
        border:1px solid var(--vo-line)!important;
        border-radius:15px!important;
        background:rgba(255,255,255,.022)!important;
        transition:transform .16s ease,border-color .16s ease,background .16s ease;
      }
      .fpl-visual-overhaul-body .archive-entry:hover{transform:translateY(-1px);border-color:rgba(0,255,135,.17)!important;background:rgba(0,255,135,.028)!important}
      .fpl-visual-overhaul-body .archive-action{border-radius:10px!important}

      .fpl-visual-overhaul-body .phase45-bottom-nav{
        left:50%!important;right:auto!important;bottom:12px!important;
        width:min(560px,calc(100% - 22px))!important;
        transform:translateX(-50%);
        padding:5px!important;
        border:1px solid rgba(255,255,255,.11)!important;
        border-radius:18px!important;
        background:rgba(5,18,12,.88)!important;
        box-shadow:0 20px 50px rgba(0,0,0,.36)!important;
        backdrop-filter:blur(18px)!important;
      }
      .fpl-visual-overhaul-body .phase45-bottom-nav button{
        min-height:47px!important;
        border-radius:13px!important;
        color:#9fb8aa!important;
        font-size:.57rem!important;
        transition:background .15s ease,color .15s ease,transform .15s ease;
      }
      .fpl-visual-overhaul-body .phase45-bottom-nav button:hover{background:rgba(255,255,255,.04)!important;color:#fff!important;transform:translateY(-1px)}
      .fpl-visual-overhaul-body .phase45-bottom-nav button span{font-size:.92rem!important}

      .vo-reveal{opacity:0;transform:translateY(9px);transition:opacity .42s ease,transform .42s cubic-bezier(.2,.78,.25,1)}
      .vo-reveal.vo-visible{opacity:1;transform:none}

      @media(min-width:1060px){
        .fpl-visual-overhaul-body #grid .slot.compact-confirmed{min-height:112px}
        .fpl-visual-overhaul-body .leaderboard-panel{padding:20px}
      }
      @media(max-width:900px){
        .fpl-visual-overhaul-body .challenge-overview{grid-template-columns:1fr}
        .fpl-visual-overhaul-body .phase45-hero{grid-template-columns:1fr}
        .fpl-visual-overhaul-body #grid{grid-template-columns:1fr}
        .fpl-visual-overhaul-body .choice-row{grid-template-columns:minmax(0,1fr) 112px auto}
      }
      @media(max-width:700px){
        .fpl-visual-overhaul-body .app{padding:10px 11px 130px}
        .vo-brandbar{min-height:54px;margin-bottom:8px;padding:5px 2px}.vo-brandmark{width:38px;height:38px;flex-basis:38px}.vo-brandcopy strong{font-size:.8rem}
        .vo-brandmeta span:nth-child(n+3){display:none}
        .fpl-visual-overhaul-body .hero{padding:21px 16px 17px;border-radius:22px}
        .fpl-visual-overhaul-body .hero h1{font-size:clamp(2rem,11vw,3.35rem)}
        .fpl-visual-overhaul-body .hero p{font-size:.79rem;line-height:1.55}
        .fpl-visual-overhaul-body .challenge-overview{padding:16px;border-radius:18px}
        .fpl-visual-overhaul-body .overview-rules{grid-template-columns:repeat(3,1fr)}
        .fpl-visual-overhaul-body .section-heading{align-items:flex-start;flex-direction:column;gap:4px;margin-top:22px}
        .fpl-visual-overhaul-body .section-heading p{text-align:left}
        .fpl-visual-overhaul-body .slot{padding:13px 12px;border-radius:15px}
        .fpl-visual-overhaul-body .choice-row{grid-template-columns:minmax(0,1fr) 105px}
        .fpl-visual-overhaul-body .choice-row .confirm{grid-column:1/-1}
        .fpl-visual-overhaul-body .draft-progress-dock{bottom:72px;width:calc(100% - 8px)}
        .fpl-visual-overhaul-body .results{padding:14px;border-radius:20px}
        .fpl-visual-overhaul-body .leaderboard-panel{padding:14px;border-radius:20px}
        .fpl-visual-overhaul-body .leaderboard-head{gap:8px}
        .fpl-visual-overhaul-body .leaderboard-state{padding:6px 8px}
        .fpl-visual-overhaul-body .phase45-bottom-nav{bottom:8px!important;width:calc(100% - 16px)!important}
      }
      @media(max-width:460px){
        .vo-brandmeta span:nth-child(n+2){display:none}
        .fpl-visual-overhaul-body .hero .status{display:grid;grid-template-columns:1fr 1fr}.fpl-visual-overhaul-body .hero .pill.penalty{grid-column:1/-1}
        .fpl-visual-overhaul-body .overview-rules{gap:5px}.fpl-visual-overhaul-body .overview-rules div{padding:9px 4px}.fpl-visual-overhaul-body .overview-rules strong{font-size:.96rem}.fpl-visual-overhaul-body .overview-rules span{font-size:.53rem}
        .fpl-visual-overhaul-body .confirmed-summary{grid-template-columns:1fr auto!important}
        .fpl-visual-overhaul-body .compact-change{grid-column:1/-1!important;width:100%}
        .fpl-visual-overhaul-body .results-v2-scoreboard{grid-template-columns:1fr 1fr}
        .fpl-visual-overhaul-body .leaderboard-head{flex-direction:column}.fpl-visual-overhaul-body .leaderboard-state{align-self:flex-start}
      }
      @media(prefers-reduced-motion:reduce){
        .vo-reveal{opacity:1!important;transform:none!important;transition:none!important}
        .fpl-visual-overhaul-body *{scroll-behavior:auto!important;animation-duration:.001ms!important;animation-iteration-count:1!important;transition-duration:.001ms!important}
      }
    `;
    document.head.appendChild(style);
  }

  function installBrandBar() {
    if (document.getElementById("voBrandbar")) return;
    const brand = document.createElement("div");
    brand.id = "voBrandbar";
    brand.className = "vo-brandbar";
    brand.innerHTML = `
      <div class="vo-brandlockup">
        <div class="vo-brandmark" aria-hidden="true">XI</div>
        <div class="vo-brandcopy"><strong>FPL Draft Challenge</strong><span>Historical fantasy football · one XI every day</span></div>
      </div>
      <div class="vo-brandmeta" aria-label="Game format">
        <span>${runtime.archiveMode ? "Archive practice" : "Today’s challenge"}</span>
        <span>${challenge?.formation || "Historical XI"}</span>
        <span>11 picks</span>
        <span>One player once</span>
      </div>`;
    app.insertBefore(brand, app.firstChild);
  }

  function refreshCopy() {
    const eyebrow = document.querySelector(".hero .eyebrow");
    if (eyebrow) eyebrow.textContent = runtime.archiveMode ? "Archive historical XI challenge" : "Daily historical XI challenge";
  }

  function markSurfaces() {
    const selectors = [
      ".hero", ".challenge-overview", ".phase45-dashboard", ".phase45-sidecard", ".phase45-panel",
      ".local-history", ".challenge-calendar-nav", "#results", "#liveLeaderboardPanel"
    ];
    document.querySelectorAll(selectors.join(",")).forEach(element => {
      if (element.dataset.voReveal === "1") return;
      element.dataset.voReveal = "1";
      element.classList.add("vo-reveal");
      revealObserver?.observe(element);
    });
  }

  function decorateDynamicUi() {
    document.querySelectorAll(".slot").forEach((slot, index) => {
      slot.dataset.voIndex = String(index + 1);
    });
    document.querySelectorAll(".leaderboard-table-wrap, .phase45-share-preview, .results-v2-analysis").forEach(element => {
      element.classList.add("vo-detail-surface");
    });
    markSurfaces();
  }

  let revealObserver = null;
  if ("IntersectionObserver" in window && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    revealObserver = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("vo-visible");
        revealObserver.unobserve(entry.target);
      }
    }, { rootMargin: "0px 0px -4% 0px", threshold: .06 });
  }

  function revealFallback() {
    if (revealObserver) return;
    document.querySelectorAll(".vo-reveal").forEach(element => element.classList.add("vo-visible"));
  }

  installStyles();
  installBrandBar();
  refreshCopy();
  decorateDynamicUi();
  revealFallback();

  const observer = new MutationObserver(() => requestAnimationFrame(decorateDynamicUi));
  observer.observe(app, { childList: true, subtree: true });

  window.addEventListener("fpl:account-auth-changed", () => requestAnimationFrame(decorateDynamicUi));
  window.addEventListener("fpl:challenge-completed", () => requestAnimationFrame(decorateDynamicUi));
})();
