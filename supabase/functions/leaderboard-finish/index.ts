import { adminClient, bodyJson, errorResponse, getRankedRows, httpError, json, loadVerifier, preflight, publicRow, requireBrowserKey, resolveIdentity, text, validDisplayName } from "../_shared/backend.ts";

Deno.serve(async req => {
  const options = preflight(req); if (options) return options;
  try {
    requireBrowserKey(req);
    const body = await bodyJson(req);
    const attemptId = text(body.attemptId, 80), challengeId = text(body.challengeId, 100), clientId = text(body.clientId, 120);
    const completing = body.action === "complete";
    const displayName = validDisplayName(body.displayName);
    if (!attemptId || !challengeId || !clientId || (!completing && !displayName)) throw httpError(400, "Attempt, challenge, client and a valid display name are required.");
    const supabase = adminClient();
    const identity = await resolveIdentity(req, supabase, clientId);
    await loadVerifier(supabase, challengeId);
    if (completing) {
      const { data, error } = await supabase.rpc("complete_leaderboard_attempt", {
        p_attempt_id: attemptId, p_challenge_id: challengeId, p_client_ids: identity.memberClientIds,
        p_selections: Array.isArray(body.selections) ? body.selections : []
      });
      if (error) throw httpError(error.code === "P0002" ? 404 : error.code === "55000" ? 409 : error.code === "22023" ? 400 : 500, error.message || "Completion accounting failed.");
      return json({ completed: true, ...data });
    }
    const findExisting = () => supabase.from("leaderboard_entries").select("*").eq("challenge_id", challengeId).in("client_id", identity.memberClientIds).order("created_at", { ascending: true }).limit(1).maybeSingle();
    const existing = await findExisting();
    if (existing.error) throw existing.error;
    let entry = existing.data, alreadySubmitted = Boolean(entry);
    if (!entry) {
      const { data: attempt, error } = await supabase.from("leaderboard_attempts").select("completion_result").eq("id", attemptId).eq("challenge_id", challengeId).in("client_id", identity.memberClientIds).maybeSingle();
      if (error) throw error;
      if (!attempt) throw httpError(404, "Leaderboard attempt was not found for this device/account.");
      const result = attempt.completion_result;
      if (!result) throw httpError(409, "Sync your picks and Reveal the XI before submitting the result.");
      const inserted = await supabase.from("leaderboard_entries").insert({
        challenge_id: challengeId, client_id: identity.storageClientId, display_name: displayName,
        final_score: result.finalScore, efficiency: result.efficiency, elapsed_seconds: result.elapsedSeconds,
        penalty_points: result.penaltyPoints, player_points: result.playerPoints, perfect_score: result.perfectScore,
        perfect_prompt_picks: result.perfectPromptPicks, selections: result.selections
      }).select("*").single();
      if (inserted.error) {
        const raced = await findExisting();
        if (raced.error) throw raced.error;
        if (!raced.data) throw inserted.error;
        entry = raced.data; alreadySubmitted = true;
      } else entry = inserted.data;
    }
    const ranked = await getRankedRows(supabase, challengeId);
    const rank = ranked.findIndex(row => String(row.client_id) === String(entry.client_id)) + 1;
    return json({ ...publicRow(entry, rank || ranked.length, identity.memberClientIds, true), alreadySubmitted });
  } catch (error) { return errorResponse(error); }
});
