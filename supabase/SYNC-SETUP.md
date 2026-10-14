# Connect vendor products to the user page

1. Run `user-project-schema.sql` in the **user** Supabase SQL Editor.
2. Deploy `functions/sync-marketplace` to the **vendor** Supabase project.
3. In vendor project Edge Function Secrets, set `USER_SUPABASE_URL` and `USER_SUPABASE_SERVICE_ROLE_KEY` for the user project.
4. In the user page, read `market_shops` and `market_products` from its own Supabase project.

The service role key is only an Edge Function secret. Never add it to HTML, JavaScript, or `.env.example`.
