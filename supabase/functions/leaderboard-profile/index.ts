import { adminClient, bodyJson, errorResponse, getRankedRows, httpError, json, preflight, requireBrowserKey, resolveIdentity, text } from "../_shared/backend.ts";

type Row = Record<string, unknown>;

const rounded = (value: unknown) => Math.round((Number(value) || 0) * 10) / 10;
const isoDate = (value: unknown) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || "")) ? String(value) : "";

function ukDateToday() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const map = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function dayNumber(date: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return NaN;
  return Math.floor(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / 86400000);
}

function streaks(dates: string[]) {
  const unique = [...new Set(dates.filter(Boolean))].sort();
  if (!unique.length) return { current: 0, longest: 0 };

  let longest = 1;
  let run = 1;
  for (let index = 1; index < unique.length; index += 1) {
    if (dayNumber(unique[index]) - dayNumber(unique[index - 1]) === 1) run += 1;
    else run = 1;
    longest = Math.max(longest, run);
  }

  let recentRun = 1;
  for (let index = unique.length - 1; index > 0; index -= 1) {
    if (dayNumber(unique[index]) - dayNumber(unique[index - 1]) !== 1) break;
    recentRun += 1;
  }

  const latest = unique[unique.length - 1];
  const gapFromToday = dayNumber(ukDateToday()) - dayNumber(latest);
  const current = gapFromToday >= 0 && gapFromToday <= 1 ? recentRun : 0;
  return { current, longest };
}

async function accountEntries(supabase: ReturnType<typeof adminClient>, clientIds: string[]) {
  const pageSize = 1000;
  const rows: Row[] = [];
  if (!clientIds.length) return rows;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("leaderboard_entries")
      .select("challenge_id, client_id, display_name, final_score, efficiency, elapsed_seconds, penalty_points, player_points, perfect_score, perfect_prompt_picks, created_at")
      .in("client_id", clientIds)
      .order("created_at", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const batch = (data || []) as Row[];
    rows.push(...batch);
    if (batch.length < pageSize) break;
  }
  return rows;
}

async function verifierMeta(supabase: ReturnType<typeof adminClient>, challengeIds: string[]) {
  const map = new Map<string, Row>();
  for (let start = 0; start < challengeIds.length; start += 100) {
    const batch = challengeIds.slice(start, start + 100);
    const { data, error } = await supabase
      .from("leaderboard_verifiers")
      .select("challenge_id, release_date, challenge_number, title, perfect_score")
      .in("challenge_id", batch);
    if (error) throw error;
    for (const row of data || []) map.set(String(row.challenge_id || ""), row as Row);
  }
  return map;
}

Deno.serve(async (req) => {
  const options = preflight(req); if (options) return options;
  try {
    requireBrowserKey(req);
    const body = await bodyJson(req);
    const clientId = text(body.clientId, 120);
    const recentLimit = Math.max(5, Math.min(20, Number(body.recentLimit) || 12));
    const supabase = adminClient();
    const identity = await resolveIdentity(req, supabase, clientId);
    if (!identity.authenticated) throw httpError(401, "Sign in to view your synced player profile.");

    const { data: allTime, error: allTimeError } = await supabase
      .from("leaderboard_all_time")
      .select("display_name, games_played, all_time_score, average_efficiency, wins, podiums, best_rank, all_time_rank")
      .eq("client_id", identity.allTimeClientId)
      .maybeSingle();
    if (allTimeError) throw allTimeError;

    const rawEntries = await accountEntries(supabase, identity.memberClientIds);
    const earliestByChallenge = new Map<string, Row>();
    for (const row of rawEntries) {
      const challengeId = String(row.challenge_id || "");
      if (challengeId && !earliestByChallenge.has(challengeId)) earliestByChallenge.set(challengeId, row);
    }
    const entries = [...earliestByChallenge.values()];
    const challengeIds = entries.map(row => String(row.challenge_id || "")).filter(Boolean);
    const metadata = await verifierMeta(supabase, challengeIds);

    const datedEntries = entries.map(row => {
      const meta = metadata.get(String(row.challenge_id || "")) || {};
      return {
        row,
        challengeId: String(row.challenge_id || ""),
        releaseDate: isoDate(meta.release_date),
        challengeNumber: Number(meta.challenge_number) || 0,
        title: String(meta.title || "Daily Challenge")
      };
    }).sort((a, b) => String(b.releaseDate).localeCompare(String(a.releaseDate)) || String(b.row.created_at || "").localeCompare(String(a.row.created_at || "")));

    const efficiencies = entries.map(row => Number(row.efficiency) || 0);
    const scores = entries.map(row => Number(row.final_score) || 0);
    const elapsed = entries.map(row => Number(row.elapsed_seconds)).filter(Number.isFinite);
    const streak = streaks(datedEntries.map(item => item.releaseDate));
    const latestRow = datedEntries[0]?.row || null;

    const recent = await Promise.all(datedEntries.slice(0, recentLimit).map(async item => {
      const ranked = await getRankedRows(supabase, item.challengeId);
      const targetClientId = String(item.row.client_id || "");
      const rankIndex = ranked.findIndex(row => String(row.client_id || "") === targetClientId);
      return {
        challengeId: item.challengeId,
        challengeNumber: item.challengeNumber,
        releaseDate: item.releaseDate,
        title: item.title,
        finalScore: Number(item.row.final_score) || 0,
        perfectScore: Number(item.row.perfect_score) || Number(metadata.get(item.challengeId)?.perfect_score) || 0,
        efficiency: rounded(item.row.efficiency),
        elapsedSeconds: Number(item.row.elapsed_seconds) || 0,
        penaltyPoints: Number(item.row.penalty_points) || 0,
        perfectPromptPicks: Number(item.row.perfect_prompt_picks) || 0,
        rank: rankIndex >= 0 ? rankIndex + 1 : 0
      };
    }));

    return json({
      accountLinked: true,
      profile: {
        displayName: String(allTime?.display_name || latestRow?.display_name || "Player"),
        gamesPlayed: Number(allTime?.games_played) || entries.length,
        allTimeRank: Number(allTime?.all_time_rank) || 0,
        allTimeScore: rounded(allTime?.all_time_score),
        averageEfficiency: rounded(allTime?.average_efficiency),
        wins: Number(allTime?.wins) || 0,
        podiums: Number(allTime?.podiums) || 0,
        bestRank: Number(allTime?.best_rank) || 0,
        bestScore: scores.length ? Math.max(...scores) : 0,
        bestEfficiency: efficiencies.length ? rounded(Math.max(...efficiencies)) : 0,
        fastestSeconds: elapsed.length ? Math.min(...elapsed) : 0,
        perfectPromptPicks: entries.reduce((sum, row) => sum + (Number(row.perfect_prompt_picks) || 0), 0),
        penaltyFreeGames: entries.filter(row => (Number(row.penalty_points) || 0) === 0).length,
        totalPenaltyPoints: entries.reduce((sum, row) => sum + (Number(row.penalty_points) || 0), 0),
        currentStreak: streak.current,
        longestStreak: streak.longest
      },
      recent
    });
  } catch (error) { return errorResponse(error); }
});
