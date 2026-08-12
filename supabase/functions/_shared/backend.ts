import { createClient } from "npm:@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store"
};

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: corsHeaders });
}

export function preflight(req: Request) {
  return req.method === "OPTIONS" ? new Response("ok", { headers: corsHeaders }) : null;
}

function parseKeyDictionary(raw: string | undefined) {
  if (!raw) return [] as string[];
  try {
    const value = JSON.parse(raw);
    if (value && typeof value === "object") return Object.values(value).filter(v => typeof v === "string") as string[];
  } catch {}
  return [] as string[];
}

export function requireBrowserKey(req: Request) {
  const provided = req.headers.get("apikey") || "";
  const allowed = [
    ...parseKeyDictionary(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") || undefined),
    Deno.env.get("SUPABASE_ANON_KEY") || ""
  ].filter(Boolean);
  // Hosted projects expose at least one browser-safe key to Edge Functions. If a local
  // environment omits them, do not accidentally block local development.
  if (allowed.length && !allowed.includes(provided)) throw httpError(401, "Invalid browser API key.");
}

export function adminClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const secretDictionary = parseKeyDictionary(Deno.env.get("SUPABASE_SECRET_KEYS") || undefined);
  const secret = secretDictionary[0] || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !secret) throw new Error("Supabase server credentials are unavailable.");
  return createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function httpError(status: number, message: string) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

export function errorResponse(error: unknown) {
  const status = Number((error as { status?: number })?.status) || 500;
  const message = error instanceof Error ? error.message : "Unexpected leaderboard error.";
  console.error(error);
  return json({ error: message, message }, status);
}

export async function bodyJson(req: Request) {
  if (req.method !== "POST") throw httpError(405, "POST required.");
  try { return await req.json(); } catch { throw httpError(400, "Invalid JSON body."); }
}

export function text(value: unknown, max = 120) {
  return String(value ?? "").trim().slice(0, max);
}

export function validDisplayName(value: unknown) {
  const name = text(value, 20);
  return name.length >= 2 && name.length <= 20 && /^[\p{L}\p{N} _.-]+$/u.test(name) ? name : "";
}

export type ResolvedIdentity = {
  requestClientId: string;
  storageClientId: string;
  allTimeClientId: string;
  memberClientIds: string[];
  authenticated: boolean;
  userId: string;
};

function bearerToken(req: Request) {
  const value = req.headers.get("authorization") || "";
  const match = /^Bearer\s+(.+)$/i.exec(value.trim());
  return match?.[1]?.trim() || "";
}

