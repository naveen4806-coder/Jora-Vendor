# Jora Vendor Portal

## Start

1. Run `npm install`.
2. Copy `.env.example` to `.env`, then enter your Supabase URL and publishable key.
3. Run `supabase/schema.sql` in the Supabase SQL Editor.
4. Open `index.html` with a local web server or deploy it as static hosting.

## Important migration note

This folder contains the existing, working vendor portal and the Supabase package, client, and database schema. The portal's current live data calls are still Firebase calls. Do not delete Firebase or deploy this as a Supabase replacement until the Firebase data and every data call in `index.html` have been migrated and tested against the new Supabase tables.

Do not commit `.env`. Git ignores it; `.env.example` is the safe template to commit.
