# One Supabase project for all Jora apps

1. In the `jorra-delivery` Supabase project, run `JORA-SINGLE-PROJECT.sql` in SQL Editor.
2. Deploy `functions/sync-marketplace` to that same project.
3. No cross-project URL or secret is required. Remove `USER_SUPABASE_URL` and `USER_SUPABASE_SERVICE_ROLE_KEY` from Edge Function Secrets.
4. Configure the user, vendor, delivery-partner, and admin apps with the same Project URL and publishable key.
5. The user-facing app reads `market_shops` and `market_products` from this shared project.

Never place an `sb_secret_` key or service-role key in HTML, browser JavaScript, or a committed `.env` file.
