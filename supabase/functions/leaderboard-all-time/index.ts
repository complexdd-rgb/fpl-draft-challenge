import { adminClient, bodyJson, errorResponse, json, preflight, requireBrowserKey, resolveIdentity, text } from "../_shared/backend.ts";

type AllTimeRow = Record<string, unknown>;

function rounded(value: unknown) {
  const number = Number(value) || 0;
  return Math.round(number * 10) / 10;
}

function publicAllTimeRow(row: AllTimeRow, currentIdentityId = "") {
  return {
    displayName: String(row.display_name || "Player"),
    rank: Number(row.all_time_rank) || 0,
    allTimeScore: rounded(row.all_time_score),
    gamesPlayed: Number(row.games_played) || 0,
    averageEfficiency: rounded(row.average_efficiency),
    wins: Number(row.wins) || 0,
    podiums: Number(row.podiums) || 0,
    bestRank: Number(row.best_rank) || 0,
    isCurrentDevice: Boolean(currentIdentityId && String(row.client_id) === currentIdentityId)
  };
}

Deno.serve(async (req) => {
  const options = preflight(req); if (options) return options;
  try {
    requireBrowserKey(req);
    const body = await bodyJson(req);
    const clientId = text(body.clientId, 120);
    const limit = Math.max(1, Math.min(100, Number(body.limit) || 50));
    const supabase = adminClient();
    const identity = await resolveIdentity(req, supabase, clientId, { allowEmpty: true });

    const { data, error, count } = await supabase
      .from("leaderboard_all_time")
      .select("client_id, display_name, games_played, all_time_score, average_efficiency, wins, podiums, best_rank, all_time_rank", { count: "exact" })
      .order("all_time_rank", { ascending: true })
      .range(0, limit - 1);
    if (error) throw error;

    let viewer: ReturnType<typeof publicAllTimeRow> | null = null;
    if (identity.allTimeClientId) {
      const { data: viewerRow, error: viewerError } = await supabase
        .from("leaderboard_all_time")
        .select("client_id, display_name, games_played, all_time_score, average_efficiency, wins, podiums, best_rank, all_time_rank")
        .eq("client_id", identity.allTimeClientId)
        .maybeSingle();
      if (viewerError) throw viewerError;
      if (viewerRow) viewer = publicAllTimeRow(viewerRow as AllTimeRow, identity.allTimeClientId);
    }

    return json({
      totalPlayers: Number(count) || 0,
      entries: (data || []).map(row => publicAllTimeRow(row as AllTimeRow, identity.allTimeClientId)),
      viewer,
      accountLinked: identity.authenticated,
      scoring: {
        dailyMaximum: 100,
        description: "All-Time Score is the sum of verified daily efficiency percentages."
      }
    });
  } catch (error) { return errorResponse(error); }
});
