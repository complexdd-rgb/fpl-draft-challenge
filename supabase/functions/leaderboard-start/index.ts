import { adminClient, bodyJson, errorResponse, httpError, json, loadVerifier, preflight, requireBrowserKey, resolveIdentity, text } from "../_shared/backend.ts";

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
    const identity = await resolveIdentity(req, supabase, clientId);

    const { data: existingEntry, error: entryError } = await supabase
      .from("leaderboard_entries")
      .select("created_at")
      .eq("challenge_id", challengeId)
      .in("client_id", identity.memberClientIds)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (entryError) throw entryError;

    const { data: existing, error: existingError } = await supabase
      .from("leaderboard_attempts")
      .select("id, started_at, completed")
      .eq("challenge_id", challengeId)
      .in("client_id", identity.memberClientIds)
      .order("started_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing) return json({ attemptId: existing.id, startedAt: existing.started_at, alreadyCompleted: Boolean(existing.completed || existingEntry) });
    if (existingEntry) return json({ attemptId: "", startedAt: existingEntry.created_at, alreadyCompleted: true });

    const { data, error } = await supabase
      .from("leaderboard_attempts")
      .insert({ challenge_id: challengeId, client_id: identity.storageClientId })
      .select("id, started_at, completed")
      .single();
    if (error) {
      // Simultaneous requests can race the uniqueness rule. Recover whichever account/device request won.
      const { data: raced } = await supabase
        .from("leaderboard_attempts")
        .select("id, started_at, completed")
        .eq("challenge_id", challengeId)
        .in("client_id", identity.memberClientIds)
        .order("started_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (raced) return json({ attemptId: raced.id, startedAt: raced.started_at, alreadyCompleted: Boolean(raced.completed) });
      throw error;
    }
    return json({ attemptId: data.id, startedAt: data.started_at, alreadyCompleted: Boolean(data.completed) });
  } catch (error) { return errorResponse(error); }
});
