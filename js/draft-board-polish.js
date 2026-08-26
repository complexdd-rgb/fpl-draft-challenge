/* FPL Draft Challenge — draft-board visual finishing + autocomplete/error layering fix. */
(() => {
  "use strict";
  if (document.getElementById("draftBoardPolishStyles")) return;

  const style = document.createElement("style");
  style.id = "draftBoardPolishStyles";
  style.textContent = `
    /* Draft-board heading: keep the explanation attached to the heading rather than floating away. */
    body.fpl-visual-overhaul-body .section-heading{
      display:block!important;
      margin:25px 2px 10px!important;
      max-width:760px;
    }
    body.fpl-visual-overhaul-body .section-heading h2{
      margin:4px 0 3px!important;
      font-size:clamp(1.25rem,2.7vw,1.65rem)!important;
    }
    body.fpl-visual-overhaul-body .section-heading p{
      margin:0!important;
      max-width:560px;
      text-align:left!important;
      color:#91aa9c!important;
      font-size:.68rem!important;
      line-height:1.45!important;
    }

    /* Open cards: clearer clue -> player -> season -> action hierarchy. */
    body.fpl-visual-overhaul-body #grid{gap:11px!important}
    body.fpl-visual-overhaul-body #grid .slot:not(.compact-confirmed){
      padding:14px 14px 12px!important;
    }
    body.fpl-visual-overhaul-body #grid .slot-head{
      align-items:flex-start!important;
      padding-right:22px!important;
    }
    body.fpl-visual-overhaul-body #grid .prompt{
      color:#f4fbf7!important;
      font-size:.78rem!important;
      font-weight:820!important;
      line-height:1.38!important;
    }
    body.fpl-visual-overhaul-body #grid .pos{
      min-width:38px!important;
      padding:6px 7px!important;
      font-size:.61rem!important;
    }
    body.fpl-visual-overhaul-body #grid .choice-row{
      display:grid!important;
      grid-template-columns:minmax(0,1fr) 112px 88px!important;
      gap:7px!important;
      align-items:stretch!important;
      margin-top:11px!important;
    }
    body.fpl-visual-overhaul-body #grid .search-wrap{min-width:0;position:relative;isolation:isolate}
    body.fpl-visual-overhaul-body #grid .player-search,
    body.fpl-visual-overhaul-body #grid .season-select,
    body.fpl-visual-overhaul-body #grid .confirm{
      width:100%!important;
      min-height:40px!important;
      box-sizing:border-box!important;
    }
    body.fpl-visual-overhaul-body #grid .player-search{font-weight:750}
    body.fpl-visual-overhaul-body #grid .season-select{font-size:.7rem!important;font-weight:750}
    body.fpl-visual-overhaul-body #grid .confirm{padding:8px 9px!important;font-size:.67rem!important;font-weight:950!important}

    /* Selected-but-unconfirmed information should read as secondary context. */
    body.fpl-visual-overhaul-body #grid .selected-meta{
      display:inline-flex!important;
      align-items:center;
      max-width:100%;
      margin-top:8px!important;
      padding:5px 8px!important;
      border:1px solid rgba(255,255,255,.07);
      border-radius:999px;
      background:rgba(255,255,255,.025);
      color:#91aa9c!important;
      font-size:.59rem!important;
      line-height:1.25!important;
      white-space:nowrap;
      overflow:hidden;
      text-overflow:ellipsis;
    }
    body.fpl-visual-overhaul-body #grid .feedback{
      position:relative;
      z-index:1;
      min-height:0!important;
      margin-top:7px!important;
      padding:0!important;
      color:#91aa9c!important;
      font-size:.61rem!important;
      line-height:1.35!important;
    }
    body.fpl-visual-overhaul-body #grid .feedback:empty{display:none!important}
    body.fpl-visual-overhaul-body #grid .feedback.bad{
      padding:7px 9px!important;
      border:1px solid rgba(255,93,124,.22);
      border-radius:10px;
      background:rgba(255,75,110,.07);
      color:#ffb6c6!important;
    }
    body.fpl-visual-overhaul-body #grid .feedback.good{
      color:#77eeb1!important;
    }
    body.fpl-visual-overhaul-body #grid .clear:not(.compact-change){
      margin-top:7px!important;
      padding:0!important;
      border:0!important;
      background:none!important;
      color:#7f9b8c!important;
      font-size:.58rem!important;
      font-weight:800!important;
      text-decoration:underline;
      text-underline-offset:2px;
      cursor:pointer;
    }

    /* Confirmed cards: make the player the visual anchor; stats stay useful but secondary. */
    body.fpl-visual-overhaul-body #grid .compact-confirmed{
      padding:13px 14px 11px!important;
    }
    body.fpl-visual-overhaul-body #grid .compact-confirmed .confirmed-summary{
      grid-template-columns:minmax(0,1fr) auto auto!important;
      gap:9px!important;
      align-items:center!important;
      margin-top:10px!important;
    }
    body.fpl-visual-overhaul-body #grid .confirmed-player{min-width:0}
    body.fpl-visual-overhaul-body #grid .confirmed-player strong{
      display:block;
      color:#fff!important;
      font-size:.78rem!important;
      line-height:1.25!important;
      white-space:nowrap;
      overflow:hidden;
      text-overflow:ellipsis;
    }
    body.fpl-visual-overhaul-body #grid .confirmed-player span{
      display:block;
      margin-top:3px;
      color:#89a596!important;
      font-size:.57rem!important;
      white-space:nowrap;
      overflow:hidden;
      text-overflow:ellipsis;
    }
    body.fpl-visual-overhaul-body #grid .compact-efficiency{
      min-width:70px;
      text-align:right;
    }
    body.fpl-visual-overhaul-body #grid .compact-change{
      min-height:34px!important;
      padding:7px 9px!important;
      font-size:.59rem!important;
      white-space:nowrap;
    }

    /*
     * Critical layering fix: an old wrong-answer/error message must never sit over player names.
     * When autocomplete is open, the menu becomes the top visual layer and the feedback/meta rows
     * beneath it are visually suppressed until the menu closes.
     */
    body.fpl-visual-overhaul-body .slot:has(.suggestions:not(.hidden)){
      z-index:2147483000!important;
      overflow:visible!important;
    }
    body.fpl-visual-overhaul-body .slot:has(.suggestions:not(.hidden)) .search-wrap{
      z-index:2147483001!important;
      overflow:visible!important;
    }
    body.fpl-visual-overhaul-body .slot:has(.suggestions:not(.hidden)) .feedback,
    body.fpl-visual-overhaul-body .slot:has(.suggestions:not(.hidden)) .selected-meta,
    body.fpl-visual-overhaul-body .slot:has(.suggestions:not(.hidden)) .clear:not(.compact-change){
      visibility:hidden!important;
      pointer-events:none!important;
    }
    body.fpl-visual-overhaul-body #grid .suggestions{
      position:absolute!important;
      top:calc(100% + 6px)!important;
      left:0!important;
      right:auto!important;
      width:max(100%,320px)!important;
      max-width:min(430px,calc(100vw - 38px))!important;
      z-index:2147483002!important;
      border-radius:13px!important;
      background:#071a11!important;
      opacity:1!important;
      box-shadow:0 24px 60px rgba(0,0,0,.88),0 0 0 1px rgba(0,255,135,.08)!important;
    }
    body.fpl-visual-overhaul-body #grid .suggestion{
      display:block!important;
      width:100%!important;
      min-width:0!important;
      padding:10px 11px!important;
      text-align:left!important;
      background:#071a11!important;
    }
    body.fpl-visual-overhaul-body #grid .suggestion strong{
      display:block;
      color:#f8fffa!important;
      font-size:.72rem!important;
      line-height:1.25!important;
    }
    body.fpl-visual-overhaul-body #grid .suggestion small{
      display:block;
      margin-top:3px;
      color:#8eaa9a!important;
      font-size:.57rem!important;
      line-height:1.25!important;
      white-space:normal!important;
    }

    @media(max-width:700px){
      body.fpl-visual-overhaul-body #grid{gap:9px!important}
      body.fpl-visual-overhaul-body #grid .slot:not(.compact-confirmed){padding:13px 12px 11px!important}
      body.fpl-visual-overhaul-body #grid .choice-row{
        grid-template-columns:minmax(0,1fr) 104px!important;
      }
      body.fpl-visual-overhaul-body #grid .confirm{grid-column:1/-1!important}
      body.fpl-visual-overhaul-body #grid .suggestions{
        width:100%!important;
        max-width:100%!important;
      }
      body.fpl-visual-overhaul-body #grid .compact-confirmed .confirmed-summary{
        grid-template-columns:minmax(0,1fr) auto!important;
      }
      body.fpl-visual-overhaul-body #grid .compact-confirmed .compact-change{
        grid-column:1/-1;
        width:100%;
      }
    }

    @media(max-width:430px){
      body.fpl-visual-overhaul-body #grid .choice-row{grid-template-columns:minmax(0,1fr) 96px!important}
      body.fpl-visual-overhaul-body #grid .prompt{font-size:.75rem!important}
      body.fpl-visual-overhaul-body #grid .confirmed-player strong{font-size:.75rem!important}
      body.fpl-visual-overhaul-body #grid .compact-efficiency{min-width:64px}
    }
  `;
  document.head.appendChild(style);
})();
