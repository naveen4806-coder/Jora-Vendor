# Jora Vendor Portal

## Start

1. Run `npm install`.
2. Copy `.env.example` to `.env`, then enter your Supabase URL and publishable key.
3. Run `supabase/schema.sql` in the Supabase SQL Editor.
4. Open `index.html` with a local web server or deploy it as static hosting.

## Important migration note

This folder contains the Jora vendor portal, Supabase client, database schema, and Supabase Edge Functions. Authentication and application data use Supabase; no Firebase project, SDK, or Firebase Functions deployment is required.

Do not commit `.env`. Git ignores it; `.env.example` is the safe template to commit.
