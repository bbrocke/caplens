# CapLens

CapLens is an NHL salary cap and contract comparison tool. It shows each
team's gross loaded cap-hit total against the $95.5M Upper Limit and lets you
compare individual player contracts side by side.

This is not official cap-space accounting — it excludes adjustments such as
LTIR, retained salary, and dead cap.

## Getting started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env.local` and fill in your Supabase project
   credentials:

   ```bash
   cp .env.example .env.local
   ```

   - `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — used by
     the app at request time.
   - `SUPABASE_SECRET_KEY` — server-side only, used by the data sync scripts
     below. Never expose this to the client.

3. Run the dev server:

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) to see the roster
   dashboard, and `/compare` for the player comparison tool.

## Data pipeline

Player rosters and contracts are synced into Supabase from external sources
via the scripts in `scripts/`:

- `npm run sync:rosters` — pulls current rosters for all 32 teams from the
  NHL API (`api-web.nhle.com`) and upserts them into the `players` table.
- `npm run sync:contracts` — scrapes active contracts from
  [thestanleycap.com](https://thestanleycap.com) and reconciles them against
  synced players. Runs as a dry run by default; pass `--apply` to write
  matched contracts to the `contracts` table.
- `npm run validate:contracts` — runs integrity checks against the synced
  data (record counts, orphaned contracts, missing provenance, etc.) and
  prints per-team gross roster-contract totals.

Before the first roster sync, run the SQL in `scripts/prepare-roster-sync.sql`
and `scripts/add-status-classification.sql` against your Supabase project
(SQL Editor) to set up the required columns, constraints, and the Utah
Mammoth team record.

## Learn more

This project is built with [Next.js](https://nextjs.org) and
[Supabase](https://supabase.com). See the
[Next.js documentation](https://nextjs.org/docs) for framework details.
