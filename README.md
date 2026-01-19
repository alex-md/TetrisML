# TetrisML

A real-time Tetris genetic algorithm “aquarium.” Watch agents evolve, track lineage and telemetry, and persist progress across sessions.

## Features
- Live simulation with population stats, diversity tracking, and auto-tuning mutation.
- Dedicated Web Worker keeps the UI responsive during heavy evolution cycles.
- Visual tooling: neural maps, telemetry, lineage tree, timeline snapshots, and high scores.
- Persistence to both `localStorage` and a Cloudflare Worker + KV backend.

## Tech Stack
- React + TypeScript + Vite
- Web Worker simulation engine (`services/simulation/simulation.worker.ts`)
- Cloudflare Worker backend (`backend/src/index.js`) with KV storage
- Recharts for charts, Lucide for icons, custom CSS

## Project Structure
- `App.tsx` — app shell, routes, persistence, worker wiring
- `components/` — shared UI elements
- `pages/` — page-level views (Arena, Telemetry, Lineage, etc.)
- `services/simulation/` — Tetris engine + genetic algorithm
- `backend/` — Cloudflare Worker and Wrangler config
- `public/` — static assets
- `dist/` — production build output (generated)

## Local Development
Frontend (root):
```bash
npm install
npm run dev
```

Backend (Cloudflare Worker):
```bash
cd backend
npm install
npm run dev
```
The worker defaults to `http://localhost:8787`. Update `API_BASE` in `App.tsx` if you want the frontend to use the local worker.

Production build preview:
```bash
npm run build
npm run preview
```

## Persistence & API
The frontend stores local state under `TetrisML-population-v1` and syncs to the Worker API:
- `GET /api/state` — fetch persisted population state
- `POST /api/state` — save state (JSON payload, 5MB max)
- `POST /api/reset` — clear persisted state

## Deployment (Cloudflare)
Backend:
1. `npx wrangler login`
2. Create a KV namespace in the Cloudflare dashboard.
3. Update `backend/wrangler.toml` with the KV `id` and `preview_id` (binding name is `KV`).
4. Deploy: `cd backend && npm run deploy`

Frontend:
1. `npm run build`
2. Deploy `dist/` (e.g., Cloudflare Pages via `npx wrangler pages deploy dist`)
