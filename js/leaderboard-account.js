/* FPL Draft Challenge — optional Supabase account UI for cross-device leaderboard identity. */
(() => {
  "use strict";
  const cfg = window.FPL_LEADERBOARD_CONFIG;
  const authBridge = window.FPL_ACCOUNT_AUTH;
  const runtime = window.FPL_CHALLENGE_RUNTIME || {};
  const CLIENT_KEY = "fpl-v5-leaderboard-client-id";
  if (!cfg?.accounts?.enabled || !authBridge || runtime.archiveMode) {
    authBridge?._markReady?.();
    return;
  }

  let supabase = null;
  let session = null;
  let message = "";
  let messageType = "info";

  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const validEmail = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
  const rotateGuestId = () => {
    const id = crypto.randomUUID ? crypto.randomUUID() : `client-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(CLIENT_KEY, id);
  };

  function addStyles() {
    if (document.getElementById("leaderboardAccountStyles")) return;
    const style = document.createElement("style");
    style.id = "leaderboardAccountStyles";
    style.textContent = `
      .leaderboard-account{margin:10px 0 2px;padding:11px 12px;border-radius:15px;border:1px solid rgba(95,229,255,.16);background:rgba(95,229,255,.045);display:flex;align-items:center;justify-content:space-between;gap:12px}
      .leaderboard-account-copy{min-width:0}.leaderboard-account-copy strong,.leaderboard-account-copy span{display:block}.leaderboard-account-copy strong{font-size:.72rem;color:#fff}.leaderboard-account-copy span{margin-top:2px;color:var(--muted);font-size:.63rem;line-height:1.4;overflow:hidden;text-overflow:ellipsis}
      .leaderboard-account-button{flex:0 0 auto;border:1px solid rgba(0,255,135,.22);border-radius:10px;background:rgba(0,255,135,.08);color:var(--accent);padding:8px 11px;font:inherit;font-size:.65rem;font-weight:950;cursor:pointer}.leaderboard-account-button.secondary{border-color:rgba(255,255,255,.11);background:rgba(255,255,255,.04);color:#e8f2ec}
      .leaderboard-account-dialog{border:1px solid rgba(255,255,255,.13);border-radius:22px;background:#091c14;color:#fff;width:min(92vw,430px);padding:0;box-shadow:0 28px 80px rgba(0,0,0,.55)}.leaderboard-account-dialog::backdrop{background:rgba(0,0,0,.68);backdrop-filter:blur(4px)}
      .leaderboard-account-dialog-inner{padding:20px}.leaderboard-account-dialog-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.leaderboard-account-dialog h3{margin:3px 0 5px}.leaderboard-account-dialog p{margin:0;color:var(--muted);font-size:.72rem;line-height:1.5}.leaderboard-account-close{border:0;background:transparent;color:#fff;font-size:1.3rem;cursor:pointer;padding:3px 6px}
      .leaderboard-account-form{margin-top:16px}.leaderboard-account-form label{display:block;margin-bottom:6px;font-size:.66rem;font-weight:900;color:#dcece3}.leaderboard-account-form input{width:100%;box-sizing:border-box}.leaderboard-account-actions{display:flex;gap:8px;margin-top:11px}.leaderboard-account-actions .btn{flex:1}.leaderboard-account-message{margin-top:11px;padding:9px 10px;border-radius:11px;font-size:.67rem;line-height:1.45}.leaderboard-account-message.info{background:rgba(95,229,255,.06);border:1px solid rgba(95,229,255,.15);color:#c9f5ff}.leaderboard-account-message.error{background:rgba(255,85,119,.07);border:1px solid rgba(255,85,119,.2);color:#ffc0ce}.leaderboard-account-message:empty{display:none}
      @media(max-width:520px){.leaderboard-account{align-items:flex-start;flex-direction:column}.leaderboard-account-button{width:100%}}
    `;
    document.head.appendChild(style);
  }

  function refreshLeaderboards() {
    setTimeout(() => {
      window.FPL_LEADERBOARD_REFRESH?.();
      document.getElementById("leaderboardAllTimeRefresh")?.click();
      window.dispatchEvent(new CustomEvent("fpl:account-auth-changed", { detail: { signedIn: Boolean(session), email: session?.user?.email || "" } }));
    }, 50);
  }

  function ensureDialog() {
    let dialog = document.getElementById("leaderboardAccountDialog");
    if (dialog) return dialog;
    dialog = document.createElement("dialog");
    dialog.id = "leaderboardAccountDialog";
    dialog.className = "leaderboard-account-dialog";
    dialog.innerHTML = `<div class="leaderboard-account-dialog-inner">
      <div class="leaderboard-account-dialog-head"><div><span class="overview-kicker">Optional account</span><h3>Sync your leaderboard record</h3><p>Use a passwordless email link so your verified record can follow you between desktop and mobile. You can always keep playing as a guest.</p></div><button class="leaderboard-account-close" type="button" aria-label="Close">×</button></div>
      <form class="leaderboard-account-form" id="leaderboardAccountForm"><label for="leaderboardAccountEmail">Email address</label><input id="leaderboardAccountEmail" type="email" autocomplete="email" placeholder="you@example.com" required><div class="leaderboard-account-actions"><button class="btn primary" id="leaderboardAccountSend" type="submit">Email me a sign-in link</button></div></form>
      <div class="leaderboard-account-message ${messageType}" id="leaderboardAccountMessage">${esc(message)}</div>
    </div>`;
    document.body.appendChild(dialog);
    dialog.querySelector(".leaderboard-account-close")?.addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close(); });
    dialog.querySelector("#leaderboardAccountForm")?.addEventListener("submit", sendMagicLink);
    return dialog;
  }

  function renderAccountControl() {
    addStyles();
    const panel = document.getElementById("liveLeaderboardPanel");
    if (!panel) return false;
    let host = document.getElementById("leaderboardAccount");
    if (!host) {
      host = document.createElement("div");
      host.id = "leaderboardAccount";
      host.className = "leaderboard-account";
      const tabs = document.getElementById("leaderboardTabs");
      if (tabs) tabs.insertAdjacentElement("afterend", host);
      else panel.querySelector(".leaderboard-head")?.insertAdjacentElement("afterend", host);
    }
    if (session?.user) {
      const email = session.user.email || "Signed-in account";
      host.innerHTML = `<div class="leaderboard-account-copy"><strong>Record syncing is on</strong><span>${esc(email)} · this account will be used across signed-in devices.</span></div><button class="leaderboard-account-button secondary" id="leaderboardAccountSignOut" type="button">Sign out</button>`;
      host.querySelector("#leaderboardAccountSignOut")?.addEventListener("click", signOut);
    } else {
      host.innerHTML = `<div class="leaderboard-account-copy"><strong>Playing as a guest</strong><span>Optional: sign in to carry your verified leaderboard and All-Time record between devices.</span></div><button class="leaderboard-account-button" id="leaderboardAccountSignIn" type="button">Sign in to sync</button>`;
      host.querySelector("#leaderboardAccountSignIn")?.addEventListener("click", () => ensureDialog().showModal());
    }
    return true;
  }

  function setDialogMessage(text, type = "info") {
    message = text || "";
    messageType = type;
    const el = document.getElementById("leaderboardAccountMessage");
    if (el) { el.textContent = message; el.className = `leaderboard-account-message ${type}`; }
  }

  async function sendMagicLink(event) {
    event.preventDefault();
    const emailInput = document.getElementById("leaderboardAccountEmail");
    const button = document.getElementById("leaderboardAccountSend");
    const email = String(emailInput?.value || "").trim();
    if (!validEmail(email)) { setDialogMessage("Enter a valid email address.", "error"); return; }
    if (!supabase) { setDialogMessage("Account sign-in is still loading. Try again in a moment.", "error"); return; }
    if (button) { button.disabled = true; button.textContent = "Sending…"; }
    try {
      const redirectTo = cfg.accounts.redirectUrl || `${location.origin}${location.pathname}`;
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo, shouldCreateUser: true }
      });
      if (error) throw error;
      setDialogMessage("Sign-in link sent. Open the email on the device you want to use; the site will sign you in automatically.", "info");
    } catch (error) {
      setDialogMessage(error?.message || "The sign-in email could not be sent.", "error");
    } finally {
      if (button) { button.disabled = false; button.textContent = "Email me a sign-in link"; }
    }
  }

  async function signOut() {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) {
      message = error.message || "Sign out failed.";
      messageType = "error";
      return;
    }
    // A guest/browser id is permanently linked once it has contributed history to an
    // account. Rotate it on sign-out so a later different account cannot claim that history.
    rotateGuestId();
  }

  async function initialise() {
    try {
      const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
      supabase = createClient(cfg.supabaseUrl, cfg.publishableKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      });
      authBridge.client = supabase;
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      session = data?.session || null;
      authBridge._setSession?.(session);
      authBridge._markReady?.();
      renderAccountControl();

      supabase.auth.onAuthStateChange((_event, nextSession) => {
        session = nextSession || null;
        authBridge._setSession?.(session);
        renderAccountControl();
        refreshLeaderboards();
      });
    } catch (error) {
      console.error("Account sign-in failed to initialise", error);
      authBridge._setSession?.(null);
      authBridge._markReady?.();
      message = "Account sign-in is temporarily unavailable. Guest play is unaffected.";
      messageType = "error";
      renderAccountControl();
    }
  }

  if (!renderAccountControl()) {
    const observer = new MutationObserver(() => { if (renderAccountControl()) observer.disconnect(); });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }
  initialise();
})();
