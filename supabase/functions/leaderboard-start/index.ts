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

    // An accepted result is account-wide: once any linked browser has submitted, no
    // second official result may be started or submitted for the same challenge.
    const { data: existingEntry, error: entryError } = await supabase
      .from("leaderboard_entries")
      .select("created_at")
      .eq("challenge_id", challengeId)
      .in("client_id", identity.memberClientIds)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (entryError) throw entryError;
    if (existingEntry) return json({ attemptId: "", startedAt: existingEntry.created_at, alreadyCompleted: true });

    // Timing is browser-run specific, not account-wide. Previously this lookup used
    // every linked device and therefore reused the earliest attempt from any device.
    // Opening the challenge on a phone in the morning could then make a later desktop
    // run appear to take hours. Keep duplicate-result protection account-wide above,
    // but bind the active timer to the browser that is actually making this run.
    const { data: existing, error: existingError } = await supabase
      .from("leaderboard_attempts")
      .select("id, started_at, completed")
      .eq("challenge_id", challengeId)
      .eq("client_id", identity.requestClientId)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing) return json({ attemptId: existing.id, startedAt: existing.started_at, alreadyCompleted: Boolean(existing.completed) });

    const { data, error } = await supabase
      .from("leaderboard_attempts")
      .insert({ challenge_id: challengeId, client_id: identity.requestClientId })
      .select("id, started_at, completed")
      .single();
    if (error) {
      // Simultaneous first-interaction requests on this browser can race the uniqueness
      // rule. Recover only this browser's attempt; never borrow another linked device's
      // timer.
      const { data: raced } = await supabase
        .from("leaderboard_attempts")
        .select("id, started_at, completed")
        .eq("challenge_id", challengeId)
        .eq("client_id", identity.requestClientId)
        .maybeSingle();
      if (raced) return json({ attemptId: raced.id, startedAt: raced.started_at, alreadyCompleted: Boolean(raced.completed) });
      throw error;
    }
    return json({ attemptId: data.id, startedAt: data.started_at, alreadyCompleted: Boolean(data.completed) });
  } catch (error) { return errorResponse(error); }
});
