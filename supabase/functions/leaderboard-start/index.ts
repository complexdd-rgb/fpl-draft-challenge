import { adminClient, bodyJson, errorResponse, httpError, json, loadVerifier, preflight, requireBrowserKey, text } from "../_shared/backend.ts";

Deno.serve(async (req) => {
  const options = preflight(req); if (options) return options;
  try {
    requireBrowserKey(req);
    const body = await bodyJson(req);
    const challengeId = text(body.challengeId, 100);
    const challengeDate = text(body.challengeDate, 10);
    const clientId = text(body.clientId, 120);
    if (!challengeId || clientId.length < 8) throw httpError(400, "challengeId and clientId are required.");

    const supabase = adminClient();
    const verifier = await loadVerifier(supabase, challengeId);
    if (challengeDate && verifier.releaseDate && challengeDate !== verifier.releaseDate) throw httpError(400, "Challenge date does not match verifier.");

    const { data: existing, error: existingError } = await supabase
      .from("leaderboard_attempts")
      .select("id, started_at, completed")
      .eq("challenge_id", challengeId)
      .eq("client_id", clientId)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing) return json({ attemptId: existing.id, startedAt: existing.started_at, alreadyCompleted: Boolean(existing.completed) });

    const { data, error } = await supabase
      .from("leaderboard_attempts")
      .insert({ challenge_id: challengeId, client_id: clientId })
      .select("id, started_at, completed")
      .single();
    if (error) {
      // Two simultaneous start requests can race the unique constraint. Recover the winner.
      const { data: raced } = await supabase.from("leaderboard_attempts").select("id, started_at, completed").eq("challenge_id", challengeId).eq("client_id", clientId).maybeSingle();
      if (raced) return json({ attemptId: raced.id, startedAt: raced.started_at, alreadyCompleted: Boolean(raced.completed) });
      throw error;
    }
    return json({ attemptId: data.id, startedAt: data.started_at, alreadyCompleted: Boolean(data.completed) });
  } catch (error) { return errorResponse(error); }
});
