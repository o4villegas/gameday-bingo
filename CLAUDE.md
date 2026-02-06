# Gameday Bingo - Super Bowl LX Prediction Game

## Stack
- **Frontend:** React 19 + TypeScript + Vite + Tailwind CSS v4 + shadcn/ui
- **Backend:** Hono on Cloudflare Workers
- **Storage:** Cloudflare KV (namespace: GAME_KV)
- **AI:** Cloudflare Workers AI (`@cf/meta/llama-3.3-70b-instruct-fp8-fast`)
- **Deployment:** Cloudflare Workers (wrangler deploy)

## Architecture
- `src/shared/` - Types, constants, and prize logic shared by worker + client
- `src/worker/` - Hono API server (routes, middleware, KV helpers, AI verification, ESPN fetcher)
- `src/react-app/` - React SPA (components, hooks, API client, styles)
- All state managed in App.tsx (no external state library)
- 8-second polling for live updates on active tabs
- 50 events across 5 periods (Q1, Q2, Q3, Q4, FG) — 10 per period
- 10 picks per player (exactly 2 per period), one-shot lock-in

## Commands
- `npm run dev` - Start local dev server (Vite + Workers)
- `npm run build` - TypeScript check + Vite build
- `npm run check` - Full validation (tsc + build + deploy dry-run)
- `npm run deploy` - Deploy to Cloudflare Workers
- `npm run cf-typegen` - Regenerate worker types after wrangler.json changes
- `npm run lint` - ESLint check

## API Endpoints
- `GET /api/events` - Event state (public)
- `PUT /api/events/:id` - Toggle event (admin: X-Admin-Code header)
- `GET /api/players` - All players (public)
- `POST /api/players` - Submit picks (public, validates 10 picks + 2 per period + duplicates)
- `DELETE /api/players/:name` - Remove player (admin)
- `POST /api/reset` - Reset all game data (admin)
- `POST /api/verify` - Trigger AI verification for a period (admin)
- `GET /api/verify/status` - Get pending/applied verification results (admin)
- `POST /api/verify/approve` - Apply AI results to event state (admin)
- `POST /api/verify/dismiss` - Discard pending verification result (admin)

## Prize Structure
- **Per-quarter:** If ANY of your picks in Q1/Q2/Q3/Q4 hit, earn 1x $3 YCI shell (max 4 shells). FG events don't earn quarter shells.
- **End-game:** Top 3 by correct count win tab discounts (1st: 20%, 2nd: 15%, 3rd: 10%). Ties broken by earliest submission timestamp.

## Tabs
- **RULES** - Landing page (default for new visitors), explains how to play
- **PICKS** - Event selection form (10 picks, 2 per period)
- **LIVE** - Real-time event board with auto-refresh
- **PRIZES** - Prize explanation + leaderboard
- **ADMIN** - Event toggles, AI verification panel, player management

## KV Keys
- `sb-events` - EventState (Record<string, boolean>)
- `sb-players` - Player[] array
- `sb-verification` - VerificationState (pending + applied results)
- `sb-game-state` - GameState (ESPN game ID, periods verified)

## Key Conventions
- Admin auth: hardcoded code "kava60", validated server-side via X-Admin-Code header
- Duplicate player names are rejected (409), not replaced
- Player timestamps are server-generated
- Tailwind CSS v4 + shadcn/ui (new-york preset) for styling
- Components: Flat structure in src/react-app/components/
- All event data and period configs live in src/shared/constants.ts
- ESPN_GAME_ID in constants.ts must be set before game day
- One entry per device enforced via localStorage flag ("sb-submitted")

## AI Verification
- Single inference call per quarter (not agentic loop): Worker fetches ESPN JSON API, feeds to Llama 3.3, gets structured response
- ESPN API: `site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event={gameId}` (no auth, JSON)
- Fallback: Admin can paste game summary text when ESPN API is unavailable
- Approve only sets events to `true`, never `false`. Admin retains manual toggle override.

## Development Notes
- Dev server must be exposed to WSL for local testing
- Always test locally before deploying (`npm run dev` then `npm run check`)
- After wrangler.json changes, run `npm run cf-typegen` to update worker types
- KV namespace ID must be set in wrangler.json before deploying (local dev uses emulated KV)
