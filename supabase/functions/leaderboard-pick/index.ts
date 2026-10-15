import { adminClient, bodyJson, errorResponse, httpError, json, loadVerifier, preflight, requireBrowserKey, resolveIdentity, text } from "../_shared/backend.ts";

Deno.serve(async req => {
  const options = preflight(req); if (options) return options;
  try {
    requireBrowserKey(req);
    const body = await bodyJson(req);
    const attemptId = text(body.attemptId, 80), challengeId = text(body.challengeId, 100), clientId = text(body.clientId, 120);
    const promptId = text(body.promptId, 160), playerId = text(body.playerId, 160), season = text(body.season, 20), eventId = text(body.eventId, 100);
    const skipped = body.skipped === true;
    if (!attemptId || !challengeId || !clientId || !promptId || (skipped ? !!playerId || !!season : !playerId || !season)) throw httpError(400, "Incomplete pick attempt.");
    const supabase = adminClient();
    const identity = await resolveIdentity(req, supabase, clientId);
    await loadVerifier(supabase, challengeId);
    if (eventId.length < 8) throw httpError(409, "Refresh the game to use recoverable pick accounting.");
    const { data, error } = await supabase.rpc("record_leaderboard_pick", {
      p_attempt_id: attemptId, p_challenge_id: challengeId, p_client_ids: identity.memberClientIds,
      p_event_id: eventId, p_prompt_id: promptId, p_player_id: playerId, p_season: season, p_skipped: skipped
    });
    if (error) throw httpError(error.code === "P0002" ? 404 : error.code === "55000" ? 409 : error.code === "22023" ? 400 : 500, error.message || "Pick accounting failed.");
    return json(data);
  } catch (error) { return errorResponse(error); }
});
