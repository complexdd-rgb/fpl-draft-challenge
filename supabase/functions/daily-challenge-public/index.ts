import { adminClient, ukReleaseDate } from "../_shared/backend.ts";

const JS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Content-Type": "application/javascript; charset=utf-8",
  "Cache-Control": "no-store, max-age=0",
  "Cross-Origin-Resource-Policy": "cross-origin"
};

function js(source: string, status = 200) {
  return new Response(source, { status, headers: JS_HEADERS });
}

function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function verifierRepairSource(payload: unknown) {
  const verifier = payload && typeof payload === "object" ? payload as Record<string, unknown> : null;
  const prompts = Array.isArray(verifier?.prompts) ? verifier.prompts : [];
  const allowed: Record<string, string[]> = {};

  for (const rawPrompt of prompts) {
    const prompt = rawPrompt && typeof rawPrompt === "object" ? rawPrompt as Record<string, unknown> : {};
    const promptId = String(prompt.promptId || "");
    if (!promptId) continue;
    const picks = Array.isArray(prompt.allowed) ? prompt.allowed : [];
    allowed[promptId] = picks.map(rawPick => {
      const pick = rawPick && typeof rawPick === "object" ? rawPick as Record<string, unknown> : {};
      const playerId = String(pick.playerId || "");
      const season = String(pick.season || "");
      return playerId && season ? `${playerId}\u0000${season}` : "";
    }).filter(Boolean);
  }

  if (!Object.keys(allowed).length) return "";

  return [
    "/* Runtime repair for published prompt tests that accidentally serialised a closure-backed safety wrapper. */",
    "(function(){",
    `const allowed=${JSON.stringify(allowed)};`,
    "const challenge=window.FPL_DAILY_CHALLENGE;",
    "if(!challenge||!Array.isArray(challenge.prompts))return;",
    "for(const prompt of challenge.prompts){",
    "const keys=allowed[String(prompt?.id||'')];",
    "if(!Array.isArray(keys))continue;",
    "const valid=new Set(keys);",
    "prompt.test=function verifierBackedPromptTest(record){return valid.has(String(record?.playerId||'')+'\\u0000'+String(record?.season||''));};",
    "}",
    "try{",
    "const runtime=window.FPL_CHALLENGE_RUNTIME||{};",
    "const store=(runtime.archiveMode===true?'fpl-v2-practice-':'fpl-v2-')+String(challenge.id||'');",
    "const repairKey=store+'-prompt-serialization-refund-v1';",
    "if(store&&!localStorage.getItem(repairKey)){",
    "const saved=JSON.parse(localStorage.getItem(store)||'{}');",
    "if(saved&&typeof saved==='object'&&!saved.completedRecord&&Number(saved.penalties)>0){saved.penalties=0;localStorage.setItem(store,JSON.stringify(saved));}",
    "localStorage.setItem(repairKey,'1');",
    "}",
    "}catch(_){ }",
    "})();"
  ].join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: JS_HEADERS });
  if (req.method !== "GET") return js("window.FPL_SUPABASE_CHALLENGE_LOADED=false;\n", 405);

  try {
    const url = new URL(req.url);
    const requestedDate = String(url.searchParams.get("date") || "");
    const officialDate = ukReleaseDate();
    const archiveRequest = url.searchParams.get("archive") === "1";
    if (!validDate(requestedDate) || !validDate(officialDate)) {
      return js("window.FPL_SUPABASE_CHALLENGE_LOADED=false;\n");
    }
    if (requestedDate > officialDate) {
      return js("window.FPL_SUPABASE_CHALLENGE_LOADED=false;\n", 404);
    }

    const supabase = adminClient();
    let selectedQuery = supabase
      .from("daily_challenge_schedule")
      .select("release_date, challenge_id, source_js")
      .eq("active", true)
      .lte("release_date", officialDate);

    selectedQuery = archiveRequest
      ? selectedQuery.eq("release_date", requestedDate)
      : selectedQuery.lte("release_date", requestedDate).order("release_date", { ascending: false }).limit(1);

    const { data: selectedRows, error: selectedError } = await selectedQuery;
    if (selectedError) throw selectedError;
    const selected = Array.isArray(selectedRows) ? selectedRows[0] : null;

    // A GitHub-backed challenge can still have its next day scheduled only in Supabase.
    // Publish that upcoming date into the shared runtime without claiming that Supabase
    // supplied today's challenge. Preserve an earlier local-manifest date when one exists.
    if (!selected?.source_js) {
      if (archiveRequest) return js("window.FPL_SUPABASE_CHALLENGE_LOADED=false;\n");

      const { data: upcomingRows, error: upcomingError } = await supabase
        .from("daily_challenge_schedule")
        .select("release_date")
        .eq("active", true)
        .gt("release_date", requestedDate)
        .order("release_date", { ascending: true })
        .limit(1);
      if (upcomingError) throw upcomingError;

      const upcomingDate = Array.isArray(upcomingRows) && upcomingRows[0]?.release_date
        ? String(upcomingRows[0].release_date)
        : "";
      if (!upcomingDate) return js("window.FPL_SUPABASE_CHALLENGE_LOADED=false;\n");

      return js([
        "window.FPL_SUPABASE_CHALLENGE_LOADED=false;",
        "(function(){",
        `const next=${JSON.stringify(upcomingDate)};`,
        "const runtime=window.FPL_CHALLENGE_RUNTIME||{};",
        "const current=String(runtime.nextScheduledDate||'');",
        "if(!current||next<current){window.FPL_CHALLENGE_RUNTIME=Object.assign({},runtime,{nextScheduledDate:next,nextScheduledPath:'supabase:'+next});}",
        "})();"
      ].join("\n") + "\n");
    }

    const selectedDate = String(selected.release_date || "");
    const { data: futureRows, error: futureError } = await supabase
      .from("daily_challenge_schedule")
      .select("release_date")
      .eq("active", true)
      .gt("release_date", selectedDate)
      .order("release_date", { ascending: true })
      .limit(1);
    if (futureError) throw futureError;

    const nextScheduledDate = Array.isArray(futureRows) && futureRows[0]?.release_date
      ? String(futureRows[0].release_date)
      : null;
    const exactMatch = selectedDate === requestedDate;
    const archiveMode = Boolean(archiveRequest && selectedDate < officialDate);
    const runtimePatch = {
      officialDate,
      requestedDate,
      selectedDate,
      selectedPath: `supabase:${selectedDate}`,
      selectedId: String(selected.challenge_id || ""),
      exactMatch,
      archiveMode,
      archiveRequest: archiveRequest ? requestedDate : null,
      selectionMode: archiveMode
        ? "supabase-archive-date"
        : exactMatch
          ? "supabase-exact-date"
          : "supabase-latest-published",
      nextScheduledDate,
      nextScheduledPath: nextScheduledDate ? `supabase:${nextScheduledDate}` : null,
      scheduleSource: "supabase"
    };

    let selectedSource = String(selected.source_js).replace(/^\uFEFF/, "");

    // The 23–29 August batch was generated while prompt tests were runtime-wrapped by the
    // missing-field guard. The wrapper closes over prompt/original/canEvaluatePrompt and is
    // therefore not standalone when serialised. Repair only those affected published rows
    // from the already-certified leaderboard verifier, keeping live validation identical to
    // the server's accepted player-season set.
    if (selectedSource.includes("function guardedPromptTest")) {
      const { data: verifierRow, error: verifierError } = await supabase
        .from("leaderboard_verifiers")
        .select("payload")
        .eq("challenge_id", String(selected.challenge_id || ""))
        .eq("active", true)
        .maybeSingle();
      if (verifierError) throw verifierError;
      const repair = verifierRepairSource(verifierRow?.payload);
      if (repair) selectedSource += `\n${repair}`;
    }

    return js([
      "window.FPL_SUPABASE_CHALLENGE_LOADED=true;",
      `window.FPL_CHALLENGE_RUNTIME=Object.assign({},window.FPL_CHALLENGE_RUNTIME||{},${JSON.stringify(runtimePatch)});`,
      selectedSource
    ].join("\n") + "\n");
  } catch (error) {
    console.error(error);
    return js("window.FPL_SUPABASE_CHALLENGE_LOADED=false;\n");
  }
});
