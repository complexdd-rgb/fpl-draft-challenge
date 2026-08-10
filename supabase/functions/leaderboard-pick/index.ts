import { adminClient, bodyJson, errorResponse, httpError, json, loadVerifier, preflight, requireBrowserKey, text } from "../_shared/backend.ts";

Deno.serve(async (req) => {
  const options = preflight(req); if (options) return options;
  try {
    requireBrowserKey(req);
    const body = await bodyJson(req);
    const attemptId = text(body.attemptId, 80), challengeId = text(body.challengeId, 100), clientId = text(body.clientId, 120);
    const promptId = text(body.promptId, 160), playerId = text(body.playerId, 160), season = text(body.season, 20);
    if (!attemptId || !challengeId || !clientId || !promptId || !playerId || !season) throw httpError(400, "Incomplete pick attempt.");

    const supabase = adminClient();
    const verifier = await loadVerifier(supabase, challengeId);
    const { data: attempt, error } = await supabase
      .from("leaderboard_attempts")
      .select("id, penalty_points, completed")
      .eq("id", attemptId).eq("challenge_id", challengeId).eq("client_id", clientId).maybeSingle();
    if (error) throw error;
    if (!attempt) throw httpError(404, "Leaderboard attempt was not found.");
    if (attempt.completed) throw httpError(409, "Leaderboard attempt is already completed.");

    const prompt = verifier.prompts.find(p => p.promptId === promptId);
    if (!prompt) throw httpError(400, "Unknown challenge prompt.");
    const valid = prompt.allowed.some(row => row.playerId === playerId && row.season === season);
    let penaltyPoints = Number(attempt.penalty_points) || 0;
    if (!valid) penaltyPoints += 10;

    const { error: updateError } = await supabase.from("leaderboard_attempts").update({ penalty_points: penaltyPoints, last_activity_at: new Date().toISOString() }).eq("id", attemptId);
    if (updateError) throw updateError;
    return json({ valid, penaltyPoints });
  } catch (error) { return errorResponse(error); }
});
