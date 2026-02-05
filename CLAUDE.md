# Gameday Bingo - Super Bowl LX Prediction Game

## Stack
- **Frontend:** React 19 + TypeScript + Vite
- **Backend:** Hono on Cloudflare Workers
- **Storage:** Cloudflare KV (namespace: GAME_KV)
- **Deployment:** Cloudflare Workers (wrangler deploy)

## Architecture
- `src/shared/` - Types and constants shared by worker + client
- `src/worker/` - Hono API server (routes, middleware, KV helpers)
- `src/react-app/` - React SPA (components, hooks, API client, styles)
- All state managed in App.tsx (no external state library)
- 8-second polling for live updates on active tabs

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
- `POST /api/players` - Submit picks (public, validates duplicates)
- `DELETE /api/players/:name` - Remove player (admin)
- `POST /api/reset` - Reset all game data (admin)

## Key Conventions
- Admin auth: hardcoded code "kava60", validated server-side via X-Admin-Code header
- Duplicate player names are rejected (409), not replaced
- Player timestamps are server-generated
- CSS: Single App.css with BEM-style classes + CSS custom properties
- Components: Flat structure in src/react-app/components/
- All event data and tier configs live in src/shared/constants.ts
- Max 5 picks per player, one-shot lock-in (no editing)
- One entry per device enforced via localStorage flag ("sb-submitted")

## Development Notes
- Dev server must be exposed to WSL for local testing
- Always test locally before deploying (`npm run dev` then `npm run check`)
- After wrangler.json changes, run `npm run cf-typegen` to update worker types
- KV namespace ID must be set in wrangler.json before deploying (local dev uses emulated KV)
