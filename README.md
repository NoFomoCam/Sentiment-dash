# Market Sentiment Console

Contrarian market sentiment dashboard for SPX/NDX products (futures, options, ETFs).

## Setup

1. Clone this repo
2. Copy `.env.local.example` to `.env.local` and add your keys
3. Run the SQL in `supabase-schema.sql` in your Supabase SQL Editor
4. `npm install`
5. `npm run dev`

## Deploy to Vercel

1. Push to GitHub
2. Connect repo in Vercel dashboard
3. Add environment variables in Vercel project settings
4. Deploy

## Tech Stack

- Next.js 14 (React)
- TradingView Lightweight Charts
- Supabase (PostgreSQL)
- Tailwind CSS
