import { adminClient, bodyJson, errorResponse, getRankedRows, httpError, json, loadVerifier, preflight, publicRow, requireBrowserKey, text, validDisplayName } from "../_shared/backend.ts";

Deno.serve(async (req) => {
  const options = preflight(req); if (options) return options;
  try {
    requireBrowserKey(req);
    const body = await bodyJson(req);
    const attemptId = text(body.attemptId, 80), challengeId = text(body.challengeId, 100), clientId = text(body.clientId, 120);
    const displayName = validDisplayName(body.displayName);
    const selections = Array.isArray(body.selections) ? body.selections : [];
    if (!attemptId || !challengeId || !clientId || !displayName) throw httpError(400, "Attempt, challenge, client and a valid display name are required.");

    const supabase = adminClient();
    const verifier = await loadVerifier(supabase, challengeId);

    const { data: existingEntry, error: existingError } = await supabase
      .from("leaderboard_entries").select("*").eq("challenge_id", challengeId).eq("client_id", clientId).maybeSingle();
    if (existingError) throw existingError;
    if (existingEntry) {
      const ranked = await getRankedRows(supabase, challengeId);
      const rank = ranked.findIndex(row => String(row.client_id) === clientId) + 1;
      return json({ ...publicRow(existingEntry, rank || 1, clientId), alreadySubmitted: true });
    }

    const { data: attempt, error: attemptError } = await supabase
      .from("leaderboard_attempts").select("id, started_at, penalty_points, completed").eq("id", attemptId).eq("challenge_id", challengeId).eq("client_id", clientId).maybeSingle();
    if (attemptError) throw attemptError;
    if (!attempt) throw httpError(404, "Leaderboard attempt was not found.");

    if (selections.length !== verifier.prompts.length) throw httpError(400, `Exactly ${verifier.prompts.length} selections are required.`);
    const byPrompt = new Map<string, { promptId: string; playerId: string; season: string }>();
    for (const raw of selections) {
      const item = { promptId: text(raw?.promptId, 160), playerId: text(raw?.playerId, 160), season: text(raw?.season, 20) };
      if (!item.promptId || !item.playerId || !item.season || byPrompt.has(item.promptId)) throw httpError(400, "Selections contain a missing or duplicate prompt.");
      byPrompt.set(item.promptId, item);
    }
    const usedPlayers = new Set<string>();
    let playerPoints = 0, perfectPromptPicks = 0;
    for (const prompt of verifier.prompts) {
      const selection = byPrompt.get(prompt.promptId);
      if (!selection) throw httpError(400, `Missing selection for ${prompt.promptId}.`);
      if (usedPlayers.has(selection.playerId)) throw httpError(400, "The same footballer cannot be used twice.");
      usedPlayers.add(selection.playerId);
      const allowed = prompt.allowed.find(row => row.playerId === selection.playerId && row.season === selection.season);
      if (!allowed) throw httpError(400, `Selection for ${prompt.promptId} does not satisfy the verified prompt.`);
      const points = Number(allowed.points) || 0;
      playerPoints += points;
      if (points === Number(prompt.bestPoints || 0)) perfectPromptPicks += 1;
    }

    const penaltyPoints = Number(attempt.penalty_points) || 0;
    const perfectScore = Number(verifier.perfectScore) || 0;
    const finalScore = playerPoints - penaltyPoints;
    const efficiency = perfectScore > 0 ? finalScore / perfectScore * 100 : 0;
    const elapsedSeconds = Math.max(0, Math.floor((Date.now() - new Date(attempt.started_at).getTime()) / 1000));

    const { data: inserted, error: insertError } = await supabase.from("leaderboard_entries").insert({
      challenge_id: challengeId, client_id: clientId, display_name: displayName,
      final_score: finalScore, efficiency, elapsed_seconds: elapsedSeconds,
      penalty_points: penaltyPoints, player_points: playerPoints, perfect_score: perfectScore,
      perfect_prompt_picks: perfectPromptPicks
    }).select("*").single();
    if (insertError) throw insertError;

    const completedAt = new Date().toISOString();
    const { error: updateError } = await supabase.from("leaderboard_attempts").update({ completed: true, completed_at: completedAt, last_activity_at: completedAt }).eq("id", attemptId);
    if (updateError) throw updateError;

    const ranked = await getRankedRows(supabase, challengeId);
    const rank = ranked.findIndex(row => String(row.client_id) === clientId) + 1;
    return json({ ...publicRow(inserted, rank || ranked.length, clientId), alreadySubmitted: false });
  } catch (error) { return errorResponse(error); }
});
