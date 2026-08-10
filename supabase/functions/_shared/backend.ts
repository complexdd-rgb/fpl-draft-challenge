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

export async function getRankedRows(supabase: ReturnType<typeof adminClient>, challengeId: string) {
  const { data, error } = await supabase
    .from("leaderboard_entries")
    .select("challenge_id, client_id, display_name, final_score, efficiency, elapsed_seconds, penalty_points, player_points, perfect_score, perfect_prompt_picks, created_at")
    .eq("challenge_id", challengeId)
    .order("final_score", { ascending: false })
    .order("elapsed_seconds", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(1000);
  if (error) throw error;
  return data || [];
}

export function publicRow(row: Record<string, unknown>, rank: number, currentClientId = "") {
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
    isCurrentDevice: Boolean(currentClientId && String(row.client_id) === currentClientId)
  };
}
