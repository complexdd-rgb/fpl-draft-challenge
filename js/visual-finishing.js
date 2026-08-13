/* FPL Draft Challenge — visual overhaul v1.1 finishing pass.
   Branding metadata and narrow-mobile presentation only. */
(() => {
  "use strict";

  const THEME = "#0b2017";
  document.title = "FPL Draft Challenge";

  function ensureMeta(selector, attributes) {
    let node = document.head.querySelector(selector);
    if (!node) {
      node = document.createElement("meta");
      document.head.appendChild(node);
    }
    for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
    return node;
  }

  function ensureLink(rel, href, attributes = {}) {
    let node = [...document.head.querySelectorAll(`link[rel="${rel}"]`)]
      .find(link => link.dataset.fplBranding === "1");
    if (!node) {
      node = document.createElement("link");
      node.rel = rel;
      node.dataset.fplBranding = "1";
      document.head.appendChild(node);
    }
    node.href = new URL(href, document.baseURI).toString();
    for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
    return node;
  }

  ensureMeta('meta[name="theme-color"]', { name: "theme-color", content: THEME });
  ensureMeta('meta[name="apple-mobile-web-app-title"]', { name: "apple-mobile-web-app-title", content: "FPL Draft Challenge" });
  ensureMeta('meta[name="application-name"]', { name: "application-name", content: "FPL Draft Challenge" });

  ensureLink("icon", "icons/icon-192.svg", { type: "image/svg+xml", sizes: "192x192" });
  ensureLink("apple-touch-icon", "icons/icon-192.svg", { sizes: "192x192" });

  if (!document.getElementById("visualFinishingStyles")) {
    const style = document.createElement("style");
    style.id = "visualFinishingStyles";
    style.textContent = `
      @media(max-width:390px){
        .fpl-visual-overhaul-body .app{padding-left:10px!important;padding-right:10px!important}
        .fpl-visual-overhaul-body .vo-brandbar{align-items:flex-start;gap:8px;margin-bottom:9px;padding-left:2px;padding-right:2px}
        .fpl-visual-overhaul-body .vo-brandmark{width:38px;height:38px;flex-basis:38px;border-radius:11px}
        .fpl-visual-overhaul-body .vo-brandcopy strong{font-size:.83rem}
        .fpl-visual-overhaul-body .vo-brandcopy span{font-size:.58rem}
        .fpl-visual-overhaul-body .vo-brandmeta{gap:5px;justify-content:flex-start}
        .fpl-visual-overhaul-body .vo-brandmeta span{min-height:26px;padding:5px 7px;font-size:.51rem}
        .fpl-visual-overhaul-body .vo-brandmeta span:nth-child(n+3){display:none}

        .fpl-visual-overhaul-body .hero{padding:20px 15px 17px!important;border-radius:22px!important}
        .fpl-visual-overhaul-body .hero h1{font-size:clamp(1.85rem,10vw,2.5rem)!important;line-height:.98}
        .fpl-visual-overhaul-body .hero p{font-size:.8rem!important;line-height:1.5!important;margin-bottom:14px!important}
        .fpl-visual-overhaul-body .hero .status{gap:5px}
        .fpl-visual-overhaul-body .hero .pill{min-height:31px;padding:6px 8px;font-size:.6rem}
        .fpl-visual-overhaul-body .v4-meta{gap:5px;margin-top:12px}
        .fpl-visual-overhaul-body .v4-badge{min-height:28px;padding:5px 7px;font-size:.57rem}

        .fpl-visual-overhaul-body .challenge-overview{padding:15px!important;border-radius:18px!important;gap:14px!important}
        .fpl-visual-overhaul-body .overview-rules{gap:5px!important}
        .fpl-visual-overhaul-body .overview-rules div{padding:9px 4px!important}
        .fpl-visual-overhaul-body .overview-rules strong{font-size:.98rem!important}
        .fpl-visual-overhaul-body .overview-rules span{font-size:.53rem!important}

        .fpl-visual-overhaul-body .section-heading{margin-top:22px!important}
        .fpl-visual-overhaul-body .slot{padding:12px 11px!important;border-radius:15px!important}
        .fpl-visual-overhaul-body .slot-head{gap:7px!important}
        .fpl-visual-overhaul-body .pos{min-width:38px!important;padding:6px!important}
        .fpl-visual-overhaul-body .prompt{font-size:.75rem!important}
        .fpl-visual-overhaul-body .choice-row{grid-template-columns:minmax(0,1fr) 92px!important;gap:6px!important}
        .fpl-visual-overhaul-body .choice-row .confirm{grid-column:1/-1!important;width:100%}
        .fpl-visual-overhaul-body .player-search,.fpl-visual-overhaul-body .season-select{min-height:44px!important}
        .fpl-visual-overhaul-body .confirmed-summary{gap:7px!important}
        .fpl-visual-overhaul-body .compact-efficiency{min-width:88px!important}

        .fpl-visual-overhaul-body .draft-progress-dock{width:calc(100% - 4px)!important;border-radius:15px!important;padding:7px!important;bottom:70px!important}
        .fpl-visual-overhaul-body .dock-stat{padding:6px 7px!important}
        .fpl-visual-overhaul-body .dock-stat strong{font-size:.76rem!important}
        .fpl-visual-overhaul-body .dock-next{min-height:42px!important}

        .fpl-visual-overhaul-body .results{padding:14px!important;border-radius:20px!important}
        .fpl-visual-overhaul-body .results-v2-headline-stat{padding:11px!important;min-height:92px!important}
        .fpl-visual-overhaul-body .results-v2-headline-stat strong{font-size:1.45rem!important}
        .fpl-visual-overhaul-body .leaderboard-panel{padding:13px!important;border-radius:19px!important}
        .fpl-visual-overhaul-body .leaderboard-head{gap:9px}
        .fpl-visual-overhaul-body .leaderboard-state{padding:6px 8px;font-size:.5rem}
        .fpl-visual-overhaul-body .leaderboard-table th,.fpl-visual-overhaul-body .leaderboard-table td{padding:9px 6px!important;font-size:.68rem}
        .fpl-visual-overhaul-body .leaderboard-account-button{min-height:42px}

        .fpl-visual-overhaul-body .phase45-bottom-nav{left:7px!important;right:7px!important;bottom:7px!important;width:auto!important}
        .fpl-visual-overhaul-body .phase45-bottom-nav button{min-height:47px!important;padding-left:5px!important;padding-right:5px!important;font-size:.58rem!important}
      }
    `;
    document.head.appendChild(style);
  }
})();
