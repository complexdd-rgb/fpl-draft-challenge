import { adminClient, bodyJson, errorResponse, httpError, json, preflight, requireBrowserKey, text } from "../_shared/backend.ts";
import { validateGeneratedSource } from "../_shared/generated-source.ts";

function bearerToken(req: Request) {
  const value = req.headers.get("authorization") || "";
  const match = /^Bearer\s+(.+)$/i.exec(value.trim());
  return match?.[1]?.trim() || "";
}

function isIsoDate(value: unknown) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

function databaseError(error: unknown, operation: string) {
  const row = error && typeof error === "object" ? error as Record<string, unknown> : {};
  const message = text(row.message, 500) || text(row.details, 500) || text(row.hint, 500);
  return httpError(500, message ? `${operation}: ${message}` : `${operation} failed.`);
}

function londonDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const values = Object.fromEntries(parts.filter(part => part.type !== "literal").map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

// Exact rectangular assignment: one footballer per prompt, each used once.
// Seasons of the same footballer share a column, using their best allowed score.
function maximumUniqueScore(prompts: Array<Record<string, any>>) {
  const players = [...new Set(prompts.flatMap(prompt => prompt.allowed.map((row: any) => row.playerId)))];
  const n = prompts.length, m = players.length;
  if (m < n) return null;
  const weights = prompts.map(prompt => {
    const best = new Map<string, number>();
    for (const row of prompt.allowed) best.set(row.playerId, Math.max(best.get(row.playerId) ?? -Infinity, row.points));
    return players.map(id => best.has(id) ? -best.get(id)! : Infinity);
  });
  const u = Array(n + 1).fill(0), v = Array(m + 1).fill(0), owner = Array(m + 1).fill(0), way = Array(m + 1).fill(0);
  for (let i = 1; i <= n; i++) {
    owner[0] = i;
    let column = 0;
    const min = Array(m + 1).fill(Infinity), used = Array(m + 1).fill(false);
    do {
      used[column] = true;
      const row = owner[column];
      let delta = Infinity, next = 0;
      for (let j = 1; j <= m; j++) if (!used[j]) {
        const cost = weights[row - 1][j - 1] - u[row] - v[j];
        if (cost < min[j]) { min[j] = cost; way[j] = column; }
        if (min[j] < delta) { delta = min[j]; next = j; }
      }
      if (!Number.isFinite(delta)) return null;
      for (let j = 0; j <= m; j++) {
        if (used[j]) { u[owner[j]] += delta; v[j] -= delta; }
        else min[j] -= delta;
      }
      column = next;
    } while (owner[column]);
    do { const previous = way[column]; owner[column] = owner[previous]; column = previous; } while (column);
  }
  return v[0];
}

function verifyScoreProof(verifier: Record<string, any>, perfectScore: number) {
  const proof = verifier.perfectXi;
  if (!Array.isArray(proof) || proof.length !== 11 || verifier.calculatedPerfectScore !== perfectScore) throw httpError(400, "Perfect-score proof is missing or inconsistent.");
  const used = new Set<string>(), proofIds = new Set<string>();
  let total = 0;
  for (const pick of proof) {
    const prompt = verifier.prompts.find((row: any) => row.promptId === pick?.promptId);
    const allowed = prompt?.allowed.find((row: any) => row.playerId === pick?.playerId && row.season === pick?.season && row.points === pick?.points);
    if (!allowed || used.has(pick.playerId) || proofIds.has(pick.promptId)) throw httpError(400, "Perfect XI must contain eleven qualifying selections and unique footballers.");
    used.add(pick.playerId); proofIds.add(pick.promptId); total += allowed.points;
  }
  if (total !== perfectScore || maximumUniqueScore(verifier.prompts) !== perfectScore) throw httpError(400, "Perfect score does not match the independently calculated unique-player maximum.");
}

function validateChallenge(raw: unknown) {
  const item = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const releaseDate = text(item.releaseDate, 10);
  const challengeId = text(item.challengeId, 140);
  const challengeNumber = Number(item.challengeNumber) || 0;
  const title = text(item.title, 180);
  const difficulty = text(item.difficulty, 40) || "Mixed";
  const formation = text(item.formation, 20) || "4-4-2";
  const theme = text(item.theme, 80) || "Generated Mix";
  const perfectScore = Number(item.perfectScore);
  const sourceJs = String(item.sourceJs || "");
  const manifestEntry = item.manifestEntry && typeof item.manifestEntry === "object" ? item.manifestEntry as Record<string, unknown> : {};
  const verifier = item.verifier && typeof item.verifier === "object" ? item.verifier as Record<string, unknown> : {};

  if (!isIsoDate(releaseDate)) throw httpError(400, "Every published challenge needs a valid release date.");
  if (!challengeId || challengeId.length < 8) throw httpError(400, `Challenge ${releaseDate} is missing its id.`);
  if (!Number.isInteger(challengeNumber) || challengeNumber < 0) throw httpError(400, `Challenge ${releaseDate} has invalid legacy number metadata.`);
  if (!title) throw httpError(400, `Challenge ${releaseDate} is missing its title.`);
  if (!Number.isInteger(perfectScore) || perfectScore < 0 || perfectScore > 2147483647) throw httpError(400, `Challenge ${releaseDate} has an invalid perfect score.`);
  if (sourceJs.length < 100 || sourceJs.length > 500000 || !sourceJs.includes("window.FPL_DAILY_CHALLENGE")) {
    throw httpError(400, `Challenge ${releaseDate} has invalid generated source.`);
  }
  if (!sourceJs.includes(JSON.stringify(challengeId)) || !sourceJs.includes(JSON.stringify(releaseDate))) {
    throw httpError(400, `Challenge ${releaseDate} source does not match its metadata.`);
  }
  if (String(manifestEntry.date || "") !== releaseDate || String(manifestEntry.id || "") !== challengeId) {
    throw httpError(400, `Challenge ${releaseDate} manifest metadata does not match.`);
  }
  if (String(verifier.challengeId || "") !== challengeId || String(verifier.releaseDate || "") !== releaseDate) {
    throw httpError(400, `Challenge ${releaseDate} verifier metadata does not match.`);
  }
  if (Number(verifier.perfectScore) !== perfectScore || verifier.perfectScoreVerified !== true) {
    throw httpError(400, `Challenge ${releaseDate} verifier has not certified the perfect score.`);
  }
  if (!Array.isArray(verifier.prompts) || verifier.prompts.length !== 11) {
    throw httpError(400, `Challenge ${releaseDate} verifier must contain exactly 11 prompts.`);
  }

  const promptIds = new Set<string>();
  for (const prompt of verifier.prompts as Array<Record<string, unknown>>) {
    const promptId = text(prompt?.promptId, 180);
    const allowed = Array.isArray(prompt?.allowed) ? prompt.allowed : [];
    if (!promptId || promptIds.has(promptId) || !allowed.length) {
      throw httpError(400, `Challenge ${releaseDate} contains an invalid or duplicate verifier prompt.`);
    }
    const answerKeys = new Set<string>();
    for (const raw of allowed) {
      const row = raw as Record<string, unknown>;
      const key = `${row?.playerId}\u0000${row?.season}`;
      if (typeof row?.playerId !== "string" || !row.playerId.trim() || typeof row?.season !== "string" || !row.season.trim() || !Number.isInteger(row?.points) || Math.abs(Number(row.points)) > 2147483647 || answerKeys.has(key)) throw httpError(400, "Verifier contains malformed or duplicate allowed answers.");
      answerKeys.add(key);
    }
    if (Number(prompt.bestPoints) !== Math.max(...allowed.map(row => Number((row as Record<string, unknown>).points)))) throw httpError(400, "Verifier best-pick score does not match its allowed answers.");
    if (!["GK", "DEF", "MID", "FWD"].includes(String(prompt.position))) throw httpError(400, "Verifier prompt position is invalid.");
    promptIds.add(promptId);
  }

  verifyScoreProof(verifier, perfectScore);
  validateGeneratedSource(sourceJs, verifier);

  return {
    releaseDate,
    challengeId,
    challengeNumber,
    title,
    difficulty,
    formation,
    theme,
    perfectScore: Math.round(perfectScore),
    sourceJs,
    manifestEntry,
    verifier
  };
}

Deno.serve(async (req) => {
  const options = preflight(req); if (options) return options;
  try {
    requireBrowserKey(req);
    const token = bearerToken(req);
    if (!token) throw httpError(401, "Sign in before publishing daily challenges.");

    const supabase = adminClient();
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    const user = userData?.user;
    if (userError || !user) throw httpError(401, "Your account session is no longer valid. Sign in again.");

    const { data: adminRow, error: adminError } = await supabase
      .from("app_admin_users")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (adminError) throw databaseError(adminError, "Admin access check failed");
    if (!adminRow) throw httpError(403, "This account is not allowed to publish daily challenges.");

    const body = await bodyJson(req);
    const action = text(body.action, 30) || "status";

    if (action === "status") {
      const today = londonDateKey();
      const { data, error } = await supabase
        .from("daily_challenge_schedule")
        .select("release_date, challenge_id, challenge_number, title, difficulty, formation, theme, perfect_score, manifest_entry, published_at")
        .eq("active", true)
        .order("release_date", { ascending: true })
        .limit(400);
      if (error) throw databaseError(error, "Schedule status query failed");
      return json({ admin: true, today, scheduled: data || [] });
    }

    if (action === "remove") {
      const rawDates = Array.isArray(body.dates) ? body.dates : [];
      if (rawDates.length < 1 || rawDates.length > 14) throw httpError(400, "Remove between 1 and 14 scheduled dates at a time.");
      const dates = rawDates.map(value => text(value, 10));
      if (dates.some(value => !isIsoDate(value))) throw httpError(400, "Every removed challenge needs a valid release date.");
      if (new Set(dates).size !== dates.length) throw httpError(400, "The removal request contains duplicate dates.");
      const today = londonDateKey();
      if (dates.some(value => value <= today)) throw httpError(400, "Only future UK challenge dates can be removed.");

      const { data: removed, error: removeError } = await supabase.rpc("remove_daily_challenge_batch", {
        p_published_by: user.id,
        p_dates: dates
      });
      if (removeError) throw databaseError(removeError, "Schedule removal failed");

      const ordered = dates.slice().sort();
      return json({
        removed: Number(removed) || 0,
        firstDate: ordered[0],
        lastDate: ordered[ordered.length - 1]
      });
    }

    if (action !== "publish") throw httpError(400, "Unknown publishing action.");
    const rawChallenges = Array.isArray(body.challenges) ? body.challenges : [];
    if (rawChallenges.length < 1 || rawChallenges.length > 14) throw httpError(400, "Publish between 1 and 14 validated challenges at a time.");
    const challenges = rawChallenges.map(validateChallenge);
    const dates = new Set(challenges.map(item => item.releaseDate));
    const ids = new Set(challenges.map(item => item.challengeId));
    if (dates.size !== challenges.length || ids.size !== challenges.length) throw httpError(400, "The publishing batch contains duplicate dates or challenge ids.");

    const ordered = challenges.slice().sort((a, b) => a.releaseDate.localeCompare(b.releaseDate));
    for (let i = 1; i < ordered.length; i += 1) {
      const previous = new Date(`${ordered[i - 1].releaseDate}T12:00:00Z`);
      previous.setUTCDate(previous.getUTCDate() + 1);
      if (previous.toISOString().slice(0, 10) !== ordered[i].releaseDate) {
        throw httpError(400, "Published challenge dates must form one continuous calendar run.");
      }
    }

    const { data: published, error: publishError } = await supabase.rpc("publish_daily_challenge_batch", {
      p_published_by: user.id,
      p_challenges: ordered
    });
    if (publishError) throw databaseError(publishError, "Challenge publishing failed");

    return json({
      published: Number(published) || ordered.length,
      firstDate: ordered[0].releaseDate,
      lastDate: ordered[ordered.length - 1].releaseDate
    });
  } catch (error) { return errorResponse(error); }
});
