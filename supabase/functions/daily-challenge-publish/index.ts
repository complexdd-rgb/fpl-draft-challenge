import { adminClient, bodyJson, errorResponse, httpError, json, preflight, requireBrowserKey, text } from "../_shared/backend.ts";

function bearerToken(req: Request) {
  const value = req.headers.get("authorization") || "";
  const match = /^Bearer\s+(.+)$/i.exec(value.trim());
  return match?.[1]?.trim() || "";
}

function isIsoDate(value: unknown) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
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
  if (!Number.isInteger(challengeNumber) || challengeNumber < 1) throw httpError(400, `Challenge ${releaseDate} has an invalid number.`);
  if (!title) throw httpError(400, `Challenge ${releaseDate} is missing its title.`);
  if (!Number.isFinite(perfectScore) || perfectScore < 0) throw httpError(400, `Challenge ${releaseDate} has an invalid perfect score.`);
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
    promptIds.add(promptId);
  }

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
    if (adminError) throw adminError;
    if (!adminRow) throw httpError(403, "This account is not allowed to publish daily challenges.");

    const body = await bodyJson(req);
    const action = text(body.action, 30) || "status";

    if (action === "status") {
      const today = londonDateKey();
      const { data, error } = await supabase
        .from("daily_challenge_schedule")
        .select("release_date, challenge_id, title, perfect_score, published_at")
        .eq("active", true)
        .gte("release_date", today)
        .order("release_date", { ascending: true })
        .limit(31);
      if (error) throw error;
      return json({ admin: true, today, scheduled: data || [] });
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
    if (publishError) throw publishError;

    return json({
      published: Number(published) || ordered.length,
      firstDate: ordered[0].releaseDate,
      lastDate: ordered[ordered.length - 1].releaseDate
    });
  } catch (error) { return errorResponse(error); }
});
