# Supabase leaderboard setup

The public repository contains only the schema and Edge Function source. Private challenge verifier maps must never be committed to GitHub.

## Deploy

1. Push the `supabase/` folder to the production branch linked to Supabase.
2. In Supabase GitHub Integration, enable **Deploy to production** so new migrations and declared Edge Functions deploy automatically.
3. Run the separately supplied private verifier seed SQL in the Supabase SQL Editor. Do **not** upload that seed file to GitHub.
4. Browser configuration is already populated for project `sacfscnhvmfvbazbfgji` and the leaderboard is enabled in `js/leaderboard-config.js`.
5. After deployment, open Studio/Admin and run the leaderboard health/status check. If the Edge Functions have not deployed yet, the public site may report the leaderboard as temporarily unavailable until they are live.

The secret/server key stays inside Supabase Edge Functions and must never be placed in the browser or repository.
