import { adminClient, bodyJson, errorResponse, getRankedRows, json, preflight, publicRow, requireBrowserKey, resolveIdentity, text } from "../_shared/backend.ts";

Deno.serve(async (req) => {
  const options = preflight(req); if (options) return options;
  try {
    requireBrowserKey(req);
    const body = await bodyJson(req);
    const challengeId = text(body.challengeId, 100);
    const clientId = text(body.clientId, 120);
    const limit = Math.max(1, Math.min(50, Number(body.limit) || 20));
    if (!challengeId) return json({ total: 0, entries: [], viewer: null, canViewTeams: false });

    const supabase = adminClient();
    const identity = await resolveIdentity(req, supabase, clientId, { allowEmpty: true });
    const rows = await getRankedRows(supabase, challengeId);
    const viewerIndex = identity.memberClientIds.length
      ? rows.findIndex(row => identity.memberClientIds.includes(String(row.client_id)))
      : -1;
    const canViewTeams = viewerIndex >= 0;
    const entries = rows.slice(0, limit).map((row, index) => publicRow(row, index + 1, identity.memberClientIds, canViewTeams));
    const viewer = viewerIndex >= 0 ? publicRow(rows[viewerIndex], viewerIndex + 1, identity.memberClientIds, true) : null;
    return json({ total: rows.length, entries, viewer, canViewTeams, accountLinked: identity.authenticated });
  } catch (error) { return errorResponse(error); }
});