// Guest requests keep their existing browser client id. If a valid Supabase Auth token
// is present, the server maps the user to a private stable leaderboard id and links the
// current browser id to that account. The private account id is never returned publicly.
export async function resolveIdentity(
  req: Request,
  supabase: ReturnType<typeof adminClient>,
  rawClientId: unknown,
  options: { allowEmpty?: boolean } = {}
): Promise<ResolvedIdentity> {
  const requestClientId = text(rawClientId, 120);
  if (!requestClientId && options.allowEmpty) {
    return { requestClientId: "", storageClientId: "", allTimeClientId: "", memberClientIds: [], authenticated: false, userId: "" };
  }
  if (requestClientId.length < 8) throw httpError(400, "A valid browser client id is required.");

  const token = bearerToken(req);
  if (!token) {
    return {
      requestClientId,
      storageClientId: requestClientId,
      allTimeClientId: requestClientId,
      memberClientIds: [requestClientId],
      authenticated: false,
      userId: ""
    };
  }

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  const user = userData?.user;
  if (userError || !user) throw httpError(401, "Your account session is no longer valid. Please sign in again.");

  let { data: identityRow, error: identityError } = await supabase
    .from("leaderboard_account_identities")
    .select("identity_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (identityError) throw identityError;

  if (!identityRow) {
    const { error: insertIdentityError } = await supabase
      .from("leaderboard_account_identities")
      .insert({ user_id: user.id });
    if (insertIdentityError && String((insertIdentityError as { code?: string })?.code || "") !== "23505") throw insertIdentityError;
    const recovered = await supabase
      .from("leaderboard_account_identities")
      .select("identity_id")
      .eq("user_id", user.id)
      .single();
    if (recovered.error) throw recovered.error;
    identityRow = recovered.data;
  }

  const { data: existingDevice, error: deviceLookupError } = await supabase
    .from("leaderboard_account_devices")
    .select("user_id")
    .eq("client_id", requestClientId)
    .maybeSingle();
  if (deviceLookupError) throw deviceLookupError;
  if (existingDevice && String(existingDevice.user_id) !== user.id) {
    throw httpError(409, "This browser profile is already linked to a different FPL Draft account.");
  }
  if (!existingDevice) {
    const { error: linkError } = await supabase
      .from("leaderboard_account_devices")
      .insert({ client_id: requestClientId, user_id: user.id });
    if (linkError && String((linkError as { code?: string })?.code || "") !== "23505") throw linkError;
    if (linkError) {
      const { data: racedDevice, error: racedError } = await supabase
        .from("leaderboard_account_devices")
        .select("user_id")
        .eq("client_id", requestClientId)
        .single();
      if (racedError) throw racedError;
      if (String(racedDevice.user_id) !== user.id) throw httpError(409, "This browser profile is already linked to a different FPL Draft account.");
    }
  }

  const { data: devices, error: devicesError } = await supabase
    .from("leaderboard_account_devices")
    .select("client_id")
    .eq("user_id", user.id);
  if (devicesError) throw devicesError;

  const identityId = String(identityRow.identity_id || "");
  if (!identityId) throw new Error("Account leaderboard identity could not be resolved.");
  const storageClientId = `acct:${identityId}`;
  const memberClientIds = [...new Set([storageClientId, ...(devices || []).map(row => text(row.client_id, 120)).filter(Boolean)])];

  return {
    requestClientId,
    storageClientId,
    allTimeClientId: identityId,
    memberClientIds,
    authenticated: true,
    userId: user.id
  };
}

export type AllowedPick = { playerId: string; season: string; points: number };
export type VerifierPrompt = { promptId: string; position: string; allowedCount: number; bestPoints: number; allowed: AllowedPick[] };
export type Verifier = {
  version: number;
  challengeId: string;
  challengeNumber: number;
  releaseDate: string;
  title: string;
  perfectScore: number;
  prompts: VerifierPrompt[];
};

export type PublicTeamPick = {
  promptId: string;
  playerId: string;
  season: string;
  points: number;
  position: string;
};

export async function loadVerifier(supabase: ReturnType<typeof adminClient>, challengeId: string) {
  const { data, error } = await supabase
    .from("leaderboard_verifiers")
    .select("challenge_id, release_date, perfect_score, payload, active")
    .eq("challenge_id", challengeId)
    .eq("active", true)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw httpError(404, "Leaderboard verifier is not available for this challenge.");
  const verifier = data.payload as Verifier;
  if (!verifier || verifier.challengeId !== challengeId || !Array.isArray(verifier.prompts)) {
    throw httpError(500, "Leaderboard verifier is invalid.");
  }
  return verifier;
}

// Supabase/PostgREST commonly caps a single response at 1,000 rows. Fetch the ordered
// ranking in deterministic pages so totals and personal ranks remain correct beyond
// the first 1,000 verified finishes.
export async function getRankedRows(supabase: ReturnType<typeof adminClient>, challengeId: string) {
  const pageSize = 1000;
  const rows: Record<string, unknown>[] = [];

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("leaderboard_entries")
      .select("challenge_id, client_id, display_name, final_score, efficiency, elapsed_seconds, penalty_points, player_points, perfect_score, perfect_prompt_picks, selections, created_at")
      .eq("challenge_id", challengeId)
      .order("final_score", { ascending: false })
      .order("elapsed_seconds", { ascending: true })
      .order("created_at", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;

    const batch = (data || []) as Record<string, unknown>[];
    rows.push(...batch);
    if (batch.length < pageSize) break;
  }

  return rows;
}

export function publicTeam(value: unknown): PublicTeamPick[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 11).map(raw => {
    const row = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
    return {
      promptId: text(row.promptId, 160),
      playerId: text(row.playerId, 160),
      season: text(row.season, 20),
      points: Number(row.points) || 0,
      position: text(row.position, 20)
    };
  }).filter(row => row.promptId && row.playerId && row.season);
}

export function publicRow(row: Record<string, unknown>, rank: number, currentClientIds: string | string[] = "", includeTeam = false) {
  const ids = new Set(Array.isArray(currentClientIds) ? currentClientIds : currentClientIds ? [currentClientIds] : []);
  return {
    challengeId: String(row.challenge_id || ""),
    displayName: String(row.display_name || "Player"),
    finalScore: Number(row.final_score) || 0,
    efficiency: Number(row.efficiency) || 0,
    elapsedSeconds: Number(row.elapsed_seconds) || 0,
    penaltyPoints: Number(row.penalty_points) || 0,
    playerPoints: Number(row.player_points) || 0,
    perfectScore: Number(row.perfect_score) || 0,
    perfectPromptPicks: Number(row.perfect_prompt_picks) || 0,
    rank,
    isCurrentDevice: ids.has(String(row.client_id || "")),
    ...(includeTeam ? { team: publicTeam(row.selections) } : {})
  };
}
