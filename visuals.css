/* FPL Daily Challenge 4.0 — visual override */
:root{
  --bg:#07140f;
  --panel:#10241c;
  --panel-2:#153126;
  --line:rgba(255,255,255,.12);
  --text:#f7fff9;
  --muted:#adc4b7;
  --accent:#00ff87;
  --accent-2:#04d9ff;
  --danger:#ff5577;
  --gold:#ffd166;
  --shadow:0 18px 50px rgba(0,0,0,.32);
}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{
  min-height:100vh;
  background:
    radial-gradient(circle at 10% 0%,rgba(0,255,135,.12),transparent 28rem),
    radial-gradient(circle at 100% 15%,rgba(4,217,255,.10),transparent 30rem),
    linear-gradient(180deg,#07140f 0%,#06100c 100%);
}
body::before{
  content:"";
  position:fixed;
  inset:0;
  pointer-events:none;
  opacity:.20;
  background-image:linear-gradient(rgba(255,255,255,.018) 1px,transparent 1px),
                   linear-gradient(90deg,rgba(255,255,255,.018) 1px,transparent 1px);
  background-size:28px 28px;
}
.app{max-width:1040px;padding:18px 14px 110px}
.hero{
  position:relative;
  overflow:hidden;
  padding:24px 20px 20px;
  border:1px solid rgba(255,255,255,.14);
  border-radius:26px;
  background:
    linear-gradient(135deg,rgba(0,255,135,.12),transparent 48%),
    linear-gradient(160deg,#173a2a,#0c2018);
  box-shadow:var(--shadow);
}
.hero::after{
  content:"";
  position:absolute;
  width:210px;height:210px;
  border:34px solid rgba(255,255,255,.035);
  border-radius:50%;
  right:-78px;top:-80px;
}
.eyebrow{
  color:var(--accent);
  font-weight:900;
  letter-spacing:.12em;
  text-transform:uppercase;
}
.hero h1{
  max-width:780px;
  margin:8px 0 9px;
  font-size:clamp(1.65rem,5vw,3.15rem);
  line-height:1.02;
  letter-spacing:-.045em;
}
.hero p{max-width:790px;color:#d0e1d7;line-height:1.58}
.v4-meta{
  display:flex;
  flex-wrap:wrap;
  align-items:center;
  gap:8px;
  margin:16px 0 4px;
}
.v4-badge{
  display:inline-flex;
  align-items:center;
  min-height:34px;
  padding:7px 11px;
  border-radius:999px;
  background:rgba(0,0,0,.22);
  border:1px solid rgba(255,255,255,.13);
  color:#eafff2;
  font-size:.8rem;
  font-weight:900;
}
.v4-badge.difficulty{color:#07140f;background:linear-gradient(135deg,var(--accent),#b6ff4a)}
.v4-badge.countdown{color:var(--accent-2)}
.v4-progress-shell{
  height:10px;
  margin:12px 0 4px;
  overflow:hidden;
  border:1px solid rgba(255,255,255,.12);
  border-radius:999px;
  background:rgba(0,0,0,.28);
}
.v4-progress-bar{
  width:0;height:100%;
  border-radius:inherit;
  background:linear-gradient(90deg,var(--accent),var(--accent-2));
  box-shadow:0 0 18px rgba(0,255,135,.45);
  transition:width .45s cubic-bezier(.2,.8,.2,1);
}
.status{position:relative;z-index:1;gap:8px}
.pill{
  background:rgba(0,0,0,.24);
  border:1px solid rgba(255,255,255,.11);
  color:#e6f7ec;
  backdrop-filter:blur(8px);
}
.grid{gap:12px;margin-top:16px}
.slot{
  position:relative;
  overflow:visible;
  border:1px solid var(--line);
  border-radius:18px;
  background:linear-gradient(145deg,rgba(24,55,42,.98),rgba(12,31,23,.98));
  box-shadow:0 10px 26px rgba(0,0,0,.18);
  transition:transform .2s ease,border-color .2s ease,box-shadow .2s ease;
}
.slot:hover{transform:translateY(-2px);border-color:rgba(255,255,255,.22)}
.slot.valid{
  border-color:rgba(0,255,135,.62);
  box-shadow:0 0 0 1px rgba(0,255,135,.11),0 14px 30px rgba(0,0,0,.22);
}
.slot.valid::after{
  content:"✓";
  position:absolute;
  right:12px;top:12px;
  display:grid;place-items:center;
  width:26px;height:26px;
  border-radius:50%;
  background:var(--accent);
  color:#062015;
  font-weight:1000;
}
.slot-head{padding-right:34px}
.pos{
  min-width:48px;
  border-radius:11px;
  color:white;
  box-shadow:inset 0 1px rgba(255,255,255,.25);
}
.slot[data-position="GK"] .pos{background:linear-gradient(135deg,#14b86d,#087b4b)}
.slot[data-position="DEF"] .pos{background:linear-gradient(135deg,#2f8cff,#1553b9)}
.slot[data-position="MID"] .pos{background:linear-gradient(135deg,#a65cff,#6530b7)}
.slot[data-position="FWD"] .pos{background:linear-gradient(135deg,#ff5d73,#b92744)}
.prompt{line-height:1.35}
.player-search,.season-select{
  background:#081a12;
  border:1px solid rgba(255,255,255,.14);
  color:var(--text);
  min-height:46px;
}
.player-search:focus,.season-select:focus{
  outline:none;
  border-color:var(--accent);
  box-shadow:0 0 0 3px rgba(0,255,135,.12);
}
.suggestions{
  z-index:100;
  background:#0d2118;
  border:1px solid rgba(255,255,255,.16);
  box-shadow:0 18px 44px rgba(0,0,0,.46);
}
.suggestion:hover,.suggestion.active{background:#183d2c}
.confirm,.btn.primary{
  color:#06170f;
  background:linear-gradient(135deg,var(--accent),#b4ff4d);
  box-shadow:0 8px 22px rgba(0,255,135,.18);
}
.confirm:disabled,.btn:disabled{opacity:.45;box-shadow:none}
.btn.secondary{background:#142a20;border-color:rgba(255,255,255,.14)}
.actions{
  position:sticky;
  bottom:0;
  z-index:50;
  margin:18px -6px 0;
  padding:12px 6px calc(12px + env(safe-area-inset-bottom));
  background:linear-gradient(180deg,transparent,rgba(6,16,12,.92) 25%);
  backdrop-filter:blur(8px);
}
.results{
  margin-top:22px;
  padding:18px;
  border:1px solid rgba(255,255,255,.12);
  border-radius:24px;
  background:linear-gradient(160deg,#122b20,#0a1c14);
  box-shadow:var(--shadow);
}
.results h2{letter-spacing:-.025em}
.pitch{
  position:relative;
  overflow:hidden;
  border:3px solid rgba(255,255,255,.75);
  border-radius:22px;
  background:
    linear-gradient(90deg,rgba(255,255,255,.035) 50%,transparent 50%) 0 0/25% 100%,
    linear-gradient(180deg,#16733d,#0e5a31);
  box-shadow:inset 0 0 55px rgba(0,0,0,.22),0 16px 36px rgba(0,0,0,.24);
}
.pitch::before{
  content:"";
  position:absolute;
  left:50%;top:0;bottom:0;
  width:2px;
  background:rgba(255,255,255,.66);
  transform:translateX(-50%);
}
.pitch::after{
  content:"";
  position:absolute;
  left:50%;top:50%;
  width:112px;height:112px;
  border:2px solid rgba(255,255,255,.7);
  border-radius:50%;
  transform:translate(-50%,-50%);
}
.pitch .line{position:relative;z-index:2}
.shirt{animation:v4CardIn .55s both}
.shirt-icon{
  filter:drop-shadow(0 8px 8px rgba(0,0,0,.3));
  transition:transform .2s ease;
}
.shirt:hover .shirt-icon{transform:translateY(-4px) scale(1.04)}
.score-card{grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;background:transparent;border:0;padding:0}
.score-card div{
  border:1px solid rgba(255,255,255,.09);
  background:linear-gradient(145deg,#163326,#0b2117);
  min-height:84px;
  display:flex;
  flex-direction:column;
  justify-content:center;
}
.score-card strong{color:var(--accent);font-size:1.45rem}
.review{background:#10261c;border-color:rgba(255,255,255,.1)}
.review[open]{border-color:rgba(0,255,135,.35)}
.review summary{list-style:none}
.review summary::-webkit-details-marker{display:none}
.review summary::after{content:"＋";float:right;color:var(--accent)}
.review[open] summary::after{content:"−"}
@keyframes v4CardIn{
  from{opacity:0;transform:translateY(16px) scale(.96)}
  to{opacity:1;transform:none}
}
@media(max-width:700px){
  .app{padding-left:10px;padding-right:10px}
  .hero{padding:20px 15px 17px;border-radius:21px}
  .hero p{font-size:.9rem}
  .status{display:grid;grid-template-columns:1fr 1fr}
  .pill{text-align:center;justify-content:center}
  .grid{gap:10px}
  .slot{border-radius:15px;padding:13px}
  .choice-row{grid-template-columns:minmax(0,1fr) 104px}
  .confirm{grid-column:1/-1;min-height:44px}
  .score-card{grid-template-columns:1fr 1fr}
  .pitch{min-height:535px}
}
@media(prefers-reduced-motion:reduce){
  *{scroll-behavior:auto!important;animation:none!important;transition:none!important}
}
